import test from 'node:test';
import assert from 'node:assert/strict';
import { routeForPath, pathForTab } from './routes.mjs';
import { loadDraft, saveDraft, loadLastRun, saveLastRun } from './session.mjs';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}

test('cada aba tem uma rota própria', () => {
  assert.equal(routeForPath('/').key, 'catalog');
  assert.equal(routeForPath('/editor').key, 'editor');
  assert.equal(routeForPath('/resultados/').key, 'results');
  assert.equal(routeForPath('/inexistente'), null);
  assert.equal(pathForTab('results'), '/resultados');
});

test('rascunho e última execução sobrevivem ao recarregamento', () => {
  const storage = memoryStorage();
  const draft = { gravity: '6.6743e-11', bodies: [{ id: 'a', name: 'Terra' }] };
  saveDraft(draft, storage);
  assert.deepEqual(loadDraft(storage), draft);
  const run = { label: 'Terra e satélite', scenario: { steps: 1200, bodies: [] } };
  saveLastRun(run, storage);
  assert.deepEqual(loadLastRun(storage), run);
});

test('armazenamento ausente, inválido ou bloqueado não quebra a interface', () => {
  assert.equal(loadDraft(null), null);
  const broken = { getItem: () => '{não é json', setItem: () => { throw new Error('quota'); } };
  assert.equal(loadDraft(broken), null);
  assert.equal(loadLastRun(broken), null);
  assert.doesNotThrow(() => saveLastRun({ label: 'x' }, broken));
});
