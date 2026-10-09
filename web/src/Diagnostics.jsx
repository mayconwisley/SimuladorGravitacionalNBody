import { useMemo } from 'react';
import Icon from './Icons.jsx';
import { formatNumber } from './format.mjs';

const chartWidth = 300;
const chartHeight = 96;
const chartMid = chartHeight / 2;
const chartAmplitude = chartHeight / 2 - 8;

// Relative energy drift (E - E0) / |E0| for every sample; null where diagnostics are missing.
function energyDrift(dataset) {
  const initial = dataset.diagnostics.get(dataset.frames[0].step);
  const values = dataset.frames.map(item => {
    const diagnostic = dataset.diagnostics.get(item.step);
    return diagnostic && initial?.energy ? (diagnostic.energy - initial.energy) / Math.abs(initial.energy) : null;
  });
  const maximum = Math.max(1e-16, ...values.filter(value => value !== null).map(Math.abs));
  const x = position => 2 + (chartWidth - 4) * position / Math.max(values.length - 1, 1);
  const y = value => chartMid - chartAmplitude * value / maximum;
  const points = values.map((value, position) => value === null ? null : [x(position), y(value)]);
  const segments = [];
  let current = [];
  for (const point of points) {
    if (point) current.push(point);
    else if (current.length) { segments.push(current); current = []; }
  }
  if (current.length) segments.push(current);
  const line = segments.map(segment => segment.map(([px, py], i) =>
    `${i ? 'L' : 'M'}${px.toFixed(2)} ${py.toFixed(2)}`).join(' ')).join(' ');
  const area = segments.map(segment => `M${segment[0][0].toFixed(2)} ${chartMid} ` +
    segment.map(([px, py]) => `L${px.toFixed(2)} ${py.toFixed(2)}`).join(' ') +
    ` L${segment.at(-1)[0].toFixed(2)} ${chartMid} Z`).join(' ');
  return { initial, values, maximum, points, line, area };
}

export default function Diagnostics({ dataset, index }) {
  const chart = useMemo(() => energyDrift(dataset), [dataset]);
  const frame = dataset.frames[index];
  const current = dataset.diagnostics.get(frame.step);
  const drift = chart.values[index];
  const marker = chart.points[index];
  const momentum = current ? Math.hypot(current.px, current.py, current.pz) : null;

  return <section className="panel diagnostics-panel">
    <header className="panel-header">
      <div><p className="eyebrow">Estabilidade numérica</p><h2>Diagnósticos</h2></div>
      <span className="panel-icon"><Icon name="bolt" /></span>
    </header>
    <div className="stat-grid">
      <div className="stat"><span className="label">Energia total</span>
        <strong className="mono">{current ? formatNumber(current.energy) : '—'}<small>J</small></strong></div>
      <div className="stat"><span className="label">Momento |P|</span>
        <strong className="mono">{momentum === null ? '—' : formatNumber(momentum)}<small>kg·m/s</small></strong></div>
      <div className="stat stat-wide"><span className="label">Variação relativa da energia</span>
        <strong className="mono accent">{drift === null || drift === undefined ? '—' : formatNumber(100 * drift, 6)}<small>%</small></strong></div>
    </div>
    <div className="chart">
      <div className="chart-header"><span className="label">Deriva de energia</span>
        <span className="mono chart-scale">{chart.initial?.energy ? `±${chart.maximum.toExponential(1)}` : 'sem dados'}</span></div>
      <div className="chart-plot"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" role="img"
        aria-label="Deriva relativa de energia ao longo da simulação">
        <defs>
          <linearGradient id="drift-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity=".35" />
            <stop offset="50%" stopColor="var(--accent)" stopOpacity=".04" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity=".35" />
          </linearGradient>
        </defs>
        <line className="chart-zero" x1="0" x2={chartWidth} y1={chartMid} y2={chartMid} />
        {chart.area && <path className="chart-area" d={chart.area} />}
        {chart.line && <path className="chart-line" d={chart.line} />}
        {marker && <line className="chart-cursor" x1={marker[0]} x2={marker[0]} y1="0" y2={chartHeight} />}
      </svg>
      {marker && <span className="chart-dot" style={{ left: `${marker[0] / chartWidth * 100}%`, top: `${marker[1] / chartHeight * 100}%` }} />}</div>
      <div className="chart-axis"><span>Início</span><span>Fim</span></div>
    </div>
  </section>;
}
