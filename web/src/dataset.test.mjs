import test from 'node:test';
import assert from 'node:assert/strict';
import { appendSamples, createDataset, decodeParticles, energyDriftFromSamples, energyDriftSeries, frameIndexAtStep,
  fromApi, suggestedTimeStep } from './dataset.mjs';
import { parseNdjson } from './simulationClient.mjs';
import { impulseVector, orbitalFrame, withManeuver } from './sandbox.mjs';

const vector = (x, y, z) => ({ x, y, z });

function sample(step, { energy = -10, particles = null, active = true, suggested = null, events = [] } = {}) {
  return {
    step, timeSeconds: step * 2,
    diagnostics: { energyJoules: energy, kineticEnergyJoules: 5, potentialEnergyJoules: energy - 5,
      momentumKgMetersPerSecond: vector(0, 0, 0), angularMomentumKgSquareMetersPerSecond: vector(0, 0, 3) },
    bodies: [
      { name: 'A', massKg: 3, radiusMeters: 1, active: true, positionMeters: vector(0, 0, 0),
        velocityMetersPerSecond: vector(0, 0, 0), orbit: null },
      { name: 'B', massKg: 1, radiusMeters: 0, active, positionMeters: vector(4, 0, 0),
        velocityMetersPerSecond: vector(0, 1, 0), orbit: { reference: 'A', semiMajorAxisMeters: 4, eccentricity: 0 } }
    ],
    particles, events,
    report: { minSeparationMeters: 4, minDynamicalTimeSeconds: 1, suggestedTimeStepSeconds: suggested,
      massiveSuggestedTimeStepSeconds: suggested,
      collisions: 0, eventsDropped: 0 }
  };
}

function base64Floats(values) {
  const bytes = new Uint8Array(new Float32Array(values).buffer);
  return btoa(String.fromCharCode(...bytes));
}

test('decodifica posições de partículas em float32 base64', () => {
  const decoded = decodeParticles(base64Floats([1.5, -2, 3, NaN, 0, 0]));
  assert.equal(decoded.length, 6);
  assert.deepEqual([...decoded.slice(0, 3)], [1.5, -2, 3]);
  assert.ok(Number.isNaN(decoded[3]));
  assert.equal(decodeParticles(null), null);
});

test('monta quadros com órbita, centro dos corpos ativos e eventos', () => {
  const dataset = fromApi({ samples: [sample(0), sample(5, { active: false, energy: -9,
    events: [{ kind: 'collision', step: 3, timeSeconds: 6, body: 'B', other: 'A', distanceMeters: 1 }] })],
  particleGroups: [], particleCount: 0 });
  assert.deepEqual(dataset.names, ['A', 'B']);
  assert.equal(dataset.frames[0].center.x, 1, 'centro de massa com B ativo');
  assert.equal(dataset.frames[1].center.x, 0, 'B fundido não conta');
  assert.equal(dataset.frames[0].bodies.get('B').orbit.semiMajorAxisMeters, 4);
  assert.deepEqual(dataset.events[0], { kind: 'collision', step: 3, time: 6, body: 'B', other: 'A', distance: 1 });
  assert.deepEqual(energyDriftSeries(dataset), [0, 0.1]);
  assert.equal(dataset.diagnostics.get(0).lz, 3);
});

test('acumula amostras transmitidas e encontra o menor Δt sugerido', () => {
  let dataset = createDataset({ expectedSamples: 3 });
  dataset = appendSamples(dataset, [sample(0, { suggested: 5 })]);
  dataset = appendSamples(dataset, [sample(4, { suggested: 2 }), sample(8)]);
  assert.equal(dataset.frames.length, 3);
  assert.equal(suggestedTimeStep(dataset), 2);
  assert.equal(frameIndexAtStep(dataset, 5), 2);
  assert.equal(frameIndexAtStep(dataset, 0), 0);
});

test('separa linhas NDJSON mesmo quando chegam partidas', () => {
  const first = parseNdjson('{"type":"start"}\n{"type":"sam');
  assert.deepEqual(first.messages, [{ type: 'start' }]);
  const second = parseNdjson(first.rest + 'ple","sample":{"step":0}}\n');
  assert.deepEqual(second.messages, [{ type: 'sample', sample: { step: 0 } }]);
  assert.equal(second.rest, '');
});

test('impulso prógrado, radial e normal em uma órbita circular', () => {
  const frame = orbitalFrame({ x: 1, y: 0, z: 0, vx: 0, vy: 1, vz: 0 }, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
  assert.deepEqual(frame.prograde, [0, 1, 0]);
  assert.deepEqual(frame.normal, [0, 0, 1]);
  assert.deepEqual(frame.radial, [1, 0, 0], 'radial aponta para fora');
  assert.deepEqual(impulseVector(frame, { prograde: 2, radial: -1, normal: 3 }), [-1, 2, 3]);
  assert.equal(orbitalFrame({ x: 1, y: 0, z: 0, vx: 1, vy: 0, vz: 0 }, null), null, 'trajetória radial');
});

test('manobra do sandbox precisa ocorrer antes do último passo', () => {
  const scenario = { steps: 10, maneuvers: [{ body: 'A', step: 1, deltaVelocityMetersPerSecond: [0, 0, 0] }] };
  const next = withManeuver(scenario, { body: 'B', step: 9, deltaVelocityMetersPerSecond: [1, 0, 0] });
  assert.equal(next.maneuvers.length, 2);
  assert.equal(scenario.maneuvers.length, 1, 'cenário original intacto');
  assert.throws(() => withManeuver(scenario, { body: 'B', step: 10, deltaVelocityMetersPerSecond: [1, 0, 0] }),
    /Não há passos/);
});

test('amostras transmitidas crescem no lugar, sem copiar quadros a cada pedaço', () => {
  const first = appendSamples(createDataset({ expectedSamples: 3 }), [sample(0)]);
  const second = appendSamples(first, [sample(4)]);
  assert.notEqual(second, first, 'novo objeto para o React perceber a mudança');
  assert.equal(second.frames, first.frames, 'mesmo vetor de quadros');
  assert.equal(second.diagnostics, first.diagnostics);
  assert.deepEqual([first.revision, second.revision], [1, 2]);
  assert.equal(second.frames.length, 2);
  assert.equal(appendSamples(second, []), second, 'pedaço vazio não muda nada');
});

test('deriva de energia direto das amostras da API, como na comparação de integradores', () => {
  assert.deepEqual(energyDriftFromSamples([sample(0, { energy: -10 }), sample(4, { energy: -9 })]), [0, 0.1]);
  assert.deepEqual(energyDriftFromSamples([]), []);
});
