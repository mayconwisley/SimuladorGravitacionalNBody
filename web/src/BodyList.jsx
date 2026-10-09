import Icon from './Icons.jsx';
import { bodyColor } from './OrbitCanvas.jsx';
import { formatNumber } from './format.mjs';

const visibleLimit = 30;

export default function BodyList({ dataset, index, focus, setFocus }) {
  const frame = dataset.frames[index];
  return <section className="panel bodies-panel">
    <header className="panel-header">
      <div><p className="eyebrow">Cenário</p><h2>Corpos celestes</h2></div>
      <span className="badge">{dataset.names.length}</span>
    </header>
    <button type="button" className={`focus-option${focus === null ? ' active' : ''}`} onClick={() => setFocus(null)}>
      <Icon name="target" /><span>Centro de massa</span><small>Referencial</small>
    </button>
    <div className="body-list">
      {dataset.names.slice(0, visibleLimit).map((name, colorIndex) => {
        const body = frame.bodies.get(name);
        const speed = Math.hypot(body.vx, body.vy, body.vz);
        return <button type="button" key={name} className={`body-item${focus === name ? ' active' : ''}`}
          aria-pressed={focus === name} onClick={() => setFocus(focus === name ? null : name)}>
          <span className="swatch" style={{ '--swatch': bodyColor(colorIndex) }} />
          <span className="body-text"><span className="body-name">{name}</span>
            <span className="body-meta mono">{formatNumber(body.mass)} kg · {formatNumber(speed)} m/s</span></span>
          <Icon name="target" className="body-focus" />
        </button>;
      })}
    </div>
    {dataset.names.length > visibleLimit &&
      <p className="panel-note">Mais {dataset.names.length - visibleLimit} corpos visíveis na cena.</p>}
  </section>;
}
