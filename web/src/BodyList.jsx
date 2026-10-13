import Icon from './Icons.jsx';
import { particleAppearance, trailColor } from './bodyAppearance.mjs';
import { formatNumber } from './format.mjs';

const visibleLimit = 30;

export default function BodyList({ dataset, index, focus, setFocus }) {
  const frame = dataset.frames[index];
  const absorbed = frame.particles ? countAbsorbed(frame.particles) : 0;
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
        return <button type="button" key={name} className={`body-item${focus === name ? ' active' : ''}${body.active ? '' : ' inactive'}`}
          aria-pressed={focus === name} onClick={() => setFocus(focus === name ? null : name)}>
          <span className="swatch" style={{ '--swatch': trailColor(name, body.mass, colorIndex) }} />
          <span className="body-text"><span className="body-name">{name}</span>
            <span className="body-meta mono">{!body.active ? 'fundido em outro corpo'
              : `${body.mass > 0 ? `${formatNumber(body.mass)} kg` : 'partícula de teste'} · ${formatNumber(speed)} m/s`}</span></span>
          <Icon name="target" className="body-focus" />
        </button>;
      })}
    </div>
    {dataset.names.length > visibleLimit &&
      <p className="panel-note">Mais {dataset.names.length - visibleLimit} corpos visíveis na cena.</p>}
    {dataset.particleGroups.length > 0 && <ul className="group-list">
      {dataset.particleGroups.map((group, groupIndex) => <li key={group.name}>
        <span className="swatch" style={{ '--swatch': particleAppearance(group, groupIndex).color }} />
        <span>{group.name}</span>
        <span className="mono">{group.count} partículas{group.around ? ` · ${group.around}` : ''}</span>
      </li>)}
      {absorbed > 0 && <li className="muted"><Icon name="burst" size={13} /> {absorbed} absorvidas por colisão</li>}
    </ul>}
  </section>;
}

function countAbsorbed(particles) {
  let count = 0;
  for (let k = 0; k < particles.length; k += 3) if (!Number.isFinite(particles[k])) count++;
  return count;
}
