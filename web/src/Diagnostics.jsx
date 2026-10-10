import { useMemo } from 'react';
import Icon from './Icons.jsx';
import { energyDriftSeries } from './dataset.mjs';
import { formatNumber } from './format.mjs';

const chartWidth = 300;
const chartHeight = 96;
const chartMid = chartHeight / 2;
const chartAmplitude = chartHeight / 2 - 8;
export const comparisonColors = { verlet: '#5eead4', yoshida4: '#c4b5fd', rk4: '#fb923c' };

// Polyline segments for a drift series scaled to ±maximum (null values break the line).
function paths(values, maximum, slots) {
  const x = position => 2 + (chartWidth - 4) * position / Math.max(slots - 1, 1);
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
  return { points, line, area };
}

function maxAbs(values) {
  let maximum = 1e-16;
  for (const value of values) if (value !== null && Math.abs(value) > maximum) maximum = Math.abs(value);
  return maximum;
}

export default function Diagnostics({ dataset, index, comparison, onCompare, busy }) {
  const drift = useMemo(() => energyDriftSeries(dataset), [dataset]);
  const slots = Math.max(dataset.expectedSamples || 0, dataset.frames.length);
  const frame = dataset.frames[index];
  const current = dataset.diagnostics.get(frame.step);
  const initial = dataset.diagnostics.get(dataset.frames[0].step);
  const comparing = comparison?.status === 'done' ? comparison.series : null;
  const maximum = useMemo(() => comparing ? Math.max(...comparing.map(item => maxAbs(item.values))) : maxAbs(drift),
    [comparing, drift]);
  const chart = useMemo(() => paths(drift, maximum, slots), [drift, maximum, slots]);
  const overlays = useMemo(() => comparing?.map(item => ({ ...item, ...paths(item.values, maximum, slots) })),
    [comparing, maximum, slots]);
  const marker = chart.points[index];
  const momentum = current ? Math.hypot(current.px, current.py, current.pz) : null;
  const angular = current?.lz !== undefined ? Math.hypot(current.lx, current.ly, current.lz) : null;
  const initialAngular = initial?.lz !== undefined ? Math.hypot(initial.lx, initial.ly, initial.lz) : null;
  const angularDrift = angular !== null && initialAngular ? (angular - initialAngular) / initialAngular : null;
  const currentDrift = drift[index];

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
      {current?.kinetic !== undefined && <>
        <div className="stat"><span className="label">Cinética K</span>
          <strong className="mono">{formatNumber(current.kinetic)}<small>J</small></strong></div>
        <div className="stat"><span className="label">Potencial U</span>
          <strong className="mono">{formatNumber(current.potential)}<small>J</small></strong></div>
      </>}
      {angular !== null && <div className="stat stat-wide"><span className="label">Momento angular |L| · variação</span>
        <strong className="mono">{formatNumber(angular)}<small>kg·m²/s</small>
          <span className="stat-aside">{angularDrift === null ? '' : `${formatNumber(100 * angularDrift, 6)} %`}</span></strong></div>}
      <div className="stat stat-wide"><span className="label">Variação relativa da energia</span>
        <strong className="mono accent">{currentDrift === null || currentDrift === undefined ? '—'
          : formatNumber(100 * currentDrift, 6)}<small>%</small></strong></div>
    </div>
    <div className="chart">
      <div className="chart-header"><span className="label">Deriva de energia</span>
        <span className="mono chart-scale">{initial?.energy ? `±${(100 * maximum).toExponential(1)} %` : 'sem dados'}</span></div>
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
        {overlays ? overlays.map(item => <path key={item.key} className="chart-line" d={item.line}
          style={{ stroke: comparisonColors[item.key] }} />) : <>
          {chart.area && <path className="chart-area" d={chart.area} />}
          {chart.line && <path className="chart-line" d={chart.line} />}
        </>}
        {marker && <line className="chart-cursor" x1={marker[0]} x2={marker[0]} y1="0" y2={chartHeight} />}
      </svg>
      {marker && !overlays && <span className="chart-dot" style={{ left: `${marker[0] / chartWidth * 100}%`, top: `${marker[1] / chartHeight * 100}%` }} />}</div>
      <div className="chart-axis"><span>Início</span><span>Fim</span></div>
    </div>
    {onCompare && <div className="comparison">
      {comparison?.status === 'done' ? <ul className="comparison-legend">
        {comparison.series.map(item => <li key={item.key}>
          <span className="swatch" style={{ '--swatch': comparisonColors[item.key] }} />
          <span>{item.label}</span>
          <span className="mono" title="Maior desvio durante a simulação · desvio ao final">
            máx {(100 * maxAbs(item.values)).toExponential(1)} % · final {(100 * Math.abs(item.values.at(-1) ?? 0)).toExponential(1)} %</span>
        </li>)}
      </ul> : comparison?.status === 'error' ? <p className="panel-note">{comparison.error}</p> : null}
      <button type="button" className="button subtle small" disabled={busy || comparison?.status === 'running'}
        onClick={onCompare}>
        {comparison?.status === 'running' ? <><span className="spinner" /> Comparando…</>
          : <><Icon name="compare" size={14} /> {comparison?.status === 'done' ? 'Comparar de novo' : 'Comparar integradores'}</>}
      </button>
      <p className="panel-note">Roda este cenário com Verlet, Yoshida e RK4 e sobrepõe a deriva de energia:
        os simpléticos oscilam; o RK4 deriva.</p>
    </div>}
  </section>;
}
