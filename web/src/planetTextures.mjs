// Procedural surface maps for planets and moons. Each style is an equirectangular texture
// (longitude across, latitude down) built from 3-D value noise sampled on the unit sphere, so it
// has no seam. Textures are generated once per style and seed, outside the drawing call, and
// kept in a small bounded cache.

const degree = Math.PI / 180;

function lattice(ix, iy, iz, seed) {
  let hash = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 1440662683) ^ Math.imul(seed, 1013904223);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

const smooth = t => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const step = (edge0, edge1, value) => smooth(clamp((value - edge0) / (edge1 - edge0)));

function valueNoise(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
  const x0 = mix(lattice(ix, iy, iz, seed), lattice(ix + 1, iy, iz, seed), fx);
  const x1 = mix(lattice(ix, iy + 1, iz, seed), lattice(ix + 1, iy + 1, iz, seed), fx);
  const x2 = mix(lattice(ix, iy, iz + 1, seed), lattice(ix + 1, iy, iz + 1, seed), fx);
  const x3 = mix(lattice(ix, iy + 1, iz + 1, seed), lattice(ix + 1, iy + 1, iz + 1, seed), fx);
  return mix(mix(x0, x1, fy), mix(x2, x3, fy), fz);
}

// Fractal noise in [0, 1].
function fbm(x, y, z, seed, octaves = 5) {
  let sum = 0, amplitude = 0.5, total = 0, frequency = 1;
  for (let octave = 0; octave < octaves; octave++) {
    sum += amplitude * valueNoise(x * frequency, y * frequency, z * frequency, seed + octave * 31);
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / total;
}

const hex = value => [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16));
const blend = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const scale = (color, factor) => [color[0] * factor, color[1] * factor, color[2] * factor];

// Zonal bands of a gas giant: latitude perturbed by turbulence, coloured from a list of tones.
function bands(tones, lat, x, y, z, seed, { count = 7, turbulence = 0.09, contrast = 1 } = {}) {
  const swirl = fbm(x * 3, y * 3, z * 9, seed, 4) - 0.5;
  const position = (Math.sin((lat + swirl * turbulence) * count) + 1) / 2;
  const index = position * (tones.length - 1);
  const low = Math.floor(index);
  const detail = (fbm(x * 8, y * 8, z * 24, seed + 9, 3) - 0.5) * 0.18 * contrast;
  return scale(blend(tones[low], tones[Math.min(tones.length - 1, low + 1)], index - low), 1 + detail);
}

function cratered(base, dark, x, y, z, seed, maria = 0.42, near = 0) {
  const large = fbm(x * 1.6, y * 1.6, z * 1.6, seed, 4) + near * x * 0.12;
  const fine = fbm(x * 9, y * 9, z * 9, seed + 5, 4);
  let color = blend(base, dark, step(maria + 0.06, maria - 0.06, large));
  color = scale(color, 0.82 + 0.36 * fine);
  const spot = valueNoise(x * 40, y * 40, z * 40, seed + 77);
  if (spot > 0.93) color = scale(color, 1.25);
  return color;
}

// Each style returns [r, g, b, nightLight, specular] for a point (x, y, z) on the unit sphere
// at latitude `lat` (radians). Colours are 0–255; the night and specular channels are 0–1.
const styles = {
  earth(x, y, z, lat, seed) {
    const height = fbm(x * 1.7, y * 1.7, z * 1.7, seed, 6);
    const land = height > 0.53;
    const absLat = Math.abs(lat) / degree;
    let color;
    if (land) {
      const dry = step(0.45, 0.65, fbm(x * 3, y * 3, z * 3, seed + 3, 4)) * step(45, 18, Math.abs(absLat - 24));
      color = blend(blend(hex('#3d6b2c'), hex('#6b7f3e'), fbm(x * 6, y * 6, z * 6, seed + 4, 3)), hex('#b99c66'), dry);
      color = blend(color, hex('#8a7d6c'), step(0.66, 0.75, height));
    } else {
      color = blend(hex('#0a2350'), hex('#1d5a96'), step(0.43, 0.53, height));
    }
    const ice = step(68, 74, absLat + (fbm(x * 5, y * 5, z * 5, seed + 6, 3) - 0.5) * 10);
    color = blend(color, hex('#eef3f7'), ice);
    // Clouds: streaks stretched along the parallels, more frequent near the equator and mid-latitudes.
    const cloud = fbm(x * 3.4 + 7, y * 3.4, z * 9, seed + 11, 6);
    const cover = step(0.55, 0.74, cloud + 0.05 * Math.cos(lat * 6));
    color = blend(color, [246, 248, 250], cover * 0.88);
    // City lights: sparse points in populated regions (land away from deserts and ice).
    const region = land && !ice && absLat < 62 ? step(0.5, 0.7, fbm(x * 6, y * 6, z * 6, seed + 13, 3)) : 0;
    const lights = region * step(0.72, 0.9, valueNoise(x * 90, y * 90, z * 90, seed + 17));
    return [...color, lights * (1 - cover * 0.8), land || ice ? 0 : 1 - cover];
  },
  moon: (x, y, z, lat, seed) => [...cratered(hex('#b9b5ae'), hex('#5f5c58'), x, y, z, seed, 0.44, 1), 0, 0],
  mercury: (x, y, z, lat, seed) => [...cratered(hex('#a8a097'), hex('#77706a'), x, y, z, seed, 0.36), 0, 0],
  rock: (x, y, z, lat, seed) => [...cratered(hex('#9a8f82'), hex('#5e554c'), x, y, z, seed, 0.4), 0, 0],
  icy: (x, y, z, lat, seed) => [...cratered(hex('#e0ddd8'), hex('#a9a49d'), x, y, z, seed, 0.36), 0, 0],
  callisto: (x, y, z, lat, seed) => [...cratered(hex('#6f665b'), hex('#4a433b'), x, y, z, seed, 0.5), 0, 0],
  ganymede: (x, y, z, lat, seed) => [...cratered(hex('#b6ac9b'), hex('#6f6556'), x, y, z, seed, 0.5), 0, 0],
  mars(x, y, z, lat, seed) {
    let color = blend(hex('#a9472a'), hex('#d48b5a'), fbm(x * 2.2, y * 2.2, z * 2.2, seed, 5));
    color = blend(color, hex('#5d3324'), step(0.42, 0.34, fbm(x * 1.4, y * 1.4, z * 1.4, seed + 2, 4)) * 0.8);
    color = blend(color, hex('#f4efe8'), step(76, 81, Math.abs(lat) / degree));
    return [...color, 0, 0];
  },
  venus: (x, y, z, lat, seed) => [...bands([hex('#d9bf87'), hex('#eedcb0'), hex('#e3c995')], lat, x, y, z, seed,
    { count: 4, turbulence: 0.35, contrast: 0.5 }), 0, 0],
  jupiter(x, y, z, lat, seed) {
    let color = bands([hex('#f1e6cf'), hex('#c9945f'), hex('#e8d2ad'), hex('#a8714a'), hex('#efe0c4')], lat, x, y, z, seed,
      { count: 9, turbulence: 0.12 });
    color = blend(color, hex('#8f8a86'), step(55, 72, Math.abs(lat) / degree));
    const longitude = Math.atan2(y, x);
    const spot = ((longitude - 1.2) / (13 * degree)) ** 2 + ((lat + 22 * degree) / (6 * degree)) ** 2;
    color = blend(color, hex('#c4623f'), step(1, 0.55, spot));
    return [...color, 0, 0];
  },
  saturn: (x, y, z, lat, seed) => [...blend(bands([hex('#efe2bb'), hex('#d8bf86'), hex('#e6d3a3'), hex('#c7a86f')], lat, x, y, z,
    seed, { count: 8, turbulence: 0.05, contrast: 0.5 }), hex('#b8b39a'), step(60, 80, Math.abs(lat) / degree)), 0, 0],
  uranus: (x, y, z, lat, seed) => [...bands([hex('#9fd9e1'), hex('#b4e6ec'), hex('#a8dde4')], lat, x, y, z, seed,
    { count: 5, turbulence: 0.02, contrast: 0.2 }), 0, 0],
  neptune(x, y, z, lat, seed) {
    let color = bands([hex('#3557c9'), hex('#4a72e0'), hex('#2f4eb8')], lat, x, y, z, seed, { count: 6, turbulence: 0.1 });
    const streak = step(0.72, 0.8, fbm(x * 4, y * 4, z * 16, seed + 3, 3));
    color = blend(color, [235, 240, 255], streak * 0.8);
    const spot = ((Math.atan2(y, x) + 0.5) / (12 * degree)) ** 2 + ((lat + 20 * degree) / (6 * degree)) ** 2;
    return [...blend(color, hex('#1c2c78'), step(1, 0.5, spot)), 0, 0];
  },
  io(x, y, z, lat, seed) {
    let color = blend(hex('#e9d65e'), hex('#d8a44a'), fbm(x * 3, y * 3, z * 3, seed, 4));
    const spots = valueNoise(x * 14, y * 14, z * 14, seed + 4);
    if (spots > 0.86) color = blend(color, hex('#2a2018'), 0.8);
    else if (spots < 0.08) color = blend(color, hex('#f4f0dc'), 0.7);
    return [...color, 0, 0];
  },
  europa(x, y, z, lat, seed) {
    const crack = Math.abs(fbm(x * 3, y * 3, z * 3, seed, 5) - 0.5);
    const color = blend(hex('#e6dcc6'), hex('#b49274'), fbm(x * 2, y * 2, z * 2, seed + 2, 3) * 0.6);
    return [...blend(color, hex('#8e5a3c'), step(0.025, 0.008, crack)), 0, 0];
  },
  titan: (x, y, z, lat, seed) => [...bands([hex('#d39a46'), hex('#e0ad5c'), hex('#c98f3f')], lat, x, y, z, seed,
    { count: 3, turbulence: 0.2, contrast: 0.3 }), 0, 0],
  pluto(x, y, z, lat, seed) {
    let color = blend(hex('#c9a585'), hex('#8a5a40'), step(0.5, 0.35, fbm(x * 2, y * 2, z * 2, seed, 4)));
    const heart = ((Math.atan2(y, x)) / (25 * degree)) ** 2 + ((lat - 15 * degree) / (25 * degree)) ** 2;
    color = blend(color, hex('#f1e7da'), step(1, 0.6, heart));
    return [...blend(color, hex('#5a3426'), step(-12, -30, lat / degree) * 0.6), 0, 0];
  },
  charon: (x, y, z, lat, seed) => [...blend(cratered(hex('#aba398'), hex('#6f6a63'), x, y, z, seed, 0.38),
    hex('#7a4535'), step(62, 78, lat / degree) * 0.7), 0, 0],
  triton: (x, y, z, lat, seed) => [...blend(cratered(hex('#d8c6bb'), hex('#9c8a80'), x, y, z, seed, 0.35),
    hex('#f2e4dc'), step(-20, -45, lat / degree)), 0, 0],
  molten(x, y, z, lat, seed) {
    const crack = Math.abs(fbm(x * 3, y * 3, z * 3, seed, 5) - 0.5);
    const glow = step(0.05, 0.01, crack);
    return [...blend(scale(hex('#3a2a24'), 0.8 + 0.4 * fbm(x * 8, y * 8, z * 8, seed + 1, 3)), hex('#ff7a2a'), glow), glow, 0];
  },
  hotRock: (x, y, z, lat, seed) => [...cratered(hex('#7a6258'), hex('#3d2f2a'), x, y, z, seed, 0.5), 0, 0],
  ocean(x, y, z, lat, seed) {
    const cloud = step(0.5, 0.75, fbm(x * 2.6, y * 2.6, z * 5, seed + 2, 5));
    const color = blend(hex('#1d4f8f'), hex('#2f6fb3'), fbm(x * 4, y * 4, z * 4, seed, 3));
    return [...blend(blend(color, hex('#eef3f7'), step(70, 78, Math.abs(lat) / degree)), [245, 247, 250], cloud * 0.85), 0, 1 - cloud];
  },
  iceWorld: (x, y, z, lat, seed) => [...cratered(hex('#dce8ef'), hex('#9fb3bf'), x, y, z, seed, 0.36), 0, 0.2],
  subNeptune: (x, y, z, lat, seed) => [...bands([hex('#86b2d6'), hex('#a3c6e2'), hex('#7aa5cc')], lat, x, y, z, seed,
    { count: 5, turbulence: 0.08, contrast: 0.4 }), 0, 0],
  giant: (x, y, z, lat, seed) => [...bands([hex('#e7d3b0'), hex('#b98d63'), hex('#d9bd93'), hex('#a77d57')], lat, x, y, z, seed,
    { count: 8, turbulence: 0.1 }), 0, 0],
  hotJupiter(x, y, z, lat, seed) {
    const color = bands([hex('#4a2f2c'), hex('#6b3d33'), hex('#3a2624')], lat, x, y, z, seed, { count: 6, turbulence: 0.15 });
    return [...color, 0.35 + 0.3 * fbm(x * 3, y * 3, z * 3, seed + 3, 3), 0];
  },
  youngGiant(x, y, z, lat, seed) {
    const color = bands([hex('#7a3f30'), hex('#a3553a'), hex('#5c2e24')], lat, x, y, z, seed, { count: 6, turbulence: 0.14 });
    return [...color, 0.55, 0];
  }
};

// Equatorial resolution: the large, well-known bodies get more detail.
const detailed = new Set(['earth', 'moon', 'mars', 'jupiter', 'saturn', 'venus', 'mercury', 'neptune', 'uranus', 'pluto']);
const cache = new Map();
const pending = new Set();
const maxTextures = 24;

// Fills rows [from, to) of a texture.
function fillRows(texture, style, seed, from, to) {
  const generate = styles[style] ?? styles.rock;
  const { width, height, color, night, specular } = texture;
  for (let row = from; row < Math.min(to, height); row++) {
    const lat = (0.5 - (row + 0.5) / height) * Math.PI;
    const cosLat = Math.cos(lat), z = Math.sin(lat);
    for (let column = 0; column < width; column++) {
      const lon = ((column + 0.5) / width - 0.5) * 2 * Math.PI;
      const [r, g, b, light, shine] = generate(cosLat * Math.cos(lon), cosLat * Math.sin(lon), z, lat, seed);
      const texel = row * width + column;
      color[3 * texel] = r; color[3 * texel + 1] = g; color[3 * texel + 2] = b;
      night[texel] = Math.round(clamp(light) * 255);
      specular[texel] = Math.round(clamp(shine) * 255);
    }
  }
}

function allocate(style) {
  const width = detailed.has(style) ? 640 : 256, height = width / 2;
  return { width, height, color: new Uint8ClampedArray(width * height * 3), night: new Uint8Array(width * height),
    specular: new Uint8Array(width * height) };
}

// Whole texture at once (tests and tools).
function build(style, seed) {
  const texture = allocate(style);
  fillRows(texture, style, seed, 0, texture.height);
  return texture;
}

/**
 * Texture for a style, or null while it is being generated. Generation runs in short slices of
 * rows between frames, so playback never waits for it; `onReady` is called once it is complete.
 */
export function surfaceTexture(style, seed, onReady) {
  const key = `${style}:${seed % 997}`;
  const found = cache.get(key);
  if (found) return found;
  if (!pending.has(key)) {
    pending.add(key);
    const texture = allocate(style);
    let row = 0;
    const slice = () => {
      const start = performance.now();
      while (row < texture.height && performance.now() - start < 8) {
        fillRows(texture, style, seed % 997, row, row + 4);
        row += 4;
      }
      if (row < texture.height) { setTimeout(slice, 0); return; }
      pending.delete(key);
      if (cache.size >= maxTextures) cache.delete(cache.keys().next().value);
      cache.set(key, texture);
      onReady?.();
    };
    setTimeout(slice, 0);
  }
  return null;
}

export const textureStyles = Object.keys(styles);
export { build as buildTexture };
