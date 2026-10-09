import { formatNumber } from './format.mjs';

export default function Diagnostics({ dataset, index }) {
  const frame = dataset.frames[index];
  const current = dataset.diagnostics.get(frame.step);
  const initial = dataset.diagnostics.get(dataset.frames[0].step);
  const drift = current && initial?.energy ? (current.energy - initial.energy) / Math.abs(initial.energy) : null;
  const values = dataset.frames.map(item => {
    const diagnostic = dataset.diagnostics.get(item.step);
    return diagnostic && initial?.energy ?
      (diagnostic.energy - initial.energy) / Math.abs(initial.energy) : null;
  });
  const maximum = Math.max(1e-16, ...values.filter(value => value !== null).map(Math.abs));
  const path = values.map((value, position) => value === null ? '' :
    `${position === 0 ? 'M' : 'L'}${(4 + 292 * position / Math.max(values.length - 1, 1)).toFixed(2)} ${(41 - 29 * value / maximum).toFixed(2)}`)
    .join(' ');
  return <section className="side-card diagnostics-card">
    <div className="section-heading"><div><p className="eyebrow">ESTABILIDADE NUMÉRICA</p><h2>Diagnósticos</h2></div><span className="check-icon">⌁</span></div>
    <div className="metric"><span>Energia total</span><strong>{current ? `${formatNumber(current.energy)} J` : '—'}</strong></div>
    <div className="metric"><span>Variação relativa</span><strong>{drift === null ? '—' : `${formatNumber(100 * drift, 6)} %`}</strong></div>
    <div className="metric"><span>Momento linear |P|</span><strong>{current ? formatNumber(Math.hypot(current.px, current.py, current.pz)) : '—'}</strong></div>
    <div className="chart-wrap"><div className="chart-header"><span>DERIVA DE ENERGIA</span><span>{initial?.energy ? `±${maximum.toExponential(1)}` : 'sem dados'}</span></div>
      <svg id="energy-chart" viewBox="0 0 300 82" preserveAspectRatio="none" role="img" aria-label="Deriva de energia"><path id="chart-line" d={path} /></svg>
      <div className="chart-baseline">INÍCIO <span>FIM</span></div>
    </div>
  </section>;
}

