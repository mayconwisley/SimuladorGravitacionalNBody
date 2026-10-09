import { useEffect } from 'react';
import Icon from './Icons.jsx';
import { eventKinds } from './EventsPanel.jsx';
import { frameIndexAtStep } from './dataset.mjs';
import { clockUnit, formatClock, formatTime } from './format.mjs';

const speeds = [0.25, 0.5, 1, 2, 4, 8];
const maxMarkers = 240;

function isEditable(target) {
  return target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
}

export default function Timeline({ dataset, playback }) {
  const { index, playing, speed, setSpeed, loop, toggleLoop, seek, toggle, reset } = playback;
  const frame = dataset.frames[index];
  const lastFrame = dataset.frames.at(-1);
  // While streaming, the timeline already spans the whole run; only the loaded part is playable.
  const scenario = dataset.scenario;
  const endStep = scenario ? scenario.steps : lastFrame.step;
  const endTime = scenario ? scenario.steps * scenario.timeStepSeconds : lastFrame.time;
  const slots = Math.max(dataset.expectedSamples || dataset.frames.length, dataset.frames.length);
  const unit = clockUnit(endTime);
  const progress = slots > 1 ? index / (slots - 1) : 1;
  const loaded = slots > 1 ? (dataset.frames.length - 1) / (slots - 1) : 1;
  const markers = dataset.events.length <= maxMarkers ? dataset.events
    : dataset.events.filter((_, position) => position % Math.ceil(dataset.events.length / maxMarkers) === 0);

  useEffect(() => {
    const onKey = event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target)) return;
      if (event.code === 'Space') { event.preventDefault(); toggle(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); seek(index + (event.shiftKey ? 10 : 1)); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); seek(index - (event.shiftKey ? 10 : 1)); }
      else if (event.key === 'Home') { event.preventDefault(); reset(); }
      else if (event.key === 'End') { event.preventDefault(); seek(dataset.frames.length - 1); }
      else if (event.key === 'l' || event.key === 'L') { event.preventDefault(); toggleLoop(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dataset, index, seek, toggle, reset, toggleLoop]);

  return <div className="timeline">
    <div className="timeline-readout">
      <div><span className="label">Tempo simulado <span className="clock-unit">{unit}</span></span>
        <strong className="mono time-value">{formatClock(frame.time, endTime)}</strong></div>
      <div><span className="label">Passo</span><strong className="mono subtle">
        <span className="step-current" style={{ minWidth: `${String(endStep).length}ch` }}>{frame.step}</span> <span>/ {endStep}</span></strong></div>
      <div className="timeline-end"><span className="label">{dataset.complete ? 'Duração' : 'Calculando'}</span>
        <strong className="mono subtle">{dataset.complete ? formatClock(endTime, endTime)
          : `${Math.round(loaded * 100)}%`}</strong></div>
    </div>
    <div className="scrubber-wrap">
      <input className="scrubber" type="range" min="0" max={slots - 1} value={index}
        style={{ '--progress': `${(progress * 100).toFixed(2)}%`, '--loaded': `${(loaded * 100).toFixed(2)}%` }}
        aria-label="Linha do tempo" aria-valuetext={formatTime(frame.time)}
        onChange={event => seek(Number(event.target.value))} />
      {markers.length > 0 && <div className="event-marks" aria-hidden="true">
        {markers.map((item, position) => <span key={position} className="event-mark"
          style={{ left: `${(endStep ? item.step / endStep : 0) * 100}%`, '--mark': eventKinds[item.kind]?.color }}
          title={`${eventKinds[item.kind]?.label ?? item.kind}: ${item.body}`}
          onClick={() => seek(frameIndexAtStep(dataset, item.step))} />)}
      </div>}
    </div>
    <div className="timeline-controls">
      <div className="transport">
        <button className="icon-button" type="button" aria-label="Voltar ao início" title="Início (Home)" onClick={reset}><Icon name="restart" /></button>
        <button className="icon-button" type="button" aria-label="Amostra anterior" title="Anterior (←)" onClick={() => seek(index - 1)}><Icon name="stepBack" /></button>
        <button className={`play-button${playing ? ' playing' : ''}`} type="button" onClick={toggle}
          aria-label={playing ? 'Pausar' : 'Reproduzir'} title="Reproduzir / pausar (Espaço)">
          <Icon name={playing ? 'pause' : 'play'} size={18} /><span>{playing ? 'Pausar' : 'Reproduzir'}</span>
        </button>
        <button className="icon-button" type="button" aria-label="Próxima amostra" title="Próxima (→)" onClick={() => seek(index + 1)}><Icon name="stepForward" /></button>
        <button className={`icon-button loop-button${loop ? ' active' : ''}`} type="button" aria-pressed={loop}
          aria-label="Repetir automaticamente" title={`Repetição automática (L): ${loop ? 'ligada' : 'desligada'}`}
          onClick={toggleLoop}><Icon name="repeat" /></button>
      </div>
      <div className="speed-control" role="group" aria-label="Velocidade de reprodução">
        {speeds.map(value => <button type="button" key={value} className={speed === value ? 'active' : ''}
          aria-pressed={speed === value} onClick={() => setSpeed(value)}>{String(value).replace('.', ',')}×</button>)}
      </div>
    </div>
  </div>;
}
