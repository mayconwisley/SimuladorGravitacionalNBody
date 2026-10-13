import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPresets, pageWindow, paginate } from './galleryPaging.mjs';
import { presets } from './scenario.mjs';

const entries = Object.entries(presets);

test('a galeria tem 125 cenários com nomes e chaves únicos', () => {
  assert.equal(entries.length, 125);
  assert.equal(new Set(entries.map(([, preset]) => preset.label)).size, 125);
});

test('paginação de 25 itens: cinco páginas, a última completa', () => {
  const first = paginate(entries, 1);
  assert.equal(first.pageCount, 5);
  assert.equal(first.items.length, 25);
  assert.deepEqual([first.start, first.end], [0, 25]);
  const last = paginate(entries, 5);
  assert.deepEqual([last.start, last.end, last.items.length], [100, 125, 25]);
});

test('página inválida ou fora do intervalo é ajustada', () => {
  assert.equal(paginate(entries, 0).page, 1);
  assert.equal(paginate(entries, 'abc').page, 1);
  assert.equal(paginate(entries, 99).page, 5);
  assert.equal(paginate([], 3).pageCount, 1);
});

test('busca ignora acentos e exige todas as palavras', () => {
  const found = filterPresets(entries, { query: 'jupiter troianos' });
  assert.ok(found.some(([key]) => key === 'jupiterTrojans'));
  assert.ok(found.every(([, preset]) => /troian/i.test(`${preset.label} ${preset.description}`)));
  assert.equal(filterPresets(entries, { query: 'zzzz' }).length, 0);
});

test('filtro por categoria', () => {
  const solar = filterPresets(entries, { category: 'Sistema Solar' });
  assert.ok(solar.length > 0);
  assert.ok(solar.every(([, preset]) => preset.category === 'Sistema Solar'));
});

test('janela de páginas com reticências para muitas páginas', () => {
  assert.deepEqual(pageWindow(2, 4), [1, 2, 3, 4]);
  assert.deepEqual(pageWindow(6, 12), [1, null, 5, 6, 7, null, 12]);
  assert.deepEqual(pageWindow(1, 12), [1, 2, null, 12]);
});
