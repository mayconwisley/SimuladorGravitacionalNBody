import { useRef } from 'react';
import { bodyColor } from './OrbitCanvas.jsx';
import { emptyBody, fromScenario, presetDraft, presets, toScenario } from './scenario.mjs';
import { formatNumber, formatTime } from './format.mjs';

function TextField({ label, value, onChange, unit, hint }) {
  return <label className="form-field">
    <span>{label} {unit && <small>{unit}</small>}</span>
    <input type="text" inputMode="decimal" required value={value}
      onChange={event => onChange(event.target.value)} aria-label={`${label}${unit ? ` em ${unit}` : ''}`} />
    {hint && <em>{hint}</em>}
  </label>;
}

export default function ScenarioEditor({ draft, setDraft, onRun, onBrowse, busy, onError }) {
  const jsonInput = useRef(null);
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
  const estimatedSamples = 2 + Math.floor((Number(draft.steps) - 1) / Number(draft.sampleEverySteps));
  const duration = Number(draft.steps) * Number(draft.timeStepSeconds);

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
      if (file) setDraft(fromScenario(JSON.parse(await file.text())));
      onError('');
    } catch (error) { onError(`Não foi possível importar o JSON: ${error.message}`); }
    event.target.value = '';
  }

  return <div className="editor-layout">
    <form className="editor-card" onSubmit={event => { event.preventDefault(); onRun(); }}>
      <div className="section-heading editor-heading">
        <div><p className="eyebrow">ENTRADA DE DADOS</p><h2>Configurar cenário</h2></div>
        <span className="count-pill">SI</span>
      </div>
      <p className="form-intro">Defina as condições iniciais. Todos os campos físicos usam o Sistema Internacional.</p>
      <div className="preset-row" aria-label="Cenários prontos">
        {['satellite', 'solar'].map(key =>
          <button type="button" key={key} onClick={() => { setDraft(presetDraft(key)); onError(''); }}>
            ◉ {presets[key].label}
          </button>)}
        <button type="button" onClick={onBrowse}>Ver todas as {Object.keys(presets).length} simulações →</button>
      </div>
      <div className="form-section-heading"><h3>Integração</h3><span>Velocity Verlet</span></div>
      <div className="config-grid">
        <TextField label="Constante gravitacional G" unit="m³/(kg·s²)" value={draft.gravity}
          onChange={value => update('gravity', value)} />
        <TextField label="Suavização ε" unit="m" value={draft.softeningMeters}
          onChange={value => update('softeningMeters', value)} hint="0 para gravidade newtoniana" />
        <TextField label="Passo de tempo Δt" unit="s" value={draft.timeStepSeconds}
          onChange={value => update('timeStepSeconds', value)} />
        <TextField label="Número de passos" value={draft.steps}
          onChange={value => update('steps', value)} />
        <TextField label="Amostra a cada" unit="passos" value={draft.sampleEverySteps}
          onChange={value => update('sampleEverySteps', value)} />
      </div>
      <div className="form-section-heading bodies-heading"><h3>Corpos</h3><span>{draft.bodies.length} / 32</span></div>
      <div className="body-edit-list">
        {draft.bodies.map((item, index) => <section className="body-edit-card" key={item.id}>
          <div className="body-edit-title">
            <span className="body-swatch" style={{ background: bodyColor(index), color: bodyColor(index) }} />
            <strong>Corpo {String(index + 1).padStart(2, '0')}</strong>
            <button type="button" className="text-button danger" disabled={draft.bodies.length === 1}
              onClick={() => setDraft(previous => ({ ...previous,
                bodies: previous.bodies.filter(body => body.id !== item.id) }))}>Remover</button>
          </div>
          <div className="body-basics">
            <label className="form-field"><span>Nome</span><input required value={item.name}
              onChange={event => updateBody(item.id, { name: event.target.value })} /></label>
            <TextField label="Massa" unit="kg" value={item.massKg}
              onChange={value => updateBody(item.id, { massKg: value })} />
          </div>
          <div className="vector-label">Posição inicial <small>m</small></div>
          <div className="vector-grid">{item.positionMeters.map((value, axis) =>
            <TextField key={axis} label={'XYZ'[axis]} value={value}
              onChange={next => updateVector(item.id, 'positionMeters', axis, next)} />)}</div>
          <div className="vector-label">Velocidade inicial <small>m/s</small></div>
          <div className="vector-grid">{item.velocityMetersPerSecond.map((value, axis) =>
            <TextField key={axis} label={'XYZ'[axis]} value={value}
              onChange={next => updateVector(item.id, 'velocityMetersPerSecond', axis, next)} />)}</div>
        </section>)}
      </div>
      <button type="button" className="add-button" disabled={draft.bodies.length >= 32}
        onClick={() => setDraft(previous => ({ ...previous, bodies: [...previous.bodies, emptyBody()] }))}>+ Adicionar corpo</button>
      <div className="editor-actions">
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Calculando...' : '▶ Executar simulação'}</button>
        <button className="secondary-button" type="button" onClick={exportJson}>Exportar JSON</button>
        <button className="secondary-button" type="button" onClick={() => jsonInput.current.click()}>Importar JSON</button>
        <input ref={jsonInput} type="file" accept=".json,application/json" hidden onChange={importJson} />
      </div>
    </form>
    <aside className="editor-aside">
      <div className="side-card">
        <p className="eyebrow">RESUMO DO CENÁRIO</p><h2>Antes de executar</h2>
        <div className="metric"><span>Corpos</span><strong>{draft.bodies.length}</strong></div>
        <div className="metric"><span>Tempo simulado</span><strong>{Number.isFinite(duration) ? formatTime(duration) : '—'}</strong></div>
        <div className="metric"><span>Amostras previstas</span><strong>{Number.isFinite(estimatedSamples) && estimatedSamples > 0 ? formatNumber(estimatedSamples) : '—'}</strong></div>
        <p className="side-description">O motor calcula a atração entre todos os pares de corpos. Reduza o passo de tempo para conferir a estabilidade da órbita.</p>
      </div>
      <div className="side-card help-card"><p className="eyebrow">DICA</p><h2>Comece por um exemplo</h2>
        <p>Carregue um cenário pronto, ajuste a massa ou a velocidade de um corpo e compare a trajetória e a deriva de energia.</p>
      </div>
    </aside>
  </div>;
}

