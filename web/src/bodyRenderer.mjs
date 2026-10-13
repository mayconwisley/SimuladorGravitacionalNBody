// Canvas drawing of the bodies: lit spheres with their surface texture, phases on small discs,
// stars with limb darkening and glow, Saturn's rings, comet tails, spacecraft, black holes,
// galactic nuclei and clusters. Vectors are in scenario axes; `basis` gives the camera axes
// e1 (screen right), e2 (screen up) and t (toward the viewer).

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const rgba = ([r, g, b], alpha) => `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
const towardWhite = (rgb, amount) => rgb.map(channel => channel + (255 - channel) * amount);

/**
 * Renders a textured, lit sphere of `diameter` pixels into `target` ({ canvas, image }).
 * light: unit vector toward the light source; lightRgb: light colour (0–1 per channel);
 * spin: rotation angle (rad) about the body's z axis; atmosphere: rim colour or null;
 * glow: style with its own light (lava, hot giants), drawn on the day side too.
 */
// Per-pixel geometry of the visible hemisphere for one diameter, camera and texture size: the
// normal in scenario axes, the texture column before rotation and the texture row. It changes
// only when the camera moves, so a playing animation only computes the lighting.
function sphereGeometry(target, diameter, basis, width, height) {
  const key = `${diameter}|${basis.key}|${width}`;
  if (target.geometry?.key === key) return target.geometry;
  const { e1, e2, t } = basis;
  const radius = diameter / 2;
  const capacity = diameter * diameter;
  const pixel = new Int32Array(capacity), row = new Int32Array(capacity), column = new Float32Array(capacity);
  const normal = new Float32Array(3 * capacity), edge = new Uint8Array(capacity);
  // Limb darkening of gas giants and the atmosphere's rim weight, both functions of the angle
  // between the surface and the line of sight.
  const limb = new Float32Array(capacity), rim = new Float32Array(capacity);
  let count = 0;
  for (let py = 0; py < diameter; py++) {
    const sy = 1 - (py + 0.5) / radius;
    for (let px = 0; px < diameter; px++) {
      const sx = (px + 0.5) / radius - 1;
      const rr = sx * sx + sy * sy;
      if (rr >= 1) continue;
      const sz = Math.sqrt(1 - rr);
      const nx = sx * e1[0] + sy * e2[0] + sz * t[0];
      const ny = sx * e1[1] + sy * e2[1] + sz * t[1];
      const nz = sx * e1[2] + sy * e2[2] + sz * t[2];
      pixel[count] = py * diameter + px;
      normal[3 * count] = nx; normal[3 * count + 1] = ny; normal[3 * count + 2] = nz;
      column[count] = (Math.atan2(ny, nx) / (2 * Math.PI) + 0.5) * width;
      row[count] = Math.min(height - 1, Math.max(0, Math.floor((0.5 - Math.asin(clamp(nz, -1, 1)) / Math.PI) * height))) * width;
      limb[count] = 0.55 + 0.45 * Math.sqrt(sz);
      rim[count] = (1 - sz) ** 2.2;
      edge[count] = 255 * clamp((1 - Math.sqrt(rr)) * radius * 1.5);
      count++;
    }
  }
  target.geometry = { key, count, pixel, row, column, normal, limb, rim, edge };
  return target.geometry;
}

export function renderSphere(target, diameter, texture, { basis, light, lightRgb, spin, atmosphere, banded, glow }) {
  target.canvas ??= document.createElement('canvas');
  const canvas = target.canvas;
  if (canvas.width !== diameter) { canvas.width = diameter; canvas.height = diameter; }
  const context = canvas.getContext('2d');
  if (target.image?.width !== diameter) target.image = context.createImageData(diameter, diameter);
  const data = target.image.data;
  const { width, height, color, night, specular } = texture;
  const { t } = basis;
  const { count, pixel, row, column, normal, limb, rim, edge } = sphereGeometry(target, diameter, basis, width, height);
  // Turning the body by `spin` about its axis shifts the texture columns.
  const shift = spin / (2 * Math.PI) * width;
  const [lx, ly, lz] = light;
  const [lr, lg, lb] = lightRgb;
  let hx = lx + t[0], hy = ly + t[1], hz = lz + t[2];
  const hl = Math.hypot(hx, hy, hz) || 1;
  hx /= hl; hy /= hl; hz /= hl;
  const ambient = 0.04;
  for (let k = 0; k < count; k++) {
    let u = column[k] - shift;
    u -= width * Math.floor(u / width);
    const texel = row[k] + (u >= width ? width - 1 : u | 0);
    const nx = normal[3 * k], ny = normal[3 * k + 1], nz = normal[3 * k + 2];
    const diffuse = nx * lx + ny * ly + nz * lz;
    // Atmospheres scatter a little light past the terminator.
    let shade = atmosphere ? (diffuse + 0.08) / 1.08 : diffuse;
    if (shade < 0) shade = 0; else if (shade > 1) shade = 1;
    if (banded) shade *= limb[k];
    let r = color[3 * texel] * (shade * lr + ambient);
    let g = color[3 * texel + 1] * (shade * lg + ambient);
    let b = color[3 * texel + 2] * (shade * lb + ambient);
    const emitted = night[texel] / 255;
    if (emitted > 0) {
      let dark = glow ? 1 - 0.6 * shade : (0.08 - diffuse) / 0.22;
      if (dark < 0) dark = 0; else if (dark > 1) dark = 1;
      r += 255 * emitted * dark * 0.8; g += 170 * emitted * dark * 0.8; b += 80 * emitted * dark * 0.8;
    }
    if (specular[texel] && diffuse > 0) {
      // Ocean glint: (n·h)^60 by repeated squaring.
      const h1 = Math.max(0, nx * hx + ny * hy + nz * hz), h4 = h1 * h1 * h1 * h1, h8 = h4 * h4, h16 = h8 * h8;
      const glint = h16 * h16 * h16 * h8 * h4 * specular[texel] / 255 * 0.55;
      r += 255 * glint * lr; g += 255 * glint * lg; b += 255 * glint * lb;
    }
    if (atmosphere) {
      let scatter = diffuse * 1.3 + 0.25;
      if (scatter < 0) scatter = 0; else if (scatter > 1) scatter = 1;
      const haze = rim[k] * scatter * 0.85;
      r += (atmosphere[0] - r) * haze; g += (atmosphere[1] - g) * haze; b += (atmosphere[2] - b) * haze;
    }
    const index = 4 * pixel[k];
    data[index] = r; data[index + 1] = g; data[index + 2] = b;
    data[index + 3] = edge[k];
  }
  context.putImageData(target.image, 0, 0);
  return canvas;
}

// Thin glow of an atmosphere just outside the limb, brighter on the lit side.
export function drawAtmosphereHalo(context, x, y, radius, rgb, viewLight) {
  const offset = radius * 0.04;
  const cx = x + viewLight[0] * offset, cy = y - viewLight[1] * offset;
  // A gradient paints its first colour inside the inner circle too: keep the disc itself clear.
  const inner = 0.97 / 1.07;
  const halo = context.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.07);
  halo.addColorStop(0, rgba(rgb, 0));
  halo.addColorStop(inner - 0.04, rgba(rgb, 0));
  halo.addColorStop(inner, rgba(rgb, 0.38 * clamp(0.4 + viewLight[2])));
  halo.addColorStop(1, rgba(rgb, 0));
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.fillStyle = halo;
  context.beginPath();
  context.arc(cx, cy, radius * 1.07, 0, 2 * Math.PI);
  context.fill();
  context.restore();
}

// Disc with its phase: the lit part is a half disc plus or minus half of the terminator ellipse.
// viewLight: light direction in camera axes (right, up, toward the viewer).
export function drawLitDisc(context, x, y, radius, rgb, lightRgb, viewLight) {
  const lit = rgb.map((channel, i) => channel * lightRgb[i]);
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI);
  context.fillStyle = rgba(rgb.map(channel => channel * 0.07 + 6), 1);
  context.fill();
  const toward = clamp(viewLight[2], -1, 1);
  context.save();
  context.translate(x, y);
  context.rotate(Math.atan2(-viewLight[1], viewLight[0]));
  context.beginPath();
  context.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
  if (toward >= 0) context.ellipse(0, 0, radius * toward, radius, 0, Math.PI / 2, 3 * Math.PI / 2, false);
  else context.ellipse(0, 0, radius * -toward, radius, 0, Math.PI / 2, -Math.PI / 2, true);
  context.closePath();
  const shading = context.createRadialGradient(radius * 0.35, 0, 0, 0, 0, radius);
  shading.addColorStop(0, rgba(towardWhite(lit, 0.12), 1));
  shading.addColorStop(1, rgba(lit.map(channel => channel * 0.7), 1));
  context.fillStyle = shading;
  context.fill();
  context.restore();
}

// A star: limb-darkened disc, a glow and, when it is only a point of light, faint diffraction spikes.
export function drawStar(context, x, y, radius, rgb) {
  context.save();
  context.globalCompositeOperation = 'lighter';
  const reach = Math.max(radius * 3.4, radius + 14);
  const glow = context.createRadialGradient(x, y, radius * 0.4, x, y, reach);
  glow.addColorStop(0, rgba(rgb, 0.5));
  glow.addColorStop(0.3, rgba(rgb, 0.14));
  glow.addColorStop(1, rgba(rgb, 0));
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, reach, 0, 2 * Math.PI);
  context.fill();
  if (radius < 14) {
    context.strokeStyle = rgba(towardWhite(rgb, 0.5), 0.22);
    context.lineWidth = 0.8;
    context.beginPath();
    context.moveTo(x - radius * 4, y); context.lineTo(x + radius * 4, y);
    context.moveTo(x, y - radius * 4); context.lineTo(x, y + radius * 4);
    context.stroke();
  }
  context.restore();
  const disc = context.createRadialGradient(x, y, 0, x, y, radius);
  disc.addColorStop(0, rgba(towardWhite(rgb, 0.8), 1));
  disc.addColorStop(0.65, rgba(towardWhite(rgb, 0.35), 1));
  disc.addColorStop(1, rgba(rgb.map(channel => channel * 0.82), 1));
  context.fillStyle = disc;
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI);
  context.fill();
}

// Event horizon (black) inside a hot accretion glow and a thin photon ring.
export function drawBlackHole(context, x, y, radius) {
  context.save();
  context.globalCompositeOperation = 'lighter';
  const glow = context.createRadialGradient(x, y, radius * 0.9, x, y, radius * 3);
  glow.addColorStop(0, 'rgba(255, 214, 160, 0.85)');
  glow.addColorStop(0.3, 'rgba(255, 140, 60, 0.4)');
  glow.addColorStop(1, 'rgba(255, 110, 40, 0)');
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, radius * 3, 0, 2 * Math.PI);
  context.fill();
  context.restore();
  context.fillStyle = '#000';
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI);
  context.fill();
  context.strokeStyle = 'rgba(255, 232, 196, 0.9)';
  context.lineWidth = 1;
  context.beginPath();
  context.arc(x, y, radius * 1.08, 0, 2 * Math.PI);
  context.stroke();
}

// Unresolved stellar light: a galactic nucleus or a star cluster.
export function drawDiffuseLight(context, x, y, radius, rgb, reach) {
  context.save();
  context.globalCompositeOperation = 'lighter';
  const glow = context.createRadialGradient(x, y, 0, x, y, radius * reach);
  glow.addColorStop(0, rgba(towardWhite(rgb, 0.7), 0.95));
  glow.addColorStop(0.12, rgba(rgb, 0.55));
  glow.addColorStop(0.45, rgba(rgb, 0.12));
  glow.addColorStop(1, rgba(rgb, 0));
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, radius * reach, 0, 2 * Math.PI);
  context.fill();
  context.restore();
}

// Spacecraft: a small bright bus between two solar panels, with a glint.
export function drawCraft(context, x, y, radius) {
  const panel = radius * 1.9, half = radius * 0.45;
  context.fillStyle = 'rgba(96, 140, 210, 0.95)';
  context.fillRect(x - radius - panel, y - half, panel, 2 * half);
  context.fillRect(x + radius, y - half, panel, 2 * half);
  context.fillStyle = '#eef1f6';
  context.fillRect(x - radius * 0.7, y - radius * 0.7, radius * 1.4, radius * 1.4);
  context.save();
  context.globalCompositeOperation = 'lighter';
  const glint = context.createRadialGradient(x, y, 0, x, y, radius * 4);
  glint.addColorStop(0, 'rgba(230, 240, 255, 0.35)');
  glint.addColorStop(1, 'rgba(230, 240, 255, 0)');
  context.fillStyle = glint;
  context.beginPath();
  context.arc(x, y, radius * 4, 0, 2 * Math.PI);
  context.fill();
  context.restore();
}

// Comet activity: the ion tail points straight away from the star, the dust tail curves
// back along the orbit; both grow as the comet nears the star (activity 0–1).
export function drawCometTails(context, x, y, antiStar, behind, activity) {
  const length = 10 + 90 * activity;
  context.save();
  context.globalCompositeOperation = 'lighter';
  const coma = context.createRadialGradient(x, y, 0, x, y, 3 + 9 * activity);
  coma.addColorStop(0, 'rgba(220, 240, 255, 0.8)');
  coma.addColorStop(1, 'rgba(160, 210, 255, 0)');
  context.fillStyle = coma;
  context.beginPath();
  context.arc(x, y, 3 + 9 * activity, 0, 2 * Math.PI);
  context.fill();
  if (activity > 0.03) {
    const ionEnd = { x: x + antiStar.x * length, y: y + antiStar.y * length };
    const ion = context.createLinearGradient(x, y, ionEnd.x, ionEnd.y);
    ion.addColorStop(0, `rgba(130, 185, 255, ${0.55 * activity + 0.1})`);
    ion.addColorStop(1, 'rgba(130, 185, 255, 0)');
    context.strokeStyle = ion;
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(ionEnd.x, ionEnd.y);
    context.stroke();
    const dustEnd = { x: x + (antiStar.x * 0.75 + behind.x * 0.35) * length, y: y + (antiStar.y * 0.75 + behind.y * 0.35) * length };
    const dust = context.createLinearGradient(x, y, dustEnd.x, dustEnd.y);
    dust.addColorStop(0, `rgba(255, 238, 205, ${0.45 * activity + 0.08})`);
    dust.addColorStop(1, 'rgba(255, 238, 205, 0)');
    context.strokeStyle = dust;
    context.lineWidth = 1 + 2.5 * activity;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + antiStar.x * length * 0.6, y + antiStar.y * length * 0.6, dustEnd.x, dustEnd.y);
    context.stroke();
  }
  context.restore();
}

// Saturn's main rings (C, B and A, with the Cassini division) in the planet's equatorial plane,
// taken as the xy plane. `half` is 'back' (behind the planet) or 'front'.
const ringBands = [[1.24, 1.53, 0.3, [176, 162, 138]], [1.53, 1.95, 0.78, [230, 214, 180]], [2.03, 2.27, 0.55, [216, 200, 166]]];
export function drawRings(context, x, y, radius, basis, half, brightness = 1) {
  const { e1, e2, t } = basis;
  const facing = Math.atan2(t[1], t[0]);
  const start = half === 'back' ? facing + Math.PI / 2 : facing - Math.PI / 2;
  const steps = 48;
  const at = (angle, scale) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [x + scale * (c * e1[0] + s * e1[1]), y - scale * (c * e2[0] + s * e2[1])];
  };
  for (const [inner, outer, alpha, rgb] of ringBands) {
    context.beginPath();
    for (let i = 0; i <= steps; i++) {
      const [px, py] = at(start + Math.PI * i / steps, outer * radius);
      if (i === 0) context.moveTo(px, py); else context.lineTo(px, py);
    }
    for (let i = steps; i >= 0; i--) context.lineTo(...at(start + Math.PI * i / steps, inner * radius));
    context.closePath();
    context.fillStyle = rgba(rgb.map(channel => channel * brightness), alpha);
    context.fill();
  }
}

// Light direction in camera axes.
export const viewVector = (vector, { e1, e2, t }) => [dot(vector, e1), dot(vector, e2), dot(vector, t)];
