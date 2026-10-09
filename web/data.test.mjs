import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTrajectory, parseDiagnostics } from './data.mjs';

const header = 'step,time_s,body,mass_kg,x_m,y_m,z_m,vx_m_s,vy_m_s,vz_m_s';

test('lê CSV com aspas, BOM e quebras CRLF', () => {
  const csv = '\uFEFF' + header + '\r\n' +
    '0,0,"Earth, blue",10,0,0,0,0,0,0\r\n' +
    '0,0,Satellite,1,2,0,0,0,1,0\r\n' +
    '2,4,"Earth, blue",10,0,0,0,0,0,0\r\n' +
    '2,4,Satellite,1,0,2,0,-1,0,0\r\n';
  const { frames, names } = parseTrajectory(csv);
  assert.deepEqual(names, ['Earth, blue', 'Satellite']);
  assert.deepEqual(frames.map(frame => frame.step), [0, 2]);
  assert.equal(frames[0].bodies.get('Satellite').x, 2);
  assert.ok(Math.abs(frames[0].center.x - 2 / 11) < 1e-12);
});

test('recusa coluna ausente e valor numérico vazio', () => {
  assert.throws(() => parseTrajectory('step,time_s\n0,0\n'), /Coluna obrigatória ausente/);
  assert.throws(() => parseTrajectory(`${header}\n0,0,A,1,,0,0,0,0,0\n`),
    /Valor ausente em x_m/);
});

test('recusa amostras incompletas, duplicadas e massa variável', () => {
  const base = `${header}\n0,0,A,2,0,0,0,0,0,0\n0,0,B,1,1,0,0,0,0,0\n`;
  assert.throws(() => parseTrajectory(base + '1,1,A,2,0,0,0,0,0,0\n'),
    /Corpos ausentes/);
  assert.throws(() => parseTrajectory(base + '0,0,A,2,0,0,0,0,0,0\n'),
    /duplicados/);
  assert.throws(() => parseTrajectory(base +
    '1,1,A,3,0,0,0,0,0,0\n1,1,B,1,1,0,0,0,0,0\n'),
  /massa de A mudou/);
});

test('lê diagnósticos e recusa passos duplicados', () => {
  const csv = 'step,energy_j,px_kg_m_s,py_kg_m_s,pz_kg_m_s\n0,-10,0,1,0\n';
  assert.equal(parseDiagnostics(csv).get(0).energy, -10);
  assert.equal(parseDiagnostics('').size, 0);
  assert.throws(() => parseDiagnostics(csv + '0,-9,0,1,0\n'), /duplicado/);
});
