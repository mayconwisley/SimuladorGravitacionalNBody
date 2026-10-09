import { memo, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import Icon from './Icons.jsx';
import Pagination from './Pagination.jsx';
import { formatTime } from './format.mjs';
import { filterPresets, paginate } from './galleryPaging.mjs';
import { presets } from './scenario.mjs';

const entries = Object.entries(presets);
const positions = new Map(entries.map(([key], index) => [key, index]));
const categories = ['Todos', ...new Set(entries.map(([, preset]) => preset.category))];
const reducedMotion = typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function durationLabel(preset) {
  const seconds = Number(preset.steps) * Number(preset.timeStepSeconds);
  if (seconds >= 2 * 365.25 * 86400) return formatTime(seconds); // years and beyond
  const hours = seconds / 3600;
  if (hours >= 48) return `${(hours / 24).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`;
  return `${hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
}

function ellipsePath(cx, cy, rx, ry) {
  return `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0`;
}

const heroOrbits = [
  { rx: 88, ry: 34, dur: 9, r: 6, color: '#93c5fd' },
  { rx: 146, ry: 56, dur: 16, r: 8, color: '#5eead4' },
  { rx: 206, ry: 80, dur: 27, r: 5, color: '#c4b5fd' }
];

function HeroOrbit() {
  return <svg className="hero-orbit" viewBox="0 0 480 320" aria-hidden="true">
    <defs>
      <radialGradient id="hero-sun" cx="40%" cy="38%" r="65%">
        <stop offset="0%" stopColor="#fff7dc" /><stop offset="45%" stopColor="#f8c27a" /><stop offset="100%" stopColor="#ef7d55" />
      </radialGradient>
      <radialGradient id="hero-halo"><stop offset="0%" stopColor="#f8b26a" stopOpacity=".45" /><stop offset="100%" stopColor="#f8b26a" stopOpacity="0" /></radialGradient>
    </defs>
    <g transform="rotate(-16 240 160)">
      {heroOrbits.map((orbit, i) => <path key={i} className="hero-ring" d={ellipsePath(240, 160, orbit.rx, orbit.ry)} />)}
      <circle cx="240" cy="160" r="70" fill="url(#hero-halo)" />
      <circle cx="240" cy="160" r="20" fill="url(#hero-sun)" className="hero-sun" />
      {heroOrbits.map((orbit, i) => <g key={i}>
        <circle r={orbit.r * 2.6} fill={orbit.color} opacity=".16" cx={reducedMotion ? 240 + orbit.rx : 0} cy={reducedMotion ? 160 : 0}>
          {!reducedMotion && <animateMotion dur={`${orbit.dur}s`} repeatCount="indefinite" path={ellipsePath(240, 160, orbit.rx, orbit.ry)} begin={`-${i * 3.7}s`} />}
        </circle>
        <circle r={orbit.r} fill={orbit.color} cx={reducedMotion ? 240 + orbit.rx : 0} cy={reducedMotion ? 160 : 0}>
          {!reducedMotion && <animateMotion dur={`${orbit.dur}s`} repeatCount="indefinite" path={ellipsePath(240, 160, orbit.rx, orbit.ry)} begin={`-${i * 3.7}s`} />}
        </circle>
      </g>)}
    </g>
  </svg>;
}

const PresetArt = memo(function PresetArt({ count, category, index }) {
  const visible = Math.min(count - 1, 5);
  return <div className={`preset-art${category === 'Múltiplos' ? ' preset-art-binary' : ''}`} aria-hidden="true">
    <span className="art-number mono">{String(index + 1).padStart(2, '0')}</span>
    <svg viewBox="0 0 240 118" preserveAspectRatio="xMidYMid meet">
      <g className="art-system">
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
      </g>
    </svg>
  </div>;
});

export default function PresetGallery({ onView, onEdit, onCreate, busy, runningKey }) {
  // Search, category and page live in the URL, so F5 and the back button keep the gallery position.
  const [params, setParams] = useSearchParams();
  const query = params.get('busca') ?? '';
  const category = categories.includes(params.get('categoria')) ? params.get('categoria') : 'Todos';
  const listTop = useRef(null);
  const filtered = useMemo(() => filterPresets(entries, { query, category }), [query, category]);
  const page = paginate(filtered, params.get('pagina'));

  const update = (changes, { replace = false } = {}) => setParams(previous => {
    const next = new URLSearchParams(previous);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '' || value === 'Todos' || value === 1) next.delete(key);
      else next.set(key, String(value));
    }
    return next;
  }, { replace, preventScrollReset: true });
  const goToPage = value => {
    update({ pagina: value });
    listTop.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  };

  return <section className="catalog">
    <div className="hero">
      <div className="hero-copy">
        <span className="kicker"><Icon name="sparkle" size={13} /> Motor Fortran · Verlet, Yoshida e RK4</span>
        <h1>O universo em <span className="gradient-text">movimento.</span></h1>
        <p>Parta de um cenário pronto, acompanhe as órbitas em 3D e confira a conservação de energia ao longo do tempo.</p>
        <div className="hero-actions">
          <button className="button primary large" type="button" disabled={busy} onClick={() => onView('satellite')}>
            {busy && runningKey === 'satellite' ? <span className="spinner" /> : <Icon name="play" />} Visualizar exemplo</button>
          <button className="button ghost large" type="button" onClick={onCreate}>Criar meu cenário <Icon name="arrowRight" /></button>
        </div>
        <dl className="hero-stats">
          <div><dt>Simulações prontas</dt><dd className="mono">{entries.length}</dd></div>
          <div><dt>Visualização</dt><dd className="mono">3D</dd></div>
          <div><dt>Unidades</dt><dd className="mono">SI</dd></div>
        </dl>
      </div>
      <div className="hero-visual"><div className="hero-grid" /><HeroOrbit />
        <span className="hero-caption mono">Δt · integração simplética</span></div>
    </div>

    <div className="section-title" ref={listTop}>
      <div><p className="eyebrow">Biblioteca de cenários</p><h2>Encontre seu próximo experimento</h2>
        <p>Visualize a dinâmica com um clique. Todos os cenários podem ser editados.</p></div>
    </div>
    <div className="catalog-toolbar">
      <label className="search-field">
        <Icon name="search" />
        <input value={query} onChange={event => update({ busca: event.target.value, pagina: null }, { replace: true })}
          aria-label="Buscar simulações" placeholder="Buscar: Júpiter, binária, manobra, galáxia…" type="search" />
      </label>
      <div className="chips" role="group" aria-label="Filtrar categoria">
        {categories.map(item => <button type="button" key={item}
          className={`chip${category === item ? ' active' : ''}`} aria-pressed={category === item}
          onClick={() => update({ categoria: item, pagina: null })}>{item}</button>)}
      </div>
      <span className="result-count mono">{filtered.length}/{entries.length}</span>
    </div>
    {filtered.length ? <div className="catalog-grid">{page.items.map(([key, preset]) => {
      const index = positions.get(key);
      const running = busy && runningKey === key;
      return <article className={`preset-card${running ? ' running' : ''}`} key={key}>
        <PresetArt count={preset.bodies.length} category={preset.category} index={index} />
        <div className="preset-body">
          <span className="preset-category">{preset.category}</span>
          <h3>{preset.label}</h3><p>{preset.description}</p>
          <div className="preset-facts">
            <span><Icon name="layers" size={13} />{preset.bodies.length} corpos</span>
            <span><Icon name="clock" size={13} />{durationLabel(preset)}</span>
          </div>
          <div className="preset-actions">
            <button className="button primary" type="button" disabled={busy} onClick={() => onView(key)}>
              {running ? <><span className="spinner" /> Calculando…</> : <><Icon name="play" size={14} /> Visualizar</>}</button>
            <button className="button subtle" type="button" disabled={busy} onClick={() => onEdit(key)}>
              <Icon name="sliders" size={14} /> Editar</button>
          </div>
        </div>
      </article>;
    })}</div> : <div className="empty-state"><Icon name="search" size={22} />
      <strong>Nenhuma simulação encontrada</strong><span>Tente outro termo ou categoria.</span></div>}
    {filtered.length > 0 && <div className="catalog-pages">
      <span className="mono page-summary">{page.start + 1}–{page.end} de {filtered.length}</span>
      <Pagination page={page.page} pageCount={page.pageCount} onChange={goToPage} />
    </div>}
    <p className="footnote"><Icon name="info" size={14} /> Todos os cenários usam unidades SI. Sistema Solar e exoplanetas partem de elementos orbitais e massas publicados (aproximados); os demais são sistemas didáticos, com as simplificações indicadas em cada descrição.</p>
  </section>;
}
