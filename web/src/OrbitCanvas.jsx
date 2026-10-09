import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icons.jsx';
import { formatNumber } from './format.mjs';

const colors = ['#f5c27a', '#5eead4', '#93b4ff', '#f49ac1', '#c4b5fd', '#a7f3a0', '#fb9d7a'];
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

// Largest "nice" length (1, 2 or 5 × 10^n metres) that fits in the given pixel budget.
function scaleBar(metersPerPixel, maxPixels) {
  const target = metersPerPixel * maxPixels;
  const power = 10 ** Math.floor(Math.log10(target));
  const meters = [5, 2, 1].map(step => step * power).find(value => value <= target) ?? power;
  return { meters, pixels: meters / metersPerPixel };
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

export default function OrbitCanvas({ dataset, index, focus, source, emptyActions }) {
  const canvasRef = useRef(null);
  const pointer = useRef(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [camera, setCamera] = useState(defaultCamera);
  const [showTrails, setShowTrails] = useState(true);
  const [showLabels, setShowLabels] = useState(null);
  const [scale, setScale] = useState(null);
  const labels = showLabels ?? (dataset ? dataset.names.length <= 8 : true);

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

  useEffect(() => { setShowLabels(null); }, [dataset]);

  const extent = useMemo(() => {
    if (!dataset) return 1;
    let largest = 0;
    for (const frame of dataset.frames) {
      const center = focus ? frame.bodies.get(focus) ?? frame.center : frame.center;
      for (const body of frame.bodies.values())
        largest = Math.max(largest, Math.hypot(body.x - center.x,
          body.y - center.y, body.z - center.z));
    }
    return largest || 1;
  }, [dataset, focus]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    drawStars(context, size.width, size.height);
    if (!dataset) { setScale(null); return; }

    const frame = dataset.frames[index];
    const centerOf = item => focus ? item.bodies.get(focus) ?? item.center : item.center;
    const center = centerOf(frame);
    const cosYaw = Math.cos(camera.yaw), sinYaw = Math.sin(camera.yaw);
    const cosPitch = Math.cos(camera.pitch), sinPitch = Math.sin(camera.pitch);
    const pixelsPerMeter = Math.min(size.width, size.height) * 0.37 * camera.zoom / extent;
    const rotate = (x, y, z) => {
      const rotatedX = x * cosYaw - y * sinYaw;
      const rotatedY = x * sinYaw + y * cosYaw;
      return { x: rotatedX, vertical: rotatedY * cosPitch - z * sinPitch, depth: rotatedY * sinPitch + z * cosPitch };
    };
    const project = (point, origin) => {
      const view = rotate(point.x - origin.x, point.y - origin.y, point.z - origin.z);
      const perspective = 1 / Math.max(0.45, 1 + view.depth / extent * 0.13);
      return { x: size.width / 2 + view.x * pixelsPerMeter * perspective,
        y: size.height / 2 - view.vertical * pixelsPerMeter * perspective, depth: view.depth };
    };

    // Reference rings in the XY plane of the current centre.
    context.lineWidth = 1;
    [0.35, 0.7, 1.05].forEach((fraction, ring) => {
      context.beginPath();
      for (let i = 0; i <= 120; i++) {
        const angle = i * Math.PI * 2 / 120;
        const point = project({ x: center.x + extent * fraction * Math.cos(angle),
          y: center.y + extent * fraction * Math.sin(angle), z: center.z }, center);
        if (i === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      }
      context.setLineDash(ring === 2 ? [2, 5] : []);
      context.strokeStyle = `rgba(120, 160, 210, ${0.13 - ring * 0.025})`;
      context.stroke();
    });
    context.setLineDash([]);

    if (showTrails) {
      const stride = Math.max(1, Math.ceil(dataset.frames.length / 900));
      const pointAt = (name, i) => {
        const sample = dataset.frames[i];
        return project(sample.bodies.get(name), centerOf(sample));
      };
      context.lineCap = 'round';
      context.lineJoin = 'round';
      dataset.names.slice(0, maxTrailBodies).forEach((name, colorIndex) => {
        const color = bodyColor(colorIndex);
        // Full path, faint, so the whole orbit stays readable.
        context.beginPath();
        for (let i = 0; i < dataset.frames.length; i += stride) {
          const point = pointAt(name, i);
          if (i === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        }
        const tail = pointAt(name, dataset.frames.length - 1);
        context.lineTo(tail.x, tail.y);
        context.strokeStyle = rgba(color, 0.11);
        context.lineWidth = 1;
        context.stroke();
        // Travelled path, brighter towards the current sample.
        if (index === 0) return;
        const indices = [];
        for (let i = 0; i < index; i += stride) indices.push(i);
        indices.push(index);
        const chunk = Math.max(1, Math.ceil(indices.length / trailChunks));
        for (let start = 0; start < indices.length - 1; start += chunk) {
          const end = Math.min(indices.length - 1, start + chunk);
          const recency = end / (indices.length - 1);
          context.beginPath();
          for (let k = start; k <= end; k++) {
            const point = pointAt(name, indices[k]);
            if (k === start) context.moveTo(point.x, point.y);
            else context.lineTo(point.x, point.y);
          }
          context.strokeStyle = rgba(color, 0.12 + 0.78 * recency ** 1.6);
          context.lineWidth = 0.8 + 1.4 * recency;
          context.stroke();
        }
      });
    }

    const bodies = [...frame.bodies.values()];
    const maxMass = Math.max(...bodies.map(item => item.mass));
    bodies.map((body, colorIndex) => ({ body, color: bodyColor(colorIndex), screen: project(body, center) }))
      .sort((a, b) => a.screen.depth - b.screen.depth)
      .forEach(({ body, color, screen }) => {
        const relative = Math.max(0, Math.log10(body.mass / maxMass) + 4) / 4;
        const radius = 3.2 + 5.6 * Math.min(1, relative);
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
          context.roundRect(x, y, width + 14, 19, 9.5);
          context.fill();
          context.strokeStyle = rgba(color, 0.35);
          context.lineWidth = 1;
          context.stroke();
          context.fillStyle = '#e6edf7';
          context.fillText(body.name, x + 7, y + 13);
        }
      });

    // Axis gizmo: orientation of the inertial X, Y and Z axes.
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

    const bar = scaleBar(1 / pixelsPerMeter, Math.min(140, size.width * 0.25));
    setScale(previous => previous && previous.meters === bar.meters &&
      Math.abs(previous.pixels - bar.pixels) < 0.5 ? previous : bar);
  }, [dataset, index, focus, camera, extent, size, showTrails, labels]);

  function move(event) {
    if (!pointer.current) return;
    const deltaX = event.clientX - pointer.current.x;
    const deltaY = event.clientY - pointer.current.y;
    pointer.current = { x: event.clientX, y: event.clientY };
    setCamera(previous => ({ ...previous, yaw: previous.yaw + deltaX * 0.006,
      pitch: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, previous.pitch + deltaY * 0.006)) }));
  }

  const zoomBy = factor => setCamera(previous => ({ ...previous, zoom: Math.max(0.25, Math.min(12, previous.zoom * factor)) }));
  const activeView = views.find(view => Math.abs(view.camera.yaw - camera.yaw) < 1e-6 &&
    Math.abs(view.camera.pitch - camera.pitch) < 1e-6)?.key;

  return <section className="viewport" aria-label="Visualização orbital">
    <canvas ref={canvasRef} className="orbit-canvas" aria-label="Trajetórias orbitais"
      onPointerDown={event => { pointer.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={move} onPointerUp={() => { pointer.current = null; }}
      onPointerCancel={() => { pointer.current = null; }}
      onDoubleClick={() => setCamera(defaultCamera)} />
    <div className="viewport-hud top-left">
      <span className={`live-dot${dataset ? '' : ' idle'}`} />
      <div><strong>Espaço de simulação</strong><span>{source || 'Nenhum cenário carregado'}</span></div>
    </div>
    <div className="viewport-hud top-right">
      <div className="segmented" role="group" aria-label="Vista da câmera">
        {views.map(view => <button type="button" key={view.key} className={activeView === view.key ? 'active' : ''}
          aria-pressed={activeView === view.key} onClick={() => setCamera(previous => ({ ...previous, ...view.camera }))}>{view.label}</button>)}
      </div>
      <div className="tool-group">
        <button type="button" className={showTrails ? 'active' : ''} aria-pressed={showTrails} title="Trajetórias"
          aria-label="Mostrar trajetórias" onClick={() => setShowTrails(value => !value)}><Icon name="trail" /></button>
        <button type="button" className={labels ? 'active' : ''} aria-pressed={labels} title="Rótulos"
          aria-label="Mostrar rótulos" onClick={() => setShowLabels(!labels)}><Icon name="tag" /></button>
      </div>
      <div className="tool-group">
        <button type="button" title="Aproximar" aria-label="Aproximar" onClick={() => zoomBy(1.25)}><Icon name="zoomIn" /></button>
        <button type="button" title="Afastar" aria-label="Afastar" onClick={() => zoomBy(0.8)}><Icon name="zoomOut" /></button>
        <button type="button" title="Enquadrar" aria-label="Enquadrar" onClick={() => setCamera(previous => ({ ...previous, zoom: 1 }))}><Icon name="frame" /></button>
      </div>
    </div>
    {dataset && scale && <div className="viewport-hud bottom-left scale-bar">
      <span className="scale-line" style={{ width: `${scale.pixels}px` }} />
      <span className="mono">≈ {formatNumber(scale.meters)} m</span>
    </div>}
    {dataset && <div className="viewport-hud bottom-hint">Arraste para girar · role para zoom · duplo clique para redefinir</div>}
    {!dataset && <div className="viewport-empty">
      <span className="empty-orbit"><Icon name="orbit" size={30} strokeWidth={1.4} /></span>
      <strong>Nenhuma simulação carregada</strong>
      <span>Escolha uma simulação pronta ou execute o seu cenário para ver as órbitas aqui.</span>
      {emptyActions}
    </div>}
  </section>;
}
