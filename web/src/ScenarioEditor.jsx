import { useMemo, useRef, useState } from 'react';
import Icon from './Icons.jsx';
import BodyCard from './BodyCard.jsx';
import PhysicsSection from './PhysicsSection.jsx';
import ParticleGroupsSection from './ParticleGroupsSection.jsx';
import ManeuversSection from './ManeuversSection.jsx';
import { bodyColor } from './OrbitCanvas.jsx';
import { Segmented, TextField } from './fields.jsx';
import { emptyBody, estimatePairEvaluations, fromScenario, integrators, limits, presetDraft, presets,
  toScenario } from './scenario.mjs';
import { formatNumber, formatTime } from './format.mjs';

export default function ScenarioEditor({ draft, setDraft, onRun, onBrowse, busy, onError }) {
  const jsonInput = useRef(null);
  const [collapsed, setCollapsed] = useState(() =>
    new Set(draft.bodies.length > 4 ? draft.bodies.map(item => item.id) : []));
  const update = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const updateBody = (id, patch) => setDraft(previous => ({ ...previous,
    bodies: previous.bodies.map(item => item.id === id ? { ...item, ...patch } : item) }));
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
  // Live validation: the same checks the run will make, shown before running.
  const validation = useMemo(() => {
    try {
      const scenario = toScenario(draft);
      return { scenario, cost: estimatePairEvaluations(scenario) / limits.pairEvaluations };
    } catch (error) { return { error: error.message }; }
  }, [draft]);
  const steps = Number(draft.steps), every = Number(draft.sampleEverySteps);
  const estimatedSamples = 2 + Math.floor((steps - 1) / every);
  const duration = steps * Number(String(draft.timeStepSeconds).replace(',', '.'));
  const particles = (draft.particleGroups ?? []).reduce((total, group) => total + (Number(group.count) || 0), 0);
  const allCollapsed = draft.bodies.every(item => collapsed.has(item.id));
  const physicsActive = Boolean(validation.scenario?.physics);

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
          {['satellite', 'solar', 'hohmann'].filter(key => presets[key]).map(key =>
            <button type="button" className="chip" key={key} onClick={() => loadDraft(presetDraft(key))}>
              <Icon name="orbit" size={14} /> {presets[key].label}
            </button>)}
          <button type="button" className="chip link" onClick={onBrowse}>Ver todas as {Object.keys(presets).length} simulações <Icon name="arrowRight" size={14} /></button>
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <div><p className="eyebrow">Integração</p><h2>Parâmetros numéricos</h2></div>
        </header>
        <div className="integrator-row">
          <Segmented label="Integrador" value={draft.integrator ?? 'verlet'} onChange={value => update('integrator', value)}
            options={Object.entries(integrators).map(([value, item]) => ({ value, label: item.label,
              title: item.description }))} />
          <p className="field-hint">{integrators[draft.integrator ?? 'verlet'].description}</p>
        </div>
        <div className="config-grid">
          <TextField label="Constante gravitacional G" unit="m³/(kg·s²)" value={draft.gravity}
            onChange={value => update('gravity', value)} />
          <TextField label="Suavização ε" unit="m" value={draft.softeningMeters}
            onChange={value => update('softeningMeters', value)} hint="0 para gravidade newtoniana" />
          <TextField label="Passo de tempo Δt" unit="s" value={draft.timeStepSeconds}
            onChange={value => update('timeStepSeconds', value)} hint="Negativo integra para trás no tempo" />
          <TextField label="Número de passos" value={draft.steps} hint="Até 20.000" inputMode="numeric"
            onChange={value => update('steps', value)} />
          <TextField label="Amostra a cada" unit="passos" value={draft.sampleEverySteps} hint="Até 1.001 amostras"
            inputMode="numeric" onChange={value => update('sampleEverySteps', value)} />
        </div>
      </section>

      <section className="panel">
        <header className="panel-header">
          <div><p className="eyebrow">Condições iniciais</p><h2>Corpos <span className="muted mono">{draft.bodies.length}/{limits.bodies}</span></h2></div>
          <button className="button subtle small" type="button"
            onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(draft.bodies.map(item => item.id)))}>
            {allCollapsed ? 'Expandir todos' : 'Recolher todos'}</button>
        </header>
        <div className="body-edit-list">
          {draft.bodies.map((item, index) => <BodyCard key={item.id} item={item} index={index} bodies={draft.bodies}
            open={!collapsed.has(item.id)} onToggle={() => toggle(item.id)} removable={draft.bodies.length > 1}
            onChange={patch => updateBody(item.id, patch)}
            onRemove={() => setDraft(previous => ({ ...previous, bodies: previous.bodies.filter(body => body.id !== item.id) }))} />)}
        </div>
        <button type="button" className="add-button" disabled={draft.bodies.length >= limits.bodies}
          onClick={() => setDraft(previous => ({ ...previous, bodies: [...previous.bodies, emptyBody()] }))}>
          <Icon name="plus" /> Adicionar corpo</button>
      </section>

      <section className="panel">
        <header className="panel-header">
          <div><p className="eyebrow">Física adicional</p><h2>Achatamento, atmosfera, relatividade e colisões</h2></div>
          <span className={`badge${physicsActive ? '' : ' off'}`}>{physicsActive ? 'Ativa' : 'Newtoniana'}</span>
        </header>
        <PhysicsSection physics={draft.physics} bodies={draft.bodies} onChange={value => update('physics', value)} />
      </section>

      <section className="panel">
        <header className="panel-header">
          <div><p className="eyebrow">Partículas de teste</p><h2>Anéis e discos <span className="muted mono">{particles}</span></h2></div>
        </header>
        <ParticleGroupsSection groups={draft.particleGroups ?? []} bodies={draft.bodies}
          onChange={value => update('particleGroups', value)} />
      </section>

      <section className="panel">
        <header className="panel-header">
          <div><p className="eyebrow">Manobras</p><h2>Impulsos programados <span className="muted mono">{draft.maneuvers?.length ?? 0}</span></h2></div>
        </header>
        <ManeuversSection maneuvers={draft.maneuvers ?? []} bodies={draft.bodies} timeStep={draft.timeStepSeconds}
          onChange={value => update('maneuvers', value)} />
      </section>

      <div className="action-bar">
        <span className="action-summary mono">{draft.bodies.length} corpos{particles ? ` · ${particles} partículas` : ''} · {Number.isFinite(duration) ? formatTime(duration) : '—'}</span>
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
          <div className="stat"><span className="label">Partículas</span><strong className="mono">{formatNumber(particles)}</strong></div>
          <div className="stat"><span className="label">Integrador</span>
            <strong className="mono">{integrators[draft.integrator ?? 'verlet'].label.split(' ').at(-1)}</strong></div>
          <div className="stat stat-wide"><span className="label">Tempo simulado</span>
            <strong className="mono accent">{Number.isFinite(duration) ? formatTime(duration) : '—'}</strong></div>
        </div>
        {validation.error ? <p className="validation error"><Icon name="alert" size={14} /> {validation.error}</p> : <>
          <div className="cost-meter" title="Interações de pares calculadas, em relação ao limite da execução interativa">
            <span className="label">Custo estimado</span>
            <span className="meter"><span style={{ width: `${Math.min(100, 100 * validation.cost)}%` }} /></span>
            <span className="mono">{validation.cost < 0.001 ? '< 0,1' : formatNumber(100 * validation.cost, 1)}%</span>
          </div>
          <p className="validation ok"><Icon name="target" size={14} /> Pronto para executar.</p>
        </>}
        <ul className="body-chips">{draft.bodies.slice(0, 12).map((item, index) =>
          <li key={item.id}><span className="swatch" style={{ '--swatch': bodyColor(index) }} />{item.name || 'Sem nome'}</li>)}
          {draft.bodies.length > 12 && <li className="muted">+{draft.bodies.length - 12}</li>}
        </ul>
        <p className="panel-note">O motor calcula a atração entre todos os pares de corpos com massa; partículas só
          sentem a gravidade. Depois da execução, o motor sugere o Δt adequado ao encontro mais próximo.</p>
      </section>
      <section className="panel tip-panel">
        <span className="panel-icon"><Icon name="sparkle" /></span>
        <h2>Comece por um exemplo</h2>
        <p>Defina um satélite por elementos orbitais (a, e, i), ligue o J2 da Terra e veja o plano da órbita girar —
          ou programe duas manobras para uma transferência de Hohmann.</p>
      </section>
    </aside>
  </div>;
}
