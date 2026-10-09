// Dataset model shared by the viewer: frames in time order, per-step diagnostics, events and
// particle groups. Built incrementally while a simulation streams in.

// The API sends little-endian float32, the byte order of every browser platform. Uint8Array.fromBase64
// decodes without the intermediate binary string where the browser supports it.
export function decodeParticles(base64) {
  if (!base64) return null;
  if (typeof Uint8Array.fromBase64 === 'function') return new Float32Array(Uint8Array.fromBase64(base64).buffer);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

function centerOfMass(bodies) {
  let mass = 0, x = 0, y = 0, z = 0;
  for (const item of bodies.values()) {
    if (!item.active || !(item.mass > 0)) continue;
    mass += item.mass; x += item.mass * item.x; y += item.mass * item.y; z += item.mass * item.z;
  }
  return mass > 0 ? { x: x / mass, y: y / mass, z: z / mass } : { x: 0, y: 0, z: 0 };
}

export function frameFromSample(sample) {
  const bodies = new Map(sample.bodies.map(item => [item.name, {
    name: item.name, mass: item.massKg, radius: item.radiusMeters ?? 0, active: item.active ?? true,
    x: item.positionMeters.x, y: item.positionMeters.y, z: item.positionMeters.z,
    vx: item.velocityMetersPerSecond.x, vy: item.velocityMetersPerSecond.y, vz: item.velocityMetersPerSecond.z,
    orbit: item.orbit ?? null
  }]));
  return { step: sample.step, time: sample.timeSeconds, bodies, center: centerOfMass(bodies),
    particles: typeof sample.particles === 'string' ? decodeParticles(sample.particles) : null,
    report: sample.report ?? null };
}

function diagnosticsFromSample(sample) {
  const d = sample.diagnostics;
  return { energy: d.energyJoules, kinetic: d.kineticEnergyJoules, potential: d.potentialEnergyJoules,
    px: d.momentumKgMetersPerSecond.x, py: d.momentumKgMetersPerSecond.y, pz: d.momentumKgMetersPerSecond.z,
    lx: d.angularMomentumKgSquareMetersPerSecond?.x ?? 0, ly: d.angularMomentumKgSquareMetersPerSecond?.y ?? 0,
    lz: d.angularMomentumKgSquareMetersPerSecond?.z ?? 0 };
}

export function createDataset({ particleGroups = [], particleCount = 0, expectedSamples = 0, scenario = null } = {}) {
  return { id: crypto.randomUUID(), revision: 0, frames: [], names: [], diagnostics: new Map(), events: [], particleGroups,
    particleCount, expectedSamples, scenario, complete: false };
}

// Appends the samples (frames and events stay in step order) and returns a new dataset object
// so React sees the change. The frame, diagnostic and event collections grow in place: copying
// them on every streamed chunk would cost O(n²) time and garbage over a run. Only the newest
// object of a run is meant to be read; `revision` counts the appended chunks.
export function appendSamples(dataset, samples) {
  if (!samples.length) return dataset;
  const { frames, diagnostics, events } = dataset;
  for (const sample of samples) {
    frames.push(frameFromSample(sample));
    diagnostics.set(sample.step, diagnosticsFromSample(sample));
    for (const item of sample.events ?? []) events.push({ kind: item.kind, step: item.step,
      time: item.timeSeconds, body: item.body, other: item.other ?? null, distance: item.distanceMeters ?? null });
  }
  return { ...dataset, revision: (dataset.revision ?? 0) + 1,
    names: dataset.names.length ? dataset.names : samples[0].bodies.map(item => item.name) };
}

// Relative energy drift computed straight from API samples, without building frames (used by the
// integrator comparison, which only needs this series).
export function energyDriftFromSamples(samples) {
  const initial = samples[0]?.diagnostics?.energyJoules;
  return samples.map(sample => {
    const energy = sample.diagnostics?.energyJoules;
    return Number.isFinite(energy) && initial ? (energy - initial) / Math.abs(initial) : null;
  });
}

export function fromApi(response, scenario = null) {
  if (!Array.isArray(response?.samples) || !response.samples.length)
    throw new Error('A API não retornou amostras.');
  const dataset = appendSamples(createDataset({ particleGroups: response.particleGroups ?? [],
    particleCount: response.particleCount ?? 0, expectedSamples: response.samples.length, scenario }),
  response.samples);
  return { ...dataset, complete: true };
}

// Smallest time step suggested for the massive bodies over all received samples, or null.
// Test particles are ignored: they cannot change the motion of the massive bodies.
export function suggestedTimeStep(dataset) {
  let best = null;
  for (const frame of dataset.frames) {
    const value = frame.report?.massiveSuggestedTimeStepSeconds;
    if (Number.isFinite(value) && value > 0 && (best === null || value < best)) best = value;
  }
  return best;
}

// Relative energy drift (E - E0) / |E0| per frame; null where undefined.
export function energyDriftSeries(dataset) {
  const initial = dataset.diagnostics.get(dataset.frames[0]?.step)?.energy;
  return dataset.frames.map(frame => {
    const energy = dataset.diagnostics.get(frame.step)?.energy;
    return Number.isFinite(energy) && initial ? (energy - initial) / Math.abs(initial) : null;
  });
}

// First frame index at or after a step (for seeking to an event).
export function frameIndexAtStep(dataset, step) {
  const frames = dataset.frames;
  let low = 0, high = frames.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (frames[middle].step < step) low = middle + 1; else high = middle;
  }
  return Math.max(0, low);
}
