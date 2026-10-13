// Shared constants and builders for the scenario gallery. Every quantity is SI
// (kg, m, s, m/s); angles given to `orbit` and `planet` are in degrees.
export const G = 6.67430e-11;
export const AU = 1.495978707e11;
export const day = 86400;
export const year = 365.25 * day;
export const sunMass = 1.98847e30;
export const earthMass = 5.972e24;
export const earthRadius = 6.378137e6;
export const earthJ2 = 1.08263e-3;
export const jupiterMass = 1.89813e27;
export const centralMass = 1e23;
const degree = Math.PI / 180;

export const body = (name, massKg, positionMeters, velocityMetersPerSecond) =>
  [name, massKg, positionMeters, velocityMetersPerSecond];
export const center = (name = 'Estrela', massKg = centralMass) => body(name, massKg, [0, 0, 0], [0, 0, 0]);

// Circular orbit around a primary at rest at the origin (phase and inclination in degrees).
export function orbiter(name, massKg, radiusMeters, phaseDegrees = 0,
  speedFactor = 1, inclinationDegrees = 0, primaryMassKg = centralMass) {
  const phase = phaseDegrees * degree;
  const inclination = inclinationDegrees * degree;
  const speed = speedFactor * Math.sqrt(G * primaryMassKg / radiusMeters);
  return body(name, massKg,
    [radiusMeters * Math.cos(phase),
      radiusMeters * Math.sin(phase) * Math.cos(inclination),
      radiusMeters * Math.sin(phase) * Math.sin(inclination)],
    [-speed * Math.sin(phase),
      speed * Math.cos(phase) * Math.cos(inclination),
      speed * Math.cos(phase) * Math.sin(inclination)]);
}

// Circular binary around its centre of mass at the origin, separated along x.
export function binary(massA, massB, separationMeters, names = ['Estrela A', 'Estrela B'], offset = null) {
  const total = massA + massB;
  const relativeSpeed = Math.sqrt(G * total / separationMeters);
  const [px, py, pz, vx, vy, vz] = offset ?? [0, 0, 0, 0, 0, 0];
  return [
    body(names[0], massA, [px - separationMeters * massB / total, py, pz], [vx, vy - relativeSpeed * massB / total, vz]),
    body(names[1], massB, [px + separationMeters * massA / total, py, pz], [vx, vy + relativeSpeed * massA / total, vz])
  ];
}

// A body given by Keplerian elements around an earlier body (meters and degrees).
export const orbit = (name, massKg, around, semiMajorAxisMeters, eccentricity = 0, angles = {}, extra = {}) => ({
  name, massKg, ...extra,
  orbit: { around, semiMajorAxisMeters, eccentricity, inclinationDegrees: angles.inclination ?? 0,
    ascendingNodeDegrees: angles.node ?? 0, argumentOfPeriapsisDegrees: angles.argument ?? 0,
    trueAnomalyDegrees: angles.anomaly ?? 0 }
});

// True anomaly (degrees) for a mean anomaly (degrees) on an elliptic orbit (Newton on Kepler's equation).
export function trueAnomaly(meanDegrees, eccentricity) {
  const mean = ((meanDegrees % 360) + 360) % 360 * degree;
  let eccentric = eccentricity < 0.8 ? mean : Math.PI;
  for (let i = 0; i < 50; i++) {
    const delta = (eccentric - eccentricity * Math.sin(eccentric) - mean) / (1 - eccentricity * Math.cos(eccentric));
    eccentric -= delta;
    if (Math.abs(delta) < 1e-14) break;
  }
  const anomaly = 2 * Math.atan2(Math.sqrt(1 + eccentricity) * Math.sin(eccentric / 2),
    Math.sqrt(1 - eccentricity) * Math.cos(eccentric / 2));
  return anomaly / degree;
}

// Planet from heliocentric mean elements: a (AU), e, i, longitude of the node Ω, longitude of
// perihelion ϖ and mean longitude L (degrees), so ω = ϖ − Ω and the mean anomaly is L − ϖ.
export function planet(name, massKg, around, semiMajorAxisAu, eccentricity, inclination, node, perihelion,
  meanLongitude, extra = {}) {
  return orbit(name, massKg, around, semiMajorAxisAu * AU, eccentricity, {
    inclination, node, argument: perihelion - node,
    anomaly: trueAnomaly(meanLongitude - perihelion, eccentricity) }, extra);
}

// Deterministic pseudo-random sequence in [0, 1) so generated presets never change between loads.
export function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Velocity of a circular orbit of radius r around mass M, rotated to phase θ (degrees) in the xy plane.
export function circularVelocity(primaryMassKg, radiusMeters, phaseDegrees) {
  const speed = Math.sqrt(G * primaryMassKg / radiusMeters);
  return [-speed * Math.sin(phaseDegrees * degree), speed * Math.cos(phaseDegrees * degree), 0];
}

// view: 'rotating' opens the result in the frame co-rotating with the two heaviest bodies;
// fit: names of the bodies the camera frames (the others may fall outside the view);
// compare: true runs the integrator comparison once the result is loaded.
export function preset(label, category, description, bodies, options = {}) {
  return {
    label, category, description, gravity: String(G),
    softeningMeters: String(options.softeningMeters ?? 0),
    timeStepSeconds: String(options.timeStepSeconds ?? 15),
    steps: String(options.steps ?? 2600),
    sampleEverySteps: String(options.sampleEverySteps ?? 13),
    bodies,
    ...(options.integrator && { integrator: options.integrator }),
    ...(options.physics && { physics: options.physics }),
    ...(options.particleGroups && { particleGroups: options.particleGroups }),
    ...(options.maneuvers && { maneuvers: options.maneuvers }),
    ...(options.view && { view: options.view }),
    ...(options.fit && { fit: options.fit }),
    ...(options.compare && { compare: true })
  };
}
