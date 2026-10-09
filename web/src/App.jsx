import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import OrbitCanvas from './OrbitCanvas.jsx';
import PresetGallery from './PresetGallery.jsx';
import ScenarioEditor from './ScenarioEditor.jsx';
import Diagnostics from './Diagnostics.jsx';
import BodyList from './BodyList.jsx';
import EventsPanel from './EventsPanel.jsx';
import OrbitPanel from './OrbitPanel.jsx';
import Timeline from './Timeline.jsx';
import Icon from './Icons.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import useEngineStatus from './useEngineStatus.js';
import usePlayback from './usePlayback.js';
import SiteFooter from './SiteFooter.jsx';
import { fromScenario, integrators, limits, presetDraft, presets, toScenario } from './scenario.mjs';
import { appendSamples, createDataset, energyDriftSeries, fromApi, suggestedTimeStep } from './dataset.mjs';
import { runSimulation, streamSimulation } from './simulationClient.mjs';
import { withManeuver } from './sandbox.mjs';
import { datasetFromFiles } from './csvImport.mjs';
import { formatNumber, formatTime } from './format.mjs';
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

// Same scenario with |dt| equal to the suggested step, keeping the duration when the step
// limit allows it and the sample and particle budgets intact.
function withSuggestedStep(scenario, suggested) {
  const direction = Math.sign(scenario.timeStepSeconds);
  const duration = Math.abs(scenario.steps * scenario.timeStepSeconds);
  const steps = Math.min(limits.steps, Math.max(1, Math.ceil(duration / suggested)));
  const particles = (scenario.particleGroups ?? []).reduce((total, group) => total + group.count, 0);
  const maxSamples = Math.min(limits.samples, particles ? Math.floor(limits.particleSamples / particles) : limits.samples);
  const sampleEverySteps = Math.max(1, Math.ceil((steps - 1) / Math.max(1, maxSamples - 2)));
  const ratio = Math.abs(scenario.timeStepSeconds) / suggested;
  const maneuvers = (scenario.maneuvers ?? []).map(item => ({ ...item, step: Math.round(item.step * ratio) }))
    .filter(item => item.step < steps);
  const next = { ...scenario, timeStepSeconds: direction * suggested, steps, sampleEverySteps };
  if (maneuvers.length) next.maneuvers = maneuvers; else delete next.maneuvers;
  return { scenario: next, truncated: steps * suggested < duration * 0.999 };
}

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
  const [notice, setNotice] = useState('');
  const [emptyNotice, setEmptyNotice] = useState('');
  const [view, setView] = useState('inertial');
  const [comparison, setComparison] = useState(null);
  const [reversal, setReversal] = useState(null);
  const csvInput = useRef(null);
  const abort = useRef(null);
  const pendingSeek = useRef(null);
  const restoreAttempted = useRef(false);
  const engine = useEngineStatus();
  const playback = usePlayback(dataset?.frames.length ?? 0);
  const frames = dataset?.frames.length ?? 0;
  const frame = frames ? dataset.frames[Math.min(playback.index, frames - 1)] : null;

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [tab]);
  useEffect(() => { document.title = `${route?.title ?? 'OrbitalSim'} · OrbitalSim`; }, [route]);
  useEffect(() => { saveDraft(draft); }, [draft]);
  useEffect(() => () => abort.current?.abort(), []);

  // After a sandbox rerun, return to the instant where the change was made.
  useEffect(() => {
    if (pendingSeek.current !== null && frames > pendingSeek.current) {
      playback.seek(pendingSeek.current);
      pendingSeek.current = null;
    }
  }, [frames]);

  // F5 on /resultados: recompute the last scenario of this browser tab.
  useEffect(() => {
    if (restoreAttempted.current || tab !== 'results' || dataset) return;
    restoreAttempted.current = true;
    const last = loadLastRun();
    if (last?.scenario) execute(last.scenario, last.label, { view: last.view });
    else if (last) setEmptyNotice(importedNotice);
  }, [tab, dataset]);

  const go = key => navigate(pathForTab(key));

  async function execute(scenario, label, { presetKey = null, view: preferred = 'inertial', compare = false,
    keepFocus = false, seekTo = null, reversalOf = null } = {}) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    let current = createDataset({ scenario });
    setError(''); setNotice(''); setEmptyNotice(''); setBusy(true); setRunningKey(presetKey);
    setComparison(null); setReversal(reversalOf); setView(preferred);
    if (!keepFocus) setFocus(null);
    playback.reset();
    pendingSeek.current = seekTo;
    setDataset(current); setSource(label);
    if (location.pathname !== pathForTab('results')) go('results');
    try {
      await streamSimulation(scenario, {
        signal: controller.signal,
        onStart: message => {
          current = { ...current, particleGroups: message.particleGroups ?? [],
            particleCount: message.particleCount ?? 0, expectedSamples: message.expectedSamples ?? 0 };
          setDataset(current);
        },
        onSamples: samples => { current = appendSamples(current, samples); setDataset(current); }
      });
      current = { ...current, complete: true };
      setDataset(current);
      saveLastRun({ label, scenario, view: preferred });
      if (compare) compareIntegrators(scenario);
    } catch (cause) {
      if (cause?.name === 'AbortError') return;
      setError(`Falha ao executar: ${cause.message}`);
      if (!current.frames.length) setDataset(null);
      else setDataset({ ...current, complete: true });
    } finally {
      if (abort.current === controller) { setBusy(false); setRunningKey(null); }
    }
  }

  function cancel() {
    abort.current?.abort();
    setBusy(false); setRunningKey(null);
    setDataset(previous => previous && previous.frames.length ? { ...previous, complete: true } : null);
    setNotice('Simulação cancelada; as amostras já recebidas continuam disponíveis.');
  }

  function run(selectedDraft = draft, presetKey = null) {
    let scenario;
    try { scenario = toScenario(selectedDraft); }
    catch (cause) { setError(cause.message); return; }
    const preset = presetKey ? presets[presetKey] : null;
    execute(scenario, preset ? preset.label :
      scenario.bodies.length <= 3 ? scenario.bodies.map(body => body.name).join(' / ') : `${scenario.bodies.length} corpos`,
    { presetKey, view: preset?.view ?? 'inertial', compare: Boolean(preset?.compare) });
  }

  function openPreset(key, visualize) {
    const selected = presetDraft(key);
    setDraft(selected);
    setError('');
    if (visualize) run(selected, key);
    else go('editor');
  }

  async function compareIntegrators(scenario = dataset?.scenario) {
    if (!scenario) return;
    setComparison({ status: 'running' });
    try {
      const keys = Object.keys(integrators);
      const results = await Promise.all(keys.map(key => runSimulation({ ...scenario, integrator: key })));
      setComparison({ status: 'done', series: keys.map((key, position) => ({ key, label: integrators[key].label,
        values: energyDriftSeries(fromApi(results[position])) })) });
    } catch (cause) {
      setComparison({ status: 'error', error: `Não foi possível comparar: ${cause.message}` });
    }
  }

  // Sandbox: the change becomes a maneuver at the current step and the run is recomputed.
  function applyManeuver(maneuver) {
    try {
      const next = withManeuver(dataset.scenario, { ...maneuver, step: frame.step });
      setDraft(fromScenario(next));
      execute(next, source, { view, keepFocus: true, seekTo: playback.index });
    } catch (cause) { setError(cause.message); }
  }

  function applySuggestedStep() {
    try {
      const { scenario, truncated } = withSuggestedStep(dataset.scenario, suggestedTimeStep(dataset));
      setDraft(fromScenario(scenario));
      execute(scenario, source, { view, keepFocus: true });
      if (truncated) setNotice(`Com o Δt sugerido, o limite de ${limits.steps.toLocaleString('pt-BR')} passos encurta a duração simulada.`);
    } catch (cause) { setError(cause.message); }
  }

  // Integrates backwards from the current instant: Verlet and Yoshida are time-reversible, so
  // the run should end at the initial state up to round-off.
  function reverseTime() {
    const scenario = dataset.scenario;
    const bodies = dataset.names.map(name => {
      const body = frame.bodies.get(name);
      const original = scenario.bodies.find(item => item.name === name);
      const entry = { name, massKg: body.mass, positionMeters: [body.x, body.y, body.z],
        velocityMetersPerSecond: [body.vx, body.vy, body.vz] };
      if (body.radius > 0) entry.radiusMeters = body.radius;
      if (original?.dragAreaPerMassSquareMetersPerKg) entry.dragAreaPerMassSquareMetersPerKg = original.dragAreaPerMassSquareMetersPerKg;
      return entry;
    });
    const next = { ...scenario, bodies, timeStepSeconds: -scenario.timeStepSeconds, steps: frame.step };
    // A maneuver applied at forward step k (0 < k <= S) is undone, with negated deltas, when the
    // reverse run reaches the same instant: reverse step S - k. Those at step 0 are already part
    // of the initial frame.
    const undone = (scenario.maneuvers ?? []).filter(item => item.step > 0 && item.step <= frame.step)
      .map(item => ({ ...item, step: frame.step - item.step,
        deltaVelocityMetersPerSecond: item.deltaVelocityMetersPerSecond.map(value => -value),
        ...(item.deltaPositionMeters && { deltaPositionMeters: item.deltaPositionMeters.map(value => -value) }) }));
    if (undone.length) next.maneuvers = undone; else delete next.maneuvers;
    const origin = dataset.frames[0];
    const extent = Math.max(...[...origin.bodies.values()].map(item => Math.hypot(item.x - origin.center.x,
      item.y - origin.center.y, item.z - origin.center.z)), 1);
    execute(next, `${source.replace(/ · tempo reverso$/, '')} · tempo reverso`, { view,
      reversalOf: { origin: new Map([...origin.bodies].map(([name, item]) => [name, item])), extent } });
  }

  async function importCsv(event) {
    try {
      abort.current?.abort();
      const imported = await datasetFromFiles(event.target.files);
      saveLastRun({ label: 'Dados importados', scenario: null });
      setDataset(imported); setSource('Dados importados'); setFocus(null); setComparison(null);
      setReversal(null); setView('inertial'); setEmptyNotice(''); setError(''); setNotice('');
      playback.reset();
      if (location.pathname !== pathForTab('results')) go('results');
    } catch (cause) { setError(cause.message); }
    event.target.value = '';
  }

  if (!route) return <Navigate to="/" replace />;

  const heading = headings[tab];
  const scenario = dataset?.scenario ?? null;
  const ready = Boolean(dataset?.complete && scenario && !busy);
  const suggested = dataset?.complete && scenario ? suggestedTimeStep(dataset) : null;
  const stepTooLarge = suggested !== null && Math.abs(scenario.timeStepSeconds) > 2 * suggested;
  const sandbox = ready && frame && frame.step < scenario.steps;
  const canReverse = ready && frame && frame.step > 0 && !scenario.particleGroups && !scenario.physics?.collisions &&
    [...frame.bodies.values()].every(item => item.active);
  const reversalError = reversal && dataset?.complete && frames ? Math.max(...[...dataset.frames.at(-1).bodies.values()]
    .map(item => { const start = reversal.origin.get(item.name); return Math.hypot(item.x - start.x, item.y - start.y, item.z - start.z); })) : null;

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
            {item.key === 'results' && frames > 0 && <span className="nav-dot" aria-label="resultado disponível" />}
          </Link>)}
        </nav>
        <div className="top-actions">
          <span className={`engine-status ${engine}`} title="Estado da API local"><span className="status-dot" />{engineLabels[engine]}</span>
          <button className="button subtle" type="button" onClick={() => csvInput.current.click()}
            title="Importar trajectory.csv e, opcionalmente, diagnostics.csv, events.csv e particles.csv">
            <Icon name="upload" size={15} /><span className="hide-small">Importar CSV</span></button>
          <input ref={csvInput} type="file" accept=".csv" multiple hidden onChange={importCsv} />
        </div>
      </div>
    </header>

    <main className={`page page-${tab}`}>
      {heading && <div className="page-heading">
        <div><p className="eyebrow">{heading.eyebrow}</p><h1>{heading.title}</h1><p className="lead">{heading.copy}</p></div>
        {tab === 'results' && dataset && <div className="heading-actions">
          {busy && <button className="button subtle small" type="button" onClick={cancel}><Icon name="close" size={14} /> Cancelar</button>}
          {canReverse && <button className="button subtle small" type="button" onClick={reverseTime}
            title="Integra para trás a partir deste instante; o sistema deve voltar ao estado inicial">
            <Icon name="rewind" size={14} /> Voltar no tempo</button>}
          {source && <span className="scenario-pill"><Icon name="orbit" size={14} />{source}</span>}
        </div>}
      </div>}

      <ErrorBoundary resetKey={`${tab}:${source}`} onReset={() => go('catalog')}>
      {tab === 'catalog' ? <PresetGallery onView={key => openPreset(key, true)} onEdit={key => openPreset(key, false)}
        onCreate={() => go('editor')} busy={busy} runningKey={runningKey} /> :
      tab === 'editor' ? <ScenarioEditor draft={draft} setDraft={setDraft} onRun={() => run()}
        onBrowse={() => go('catalog')} busy={busy} onError={setError} /> :
        <>
          {stepTooLarge && <div className="callout warning" role="status">
            <Icon name="alert" size={18} />
            <span>O passo Δt = {formatTime(Math.abs(scenario.timeStepSeconds))} é grande para o encontro mais próximo
              entre corpos com massa. O motor sugere Δt ≈ {formatTime(suggested)}, cerca de 200 passos pela órbita
              mais curta.</span>
            <button className="button primary small" type="button" onClick={applySuggestedStep}>Usar Δt sugerido</button>
          </div>}
          {notice && <div className="callout" role="status"><Icon name="info" size={18} /><span>{notice}</span>
            <button type="button" className="icon-button" onClick={() => setNotice('')} aria-label="Fechar aviso"><Icon name="close" /></button></div>}
          {reversalError !== null && <div className="callout success" role="status"><Icon name="rewind" size={18} />
            <span>De volta ao início: a maior diferença de posição em relação ao estado inicial é {formatNumber(reversalError)} m
              ({formatNumber(reversalError / reversal.extent)} do tamanho do sistema). A integração é reversível no tempo.</span></div>}
          <div className={`results-layout${frames ? '' : ' empty'}`}>
            <div className="viewer">
              <OrbitCanvas dataset={frames ? dataset : null} index={playback.index} focus={focus} source={source}
                loading={busy} emptyNotice={emptyNotice} preferredFrame={view}
                canMove={Boolean(sandbox)} onMoveBody={(name, delta) => applyManeuver({ body: name,
                  deltaVelocityMetersPerSecond: [0, 0, 0], deltaPositionMeters: delta })}
                emptyActions={<div className="empty-actions">
                  <button className="button primary" type="button" onClick={() => go('catalog')}><Icon name="grid" size={14} /> Ver simulações</button>
                  <button className="button subtle" type="button" onClick={() => csvInput.current.click()}><Icon name="upload" size={14} /> Importar CSV</button>
                </div>} />
              {frames > 0 && <Timeline dataset={dataset} playback={playback} />}
            </div>
            {frames > 0 && <aside className="results-aside">
              <BodyList dataset={dataset} index={playback.index} focus={focus} setFocus={setFocus} />
              {focus && <OrbitPanel frame={frame} focus={focus} sandbox={sandbox} busy={busy}
                onImpulse={deltaVelocity => applyManeuver({ body: focus, deltaVelocityMetersPerSecond: deltaVelocity })} />}
              <Diagnostics dataset={dataset} index={playback.index} comparison={comparison}
                onCompare={ready ? () => compareIntegrators() : null} busy={busy} />
              <EventsPanel dataset={dataset} onSeek={playback.seek} />
            </aside>}
          </div>
          {frames > 0 && <div className="info-strip">
            <Icon name="info" size={14} /><span>Distâncias ajustadas à tela; os valores físicos permanecem no cenário e nos CSVs.</span>
            <span className="info-shortcuts"><Icon name="keyboard" size={14} /> Espaço reproduz · ← → navegam · L repete</span>
            <span className="mono info-count">{frames} amostras · {dataset.names.length} corpos
              {dataset.particleCount ? ` · ${dataset.particleCount} partículas` : ''}
              {scenario ? ` · ${integrators[scenario.integrator ?? 'verlet'].label}` : ''}</span>
          </div>}
        </>}
      </ErrorBoundary>
    </main>
    <SiteFooter />

    {error && <div className="toast" role="alert">
      <Icon name="alert" size={18} /><span>{error}</span>
      <button type="button" className="icon-button" onClick={() => setError('')} aria-label="Fechar aviso"><Icon name="close" /></button>
    </div>}
  </div>;
}
