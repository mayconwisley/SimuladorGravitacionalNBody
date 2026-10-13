import test from 'node:test';
import assert from 'node:assert/strict';
import { limits, presetDraft, presets, toScenario, fromScenario } from './scenario.mjs';

test('ao menos 20 cenários prontos têm metadados, limites e corpos distintos', () => {
  assert.ok(Object.keys(presets).length >= 20);
  const labels = new Set();
  for (const [key, preset] of Object.entries(presets)) {
    const scenario = toScenario(presetDraft(key));
    assert.ok(preset.label && preset.category && preset.description);
    assert.ok(!labels.has(preset.label));
    labels.add(preset.label);
    assert.ok(scenario.bodies.length <= 32);
    assert.ok(scenario.steps <= limits.steps);
    assert.ok(2 + Math.floor((scenario.steps - 1) / scenario.sampleEverySteps) <= 1001);
    if (scenario.softeningMeters === 0) {
      // Vector bodies must not share a position; orbit bodies must not share central body and elements.
      const placement = item => JSON.stringify(item.orbit ?? item.positionMeters);
      for (let i = 0; i < scenario.bodies.length; i++) {
        for (let j = i + 1; j < scenario.bodies.length; j++) {
          assert.notEqual(placement(scenario.bodies[i]), placement(scenario.bodies[j]), `${key}: corpos coincidentes`);
        }
      }
    }
  }
});

test('importação JSON preserva valores e vetores', () => {
  const original = toScenario(presetDraft());
  assert.deepEqual(toScenario(fromScenario(original)), original);
});

test('aceita ponto ou vírgula decimal em campos manuais', () => {
  const draft = presetDraft();
  draft.timeStepSeconds = '0,5';
  assert.equal(toScenario(draft).timeStepSeconds, 0.5);
});

test('recusa entrada ausente, corpos repetidos e amostragem excessiva', () => {
  const draft = presetDraft();
  draft.bodies[1].massKg = '';
  assert.throws(() => toScenario(draft), /massa/);
  draft.bodies[1].massKg = '1000';
  draft.bodies[1].name = 'terra';
  assert.throws(() => toScenario(draft), /nome único/);
  draft.bodies[1].name = 'Satélite';
  draft.sampleEverySteps = '1';
  assert.throws(() => toScenario(draft), /1.001 amostras/);
});

test('corpo definido por órbita, física, partículas e manobras viram JSON da API', () => {
  const draft = presetDraft();
  draft.integrator = 'yoshida4';
  draft.bodies[1] = { ...draft.bodies[1], mode: 'orbit', radiusMeters: '2', dragAreaPerMass: '0,01',
    orbit: { around: 'Terra', semiMajorAxisMeters: '7e6', eccentricity: '0,1', inclinationDegrees: '98',
      ascendingNodeDegrees: '0', argumentOfPeriapsisDegrees: '0', trueAnomalyDegrees: '0' } };
  draft.physics = { ...draft.physics, centralBody: 'Terra', j2: '1.08263e-3', centralRadiusMeters: '6.378e6' };
  draft.particleGroups = [{ name: 'Anel', around: 'Terra', count: '100', innerRadiusMeters: '8e6',
    outerRadiusMeters: '9e6', eccentricity: '0', inclinationDegrees: '0', ascendingNodeDegrees: '0' }];
  draft.maneuvers = [{ body: 'Satélite', step: '100', deltaVelocityMetersPerSecond: ['0', '10', '0'],
    deltaPositionMeters: ['0', '0', '0'] }];
  const scenario = toScenario(draft);
  assert.equal(scenario.integrator, 'yoshida4');
  assert.deepEqual(scenario.bodies[1], { name: 'Satélite', massKg: 1000, radiusMeters: 2,
    dragAreaPerMassSquareMetersPerKg: 0.01, orbit: { around: 'Terra', semiMajorAxisMeters: 7e6,
      eccentricity: 0.1, inclinationDegrees: 98, ascendingNodeDegrees: 0, argumentOfPeriapsisDegrees: 0,
      trueAnomalyDegrees: 0 } });
  assert.deepEqual(scenario.physics, { centralBody: 'Terra', j2: 1.08263e-3, centralRadiusMeters: 6.378e6 });
  assert.equal(scenario.particleGroups[0].count, 100);
  assert.deepEqual(scenario.maneuvers, [{ body: 'Satélite', step: 100, deltaVelocityMetersPerSecond: [0, 10, 0] }]);
  assert.deepEqual(toScenario(fromScenario(scenario)), scenario, 'importação JSON preserva as seções novas');
});

test('cenário clássico não ganha seções opcionais', () => {
  const scenario = toScenario(presetDraft());
  assert.deepEqual(Object.keys(scenario).sort(),
    ['bodies', 'gravity', 'sampleEverySteps', 'softeningMeters', 'steps', 'timeStepSeconds']);
  assert.deepEqual(Object.keys(scenario.bodies[0]).sort(), ['massKg', 'name', 'positionMeters', 'velocityMetersPerSecond']);
});

test('recusa órbitas, física, partículas e manobras inconsistentes', () => {
  const draft = presetDraft();
  draft.bodies[1] = { ...draft.bodies[1], mode: 'orbit', orbit: { around: 'Terra', semiMajorAxisMeters: '7e6',
    eccentricity: '1', inclinationDegrees: '0', ascendingNodeDegrees: '0', argumentOfPeriapsisDegrees: '0',
    trueAnomalyDegrees: '0' } };
  assert.throws(() => toScenario(draft), /elipses usam a > 0/);
  draft.bodies[1].orbit.around = 'Satélite';
  assert.throws(() => toScenario(draft), /listado antes/);
  const physics = presetDraft();
  physics.physics.j2 = '1e-3';
  assert.throws(() => toScenario(physics), /corpo central/);
  const particles = presetDraft();
  particles.particleGroups = [{ name: 'Nuvem', around: 'Terra', count: '2001', innerRadiusMeters: '1e7',
    outerRadiusMeters: '2e7', eccentricity: '0', inclinationDegrees: '0', ascendingNodeDegrees: '0' }];
  assert.throws(() => toScenario(particles), /2\.000 partículas/);
  const late = presetDraft();
  late.maneuvers = [{ body: 'Satélite', step: '1200', deltaVelocityMetersPerSecond: ['1', '0', '0'] }];
  assert.throws(() => toScenario(late), /antes do passo 1200/);
  const reverse = presetDraft();
  reverse.timeStepSeconds = '-5';
  assert.equal(toScenario(reverse).timeStepSeconds, -5, 'passo negativo integra para trás');
  reverse.timeStepSeconds = '0';
  assert.throws(() => toScenario(reverse), /passo de tempo/);
});
