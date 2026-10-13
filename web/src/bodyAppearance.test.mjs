import test from 'node:test';
import assert from 'node:assert/strict';
import { bodyAppearance, particleAppearance, temperatureColor, trailColor } from './bodyAppearance.mjs';
import { presets } from './presets.mjs';
import { buildTexture, textureStyles } from './planetTextures.mjs';

test('real bodies with their real mass are drawn at their real radius', () => {
  const earth = bodyAppearance('Terra', 5.972e24, 0, 0);
  assert.equal(earth.kind, 'planet');
  assert.equal(earth.style, 'earth');
  assert.equal(earth.radius, 6.371e6);
  assert.ok(earth.atmosphere);
  assert.equal(bodyAppearance('Saturno', 5.683e26).rings, true);
});

test('idealized presets reusing a real name keep a marker instead of the real size', () => {
  // Marte with 1e23 kg holds Fobos at 3000 km, inside the real Mars radius (3390 km).
  const mars = bodyAppearance('Marte', 1e23, 0, 0);
  assert.equal(mars.style, 'mars');
  assert.equal(mars.radius, 0);
  assert.equal(bodyAppearance('Júpiter (10×)', 1.9e28).radius, 0);
  assert.equal(bodyAppearance('Júpiter (10×)', 1.9e28).style, 'jupiter');
  assert.equal(bodyAppearance('Mimas (ampliada)', 5e23).radius, 0);
});

test('a radius given in the scenario always wins', () => {
  assert.equal(bodyAppearance('Lua', 7.342e22, 1737400).radius, 1737400);
  assert.equal(bodyAppearance('Cápsula', 1000, 2).radius, 2);
});

test('bodies outside the catalog are classified by name, then by mass', () => {
  assert.equal(bodyAppearance('Sgr A*', 8.54e36).kind, 'blackHole');
  assert.equal(bodyAppearance('Buraco negro', 1e37).kind, 'blackHole');
  assert.equal(bodyAppearance('Galáxia A', 2e41).kind, 'galaxy');
  assert.equal(bodyAppearance('Intrusa', 6e40).kind, 'galaxy');
  assert.equal(bodyAppearance('Estrela', 1e23).kind, 'star');
  assert.equal(bodyAppearance('GPS A1', 2000).kind, 'craft');
  assert.equal(bodyAppearance('Sonda polar (50 km)', 0).kind, 'craft');
  assert.equal(bodyAppearance('Fragmento A', 1e12).kind, 'comet');
  assert.equal(bodyAppearance('Planetesimal 3', 1e19).kind, 'asteroid');
  assert.equal(bodyAppearance('Planeta', 1e25).style, 'rock');
  assert.equal(bodyAppearance('Corpo A', 1e30).kind, 'star');
  assert.equal(bodyAppearance('Interno', 1e12).kind, 'asteroid');
});

test('star colours follow temperature and luminosity sets the marker', () => {
  const [r, , b] = temperatureColor(2566);
  assert.ok(r > b, 'TRAPPIST-1 is red');
  const [r2, , b2] = temperatureColor(28000);
  assert.ok(b2 > r2, 'S2 is blue-white');
  const sun = bodyAppearance('Sol', 1.989e30);
  assert.ok(Math.abs(sun.luminosity - 1) < 1e-9);
  assert.ok(bodyAppearance('S2', 2.78e31).marker > sun.marker);
  assert.ok(bodyAppearance('TRAPPIST-1', 1.79e29, 8.29e7).luminosity < 1e-3);
});

test('known bodies keep their real colour; others get distinct palette colours', () => {
  assert.equal(trailColor('Terra', 5.972e24, 5), '#4f8fe6');
  assert.notEqual(trailColor('GPS A1', 2000, 1), trailColor('GPS A2', 2000, 2));
});

test('particle groups look like what they represent', () => {
  assert.equal(particleAppearance({ name: 'Anel', around: 'Saturno' }).glow, false);
  assert.equal(particleAppearance({ name: 'Disco A', around: 'Galáxia A' }).glow, true);
  assert.equal(particleAppearance({ name: 'Estrelas do aglomerado', around: 'Aglomerado' }).glow, true);
  assert.equal(particleAppearance({ name: 'Cinturão de Kuiper', around: 'Sol' }).color, '#a9c2d6');
});

test('every body of the 100 presets gets an appearance with a texture style when it is a planet or moon', () => {
  for (const [key, preset] of Object.entries(presets)) {
    preset.bodies.forEach((item, index) => {
      const [name, mass, , , radius] = Array.isArray(item) ? [...item, 0] : [item.name, item.massKg, 0, 0, item.radiusMeters ?? 0];
      const look = bodyAppearance(name, mass, radius, index);
      assert.ok(look.kind, `${key}: ${name}`);
      assert.match(look.color, /^#[0-9a-f]{6}$/, `${key}: ${name}`);
      if (look.kind === 'planet' || look.kind === 'moon') assert.ok(textureStyles.includes(look.style), `${key}: ${name} ${look.style}`);
    });
  }
});

test('textures are deterministic and fully filled', () => {
  const first = buildTexture('moon', 7), second = buildTexture('moon', 7);
  assert.deepEqual(first.color, second.color);
  assert.equal(first.color.length, first.width * first.height * 3);
  assert.ok(first.color.some(value => value > 0));
});
