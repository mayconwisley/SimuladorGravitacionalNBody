import { useEffect, useRef, useState } from 'react';
import { parseTrajectory, parseDiagnostics } from '../data.mjs';
import OrbitCanvas, { bodyColor } from './OrbitCanvas.jsx';
import PresetGallery from './PresetGallery.jsx';
import { emptyBody, fromApi, fromScenario, presetDraft, presets, toScenario } from './scenario.mjs';

function formatNumber(value, digits = 3) {
  if (!Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  if (magnitude && (magnitude >= 1e6 || magnitude < 1e-3)) return value.toExponential(2);
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(value);
}

function formatTime(seconds) {
  if (seconds >= 86400) return `${formatNumber(seconds / 86400, 2)} dias`;
  if (seconds >= 3600) return `${formatNumber(seconds / 3600, 2)} h`;
  if (seconds >= 60) return `${formatNumber(seconds / 60, 2)} min`;
  return `${formatNumber(seconds, 2)} s`;
}

function TextField({ label, value, onChange, unit, hint }) {
  return <label className="form-field">
    <span>{label} {unit && <small>{unit}</small>}</span>
    <input type="text" inputMode="decimal" required value={value}
      onChange={event => onChange(event.target.value)} aria-label={`${label}${unit ? ` em ${unit}` : ''}`} />
    {hint && <em>{hint}</em>}
  </label>;
}

function ScenarioEditor({ draft, setDraft, onRun, onBrowse, busy, onError }) {
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

function Diagnostics({ dataset, index }) {
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

export default function App() {
  const [tab, setTab] = useState('catalog');
  const [draft, setDraft] = useState(() => presetDraft());
  const [dataset, setDataset] = useState(null);
  const [source, setSource] = useState('');
  const [index, setIndex] = useState(0);
  const [focus, setFocus] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [runningKey, setRunningKey] = useState(null);
  const [error, setError] = useState('');
  const csvInput = useRef(null);

  useEffect(() => {
    if (!playing || !dataset) return;
    const timer = setInterval(() => setIndex(previous => {
      return Math.min(dataset.frames.length - 1, previous + 1);
    }), 1000 / (12 * speed));
    return () => clearInterval(timer);
  }, [playing, dataset, speed]);

  useEffect(() => {
    if (dataset && index >= dataset.frames.length - 1) setPlaying(false);
  }, [dataset, index]);

  async function run(selectedDraft = draft, presetKey = null) {
    let scenario;
    try { scenario = toScenario(selectedDraft); }
    catch (cause) { setError(cause.message); return; }
    setError(''); setBusy(true); setRunningKey(presetKey); setPlaying(false);
    try {
      let response;
      try {
        response = await fetch('/api/simulations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scenario)
        });
      } catch {
        throw new Error('A API .NET está indisponível. Inicie o servidor local na porta 5080.');
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível executar a simulação.');
      setDataset(fromApi(result));
      setSource(presetKey ? presets[presetKey].label :
        scenario.bodies.length <= 3 ? scenario.bodies.map(body => body.name).join(' / ') : `${scenario.bodies.length} corpos`);
      setIndex(0); setFocus(null); setTab('results');
    } catch (cause) {
      setError(`Falha ao executar: ${cause.message}`);
    } finally { setBusy(false); setRunningKey(null); }
  }

  function openPreset(key, visualize) {
    const selected = presetDraft(key);
    setDraft(selected);
    setError('');
    if (visualize) run(selected, key);
    else setTab('editor');
  }

  async function importCsv(event) {
    try {
      const files = new Map([...event.target.files].map(file => [file.name.toLowerCase(), file]));
      const trajectory = files.get('trajectory.csv');
      if (!trajectory) throw new Error('Selecione trajectory.csv. diagnostics.csv é opcional.');
      const parsed = parseTrajectory(await trajectory.text());
      const diagnostics = files.get('diagnostics.csv');
      setDataset({ ...parsed, diagnostics: parseDiagnostics(diagnostics ? await diagnostics.text() : '') });
      setSource('Dados importados'); setIndex(0); setFocus(null); setPlaying(false); setTab('results'); setError('');
    } catch (cause) { setError(cause.message); }
    event.target.value = '';
  }

  const frame = dataset?.frames[index];
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><span /></span><div><strong>OrbitalSim</strong><small>Laboratório orbital</small></div></div>
      <div className="top-actions"><span className="engine-pill"><span className="status-dot" /> FORTRAN · .NET 10 · REACT</span>
        <button className="import-button" type="button" onClick={() => csvInput.current.click()}>↥ Importar CSV</button>
        <input ref={csvInput} type="file" accept=".csv" multiple hidden onChange={importCsv} />
      </div>
    </header>
    <main>
      <div className="page-heading"><div><p className="eyebrow">DINÂMICA GRAVITACIONAL / N-BODY</p>
        <h1>Explore sistemas orbitais.</h1>
        <p className="heading-copy">Escolha uma simulação pronta ou defina cada corpo para calcular novas trajetórias.</p></div>
        <span className="scenario-chip"><span className="chip-orbit" />{source || 'Novo cenário'}</span>
      </div>
      <nav className="workspace-tabs" aria-label="Área de trabalho">
        <button type="button" className={tab === 'catalog' ? 'active' : ''} onClick={() => setTab('catalog')}>01 · Simulações prontas</button>
        <button type="button" className={tab === 'editor' ? 'active' : ''} onClick={() => setTab('editor')}>02 · Criar cenário</button>
        <button type="button" className={tab === 'results' ? 'active' : ''} onClick={() => setTab('results')}>03 · Explorar resultados</button>
      </nav>
      {error && <div className="error-banner" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Fechar aviso">×</button></div>}
      {tab === 'catalog' ? <PresetGallery onView={key => openPreset(key, true)} onEdit={key => openPreset(key, false)} busy={busy} runningKey={runningKey} /> :
      tab === 'editor' ? <ScenarioEditor draft={draft} setDraft={setDraft} onRun={() => run()} onBrowse={() => setTab('catalog')} busy={busy} onError={setError} /> :
        <div className="workspace-grid">
          <div className="viewer-column"><OrbitCanvas dataset={dataset} index={index} focus={focus} />
            {dataset && <div className="timeline-panel">
              <div className="timeline-meta"><div className="time-display"><span className="meta-label">TEMPO SIMULADO</span><strong>{formatTime(frame.time)}</strong></div>
                <div className="step-display"><span className="meta-label">PASSO</span><strong>{frame.step} / {dataset.frames.at(-1).step}</strong></div></div>
              <input id="timeline" type="range" min="0" max={dataset.frames.length - 1} value={index}
                aria-label="Linha do tempo" onChange={event => { setPlaying(false); setIndex(Number(event.target.value)); }} />
              <div className="playback-row"><div className="playback-left">
                <button className="icon-button" type="button" aria-label="Voltar ao início" onClick={() => { setPlaying(false); setIndex(0); }}>↺</button>
                <button className="play-button" type="button" onClick={() => { if (index === dataset.frames.length - 1) setIndex(0); setPlaying(!playing); }}>
                  {playing ? 'Ⅱ Pausar' : '▶ Reproduzir'}</button><span className="timeline-end">Fim: {formatTime(dataset.frames.at(-1).time)}</span></div>
                <div className="speed-control"><label htmlFor="speed-select">Velocidade</label><select id="speed-select" value={speed} onChange={event => setSpeed(Number(event.target.value))}>
                  {[0.25, 0.5, 1, 2, 4, 8].map(value => <option key={value} value={value}>{String(value).replace('.', ',')}×</option>)}</select></div>
              </div>
            </div>}
          </div>
          {dataset && <aside className="sidebar"><section className="side-card objects-card">
            <div className="section-heading"><div><p className="eyebrow">CENÁRIO</p><h2>Corpos celestes</h2></div><span className="count-pill">{dataset.names.length}</span></div>
            <p className="side-description">Selecione um corpo para acompanhá-lo.</p>
            <div className="body-list">{dataset.names.slice(0, 30).map((name, colorIndex) =>
              <button type="button" key={name} className={`body-item${focus === name ? ' active' : ''}`} onClick={() => setFocus(name)}>
                <span className="body-swatch" style={{ background: bodyColor(colorIndex), color: bodyColor(colorIndex) }} />
                <span><span className="body-name">{name}</span><span className="body-mass">{formatNumber(dataset.frames[0].bodies.get(name).mass)} kg</span></span><span className="body-arrow">↗</span>
              </button>)}
              {dataset.names.length > 30 && <p className="side-description">Mais {dataset.names.length - 30} corpos visíveis na cena.</p>}
            </div>
            <button type="button" className={`focus-center${focus === null ? ' active' : ''}`} onClick={() => setFocus(null)}>◎ Centro do sistema</button>
          </section><Diagnostics dataset={dataset} index={index} /></aside>}
        </div>}
      {tab === 'results' && dataset && <div className="info-strip"><span className="info-symbol">i</span><span>Distâncias ajustadas à tela; os valores físicos permanecem no cenário e nos CSVs.</span><span id="sample-count">{dataset.frames.length} amostras · {dataset.names.length} corpos</span></div>}
    </main>
  </div>;
}
