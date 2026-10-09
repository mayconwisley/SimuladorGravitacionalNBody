import test from 'node:test';
import assert from 'node:assert/strict';
import { advancePosition, clampIndex } from './playback.mjs';

test('tempo negativo do primeiro quadro não recua antes da amostra 0', () => {
  // rAF can report a timestamp 3 ms before the recorded start time.
  const position = advancePosition(0, -3, 12, 200);
  assert.equal(position, 0);
  assert.equal(Math.floor(position), 0);
});

test('avança 12 amostras por segundo multiplicadas pela velocidade', () => {
  assert.equal(advancePosition(10, 500, 12 * 2, 200), 22);
});

test('para na última amostra', () => {
  assert.equal(advancePosition(195, 10_000, 12, 200), 200);
});

test('índice fica no intervalo do conjunto atual', () => {
  assert.equal(clampIndex(-1, 60), 0);
  assert.equal(clampIndex(800, 60), 60);
  assert.equal(clampIndex(NaN, 60), 0);
  assert.equal(clampIndex(5, 0), 0);
});

test('modo repetição volta ao início depois da última amostra', () => {
  // 200 s at 12 samples/s from sample 195 of 0..200: 195 + 2.4 = 197.4, still inside.
  assert.equal(advancePosition(195, 200, 12, 200, { loop: true }), 197.4);
  // 196 + 6 = 202 → wraps over 201 samples (0..200) to sample 1.
  assert.equal(advancePosition(196, 500, 12, 200, { loop: true }), 1);
  // Without loop the same advance stops at the last sample.
  assert.equal(advancePosition(196, 500, 12, 200), 200);
});
