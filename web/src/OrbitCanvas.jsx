import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icons.jsx';
import { formatNumber } from './format.mjs';

const colors = ['#f5c27a', '#5eead4', '#93b4ff', '#f49ac1', '#c4b5fd', '#a7f3a0', '#fb9d7a'];
const particleColors = ['#7dd3fc', '#fda4af', '#bef264', '#fcd34d', '#d8b4fe', '#99f6e4', '#fdba74', '#a5b4fc'];
const defaultCamera = { yaw: -0.22, pitch: 0.38, zoom: 1 };
const views = [
  { key: '3d', label: '3D', camera: { yaw: -0.22, pitch: 0.38 } },
  { key: 'xy', label: 'XY', camera: { yaw: 0, pitch: 0 } },
  { key: 'xz', label: 'XZ', camera: { yaw: 0, pitch: -Math.PI / 2 } }
];
const trailChunks = 28;
const maxTrailBodies = 24;

function rgba(hex, alpha) {
  const value = hex.slice(1);
  return `rgba(${parseInt(value.slice(0, 2), 16)},${parseInt(value.slice(2, 4), 16)},${parseInt(value.slice(4, 6), 16)},${alpha})`;
}

export function bodyColor(index) { return colors[index % colors.length]; }
export function particleColor(index) { return particleColors[index % particleColors.length]; }

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

function drawStars(context, width, height) {
  for (let i = 0; i < 160; i++) {
    const x = ((i * 137.508 + 91) % 997) / 997 * width;
    const y = ((i * 73.719 + 54) % 991) / 991 * height;
    const bright = i % 11 === 0;
    context.fillStyle = bright ? 'rgba(200,220,255,.55)' : i % 3 ? 'rgba(140,165,200,.22)' : 'rgba(170,190,225,.38)';
    context.fillRect(x, y, bright ? 1.6 : 1, bright ? 1.6 : 1);
  }
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

export default function OrbitCanvas({ dataset, index, focus, source, emptyActions, loading = false, emptyNotice = '',
  preferredFrame = 'inertial', canMove = false, onMoveBody }) {
  const canvasRef = useRef(null);
  const pointer = useRef(null);
  const projection = useRef(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [camera, setCamera] = useState(defaultCamera);
  const [showTrails, setShowTrails] = useState(true);
  const [showLabels, setShowLabels] = useState(null);
  const [frameMode, setFrameMode] = useState(preferredFrame);
  const [moveMode, setMoveMode] = useState(false);
  const [drag, setDrag] = useState(null);
  const [scale, setScale] = useState(null);
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
        zoom: Math.max(0.25, Math.min(12, previous.zoom * Math.exp(-event.deltaY * 0.001))) }));
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => canvas.removeEventListener('wheel', wheel);
  }, []);

  // A new run (not a streamed chunk of the same run) restores the default display.
  useEffect(() => { setShowLabels(null); setFrameMode(preferredFrame); setMoveMode(false); }, [dataset?.id, preferredFrame]);
  useEffect(() => { if (!canMove) setMoveMode(false); }, [canMove]);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    drawStars(context, size.width, size.height);
    if (!dataset?.frames.length) { setScale(null); projection.current = null; return; }

    const frame = dataset.frames[Math.min(index, dataset.frames.length - 1)];
    const transforms = new Map();
    const transformAt = i => {
      if (!transforms.has(i)) transforms.set(i, frameTransform(dataset.frames[i], rotating ? null : focus, rotating ? pair : null));
      return transforms.get(i);
    };
    const current = transformAt(dataset.frames.indexOf(frame));
    const cosYaw = Math.cos(camera.yaw), sinYaw = Math.sin(camera.yaw);
    const cosPitch = Math.cos(camera.pitch), sinPitch = Math.sin(camera.pitch);
    const pixelsPerMeter = Math.min(size.width, size.height) * 0.37 * camera.zoom / extent;
    const rotate = (x, y, z) => {
      const rotatedX = x * cosYaw - y * sinYaw;
      const rotatedY = x * sinYaw + y * cosYaw;
      return { x: rotatedX, vertical: rotatedY * cosPitch - z * sinPitch, depth: rotatedY * sinPitch + z * cosPitch };
    };
    const perspectiveOf = depth => 1 / Math.max(0.45, 1 + depth / extent * 0.13);
    const project = ([x, y, z]) => {
      const view = rotate(x, y, z);
      const perspective = perspectiveOf(view.depth);
      return { x: size.width / 2 + view.x * pixelsPerMeter * perspective,
        y: size.height / 2 - view.vertical * pixelsPerMeter * perspective, depth: view.depth, perspective };
    };
    const projectBody = (i, body) => project(transformAt(i)(body.x, body.y, body.z));

    // Reference rings in the XY plane of the frame origin.
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
      context.strokeStyle = `rgba(120, 160, 210, ${0.13 - ring * 0.025})`;
      context.stroke();
    });
    context.setLineDash([]);

    if (showTrails) {
      const last = dataset.frames.length - 1;
      const frameIndex = Math.min(index, last);
      const stride = Math.max(1, Math.ceil(dataset.frames.length / 900));
      context.lineCap = 'round';
      context.lineJoin = 'round';
      // Draws a polyline through the given sample indices, breaking it where the body is inactive.
      const path = (name, indices) => {
        let open = false;
        for (const i of indices) {
          const body = dataset.frames[i].bodies.get(name);
          if (!body?.active) { open = false; continue; }
          const point = projectBody(i, body);
          if (open) context.lineTo(point.x, point.y);
          else { context.moveTo(point.x, point.y); open = true; }
        }
      };
      dataset.names.slice(0, maxTrailBodies).forEach((name, colorIndex) => {
        const color = bodyColor(colorIndex);
        const all = [];
        for (let i = 0; i < last; i += stride) all.push(i);
        all.push(last);
        context.beginPath();
        path(name, all);
        context.strokeStyle = rgba(color, 0.11);
        context.lineWidth = 1;
        context.stroke();
        if (frameIndex === 0) return;
        const travelled = [];
        for (let i = 0; i < frameIndex; i += stride) travelled.push(i);
        travelled.push(frameIndex);
        const chunk = Math.max(1, Math.ceil(travelled.length / trailChunks));
        for (let start = 0; start < travelled.length - 1; start += chunk) {
          const end = Math.min(travelled.length - 1, start + chunk);
          const recency = end / (travelled.length - 1);
          context.beginPath();
          path(name, travelled.slice(start, end + 1));
          context.strokeStyle = rgba(color, 0.12 + 0.78 * recency ** 1.6);
          context.lineWidth = 0.8 + 1.4 * recency;
          context.stroke();
        }
      });
    }

    if (frame.particles) {
      const groups = dataset.particleGroups.length ? dataset.particleGroups
        : [{ start: 0, count: frame.particles.length / 3 }];
      groups.forEach((group, groupIndex) => {
        context.fillStyle = rgba(particleColor(groupIndex), 0.8);
        for (let k = group.start; k < group.start + group.count; k++) {
          const x = frame.particles[3 * k];
          if (!Number.isFinite(x)) continue;
          const point = project(current(x, frame.particles[3 * k + 1], frame.particles[3 * k + 2]));
          context.fillRect(point.x - 0.8, point.y - 0.8, 1.6, 1.6);
        }
      });
    }

    const frameIndex = dataset.frames.indexOf(frame);
    const bodies = dataset.names.map((name, colorIndex) => ({ body: frame.bodies.get(name), color: bodyColor(colorIndex) }))
      .filter(item => item.body?.active);
    const maxMass = Math.max(...bodies.map(item => item.body.mass), 0);
    const screens = new Map();
    bodies.map(item => ({ ...item, screen: projectBody(frameIndex, item.body) }))
      .sort((a, b) => a.screen.depth - b.screen.depth)
      .forEach(({ body, color, screen }) => {
        screens.set(body.name, screen);
        const relative = body.mass > 0 && maxMass > 0 ? Math.max(0, Math.log10(body.mass / maxMass) + 4) / 4 : 0;
        const radius = body.mass > 0 ? 3.2 + 5.6 * Math.min(1, relative) : 2.4;
        const physical = body.radius * pixelsPerMeter * screen.perspective;
        if (physical > radius * 1.2) {
          context.beginPath();
          context.arc(screen.x, screen.y, physical, 0, 2 * Math.PI);
          context.fillStyle = rgba(color, 0.12);
          context.fill();
          context.strokeStyle = rgba(color, 0.45);
          context.lineWidth = 1;
          context.stroke();
        }
        const glow = context.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, radius * 4.5);
        glow.addColorStop(0, rgba(color, 0.35));
        glow.addColorStop(1, rgba(color, 0));
        context.fillStyle = glow;
        context.beginPath();
        context.arc(screen.x, screen.y, radius * 4.5, 0, 2 * Math.PI);
        context.fill();
        const core = context.createRadialGradient(screen.x - radius * 0.35, screen.y - radius * 0.35, 0,
          screen.x, screen.y, radius);
        core.addColorStop(0, '#ffffff');
        core.addColorStop(0.35, color);
        core.addColorStop(1, rgba(color, 0.85));
        context.fillStyle = core;
        context.beginPath();
        context.arc(screen.x, screen.y, radius, 0, 2 * Math.PI);
        context.fill();
        if (body.name === focus) {
          context.strokeStyle = rgba(color, 0.8);
          context.lineWidth = 1.2;
          context.beginPath();
          context.arc(screen.x, screen.y, radius + 6, 0, 2 * Math.PI);
          context.stroke();
        }
        if (labels || body.name === focus) {
          context.font = '600 11px "Inter Variable", Inter, sans-serif';
          const width = context.measureText(body.name).width;
          const right = screen.x + radius + 8;
          const x = right + width + 14 > size.width - 8 ? screen.x - radius - 8 - width - 14 : right;
          const y = Math.max(4, screen.y - radius - 16);
          context.fillStyle = 'rgba(8, 12, 22, .72)';
          context.beginPath();
          pill(context, x, y, width + 14, 19);
          context.fill();
          context.strokeStyle = rgba(color, 0.35);
          context.lineWidth = 1;
          context.stroke();
          context.fillStyle = '#e6edf7';
          context.fillText(body.name, x + 7, y + 13);
        }
      });

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

    projection.current = { pixelsPerMeter, cosYaw, sinYaw, cosPitch, sinPitch, screens };
    const bar = scaleBar(1 / pixelsPerMeter, Math.min(140, size.width * 0.25));
    setScale(previous => previous && previous.meters === bar.meters &&
      Math.abs(previous.pixels - bar.pixels) < 0.5 ? previous : bar);
  }, [dataset, index, focus, camera, extent, size, showTrails, labels, rotating, pair, drag]);

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

  const zoomBy = factor => setCamera(previous => ({ ...previous, zoom: Math.max(0.25, Math.min(12, previous.zoom * factor)) }));
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
