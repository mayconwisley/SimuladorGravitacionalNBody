import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { parseTrajectory, parseDiagnostics } from '../data.mjs';
import OrbitCanvas from './OrbitCanvas.jsx';
import PresetGallery from './PresetGallery.jsx';
import ScenarioEditor from './ScenarioEditor.jsx';
import Diagnostics from './Diagnostics.jsx';
import BodyList from './BodyList.jsx';
import Timeline from './Timeline.jsx';
import Icon from './Icons.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import useEngineStatus from './useEngineStatus.js';
import usePlayback from './usePlayback.js';
import { fromApi, presetDraft, presets, toScenario } from './scenario.mjs';
import { pathForTab, routeForPath, routes } from './routes.mjs';
import { loadDraft, loadLastRun, saveDraft, saveLastRun } from './session.mjs';

const headings = {
  editor: { eyebrow: 'Editor de cenário', title: 'Desenhe sua próxima órbita',
    copy: 'Defina corpos, massas e velocidades em unidades SI. O motor Fortran calcula a evolução do sistema.' },
  results: { eyebrow: 'Explorar resultados', title: 'Cada trajetória, em detalhe',
    copy: 'Acompanhe a evolução no tempo, siga um corpo e confira os diagnósticos de conservação.' }
};

const engineLabels = { online: 'Motor pronto', offline: 'API indisponível', checking: 'Conectando…' };
const importedNotice = 'Dados importados de CSV não ficam salvos ao recarregar a página. Importe os arquivos novamente.';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const route = routeForPath(location.pathname);
  const tab = route?.key;
  const [draft, setDraft] = useState(() => loadDraft() ?? presetDraft());
  const [dataset, setDataset] = useState(null);
  const [source, setSource] = useState('');
  const [focus, setFocus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [runningKey, setRunningKey] = useState(null);
  const [error, setError] = useState('');
  const [emptyNotice, setEmptyNotice] = useState('');
  const csvInput = useRef(null);
  const restoreAttempted = useRef(false);
  const engine = useEngineStatus();
  const playback = usePlayback(dataset?.frames.length ?? 0);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [tab]);
  useEffect(() => { document.title = `${route?.title ?? 'OrbitalSim'} · OrbitalSim`; }, [route]);
  useEffect(() => { saveDraft(draft); }, [draft]);

  // F5 on /resultados: recompute the last scenario of this browser tab.
  useEffect(() => {
    if (restoreAttempted.current || tab !== 'results' || dataset) return;
    restoreAttempted.current = true;
    const last = loadLastRun();
    if (last?.scenario) execute(last.scenario, last.label);
    else if (last) setEmptyNotice(importedNotice);
    // Runs once on the first visit to the results route.
  }, [tab, dataset]);

  const go = key => navigate(pathForTab(key));

  function show(nextDataset, label) {
    setDataset(nextDataset); setSource(label); setFocus(null); setEmptyNotice('');
    playback.reset();
    if (location.pathname !== pathForTab('results')) go('results');
  }

  async function execute(scenario, label, presetKey = null) {
    setError(''); setBusy(true); setRunningKey(presetKey); playback.reset();
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
      saveLastRun({ label, scenario });
      show(fromApi(result), label);
    } catch (cause) {
      setError(`Falha ao executar: ${cause.message}`);
    } finally { setBusy(false); setRunningKey(null); }
  }

  function run(selectedDraft = draft, presetKey = null) {
    let scenario;
    try { scenario = toScenario(selectedDraft); }
    catch (cause) { setError(cause.message); return; }
    execute(scenario, presetKey ? presets[presetKey].label :
      scenario.bodies.length <= 3 ? scenario.bodies.map(body => body.name).join(' / ') : `${scenario.bodies.length} corpos`,
    presetKey);
  }

  function openPreset(key, visualize) {
    const selected = presetDraft(key);
    setDraft(selected);
    setError('');
    if (visualize) run(selected, key);
    else go('editor');
  }

  async function importCsv(event) {
    try {
      const files = new Map([...event.target.files].map(file => [file.name.toLowerCase(), file]));
      const trajectory = files.get('trajectory.csv');
      if (!trajectory) throw new Error('Selecione trajectory.csv. diagnostics.csv é opcional.');
      const parsed = parseTrajectory(await trajectory.text());
      const diagnostics = files.get('diagnostics.csv');
      saveLastRun({ label: 'Dados importados', scenario: null });
      show({ ...parsed, diagnostics: parseDiagnostics(diagnostics ? await diagnostics.text() : '') }, 'Dados importados');
      setError('');
    } catch (cause) { setError(cause.message); }
    event.target.value = '';
  }

  if (!route) return <Navigate to="/" replace />;

  const heading = headings[tab];
  return <div className="app-shell">
    {busy && <div className="progress-bar" role="progressbar" aria-label="Calculando simulação" />}
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand" aria-label="OrbitalSim, ir para simulações">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-text"><strong>OrbitalSim</strong><small>Laboratório orbital</small></span>
        </Link>
        <nav className="nav-tabs" aria-label="Área de trabalho">
          {routes.map(item => <Link to={item.path} key={item.key} className={tab === item.key ? 'active' : ''}
            aria-current={tab === item.key ? 'page' : undefined}>
            <Icon name={item.icon} /><span>{item.label}</span>
            {item.key === 'results' && dataset && <span className="nav-dot" aria-label="resultado disponível" />}
          </Link>)}
        </nav>
        <div className="top-actions">
          <span className={`engine-status ${engine}`} title="Estado da API local"><span className="status-dot" />{engineLabels[engine]}</span>
          <button className="button subtle" type="button" onClick={() => csvInput.current.click()} title="Importar trajectory.csv e diagnostics.csv">
            <Icon name="upload" size={15} /><span className="hide-small">Importar CSV</span></button>
          <input ref={csvInput} type="file" accept=".csv" multiple hidden onChange={importCsv} />
        </div>
      </div>
    </header>

    <main className={`page page-${tab}`}>
      {heading && <div className="page-heading">
        <div><p className="eyebrow">{heading.eyebrow}</p><h1>{heading.title}</h1><p className="lead">{heading.copy}</p></div>
        {tab === 'results' && dataset && <span className="scenario-pill"><Icon name="orbit" size={14} />{source}</span>}
      </div>}

      <ErrorBoundary resetKey={`${tab}:${source}`} onReset={() => go('catalog')}>
      {tab === 'catalog' ? <PresetGallery onView={key => openPreset(key, true)} onEdit={key => openPreset(key, false)}
        onCreate={() => go('editor')} busy={busy} runningKey={runningKey} /> :
      tab === 'editor' ? <ScenarioEditor draft={draft} setDraft={setDraft} onRun={() => run()}
        onBrowse={() => go('catalog')} busy={busy} onError={setError} /> :
        <>
          <div className={`results-layout${dataset ? '' : ' empty'}`}>
            <div className="viewer">
              <OrbitCanvas dataset={dataset} index={playback.index} focus={focus} source={source}
                loading={busy} emptyNotice={emptyNotice}
                emptyActions={<div className="empty-actions">
                  <button className="button primary" type="button" onClick={() => go('catalog')}><Icon name="grid" size={14} /> Ver simulações</button>
                  <button className="button subtle" type="button" onClick={() => csvInput.current.click()}><Icon name="upload" size={14} /> Importar CSV</button>
                </div>} />
              {dataset && <Timeline dataset={dataset} playback={playback} />}
            </div>
            {dataset && <aside className="results-aside">
              <BodyList dataset={dataset} index={playback.index} focus={focus} setFocus={setFocus} />
              <Diagnostics dataset={dataset} index={playback.index} />
            </aside>}
          </div>
          {dataset && <div className="info-strip">
            <Icon name="info" size={14} /><span>Distâncias ajustadas à tela; os valores físicos permanecem no cenário e nos CSVs.</span>
            <span className="info-shortcuts"><Icon name="keyboard" size={14} /> Espaço reproduz · ← → navegam · L repete</span>
            <span className="mono info-count">{dataset.frames.length} amostras · {dataset.names.length} corpos</span>
          </div>}
        </>}
      </ErrorBoundary>
    </main>

    {error && <div className="toast" role="alert">
      <Icon name="alert" size={18} /><span>{error}</span>
      <button type="button" className="icon-button" onClick={() => setError('')} aria-label="Fechar aviso"><Icon name="close" /></button>
    </div>}
  </div>;
}
