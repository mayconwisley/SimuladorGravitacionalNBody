import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTrajectory, parseDiagnostics, parseEvents, parseParticles } from './data.mjs';

const header = 'step,time_s,body,mass_kg,x_m,y_m,z_m,vx_m_s,vy_m_s,vz_m_s';

test('lê CSV com aspas, BOM e quebras CRLF', () => {
  const csv = '﻿' + header + '\r\n' +
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

test('recusa amostras incompletas, duplicadas e tempo fora de ordem', () => {
  const base = `${header}\n0,0,A,2,0,0,0,0,0,0\n0,0,B,1,1,0,0,0,0,0\n`;
  assert.throws(() => parseTrajectory(base + '1,1,A,2,0,0,0,0,0,0\n'),
    /Corpos ausentes/);
  assert.throws(() => parseTrajectory(base + '0,0,A,2,0,0,0,0,0,0\n'),
    /duplicados/);
  assert.throws(() => parseTrajectory(base + '1,1,A,2,0,0,0,0,0,0\n1,1,B,1,1,0,0,0,0,0\n' +
    '2,0.5,A,2,0,0,0,0,0,0\n2,0.5,B,1,1,0,0,0,0,0\n'), /mesmo sentido/);
});

test('aceita fusão, tempo reverso e coluna active', () => {
  const extended = `${header},radius_m,active`;
  const csv = `${extended}\n0,0,A,2,0,0,0,0,0,0,1,1\n0,0,B,1,3,0,0,0,0,0,1,1\n` +
    '1,-1,A,3,1,0,0,0,0,0,1.44,1\n1,-1,B,1,1,0,0,0,0,0,1,0\n';
  const { frames } = parseTrajectory(csv);
  assert.equal(frames[1].bodies.get('A').mass, 3);
  assert.equal(frames[1].bodies.get('B').active, false);
  assert.equal(frames[1].center.x, 1, 'centro só com corpos ativos');
  assert.equal(frames[0].bodies.get('A').radius, 1);
});

test('lê eventos e partículas da CLI', () => {
  const events = parseEvents('step,time_s,kind,body,other,distance_m\n' +
    '5,10,periapsis,Cometa,Estrela,1.5\n6,12,maneuver,Cometa,,\n');
  assert.deepEqual(events[0], { step: 5, time: 10, kind: 'periapsis', body: 'Cometa', other: 'Estrela', distance: 1.5 });
  assert.equal(events[1].other, null);
  const particles = parseParticles('step,time_s,group,particle,x_m,y_m,z_m\n' +
    '0,0,Anel,1,1,2,3\n0,0,Anel,2,4,5,6\n', [0, 5]);
  assert.equal(particles.particleCount, 2);
  assert.deepEqual([...particles.byStep.get(0)], [1, 2, 3, 4, 5, 6]);
  assert.ok(Number.isNaN(particles.byStep.get(5)[0]), 'partículas ausentes ficam NaN');
});

test('lê diagnósticos e recusa passos duplicados', () => {
  const csv = 'step,energy_j,px_kg_m_s,py_kg_m_s,pz_kg_m_s\n0,-10,0,1,0\n';
  assert.equal(parseDiagnostics(csv).get(0).energy, -10);
  assert.equal(parseDiagnostics('').size, 0);
  assert.throws(() => parseDiagnostics(csv + '0,-9,0,1,0\n'), /duplicado/);
});
