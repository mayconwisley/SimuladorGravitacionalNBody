import { useState } from 'react';
import Icon from './Icons.jsx';
import { frameIndexAtStep } from './dataset.mjs';
import { formatNumber, formatTime } from './format.mjs';

export const eventKinds = {
  collision: { label: 'Colisão', icon: 'burst', color: '#fb7185', verb: 'fundiu-se com' },
  periapsis: { label: 'Periastro', icon: 'periapsis', color: '#5eead4', verb: 'passou mais perto de' },
  apoapsis: { label: 'Apoastro', icon: 'apoapsis', color: '#93b4ff', verb: 'chegou mais longe de' },
  escape: { label: 'Escape', icon: 'escape', color: '#fbbf24', verb: 'escapou de' },
  maneuver: { label: 'Manobra', icon: 'rocket', color: '#c4b5fd', verb: 'sofreu uma manobra' }
};
const listLimit = 150;

export default function EventsPanel({ dataset, onSeek }) {
  const [filter, setFilter] = useState('all');
  const counts = dataset.events.reduce((total, item) => ({ ...total, [item.kind]: (total[item.kind] ?? 0) + 1 }), {});
  const shown = dataset.events.filter(item => filter === 'all' || item.kind === filter);
  return <section className="panel events-panel">
    <header className="panel-header">
      <div><p className="eyebrow">Linha do tempo</p><h2>Eventos</h2></div>
      <span className="badge">{dataset.events.length}</span>
    </header>
    {dataset.events.length === 0 ? <p className="panel-note">Nenhum evento: sem colisões, escapes, manobras nem
      órbitas excêntricas o bastante para marcar periastro e apoastro.</p> : <>
      <div className="chips small-chips" role="group" aria-label="Filtrar eventos">
        <button type="button" className={`chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>Todos</button>
        {Object.entries(counts).map(([kind, count]) => <button type="button" key={kind}
          className={`chip${filter === kind ? ' active' : ''}`} onClick={() => setFilter(kind)}>
          <span className="event-dot" style={{ '--mark': eventKinds[kind]?.color }} />{eventKinds[kind]?.label ?? kind} {count}</button>)}
      </div>
      <ol className="event-list">
        {shown.slice(0, listLimit).map((item, position) => {
          const kind = eventKinds[item.kind] ?? { label: item.kind, icon: 'info', color: '#a4afc2', verb: '' };
          return <li key={position}>
            <button type="button" onClick={() => onSeek(frameIndexAtStep(dataset, item.step))}>
              <span className="event-icon" style={{ '--mark': kind.color }}><Icon name={kind.icon} size={14} /></span>
              <span className="event-text"><strong>{item.body}</strong> {kind.verb}{item.other ? <> <strong>{item.other}</strong></> : null}
                <span className="mono">{formatTime(item.time)}{item.distance !== null ? ` · r ≈ ${formatNumber(item.distance)} m` : ''}</span></span>
            </button>
          </li>;
        })}
      </ol>
      {shown.length > listLimit && <p className="panel-note">Mostrando {listLimit} de {shown.length} eventos.</p>}
    </>}
  </section>;
}
