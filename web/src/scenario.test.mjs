import test from 'node:test';
import assert from 'node:assert/strict';
import { presetDraft, toScenario, fromScenario } from './scenario.mjs';

test('preset contém todos os campos físicos válidos', () => {
  for (const key of ['satellite', 'solar']) {
    const scenario = toScenario(presetDraft(key));
    assert.equal(scenario.bodies.length, 2);
    assert.ok(scenario.bodies[1].positionMeters[0] > 0);
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
