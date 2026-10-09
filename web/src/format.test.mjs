import test from 'node:test';
import assert from 'node:assert/strict';
import { clockUnit, formatClock } from './format.mjs';

test('relógio mantém a mesma largura durante toda a simulação', () => {
  for (const total of [42.5, 6000, 90000, 31536000]) {
    const width = formatClock(total, total).length;
    for (let i = 0; i <= 100; i++)
      assert.equal(formatClock(total * i / 100, total).length, width, `total=${total}, i=${i}`);
  }
});

test('formata h:min:s para a órbita do satélite (6000 s)', () => {
  assert.equal(clockUnit(6000), 'h:min:s');
  assert.equal(formatClock(0, 6000), '00:00:00');
  assert.equal(formatClock(500, 6000), '00:08:20');
  assert.equal(formatClock(5999.9999999, 6000), '01:40:00');
});

test('formata dias com largura do total (365 dias)', () => {
  const total = 365 * 86400;
  assert.equal(clockUnit(total), 'd h:min:s');
  assert.equal(formatClock(86400 + 3661, total), '001d 01:01:01');
  assert.equal(formatClock(total, total), '365d 00:00:00');
});

test('durações curtas usam segundos com duas casas', () => {
  assert.equal(clockUnit(42.5), 's');
  assert.equal(formatClock(3.25, 42.5), '03,25 s');
  assert.equal(formatClock(42.5, 42.5), '42,50 s');
});
