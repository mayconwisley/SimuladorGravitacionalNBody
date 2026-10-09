import { useEffect, useMemo, useRef, useState } from 'react';

const colors = ['#efbc78', '#59d8cc', '#96afff', '#e995b5', '#b8a4f3', '#a2e29a', '#ef9b76'];

function rgba(hex, alpha) {
  const value = hex.slice(1);
  return `rgba(${parseInt(value.slice(0, 2), 16)},${parseInt(value.slice(2, 4), 16)},${parseInt(value.slice(4, 6), 16)},${alpha})`;
}

export function bodyColor(index) { return colors[index % colors.length]; }

export default function OrbitCanvas({ dataset, index, focus }) {
  const canvasRef = useRef(null);
  const pointer = useRef(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [camera, setCamera] = useState({ yaw: -0.22, pitch: 0.38, zoom: 1 });

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
    for (let i = 0; i < 115; i++) {
      const x = ((i * 137.508 + 91) % 997) / 997 * size.width;
      const y = ((i * 73.719 + 54) % 991) / 991 * size.height;
      context.fillStyle = i % 8 === 0 ? '#7490b26b' : '#7191ab37';
      context.fillRect(x, y, 1, 1);
    }
    if (!dataset) return;
    const frame = dataset.frames[index];
    const centerOf = item => focus ? item.bodies.get(focus) ?? item.center : item.center;
    const center = centerOf(frame);
    const project = (point, origin) => {
      const x = point.x - origin.x, y = point.y - origin.y, z = point.z - origin.z;
      const rotatedX = x * Math.cos(camera.yaw) - y * Math.sin(camera.yaw);
      const rotatedY = x * Math.sin(camera.yaw) + y * Math.cos(camera.yaw);
      const vertical = rotatedY * Math.cos(camera.pitch) - z * Math.sin(camera.pitch);
      const depth = rotatedY * Math.sin(camera.pitch) + z * Math.cos(camera.pitch);
      const perspective = 1 / Math.max(0.45, 1 + depth / extent * 0.13);
      const scale = Math.min(size.width, size.height) * 0.37 * camera.zoom / extent;
      return { x: size.width / 2 + rotatedX * scale * perspective,
        y: size.height / 2 - vertical * scale * perspective, depth };
    };
    context.strokeStyle = 'rgba(88, 131, 164, .16)';
    context.lineWidth = 1;
    for (const fraction of [0.35, 0.7, 1.05]) {
      context.beginPath();
      for (let i = 0; i <= 90; i++) {
        const angle = i * Math.PI * 2 / 90;
        const point = project({ x: center.x + extent * fraction * Math.cos(angle),
          y: center.y + extent * fraction * Math.sin(angle), z: center.z }, center);
        if (i === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      }
      context.stroke();
    }
    const stride = Math.max(1, Math.ceil(dataset.frames.length / 900));
    dataset.names.slice(0, 24).forEach((name, colorIndex) => {
      for (const [last, alpha, width] of [[dataset.frames.length - 1, 0.15, 1], [index, 0.82, 1.8]]) {
        context.beginPath();
        for (let i = 0; i <= last; i += stride) {
          const sample = dataset.frames[i];
          const point = project(sample.bodies.get(name), centerOf(sample));
          if (i === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        }
        if (last % stride) {
          const sample = dataset.frames[last];
          const point = project(sample.bodies.get(name), centerOf(sample));
          context.lineTo(point.x, point.y);
        }
        context.strokeStyle = rgba(bodyColor(colorIndex), alpha);
        context.lineWidth = width;
        context.stroke();
      }
    });
    const masses = [...frame.bodies.values()].map(item => item.mass);
    const maxMass = Math.max(...masses);
    [...frame.bodies.values()].map((body, colorIndex) => ({
      body, color: bodyColor(colorIndex), screen: project(body, center)
    })).sort((a, b) => a.screen.depth - b.screen.depth).forEach(({ body, color, screen }) => {
      const relative = Math.max(0, Math.log10(body.mass / maxMass) + 4) / 4;
      const radius = 3.4 + 5.4 * Math.min(1, relative);
      context.beginPath();
      context.arc(screen.x, screen.y, radius * 2.7, 0, 2 * Math.PI);
      context.fillStyle = rgba(color, 0.08);
      context.fill();
      context.beginPath();
      context.arc(screen.x, screen.y, radius, 0, 2 * Math.PI);
      context.fillStyle = color;
      context.shadowColor = color;
      context.shadowBlur = 18;
      context.fill();
      context.shadowBlur = 0;
      if (dataset.names.length <= 8 || body.name === focus) {
        context.fillStyle = '#d9e6f6';
        context.font = '600 11px Inter, sans-serif';
        context.fillText(body.name, screen.x + radius + 8, screen.y - radius - 5);
      }
    });
  }, [dataset, index, focus, camera, extent, size]);

  function move(event) {
    if (!pointer.current) return;
    const deltaX = event.clientX - pointer.current.x;
    const deltaY = event.clientY - pointer.current.y;
    pointer.current = { x: event.clientX, y: event.clientY };
    setCamera(previous => ({ ...previous, yaw: previous.yaw + deltaX * 0.006,
      pitch: Math.max(-1.45, Math.min(1.45, previous.pitch + deltaY * 0.006)) }));
  }

  return <section className="viewport-card" aria-label="Visualização orbital">
    <div className="viewport-toolbar">
      <div className="viewport-title"><span className="live-dot" /> Espaço de simulação <span className="view-badge">3D</span></div>
      <div className="view-controls">
        <button type="button" onClick={() => setCamera(previous => ({ ...previous, yaw: 0, pitch: 0 }))}>Vista XY</button>
        <button type="button" onClick={() => setCamera(previous => ({ ...previous, zoom: 1 }))}>Enquadrar</button>
      </div>
    </div>
    <div className="canvas-wrap">
      <canvas ref={canvasRef} id="orbit-canvas" aria-label="Trajetórias orbitais"
        onPointerDown={event => { pointer.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={move} onPointerUp={() => { pointer.current = null; }}
        onPointerCancel={() => { pointer.current = null; }} />
      <div className="canvas-hint">ARRASTE PARA GIRAR <span>·</span> ROLE PARA ZOOM</div>
      <div className="canvas-corner"><span className="corner-line" /> REFERENCIAL INERCIAL</div>
      {!dataset && <div className="loading-overlay">Configure e execute um cenário para visualizar as órbitas.</div>}
    </div>
  </section>;
}
