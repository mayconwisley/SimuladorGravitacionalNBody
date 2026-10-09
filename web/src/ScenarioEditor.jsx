import { useRef, useState } from 'react';
import Icon from './Icons.jsx';
import { bodyColor } from './OrbitCanvas.jsx';
import { emptyBody, fromScenario, presetDraft, presets, toScenario } from './scenario.mjs';
import { formatNumber, formatTime } from './format.mjs';

const maxBodies = 32;
const axes = ['X', 'Y', 'Z'];

function massLabel(value) {
  const parsed = Number(String(value).trim().replace(',', '.'));
  return String(value).trim() && Number.isFinite(parsed) ? formatNumber(parsed) : '—';
}

function TextField({ label, value, onChange, unit, hint, compact = false }) {
  return <label className={`field${compact ? ' compact' : ''}`}>
    <span className="field-label">{label}</span>
    <span className="field-control">
      <input type="text" inputMode="decimal" required value={value} spellCheck="false"
        onChange={event => onChange(event.target.value)} aria-label={`${label}${unit ? ` em ${unit}` : ''}`} />
      {unit && <span className="field-unit">{unit}</span>}
    </span>
    {hint && <span className="field-hint">{hint}</span>}
  </label>;
}

function VectorField({ label, unit, values, onChange }) {
  return <fieldset className="vector-field">
    <legend>{label} <span>{unit}</span></legend>
    <div className="vector-grid">{values.map((value, axis) =>
      <TextField key={axis} compact label={`${label.split(' ')[0]} ${axes[axis]}`} value={value}
        onChange={next => onChange(axis, next)} />)}</div>
  </fieldset>;
}

export default function ScenarioEditor({ draft, setDraft, onRun, onBrowse, busy, onError }) {
  const jsonInput = useRef(null);
  const [collapsed, setCollapsed] = useState(() =>
    new Set(draft.bodies.length > 4 ? draft.bodies.map(item => item.id) : []));
  const update = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const updateBody = (id, patch) => setDraft(previous => ({ ...previous,
    bodies: previous.bodies.map(item => item.id === id ? { ...item, ...patch } : item) }));
  const updateVector = (id, key, axis, value) => setDraft(previous => ({ ...previous,
    bodies: previous.bodies.map(item => {
      if (item.id !== id) return item;
      const vector = [...item[key]];
      vector[axis] = value;
      return { ...item, [key]: vector };
    })
  }));
  const toggle = id => setCollapsed(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const loadDraft = next => {
    setDraft(next);
    setCollapsed(new Set(next.bodies.length > 4 ? next.bodies.map(item => item.id) : []));
    onError('');
  };
  const estimatedSamples = 2 + Math.floor((Number(draft.steps) - 1) / Number(draft.sampleEverySteps));
  const duration = Number(draft.steps) * Number(draft.timeStepSeconds);
  const allCollapsed = draft.bodies.every(item => collapsed.has(item.id));

  function exportJson() {
    try {
      const content = JSON.stringify(toScenario(draft), null, 2);
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'orbital-scenario.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { onError(error.message); }
  }

  async function importJson(event) {
    try {
      const file = event.target.files?.[0];
      if (file) loadDraft(fromScenario(JSON.parse(await file.text())));
      else onError('');
    } catch (error) { onError(`Não foi possível importar o JSON: ${error.message}`); }
    event.target.value = '';
  }

  return <div className="editor-layout">
    <form className="editor-form" onSubmit={event => { event.preventDefault(); onRun(); }}>
      <section className="panel">
        <header className="panel-header">
          <div><p className="eyebrow">Ponto de partida</p><h2>Carregar um modelo</h2></div>
          <div className="header-actions">
            <button className="button subtle small" type="button" onClick={() => jsonInput.current.click()}><Icon name="upload" size={14} /> Importar JSON</button>
            <input ref={jsonInput} type="file" accept=".json,application/json" hidden onChange={importJson} />
          </div>
        </header>
        <div className="chips" aria-label="Cenários prontos">
          {['satellite', 'solar'].map(key =>
            <button type="button" className="chip" key={key} onClick={() => loadDraft(presetDraft(key))}>
              <Icon name="orbit" size={14} /> {presets[key].label}
            </button>)}
          <button type="button" className="chip link" onClick={onBrowse}>Ver todas as {Object.keys(presets).length} simulações <Icon name="arrowRight" size={14} /></button>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <div><p className="eyebrow">Integração</p><h2>Parâmetros numéricos</h2></div>
          <span className="badge">Velocity Verlet</span>
        </header>
        <div className="config-grid">
          <TextField label="Constante gravitacional G" unit="m³/(kg·s²)" value={draft.gravity}
            onChange={value => update('gravity', value)} />
          <TextField label="Suavização ε" unit="m" value={draft.softeningMeters}
            onChange={value => update('softeningMeters', value)} hint="0 para gravidade newtoniana" />
          <TextField label="Passo de tempo Δt" unit="s" value={draft.timeStepSeconds}
            onChange={value => update('timeStepSeconds', value)} />
          <TextField label="Número de passos" value={draft.steps} hint="Até 20.000"
            onChange={value => update('steps', value)} />
          <TextField label="Amostra a cada" unit="passos" value={draft.sampleEverySteps} hint="Até 1.001 amostras"
            onChange={value => update('sampleEverySteps', value)} />
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <div><p className="eyebrow">Condições iniciais</p><h2>Corpos <span className="muted mono">{draft.bodies.length}/{maxBodies}</span></h2></div>
          <button className="button subtle small" type="button"
            onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(draft.bodies.map(item => item.id)))}>
            {allCollapsed ? 'Expandir todos' : 'Recolher todos'}</button>
        </header>
        <div className="body-edit-list">
          {draft.bodies.map((item, index) => {
            const open = !collapsed.has(item.id);
            return <article className={`body-card${open ? ' open' : ''}`} key={item.id} style={{ '--swatch': bodyColor(index) }}>
              <div className="body-card-header">
                <button type="button" className="body-card-toggle" aria-expanded={open} onClick={() => toggle(item.id)}>
                  <span className="swatch" />
                  <span className="body-card-title"><strong>{item.name || 'Sem nome'}</strong>
                    <span className="mono">#{String(index + 1).padStart(2, '0')} · {massLabel(item.massKg)} kg</span></span>
                  <Icon name="chevron" className="chevron" />
                </button>
                <button type="button" className="icon-button danger" disabled={draft.bodies.length === 1}
                  aria-label={`Remover ${item.name || `corpo ${index + 1}`}`} title="Remover corpo"
                  onClick={() => setDraft(previous => ({ ...previous,
                    bodies: previous.bodies.filter(body => body.id !== item.id) }))}><Icon name="trash" /></button>
              </div>
              {open && <div className="body-card-content">
                <div className="body-basics">
                  <label className="field"><span className="field-label">Nome</span>
                    <span className="field-control"><input required value={item.name}
                      onChange={event => updateBody(item.id, { name: event.target.value })} /></span></label>
                  <TextField label="Massa" unit="kg" value={item.massKg}
                    onChange={value => updateBody(item.id, { massKg: value })} />
                </div>
                <VectorField label="Posição inicial" unit="m" values={item.positionMeters}
                  onChange={(axis, next) => updateVector(item.id, 'positionMeters', axis, next)} />
                <VectorField label="Velocidade inicial" unit="m/s" values={item.velocityMetersPerSecond}
                  onChange={(axis, next) => updateVector(item.id, 'velocityMetersPerSecond', axis, next)} />
              </div>}
            </article>;
          })}
        </div>
        <button type="button" className="add-button" disabled={draft.bodies.length >= maxBodies}
          onClick={() => setDraft(previous => ({ ...previous, bodies: [...previous.bodies, emptyBody()] }))}>
          <Icon name="plus" /> Adicionar corpo</button>
      </section>

      <div className="action-bar">
        <span className="action-summary mono">{draft.bodies.length} corpos · {Number.isFinite(duration) ? formatTime(duration) : '—'}</span>
        <button className="button subtle" type="button" onClick={exportJson}><Icon name="download" size={14} /> Exportar JSON</button>
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? <><span className="spinner" /> Calculando…</> : <><Icon name="play" size={14} /> Executar simulação</>}</button>
      </div>
    </form>

    <aside className="editor-aside">
      <section className="panel summary-panel">
        <header className="panel-header"><div><p className="eyebrow">Resumo</p><h2>Antes de executar</h2></div></header>
        <div className="stat-grid">
          <div className="stat"><span className="label">Corpos</span><strong className="mono">{draft.bodies.length}</strong></div>
          <div className="stat"><span className="label">Amostras</span>
            <strong className="mono">{Number.isFinite(estimatedSamples) && estimatedSamples > 0 ? formatNumber(estimatedSamples) : '—'}</strong></div>
          <div className="stat stat-wide"><span className="label">Tempo simulado</span>
            <strong className="mono accent">{Number.isFinite(duration) ? formatTime(duration) : '—'}</strong></div>
        </div>
        <ul className="body-chips">{draft.bodies.slice(0, 12).map((item, index) =>
          <li key={item.id}><span className="swatch" style={{ '--swatch': bodyColor(index) }} />{item.name || 'Sem nome'}</li>)}
          {draft.bodies.length > 12 && <li className="muted">+{draft.bodies.length - 12}</li>}
        </ul>
        <p className="panel-note">O motor calcula a atração entre todos os pares de corpos. Reduza o passo de tempo para conferir a estabilidade da órbita.</p>
      </section>
      <section className="panel tip-panel">
        <span className="panel-icon"><Icon name="sparkle" /></span>
        <h2>Comece por um exemplo</h2>
        <p>Carregue um cenário pronto, ajuste a massa ou a velocidade de um corpo e compare a trajetória e a deriva de energia.</p>
      </section>
    </aside>
  </div>;
}
