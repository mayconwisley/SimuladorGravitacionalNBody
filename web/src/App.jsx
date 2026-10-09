import { useEffect, useRef, useState } from 'react';
import { parseTrajectory, parseDiagnostics } from '../data.mjs';
import OrbitCanvas, { bodyColor } from './OrbitCanvas.jsx';
import PresetGallery from './PresetGallery.jsx';
import ScenarioEditor from './ScenarioEditor.jsx';
import Diagnostics from './Diagnostics.jsx';
import { formatNumber, formatTime } from './format.mjs';
import { fromApi, presetDraft, presets, toScenario } from './scenario.mjs';

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
