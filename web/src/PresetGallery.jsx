import { useMemo, useState } from 'react';
import { presets } from './scenario.mjs';

const entries = Object.entries(presets);
const categories = ['Todos', ...new Set(entries.map(([, preset]) => preset.category))];

function normalized(value) {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function durationLabel(preset) {
  const hours = Number(preset.steps) * Number(preset.timeStepSeconds) / 3600;
  if (hours >= 48) return `${(hours / 24).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`;
  return `${hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
}

function PresetArt({ count, category, index }) {
  const visible = Math.min(count - 1, 5);
  return <div className={`preset-art preset-art-${category === 'Múltiplos' ? 'binary' : 'orbit'}`} aria-hidden="true">
    <span className="art-number">{String(index + 1).padStart(2, '0')}</span>
    <svg viewBox="0 0 240 118" preserveAspectRatio="xMidYMid meet">
      <ellipse cx="120" cy="59" rx="48" ry="24" />
      <ellipse cx="120" cy="59" rx="80" ry="40" />
      <ellipse cx="120" cy="59" rx="109" ry="53" />
      <circle className="art-star" cx="120" cy="59" r="8" />
      {Array.from({ length: visible }, (_, dot) => {
        const angle = dot * 2.399 + index * 0.48;
        const radiusX = [48, 80, 109][dot % 3];
        const radiusY = [24, 40, 53][dot % 3];
        return <circle className={`art-dot art-dot-${dot % 4}`} key={dot}
          cx={120 + Math.cos(angle) * radiusX} cy={59 + Math.sin(angle) * radiusY} r={dot ? 3 : 4} />;
      })}
    </svg>
  </div>;
}

export default function PresetGallery({ onView, onEdit, busy, runningKey }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const filtered = useMemo(() => entries.filter(([, preset]) => {
    const categoryMatches = category === 'Todos' || preset.category === category;
    const searchText = normalized(`${preset.label} ${preset.description} ${preset.category}`);
    return categoryMatches && searchText.includes(normalized(query.trim()));
  }), [query, category]);

  return <section className="catalog">
    <div className="catalog-heading"><div><p className="eyebrow">BIBLIOTECA DE CENÁRIOS</p>
      <h2>{entries.length} simulações para explorar</h2>
      <p>Escolha um sistema e visualize a dinâmica orbital com um clique. Todos os cenários podem ser editados.</p></div>
      <span className="catalog-total">{filtered.length} de {entries.length}</span>
    </div>
    <div className="catalog-toolbar">
      <label className="catalog-search"><span>Buscar simulações</span>
        <input value={query} onChange={event => setQuery(event.target.value)}
          placeholder="Ex.: binária, elipse, satélite..." type="search" /></label>
      <div className="catalog-filters" aria-label="Filtrar categoria">
        {categories.map(item => <button type="button" key={item}
          className={category === item ? 'active' : ''} aria-pressed={category === item}
          onClick={() => setCategory(item)}>{item}</button>)}
      </div>
    </div>
    {filtered.length ? <div className="catalog-grid">{filtered.map(([key, preset]) => {
      const index = entries.findIndex(([item]) => item === key);
      return <article className="preset-card" key={key}>
        <PresetArt count={preset.bodies.length} category={preset.category} index={index} />
        <div className="preset-content"><span className="preset-category">{preset.category}</span>
          <h3>{preset.label}</h3><p>{preset.description}</p>
          <div className="preset-facts"><span>{preset.bodies.length} corpos</span><span>{durationLabel(preset)}</span></div>
          <div className="preset-actions">
            <button className="primary-button" type="button" disabled={busy}
              onClick={() => onView(key)}>{busy && runningKey === key ? 'Calculando...' : '▶ Visualizar'}</button>
            <button className="secondary-button" type="button" disabled={busy}
              onClick={() => onEdit(key)}>Editar dados</button>
          </div>
        </div>
      </article>;
    })}</div> : <div className="catalog-empty">Nenhuma simulação encontrada. Tente outro termo ou categoria.</div>}
    <p className="catalog-note">Cenários didáticos em unidades SI. “Terra e satélite” e “Sol e Terra” usam valores aproximados; os demais são sistemas idealizados.</p>
  </section>;
}
