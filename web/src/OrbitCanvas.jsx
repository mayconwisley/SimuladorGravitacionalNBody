import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icons.jsx';
import { formatNumber } from './format.mjs';
import { bodyAppearance, hexToRgb, particleAppearance } from './bodyAppearance.mjs';
import { drawAtmosphereHalo, drawBlackHole, drawCometTails, drawCraft, drawDiffuseLight, drawLitDisc, drawRings, drawStar, renderSphere,
  viewVector } from './bodyRenderer.mjs';
import { surfaceTexture } from './planetTextures.mjs';
import { cameraBasis, drawSky } from './skyRenderer.mjs';

const defaultCamera = { yaw: -0.22, pitch: 0.38, zoom: 1 };
const views = [
  { key: '3d', label: '3D', camera: { yaw: -0.22, pitch: 0.38 } },
  { key: 'xy', label: 'XY', camera: { yaw: 0, pitch: 0 } },
  { key: 'xz', label: 'XZ', camera: { yaw: 0, pitch: -Math.PI / 2 } }
];
const trailChunks = 28;
const maxTrailBodies = 24;
// Discs at least this large (px) get their surface texture; smaller ones a shaded phase.
const texturedRadius = 7;
const maxSphereDiameter = 360;
const white = [1, 1, 1];

// Sunlight for scenarios without a star: from the upper left and in front of the default view,
// fixed in the scenario axes, so turning the camera shows the night side.
const defaultLight = (() => {
  const { e1, e2, t } = cameraBasis(defaultCamera);
  const view = [-0.55, 0.42, 0.72];
  const vector = [0, 1, 2].map(axis => view[0] * e1[axis] + view[1] * e2[axis] + view[2] * t[axis]);
  const length = Math.hypot(...vector);
  return vector.map(value => value / length);
})();

function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Largest "nice" length (1, 2 or 5 × 10^n metres) that fits in the given pixel budget.
function scaleBar(metersPerPixel, maxPixels) {
  const target = metersPerPixel * maxPixels;
  const power = 10 ** Math.floor(Math.log10(target));
  const meters = [5, 2, 1].map(step => step * power).find(value => value <= target) ?? power;
  return { meters, pixels: meters / metersPerPixel };
}

// Rounded label background; avoids CanvasRenderingContext2D.roundRect, missing in older browsers.
function pill(context, x, y, width, height) {
  const radius = height / 2;
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.arc(x + width - radius, y + radius, radius, -Math.PI / 2, Math.PI / 2);
  context.lineTo(x + radius, y + height);
  context.arc(x + radius, y + radius, radius, Math.PI / 2, 3 * Math.PI / 2);
  context.closePath();
}

// The two most massive bodies of the first frame define the co-rotating frame.
function rotatingPair(dataset) {
  const first = dataset?.frames[0];
  if (!first) return null;
  const massive = [...first.bodies.values()].filter(item => item.mass > 0).sort((a, b) => b.mass - a.mass);
  return massive.length >= 2 ? [massive[0].name, massive[1].name] : null;
}

// Maps a sample to a function giving positions relative to the chosen reference frame:
// the centre of mass, a focused body, or the frame rotating with the two heaviest bodies.
function frameTransform(sample, focus, pair) {
  if (pair) {
    const a = sample.bodies.get(pair[0]), b = sample.bodies.get(pair[1]);
    const mass = a.mass + b.mass;
    const cx = (a.mass * a.x + b.mass * b.x) / mass, cy = (a.mass * a.y + b.mass * b.y) / mass;
    const cz = (a.mass * a.z + b.mass * b.z) / mass;
    const angle = Math.atan2(b.y - a.y, b.x - a.x), cos = Math.cos(angle), sin = Math.sin(angle);
    return (x, y, z) => {
      const dx = x - cx, dy = y - cy;
      return [dx * cos + dy * sin, -dx * sin + dy * cos, z - cz];
    };
  }
  const center = focus ? sample.bodies.get(focus) ?? sample.center : sample.center;
  return (x, y, z) => [x - center.x, y - center.y, z - center.z];
}

const unit = vector => {
  const length = Math.hypot(...vector) || 1;
  return vector.map(value => value / length);
};

export default function OrbitCanvas({ dataset, index, focus, source, emptyActions, loading = false, emptyNotice = '',
  preferredFrame = 'inertial', canMove = false, onMoveBody }) {
  const canvasRef = useRef(null);
  const pointer = useRef(null);
  const projection = useRef(null);
  const sky = useRef({ key: '', canvas: null });
  const spheres = useRef(new Map());
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [camera, setCamera] = useState(defaultCamera);
  const [showTrails, setShowTrails] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showLabels, setShowLabels] = useState(null);
  const [frameMode, setFrameMode] = useState(preferredFrame);
  const [moveMode, setMoveMode] = useState(false);
  const [drag, setDrag] = useState(null);
  const [scale, setScale] = useState(null);
  const [textures, setTextures] = useState(0);
  const labels = showLabels ?? (dataset ? dataset.names.length <= 8 : true);
  const pair = useMemo(() => rotatingPair(dataset), [dataset?.id, dataset?.frames.length > 0]);
  const rotating = frameMode === 'rotating' && pair !== null;
  const moving = moveMode && canMove && !rotating && Boolean(focus);

  useEffect(() => {
    const canvas = canvasRef.current;
    const observer = new ResizeObserver(() => {
      const bounds = canvas.getBoundingClientRect();
      setSize({ width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wheel = event => {
      event.preventDefault();
      setCamera(previous => ({ ...previous,
        zoom: Math.max(0.25, Math.min(40, previous.zoom * Math.exp(-event.deltaY * 0.001))) }));
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => canvas.removeEventListener('wheel', wheel);
  }, []);

  // A new run (not a streamed chunk of the same run) restores the default display and releases
  // the sphere images of the previous one.
  useEffect(() => {
    setShowLabels(null); setFrameMode(preferredFrame); setMoveMode(false);
    spheres.current.clear();
  }, [dataset?.id, preferredFrame]);
  useEffect(() => { if (!canMove) setMoveMode(false); }, [canMove]);

  // Appearance of every body (kind, colour, real radius, surface), fixed for a run. The names
  // arrive with the first samples; the frames array may already be growing before that.
  const names = dataset?.names;
  const looks = useMemo(() => {
    const first = dataset?.frames[0];
    if (!first || !names?.length) return new Map();
    return new Map(names.map((name, position) => {
      const body = first.bodies.get(name);
      return [name, bodyAppearance(name, body?.mass ?? 0, body?.radius ?? 0, position)];
    }));
  }, [dataset?.id, names]);
  const particleLooks = useMemo(() => (dataset?.particleGroups ?? []).map(particleAppearance), [dataset?.particleGroups]);

  // Closest approach of each comet to the brightest star, which sets how active its tails are.
  const perihelia = useMemo(() => {
    const found = new Map();
    const stars = [...looks.values()].filter(look => look.kind === 'star').sort((a, b) => b.luminosity - a.luminosity);
    const comets = [...looks.values()].filter(look => look.kind === 'comet');
    if (!dataset?.frames.length || !stars.length || !comets.length) return found;
    const stride = Math.max(1, Math.ceil(dataset.frames.length / 2000));
    for (const comet of comets) {
      let closest = Infinity;
      for (let i = 0; i < dataset.frames.length; i += stride) {
        const a = dataset.frames[i].bodies.get(comet.name), b = dataset.frames[i].bodies.get(stars[0].name);
        if (a?.active && b?.active) closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
      }
      if (Number.isFinite(closest)) found.set(comet.name, closest);
    }
    return found;
  }, [dataset, looks]);

  const extent = useMemo(() => {
    if (!dataset?.frames.length) return 1;
    let largest = 0;
    const stride = Math.max(1, Math.ceil(dataset.frames.length / 300));
    for (let i = 0; i < dataset.frames.length; i += stride) {
      const frame = dataset.frames[i];
      const transform = frameTransform(frame, rotating ? null : focus, rotating ? pair : null);
      for (const body of frame.bodies.values()) {
        if (!body.active) continue;
        const [x, y, z] = transform(body.x, body.y, body.z);
        largest = Math.max(largest, Math.hypot(x, y, z));
      }
      if (frame.particles && (i === 0 || i + stride >= dataset.frames.length)) {
        for (let k = 0; k < frame.particles.length; k += 9) {
          const [x, y, z] = transform(frame.particles[k], frame.particles[k + 1], frame.particles[k + 2]);
          if (Number.isFinite(x)) largest = Math.max(largest, Math.hypot(x, y, z));
        }
      }
    }
    return largest || 1;
  }, [dataset, focus, rotating, pair]);

  // Trail positions in the displayed frame, one Float64Array (xyz per sample, NaN while inactive)
  // per body. They change only with the data or the reference frame, not with the camera or the
  // playback index, so each animation frame only projects them.
  const trails = useMemo(() => {
    if (!dataset?.frames.length) return [];
    const frames = dataset.frames;
    const transforms = frames.map(frame => frameTransform(frame, rotating ? null : focus, rotating ? pair : null));
    return dataset.names.slice(0, maxTrailBodies).map(name => {
      const points = new Float64Array(3 * frames.length).fill(NaN);
      frames.forEach((frame, i) => {
        const body = frame.bodies.get(name);
        if (!body?.active) return;
        const [x, y, z] = transforms[i](body.x, body.y, body.z);
        points[3 * i] = x; points[3 * i + 1] = y; points[3 * i + 2] = z;
      });
      return points;
    });
  }, [dataset, focus, rotating, pair]);

  // Resizing a canvas reallocates its pixel buffer: do it only when the element size changes.
  const ratio = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2);
  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
  }, [size, ratio]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const basis = cameraBasis(camera);
    drawSky(context, sky.current, size.width, size.height, Math.min(ratio, 1.5), basis);
    if (!dataset?.frames.length) { setScale(null); projection.current = null; return; }

    const frameIndex = Math.min(index, dataset.frames.length - 1);
    const frame = dataset.frames[frameIndex];
    const current = frameTransform(frame, rotating ? null : focus, rotating ? pair : null);
    const { e1, e2, t } = basis;
    const pixelsPerMeter = Math.min(size.width, size.height) * 0.37 * camera.zoom / extent;
    const rotate = (x, y, z) => ({ x: x * e1[0] + y * e1[1], vertical: x * e2[0] + y * e2[1] + z * e2[2],
      depth: x * t[0] + y * t[1] + z * t[2] });
    // `depth` grows toward the viewer: nearer points are drawn later and slightly larger.
    const perspectiveOf = depth => 1 / Math.max(0.45, 1 - depth / extent * 0.13);
    const project = ([x, y, z]) => {
      const view = rotate(x, y, z);
      const perspective = perspectiveOf(view.depth);
      return { x: size.width / 2 + view.x * pixelsPerMeter * perspective,
        y: size.height / 2 - view.vertical * pixelsPerMeter * perspective, depth: view.depth, perspective };
    };

    // Optional reference rings in the XY plane of the frame origin.
    if (showGrid) {
      context.lineWidth = 1;
      [0.35, 0.7, 1.05].forEach((fraction, ring) => {
        context.beginPath();
        for (let i = 0; i <= 120; i++) {
          const angle = i * Math.PI * 2 / 120;
          const point = project([extent * fraction * Math.cos(angle), extent * fraction * Math.sin(angle), 0]);
          if (i === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        }
        context.setLineDash(ring === 2 ? [2, 5] : []);
        context.strokeStyle = `rgba(120, 160, 210, ${0.16 - ring * 0.03})`;
        context.stroke();
      });
      context.setLineDash([]);
    }

    // Trails and particles take an optional depth: with it, only the parts nearer to the viewer
    // are drawn, to repaint them over a large body they pass in front of.
    const last = dataset.frames.length - 1;
    const stride = Math.max(1, Math.ceil(dataset.frames.length / 900));
    const all = [];
    for (let i = 0; i < last; i += stride) all.push(i);
    all.push(last);
    const travelled = [];
    for (let i = 0; i < frameIndex; i += stride) travelled.push(i);
    travelled.push(frameIndex);
    const chunk = Math.max(1, Math.ceil(travelled.length / trailChunks));
    // Polyline through indices[from..to], broken where the body is inactive (NaN) or behind `near`.
    const path = (points, indices, from, to, near) => {
      let open = false;
      for (let k = from; k <= to; k++) {
        const i = indices[k];
        const x = points[3 * i];
        if (Number.isNaN(x)) { open = false; continue; }
        const point = project([x, points[3 * i + 1], points[3 * i + 2]]);
        if (near !== undefined && point.depth <= near) { open = false; continue; }
        if (open) context.lineTo(point.x, point.y);
        else { context.moveTo(point.x, point.y); open = true; }
      }
    };
    const drawTrails = near => {
      if (!showTrails) return;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      trails.forEach((points, colorIndex) => {
        if (points.length !== 3 * dataset.frames.length) return;
        const color = looks.get(dataset.names[colorIndex])?.color ?? '#9fb3c8';
        context.beginPath();
        path(points, all, 0, all.length - 1, near);
        context.strokeStyle = rgba(color, 0.11);
        context.lineWidth = 1;
        context.stroke();
        if (frameIndex === 0) return;
        for (let start = 0; start < travelled.length - 1; start += chunk) {
          const end = Math.min(travelled.length - 1, start + chunk);
          const recency = end / (travelled.length - 1);
          context.beginPath();
          path(points, travelled, start, end, near);
          context.strokeStyle = rgba(color, 0.12 + 0.78 * recency ** 1.6);
          context.lineWidth = 0.8 + 1.4 * recency;
          context.stroke();
        }
      });
    };
    const groups = dataset.particleGroups.length ? dataset.particleGroups
      : [{ start: 0, count: frame.particles ? frame.particles.length / 3 : 0 }];
    // One path per group: a single fill call instead of one per particle. Star-like particles add
    // their light, so dense regions glow.
    const drawParticles = near => {
      if (!frame.particles) return;
      groups.forEach((group, groupIndex) => {
        const look = particleLooks[groupIndex] ?? particleAppearance(group, groupIndex);
        const half = look.glow ? 0.6 : 0.7;
        context.beginPath();
        for (let k = group.start; k < group.start + group.count; k++) {
          const x = frame.particles[3 * k];
          if (!Number.isFinite(x)) continue;
          const point = project(current(x, frame.particles[3 * k + 1], frame.particles[3 * k + 2]));
          if (near !== undefined && point.depth <= near) continue;
          context.rect(point.x - half, point.y - half, 2 * half, 2 * half);
        }
        context.save();
        if (look.glow) context.globalCompositeOperation = 'lighter';
        context.fillStyle = rgba(look.color, look.glow ? 0.32 : 0.8);
        context.fill();
        context.restore();
      });
    };
    drawTrails();
    drawParticles();

    // Bodies, far to near. Planets and moons are lit by the star that illuminates them most
    // (luminosity / distance²), or by the fixed sunlight when the scenario has no star.
    const items = dataset.names.map(name => ({ body: frame.bodies.get(name), look: looks.get(name) }))
      .filter(item => item.body?.active && item.look)
      .map(item => {
        const position = current(item.body.x, item.body.y, item.body.z);
        const screen = project(position);
        const physical = item.look.radius * pixelsPerMeter * screen.perspective;
        return { ...item, position, screen, physical, radius: Math.max(item.look.marker, physical) };
      });
    const stars = items.filter(item => item.look.kind === 'star').map(item => ({ name: item.body.name,
      position: item.position, luminosity: item.look.luminosity,
      light: item.look.rgb.map(channel => channel / Math.max(...item.look.rgb)) }));
    const massive = items.filter(item => item.body.mass > 0);
    const lightFor = item => {
      let best = null, strongest = 0;
      for (const star of stars) {
        if (star.name === item.body.name) continue;
        const d2 = (star.position[0] - item.position[0]) ** 2 + (star.position[1] - item.position[1]) ** 2 +
          (star.position[2] - item.position[2]) ** 2;
        if (d2 > 0 && star.luminosity / d2 > strongest) { strongest = star.luminosity / d2; best = star; }
      }
      return best ? { direction: unit(best.position.map((value, axis) => value - item.position[axis])), rgb: best.light }
        : { direction: defaultLight, rgb: white };
    };
    // Rotation angle of the surface: tidally locked bodies keep longitude 0 toward the body that
    // raises the strongest tide on them (mass / distance³); the others turn with their period.
    const spinOf = item => {
      if (item.look.locked) {
        let primary = null, strongest = 0;
        for (const other of massive) {
          if (other === item) continue;
          const d = Math.hypot(...other.position.map((value, axis) => value - item.position[axis]));
          if (d > 0 && other.body.mass / d ** 3 > strongest) { strongest = other.body.mass / d ** 3; primary = other; }
        }
        if (primary) return Math.atan2(primary.position[1] - item.position[1], primary.position[0] - item.position[0]);
      }
      return item.look.rotation ? 2 * Math.PI * (frame.time ?? 0) / (item.look.rotation * 3600) : 0;
    };
    const redraw = () => setTextures(value => value + 1);
    const used = new Set();
    const screens = new Map();
    items.sort((a, b) => a.screen.depth - b.screen.depth).forEach(item => {
      const { body, look, screen, radius } = item;
      const { x, y } = screen;
      screens.set(body.name, { ...screen, radius });
      if (x < -radius * 4 - 40 || y < -radius * 4 - 40 || x > size.width + radius * 4 + 40 || y > size.height + radius * 4 + 40) return;
      if (look.kind === 'star') drawStar(context, x, y, radius, look.rgb);
      else if (look.kind === 'blackHole') drawBlackHole(context, x, y, radius);
      else if (look.kind === 'galaxy') drawDiffuseLight(context, x, y, radius, [255, 226, 186], 6);
      else if (look.kind === 'cluster') drawDiffuseLight(context, x, y, radius, [255, 236, 205], 5);
      else if (look.kind === 'craft') drawCraft(context, x, y, Math.min(radius, 2.4));
      else {
        const light = lightFor(item);
        if (look.rings) drawRings(context, x, y, radius, basis, 'back');
        const texture = radius >= texturedRadius ? surfaceTexture(look.style, look.seed, redraw) : null;
        if (texture) {
          const diameter = Math.min(maxSphereDiameter, Math.ceil(2 * radius * ratio));
          const target = spheres.current.get(body.name) ?? {};
          spheres.current.set(body.name, target);
          used.add(body.name);
          const image = renderSphere(target, diameter, texture, { basis, light: light.direction, lightRgb: light.rgb,
            spin: spinOf(item), atmosphere: look.atmosphere,
            banded: ['jupiter', 'saturn', 'uranus', 'neptune', 'giant', 'subNeptune', 'hotJupiter', 'youngGiant'].includes(look.style),
            glow: ['molten', 'hotJupiter', 'youngGiant'].includes(look.style) });
          context.drawImage(image, x - radius, y - radius, 2 * radius, 2 * radius);
          if (look.atmosphere) drawAtmosphereHalo(context, x, y, radius, look.atmosphere, viewVector(light.direction, basis));
        } else {
          drawLitDisc(context, x, y, radius, look.rgb, light.rgb, viewVector(light.direction, basis));
        }
        if (look.rings) drawRings(context, x, y, radius, basis, 'front');
        if (look.kind === 'comet' && perihelia.has(body.name) && stars.length) {
          const away = light.direction.map(value => -value);
          const velocity = unit([body.vx, body.vy, body.vz]).map(value => -value);
          const screenOf = vector => {
            const [vx, vy] = [vector[0] * e1[0] + vector[1] * e1[1], -(vector[0] * e2[0] + vector[1] * e2[1] + vector[2] * e2[2])];
            const length = Math.hypot(vx, vy) || 1;
            return { x: vx / length * Math.min(1, length * 1.5), y: vy / length * Math.min(1, length * 1.5) };
          };
          const star = stars.reduce((a, b) => a.luminosity >= b.luminosity ? a : b);
          const distance = Math.hypot(...star.position.map((value, axis) => value - item.position[axis]));
          const activity = Math.min(1, (perihelia.get(body.name) / distance) ** 1.5);
          drawCometTails(context, x, y, screenOf(away), screenOf(velocity), activity);
        }
      }
      // A body large on screen hides what is behind it: repaint the trails and particles that
      // pass in front of it.
      if (radius >= 5 && (look.kind === 'planet' || look.kind === 'moon' || look.kind === 'star')) {
        context.save();
        context.beginPath();
        context.arc(x, y, radius, 0, 2 * Math.PI);
        context.clip();
        drawTrails(screen.depth);
        drawParticles(screen.depth);
        context.restore();
      }
      if (body.name === focus) {
        context.strokeStyle = rgba(look.color, 0.85);
        context.lineWidth = 1.2;
        context.beginPath();
        context.arc(x, y, radius + 6, 0, 2 * Math.PI);
        context.stroke();
      }
    });
    // Sphere images of bodies no longer drawn large are released.
    for (const name of spheres.current.keys()) if (!used.has(name)) spheres.current.delete(name);

    if (labels || focus) {
      context.font = '600 11px "Inter Variable", Inter, sans-serif';
      for (const { body, look } of items) {
        if (!labels && body.name !== focus) continue;
        const screen = screens.get(body.name);
        if (!screen) continue;
        const radius = screen.radius;
        const width = context.measureText(body.name).width;
        const right = screen.x + radius + 8;
        const x = right + width + 14 > size.width - 8 ? screen.x - radius - 8 - width - 14 : right;
        const y = Math.max(4, screen.y - radius - 16);
        context.fillStyle = 'rgba(8, 12, 22, .72)';
        context.beginPath();
        pill(context, x, y, width + 14, 19);
        context.fill();
        context.strokeStyle = rgba(look.color, 0.35);
        context.lineWidth = 1;
        context.stroke();
        context.fillStyle = '#e6edf7';
        context.fillText(body.name, x + 7, y + 13);
      }
    }

    // Sandbox drag: ghost of the focused body at its new screen position.
    if (drag && screens.has(drag.name)) {
      const origin = screens.get(drag.name);
      context.setLineDash([4, 4]);
      context.strokeStyle = 'rgba(94, 234, 212, .8)';
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(origin.x, origin.y);
      context.lineTo(origin.x + drag.dx, origin.y + drag.dy);
      context.stroke();
      context.setLineDash([]);
      context.beginPath();
      context.arc(origin.x + drag.dx, origin.y + drag.dy, 7, 0, 2 * Math.PI);
      context.stroke();
    }

    // Axis gizmo: orientation of the X, Y and Z axes of the displayed frame.
    const gizmo = { x: size.width - 46, y: size.height - 46 };
    [['X', [1, 0, 0], '#f87171'], ['Y', [0, 1, 0], '#4ade80'], ['Z', [0, 0, 1], '#60a5fa']]
      .map(([label, axis, color]) => ({ label, color, view: rotate(...axis) }))
      .sort((a, b) => a.view.depth - b.view.depth)
      .forEach(({ label, color, view }) => {
        const endX = gizmo.x + view.x * 24, endY = gizmo.y - view.vertical * 24;
        context.strokeStyle = color;
        context.lineWidth = 1.6;
        context.beginPath();
        context.moveTo(gizmo.x, gizmo.y);
        context.lineTo(endX, endY);
        context.stroke();
        context.fillStyle = color;
        context.font = '700 9px "JetBrains Mono Variable", monospace';
        context.fillText(label, endX + (view.x >= 0 ? 3 : -9), endY + (view.vertical >= 0 ? -3 : 9));
      });

    projection.current = { pixelsPerMeter, cosYaw: Math.cos(camera.yaw), sinYaw: Math.sin(camera.yaw),
      cosPitch: Math.cos(camera.pitch), sinPitch: Math.sin(camera.pitch), screens };
    const bar = scaleBar(1 / pixelsPerMeter, Math.min(140, size.width * 0.25));
    setScale(previous => previous && previous.meters === bar.meters &&
      Math.abs(previous.pixels - bar.pixels) < 0.5 ? previous : bar);
  }, [dataset, index, focus, camera, extent, size, ratio, trails, showTrails, showGrid, labels, rotating, pair, drag,
    looks, particleLooks, perihelia, textures]);

  // Screen displacement of the focused body -> inertial displacement in meters, in the
  // plane facing the camera (depth unchanged).
  function screenToWorld(dx, dy) {
    const p = projection.current;
    const screen = p?.screens.get(focus);
    if (!screen) return null;
    const scale = p.pixelsPerMeter * screen.perspective;
    const viewX = dx / scale, vertical = -dy / scale;
    const rotatedY = vertical * p.cosPitch;
    const z = -vertical * p.sinPitch;
    return [viewX * p.cosYaw + rotatedY * p.sinYaw, -viewX * p.sinYaw + rotatedY * p.cosYaw, z];
  }

  function pointerDown(event) {
    // Capture keeps the drag alive outside the canvas; it can fail for synthetic pointers.
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* drag still works inside */ }
    pointer.current = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY };
    if (moving) setDrag({ name: focus, dx: 0, dy: 0 });
  }

  function pointerMove(event) {
    if (!pointer.current) return;
    if (drag) {
      setDrag(previous => previous && { ...previous, dx: event.clientX - pointer.current.startX,
        dy: event.clientY - pointer.current.startY });
      return;
    }
    const deltaX = event.clientX - pointer.current.x;
    const deltaY = event.clientY - pointer.current.y;
    pointer.current = { ...pointer.current, x: event.clientX, y: event.clientY };
    setCamera(previous => ({ ...previous, yaw: previous.yaw + deltaX * 0.006,
      pitch: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, previous.pitch + deltaY * 0.006)) }));
  }

  function pointerUp() {
    if (drag && (Math.abs(drag.dx) > 2 || Math.abs(drag.dy) > 2)) {
      const delta = screenToWorld(drag.dx, drag.dy);
      if (delta) onMoveBody?.(drag.name, delta);
    }
    pointer.current = null;
    setDrag(null);
  }

  const zoomBy = factor => setCamera(previous => ({ ...previous, zoom: Math.max(0.25, Math.min(40, previous.zoom * factor)) }));
  const activeView = views.find(view => Math.abs(view.camera.yaw - camera.yaw) < 1e-6 &&
    Math.abs(view.camera.pitch - camera.pitch) < 1e-6)?.key;
  const hasData = Boolean(dataset?.frames.length);

  return <section className="viewport" aria-label="Visualização orbital">
    <canvas ref={canvasRef} className={`orbit-canvas${moving ? ' moving' : ''}`} aria-label="Trajetórias orbitais"
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
      onPointerCancel={() => { pointer.current = null; setDrag(null); }}
      onDoubleClick={() => setCamera(defaultCamera)} />
    <div className="viewport-hud top-left">
      <span className={`live-dot${hasData ? '' : ' idle'}`} />
      <div><strong>{rotating ? 'Referencial girante' : 'Espaço de simulação'}</strong>
        <span>{rotating ? `Gira com ${pair[0]} e ${pair[1]}` : source || 'Nenhum cenário carregado'}</span></div>
    </div>
    <div className="viewport-hud top-right">
      <div className="segmented" role="group" aria-label="Vista da câmera">
        {views.map(view => <button type="button" key={view.key} className={activeView === view.key ? 'active' : ''}
          aria-pressed={activeView === view.key} onClick={() => setCamera(previous => ({ ...previous, ...view.camera }))}>{view.label}</button>)}
      </div>
      {pair && <div className="segmented" role="group" aria-label="Referencial">
        <button type="button" className={rotating ? '' : 'active'} aria-pressed={!rotating} title="Referencial inercial"
          onClick={() => setFrameMode('inertial')}>Inercial</button>
        <button type="button" className={rotating ? 'active' : ''} aria-pressed={rotating}
          title={`Gira com ${pair[0]} e ${pair[1]}: mostra pontos de Lagrange e órbitas em ferradura`}
          onClick={() => setFrameMode('rotating')}>Girante</button>
      </div>}
      <div className="tool-group">
        <button type="button" className={showTrails ? 'active' : ''} aria-pressed={showTrails} title="Trajetórias"
          aria-label="Mostrar trajetórias" onClick={() => setShowTrails(value => !value)}><Icon name="trail" /></button>
        <button type="button" className={showGrid ? 'active' : ''} aria-pressed={showGrid} title="Grade de referência"
          aria-label="Mostrar grade de referência" onClick={() => setShowGrid(value => !value)}><Icon name="plane" /></button>
        <button type="button" className={labels ? 'active' : ''} aria-pressed={labels} title="Rótulos"
          aria-label="Mostrar rótulos" onClick={() => setShowLabels(!labels)}><Icon name="tag" /></button>
        {canMove && <button type="button" className={moving ? 'active' : ''} aria-pressed={moving}
          disabled={!focus || rotating} title={focus ? 'Arrastar o corpo selecionado para uma nova posição' :
            'Selecione um corpo para movê-lo'} aria-label="Mover corpo"
          onClick={() => setMoveMode(value => !value)}><Icon name="move" /></button>}
      </div>
      <div className="tool-group">
        <button type="button" title="Aproximar" aria-label="Aproximar" onClick={() => zoomBy(1.25)}><Icon name="zoomIn" /></button>
        <button type="button" title="Afastar" aria-label="Afastar" onClick={() => zoomBy(0.8)}><Icon name="zoomOut" /></button>
        <button type="button" title="Enquadrar" aria-label="Enquadrar" onClick={() => setCamera(previous => ({ ...previous, zoom: 1 }))}><Icon name="frame" /></button>
      </div>
    </div>
    {hasData && scale && <div className="viewport-hud bottom-left scale-bar">
      <span className="scale-line" style={{ width: `${scale.pixels}px` }} />
      <span className="mono">≈ {formatNumber(scale.meters)} m</span>
    </div>}
    {hasData && <div className="viewport-hud bottom-hint">{moving
      ? `Arraste ${focus} para reposicioná-lo e recalcular a partir deste instante`
      : 'Arraste para girar · role para zoom · duplo clique para redefinir'}</div>}
    {!hasData && <div className="viewport-empty">
      <span className="empty-orbit"><Icon name="orbit" size={30} strokeWidth={1.4} /></span>
      {loading ? <>
        <strong>Calculando simulação…</strong>
        <span>O motor Fortran está integrando as órbitas.</span>
      </> : <>
        <strong>Nenhuma simulação carregada</strong>
        <span>{emptyNotice || 'Escolha uma simulação pronta ou execute o seu cenário para ver as órbitas aqui.'}</span>
        {emptyActions}
      </>}
    </div>}
  </section>;
}
