// Background sky: fixed stars at infinity and the band of the Milky Way. The stars are
// directions, so they turn with the camera but never move with the bodies. The sky is drawn
// into an offscreen canvas that is only redrawn when the camera or the viewport changes.

// Camera axes in scenario coordinates: screen right (e1), screen up (e2) and toward the viewer (t),
// matching the projection of OrbitCanvas (yaw about z, then pitch).
export function cameraBasis({ yaw, pitch }) {
  const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw), cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
  return { e1: [cosYaw, -sinYaw, 0], e2: [sinYaw * cosPitch, cosYaw * cosPitch, -sinPitch],
    t: [sinYaw * sinPitch, cosYaw * sinPitch, cosPitch], key: `${yaw.toFixed(5)}:${pitch.toFixed(5)}` };
}

const tints = [[190, 210, 255], [236, 240, 255], [255, 241, 220], [255, 214, 176]];
const tintWeights = [0.1, 0.45, 0.3, 0.15];
const levels = 5;
let catalog = null;

function normalize([x, y, z]) {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

function generate() {
  let state = 20241013;
  const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
  const gaussian = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  // The galactic plane is inclined about 60° to the plane of the planets.
  const pole = normalize([0, -0.87, 0.49]);
  const u = normalize([1, 0, 0]);
  const w = normalize([pole[1] * u[2] - pole[2] * u[1], pole[2] * u[0] - pole[0] * u[2], pole[0] * u[1] - pole[1] * u[0]]);
  const inPlane = (longitude, latitude) => {
    const c = Math.cos(latitude), s = Math.sin(latitude);
    return [0, 1, 2].map(axis => c * (Math.cos(longitude) * u[axis] + Math.sin(longitude) * w[axis]) + s * pole[axis]);
  };
  const tint = () => {
    let pick = random(), index = 0;
    while (index < tintWeights.length - 1 && pick > tintWeights[index]) pick -= tintWeights[index++];
    return index;
  };
  const stars = [];
  // Field stars: uniform over the sky, most of them faint.
  for (let i = 0; i < 2400; i++) {
    const z = 2 * random() - 1, phi = 2 * Math.PI * random(), r = Math.sqrt(1 - z * z);
    const brightness = 0.16 + 0.84 * random() ** 7;
    stars.push({ direction: [r * Math.cos(phi), r * Math.sin(phi), z], brightness, tint: tint() });
  }
  // Milky Way: many faint stars close to the galactic plane, denser toward its centre.
  for (let i = 0; i < 4600; i++) {
    const longitude = i % 3 === 0 ? gaussian() * 0.7 : 2 * Math.PI * random();
    const latitude = gaussian() * (0.07 + 0.06 * Math.exp(-longitude * longitude));
    stars.push({ direction: inPlane(longitude, latitude), brightness: 0.05 + 0.3 * random() ** 3, tint: tint() });
  }
  const haze = [];
  for (let i = 0; i < 90; i++) {
    const longitude = i % 2 ? gaussian() * 0.8 : 2 * Math.PI * random();
    haze.push({ direction: inPlane(longitude, gaussian() * 0.05), strength: 0.5 + random() * (1 + Math.exp(-longitude * longitude)) });
  }
  return { stars, haze };
}

function render(canvas, width, height, ratio, basis) {
  catalog ??= generate();
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = '#02040a';
  context.fillRect(0, 0, width, height);
  const { e1, e2, t } = basis;
  const focal = 0.85 * Math.max(width, height);
  // Perspective camera looking along −t, the side of the scene facing away from the viewer.
  const project = direction => {
    const ahead = -(direction[0] * t[0] + direction[1] * t[1] + direction[2] * t[2]);
    if (ahead < 0.08) return null;
    const x = width / 2 + focal * (direction[0] * e1[0] + direction[1] * e1[1] + direction[2] * e1[2]) / ahead;
    const y = height / 2 - focal * (direction[0] * e2[0] + direction[1] * e2[1] + direction[2] * e2[2]) / ahead;
    return x < -60 || y < -60 || x > width + 60 || y > height + 60 ? null : { x, y, ahead };
  };

  context.globalCompositeOperation = 'lighter';
  for (const blob of catalog.haze) {
    const point = project(blob.direction);
    if (!point) continue;
    const radius = focal * 0.16 / point.ahead;
    const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
    glow.addColorStop(0, `rgba(170, 180, 225, ${0.022 * blob.strength})`);
    glow.addColorStop(1, 'rgba(170, 180, 225, 0)');
    context.fillStyle = glow;
    context.fillRect(point.x - radius, point.y - radius, 2 * radius, 2 * radius);
  }
  context.globalCompositeOperation = 'source-over';

  // One path per tint and brightness level keeps the fill calls few.
  const paths = Array.from({ length: tints.length * levels }, () => []);
  for (const star of catalog.stars) {
    const point = project(star.direction);
    if (!point) continue;
    const level = Math.min(levels - 1, Math.floor(star.brightness * levels));
    paths[star.tint * levels + level].push(point);
  }
  paths.forEach((points, bucket) => {
    if (!points.length) return;
    const level = bucket % levels, [r, g, b] = tints[Math.floor(bucket / levels)];
    const size = level >= 4 ? 1.7 : level >= 2 ? 1.25 : 0.9;
    context.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.2 + 0.2 * level})`;
    context.beginPath();
    for (const point of points) context.rect(point.x - size / 2, point.y - size / 2, size, size);
    context.fill();
    if (level === levels - 1) {
      context.fillStyle = `rgba(${r}, ${g}, ${b}, 0.12)`;
      context.beginPath();
      for (const point of points) {
        context.moveTo(point.x + 2.6, point.y);
        context.arc(point.x, point.y, 2.6, 0, 2 * Math.PI);
      }
      context.fill();
    }
  });
}

// Draws the sky behind the scene; `cache` ({ key, canvas }) keeps the rendered image.
export function drawSky(context, cache, width, height, ratio, basis) {
  const key = `${width}x${height}@${ratio}|${basis.key}`;
  if (typeof document === 'undefined') return;
  cache.canvas ??= document.createElement('canvas');
  if (cache.key !== key) {
    render(cache.canvas, width, height, ratio, basis);
    cache.key = key;
  }
  context.drawImage(cache.canvas, 0, 0, width, height);
}
