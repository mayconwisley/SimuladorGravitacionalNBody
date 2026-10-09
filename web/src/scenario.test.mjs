import test from 'node:test';
import assert from 'node:assert/strict';
import { presetDraft, presets, toScenario, fromScenario } from './scenario.mjs';

test('ao menos 20 cenários prontos têm metadados, limites e corpos distintos', () => {
  assert.ok(Object.keys(presets).length >= 20);
  const labels = new Set();
  for (const [key, preset] of Object.entries(presets)) {
    const scenario = toScenario(presetDraft(key));
    assert.ok(preset.label && preset.category && preset.description);
    assert.ok(!labels.has(preset.label));
    labels.add(preset.label);
    assert.ok(scenario.bodies.length <= 32);
    assert.ok(scenario.steps <= 20000);
    assert.ok(2 + Math.floor((scenario.steps - 1) / scenario.sampleEverySteps) <= 1001);
    if (scenario.softeningMeters === 0) {
      for (let i = 0; i < scenario.bodies.length; i++) {
        for (let j = i + 1; j < scenario.bodies.length; j++) {
          assert.notDeepEqual(scenario.bodies[i].positionMeters,
            scenario.bodies[j].positionMeters, `${key}: corpos coincidentes`);
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
