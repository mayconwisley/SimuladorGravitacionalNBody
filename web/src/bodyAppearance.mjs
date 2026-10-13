// How each body looks in the viewer: real colours, radii, rotation and surface style for the known
// bodies of the gallery, and a classification by name and mass for the rest. Display only; the
// physics never reads it. Radii in metres, rotation periods in hours (negative = retrograde),
// temperatures in kelvin.

const palette = ['#f5c27a', '#5eead4', '#93b4ff', '#f49ac1', '#c4b5fd', '#a7f3a0', '#fb9d7a'];
const particlePalette = ['#7dd3fc', '#fda4af', '#bef264', '#fcd34d', '#d8b4fe', '#99f6e4', '#fdba74', '#a5b4fc'];
const solarMass = 1.98847e30;
const solarRadius = 6.957e8;
const sunTemperature = 5772;
const earthRadius = 6.371e6;
const jupiterRadius = 6.9911e7;

const planet = (style, radius, mass, rotation, color, extra = {}) => ({ kind: 'planet', style, radius, mass, rotation, color, ...extra });
const moon = (style, radius, mass, color, extra = {}) => ({ kind: 'moon', style, radius, mass, locked: true, color, ...extra });
const star = (temperature, extra = {}) => ({ kind: 'star', temperature, ...extra });
const asteroid = (radius, mass, color = '#9a8f82') => ({ kind: 'asteroid', style: 'rock', radius, mass, color });
// Exoplanets: radius in Earth or Jupiter radii (measured, or estimated from the mass when the
// planet does not transit); no colour, so their trails keep the distinct palette colours.
const exo = (style, radius, extra = {}) => ({ kind: 'planet', style, radius, ...extra });
const trojan = { kind: 'asteroid', style: 'rock', color: '#a08f7c' };

// Masses (kg) of real bodies: the real radius is only drawn when the scenario uses a mass within
// a factor of 3 of it, so idealized presets that reuse a name (Marte with 1e23 kg holding Fobos
// at 3000 km) are not covered by a planet bigger than their orbits.
export const catalog = {
  'Sol': star(sunTemperature, { radius: solarRadius, mass: 1.989e30, rotation: 609.12, color: '#ffd27a' }),
  'Mercúrio': planet('mercury', 2.4397e6, 3.301e23, 1407.6, '#a39c94'),
  'Vênus': planet('venus', 6.0518e6, 4.867e24, -5832.5, '#e8cf98', { atmosphere: '#f6e2b0' }),
  'Terra': planet('earth', 6.371e6, 5.972e24, 23.9345, '#4f8fe6', { atmosphere: '#6aa6ff' }),
  'Lua': moon('moon', 1.7374e6, 7.342e22, '#c8c4bc'),
  'Marte': planet('mars', 3.3895e6, 6.417e23, 24.6229, '#d4643c', { atmosphere: '#e8a07a' }),
  'Fobos': moon('rock', 1.11e4, 1.0659e16, '#8f857a'),
  'Deimos': moon('rock', 6.2e3, 1.4762e15, '#a0968a'),
  'Júpiter': planet('jupiter', jupiterRadius, 1.898e27, 9.925, '#d9b58c'),
  'Io': moon('io', 1.8216e6, 8.93e22, '#e3cf5a'),
  'Europa': moon('europa', 1.5608e6, 4.8e22, '#dccdb2'),
  'Ganimedes': moon('ganymede', 2.6341e6, 1.48e23, '#a59a88'),
  'Calisto': moon('callisto', 2.4103e6, 1.076e23, '#8a7f72'),
  'Saturno': planet('saturn', 5.8232e7, 5.683e26, 10.656, '#e4cf98', { rings: true }),
  'Mimas': moon('icy', 1.982e5, 3.75e19, '#cfcac3'),
  'Encélado': moon('icy', 2.521e5, 1.08e20, '#f2f5f7'),
  'Tétis': moon('icy', 5.311e5, 6.17e20, '#dcd8d2'),
  'Dione': moon('icy', 5.614e5, 1.095e21, '#d4cfc8'),
  'Reia': moon('icy', 7.638e5, 2.31e21, '#cdc7bf'),
  'Titã': moon('titan', 2.5747e6, 1.345e23, '#dca453', { atmosphere: '#e9b25e' }),
  'Urano': planet('uranus', 2.5362e7, 8.681e25, -17.24, '#a6e1e8', { atmosphere: '#c4f1f5' }),
  'Miranda': moon('icy', 2.357e5, 6.4e19, '#bdb9b4'),
  'Ariel': moon('icy', 5.789e5, 1.25e21, '#c9c4bd'),
  'Umbriel': moon('rock', 5.847e5, 1.28e21, '#8a847c'),
  'Titânia': moon('icy', 7.889e5, 3.4e21, '#bfb6aa'),
  'Oberon': moon('icy', 7.614e5, 3.08e21, '#ab9f92'),
  'Netuno': planet('neptune', 2.4622e7, 1.024e26, 16.11, '#4f73e3', { atmosphere: '#7d9cff' }),
  'Tritão': moon('triton', 1.3534e6, 2.14e22, '#d8c3b8'),
  'Proteu': moon('rock', 2.1e5, 4.4e19, '#837d77'),
  'Plutão': planet('pluto', 1.1883e6, 1.303e22, -153.29, '#d8b796'),
  'Caronte': moon('charon', 6.06e5, 1.586e21, '#a9a198'),
  'Nix': moon('icy', 2.5e4, 4.5e16, '#d5d2cc'),
  'Hidra': moon('icy', 2.5e4, 4.8e16, '#d0cdc7'),
  'Cérbero': moon('icy', 6e3, 1.65e16, '#c6c2bb'),
  'Estige': moon('icy', 6e3, 7.5e15, '#c9c5be'),
  'Halley': { kind: 'comet', style: 'rock', radius: 5.5e3, mass: 2.2e14, color: '#cfd9e6' },
  'Cruithne': asteroid(2.5e3, 1.3e14),
  'ʻOumuamua': asteroid(1e2, 0, '#b8866b'),
  'Didymos': asteroid(3.9e2, 5.4e11),
  'Dimorphos': asteroid(7.5e1, 4.3e9),
  'Proto-Terra': planet('molten', 6.1e6, 5.37e24, 5, '#d9774a'),
  'Theia': planet('rock', 3.39e6, 6.4e23, 8, '#b49a7e'),
  ...Object.fromEntries(['Agamenon', 'Anquises', 'Aquiles', 'Eneias', 'Heitor', 'Nestor', 'Príamo', 'Pátroclo',
    'Troilo', 'Ulisses'].map(name => [name, trojan])),

  'Sgr A*': { kind: 'blackHole' },
  'S2': star(28000, { radius: 7 * solarRadius }),
  'Alfa Centauri A': star(5790),
  'Alfa Centauri B': star(5260),
  'TRAPPIST-1': star(2566),
  'TRAPPIST-1 b': exo('hotRock', 1.116 * earthRadius, { locked: true }),
  'TRAPPIST-1 c': exo('hotRock', 1.097 * earthRadius, { locked: true }),
  'TRAPPIST-1 d': exo('rock', 0.788 * earthRadius, { locked: true }),
  'TRAPPIST-1 e': exo('ocean', 0.920 * earthRadius, { locked: true }),
  'TRAPPIST-1 f': exo('iceWorld', 1.045 * earthRadius, { locked: true }),
  'TRAPPIST-1 g': exo('iceWorld', 1.129 * earthRadius, { locked: true }),
  'TRAPPIST-1 h': exo('iceWorld', 0.755 * earthRadius, { locked: true }),
  'Kepler-11': star(5680),
  'Kepler-11 b': exo('subNeptune', 1.80 * earthRadius),
  'Kepler-11 c': exo('subNeptune', 2.87 * earthRadius),
  'Kepler-11 d': exo('subNeptune', 3.12 * earthRadius),
  'Kepler-11 e': exo('subNeptune', 4.19 * earthRadius),
  'Kepler-11 f': exo('subNeptune', 2.49 * earthRadius),
  'Kepler-11 g': exo('subNeptune', 3.33 * earthRadius),
  'Kepler-90': star(6080),
  'Kepler-90 b': exo('hotRock', 1.31 * earthRadius, { locked: true }),
  'Kepler-90 c': exo('hotRock', 1.18 * earthRadius, { locked: true }),
  'Kepler-90 i': exo('hotRock', 1.32 * earthRadius, { locked: true }),
  'Kepler-90 d': exo('subNeptune', 2.88 * earthRadius),
  'Kepler-90 e': exo('subNeptune', 2.67 * earthRadius),
  'Kepler-90 f': exo('subNeptune', 2.89 * earthRadius),
  'Kepler-90 g': exo('giant', 8.13 * earthRadius),
  'Kepler-90 h': exo('giant', 11.32 * earthRadius),
  'Gliese 876': star(3130),
  'Gliese 876 b': exo('giant', 1.1 * jupiterRadius),
  'Gliese 876 c': exo('giant', 1.0 * jupiterRadius),
  'Gliese 876 e': exo('subNeptune', 0.35 * jupiterRadius),
  'HR 8799': star(7430),
  ...Object.fromEntries(['b', 'c', 'd', 'e'].map(letter => [`HR 8799 ${letter}`, exo('youngGiant', 1.2 * jupiterRadius)])),
  'Proxima Centauri': star(3042),
  'Proxima b': exo('rock', 1.07 * earthRadius, { locked: true }),
  'Proxima d': exo('hotRock', 0.81 * earthRadius, { locked: true }),
  '51 Pegasi': star(5768),
  '51 Pegasi b': exo('hotJupiter', 1.2 * jupiterRadius, { locked: true }),
  'HD 80606': star(5574),
  'HD 80606 b': exo('giant', 1.03 * jupiterRadius),
  'Kepler-16 b': exo('giant', 0.754 * jupiterRadius, { mass: 1.0e27 }),
  'Kepler-47 b': exo('subNeptune', 3.05 * earthRadius, { mass: 1.2e26 }),
  'Kepler-47 c': exo('subNeptune', 4.65 * earthRadius, { mass: 1.9e26 })
};

// Order matters: the first matching rule names the kind of a body missing from the catalog.
const rules = [
  [/buraco negro|sgr a\*/i, 'blackHole'],
  [/gal[aá]xia/i, 'galaxy'],
  [/aglomerado/i, 'cluster'],
  [/estrela|^massa \d/i, 'star'],
  [/cometa|fragmento/i, 'comet'],
  [/sat[eé]lite|sonda|nave|c[aá]psula|gps|geo |^plano \d|queima|perseguidor|^alvo$|bi-el[ií]ptica|hohmann|^e = /i, 'craft'],
  [/troian|girino|ferradura|planetesimal|asteroide/i, 'asteroid'],
  [/^lua\b/i, 'moon'],
  [/planeta|terra/i, 'planet']
];

function kindFromMass(mass) {
  if (mass >= 1e38) return 'galaxy';
  if (mass >= 1e34) return 'cluster';
  if (mass >= 1.5e29) return 'star';
  if (mass >= 1e24) return 'planet';
  if (mass >= 1e20) return 'moon';
  return 'asteroid';
}

const genericStyle = { planet: mass => mass >= 5e26 ? 'giant' : mass >= 3e25 ? 'subNeptune' : 'rock', moon: () => 'moon',
  asteroid: () => 'rock', comet: () => 'rock' };
const markerRadius = { planet: 3.1, moon: 2.4, asteroid: 1.6, comet: 1.8, craft: 1.7, blackHole: 4, galaxy: 3.4, cluster: 3 };

// Base colour of each surface style, for small discs and as the texture's dominant tone.
export const styleColor = {
  earth: '#4f8fe6', moon: '#bdb8b0', mercury: '#a39c94', venus: '#e8cf98', mars: '#c9603a', jupiter: '#d9b58c',
  saturn: '#e4cf98', uranus: '#a6e1e8', neptune: '#4f73e3', io: '#e3cf5a', europa: '#dccdb2', ganymede: '#a59a88',
  callisto: '#7d7266', titan: '#dca453', icy: '#d9d6d0', rock: '#9a8f82', pluto: '#d8b796', charon: '#a9a198',
  triton: '#d8c3b8', molten: '#8a4a32', hotRock: '#7a6258', ocean: '#3f78c8', iceWorld: '#d3e2ea',
  subNeptune: '#8fb8d9', giant: '#cfae84', hotJupiter: '#5a3b36', youngGiant: '#8a4b3a'
};

const baseName = name => String(name).replace(/\s*\(.*\)\s*$/, '').trim();

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

// Approximate colour (sRGB 0–255) of a black body at the given temperature.
export function temperatureColor(kelvin) {
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100;
  const red = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [red, green, blue].map(value => Math.round(Math.max(0, Math.min(255, value))));
}

export function hexToRgb(hex) {
  const value = hex.slice(1);
  return [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16));
}

const withinFactor = (value, reference, factor) => value > 0 && reference > 0 &&
  Math.abs(Math.log(value / reference)) <= Math.log(factor);

// Main-sequence estimates for a star of realistic mass without catalog data: L ∝ M^3.5, R ∝ M^0.8.
function starFromMass(mass) {
  const solar = mass / solarMass;
  if (!(solar >= 0.075 && solar <= 60)) return { temperature: sunTemperature, radius: 0, luminosity: 1 };
  const luminosity = solar ** 3.5, radius = solar ** 0.8;
  return { temperature: Math.max(2300, Math.min(40000, sunTemperature * (luminosity / radius ** 2) ** 0.25)),
    radius: radius * solarRadius, luminosity };
}

/**
 * Appearance of a body for the viewer.
 * @param {string} name body name
 * @param {number} massKg mass in the scenario (kg)
 * @param {number} radiusMeters radius given in the scenario (m), 0 when absent
 * @param {number} index position in the body list, for the trail colour of bodies without a real one
 */
export function bodyAppearance(name, massKg = 0, radiusMeters = 0, index = 0) {
  const entry = catalog[name] ?? catalog[baseName(name)] ?? null;
  const kind = entry?.kind ?? rules.find(([pattern]) => pattern.test(name))?.[1] ?? kindFromMass(massKg);
  const realMass = !entry?.mass || massKg === 0 || withinFactor(massKg, entry.mass, 3);
  const seed = hashString(name);
  const trail = entry?.color ?? palette[index % palette.length];
  const result = { name, kind, color: trail, seed, radius: radiusMeters > 0 ? radiusMeters : 0, rotation: 0,
    locked: false, rings: false, atmosphere: null, style: null, marker: markerRadius[kind] ?? 2.4 };

  if (kind === 'star') {
    const estimate = starFromMass(massKg);
    const temperature = entry?.temperature ?? estimate.temperature;
    const radius = result.radius || (entry?.radius && realMass ? entry.radius : estimate.radius);
    const luminosity = entry?.temperature && radius > 0 ? (radius / solarRadius) ** 2 * (temperature / sunTemperature) ** 4
      : entry?.temperature ? (temperature / sunTemperature) ** 6 : estimate.luminosity;
    const rgb = temperatureColor(temperature);
    return { ...result, radius, temperature, luminosity, rgb, rotation: entry?.rotation ?? 0,
      marker: Math.max(3, Math.min(9, 4 + 1.2 * Math.log10(1 + luminosity))) };
  }
  if (kind === 'blackHole' || kind === 'galaxy' || kind === 'cluster' || kind === 'craft') return result;

  const style = entry?.style ?? genericStyle[kind]?.(massKg) ?? 'rock';
  const radius = result.radius || (entry?.radius && realMass ? entry.radius : 0);
  return { ...result, style, radius, rgb: hexToRgb(styleColor[style] ?? '#9a8f82'),
    rotation: entry?.rotation ?? 0, locked: Boolean(entry?.locked), rings: Boolean(entry?.rings),
    atmosphere: entry?.atmosphere ? hexToRgb(entry.atmosphere) : null,
    marker: kind === 'planet' && (style === 'giant' || style === 'jupiter' || style === 'saturn' || massKg >= 5e25)
      ? 3.6 : result.marker };
}

// Trail and list colour: the real colour of known bodies, a distinct palette colour otherwise.
export const trailColor = (name, massKg, index) => bodyAppearance(name, massKg, 0, index).color;

// Particle groups: icy ring material, rocky belts, icy Kuiper objects, dust or stars.
const particleStyles = [
  [/anel/i, { color: '#e4d6b8', glow: false }],
  [/kuiper/i, { color: '#a9c2d6', glow: false }],
  [/cintur|coorbital|troian|asteroide/i, { color: '#bba68c', glow: false }],
  [/estrela|aglomerado/i, { color: '#ffe3bd', glow: true }]
];

export function particleAppearance(group = {}, index = 0) {
  const match = particleStyles.find(([pattern]) => pattern.test(group.name ?? ''))?.[1];
  if (match) return match;
  const around = bodyAppearance(group.around ?? '', 0).kind;
  if (around === 'galaxy' || around === 'cluster' || around === 'blackHole') return { color: '#d4ddff', glow: true };
  if (/disco/i.test(group.name ?? '')) return { color: '#d8b98f', glow: false };
  return { color: particlePalette[index % particlePalette.length], glow: false };
}
