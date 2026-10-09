import { useEffect } from 'react';
import Icon from './Icons.jsx';
import { clockUnit, formatClock, formatTime } from './format.mjs';

const speeds = [0.25, 0.5, 1, 2, 4, 8];

function isEditable(target) {
  return target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
}

export default function Timeline({ dataset, playback }) {
  const { index, playing, speed, setSpeed, seek, toggle, reset } = playback;
  const frame = dataset.frames[index];
  const lastFrame = dataset.frames.at(-1);
  const unit = clockUnit(lastFrame.time);
  const progress = dataset.frames.length > 1 ? index / (dataset.frames.length - 1) : 1;

  useEffect(() => {
    const onKey = event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target)) return;
      if (event.code === 'Space') { event.preventDefault(); toggle(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); seek(index + (event.shiftKey ? 10 : 1)); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); seek(index - (event.shiftKey ? 10 : 1)); }
      else if (event.key === 'Home') { event.preventDefault(); reset(); }
      else if (event.key === 'End') { event.preventDefault(); seek(dataset.frames.length - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dataset, index, seek, toggle, reset]);

  return <div className="timeline">
    <div className="timeline-readout">
      <div><span className="label">Tempo simulado <span className="clock-unit">{unit}</span></span>
        <strong className="mono time-value">{formatClock(frame.time, lastFrame.time)}</strong></div>
      <div><span className="label">Passo</span><strong className="mono subtle">
        <span className="step-current" style={{ minWidth: `${String(lastFrame.step).length}ch` }}>{frame.step}</span> <span>/ {lastFrame.step}</span></strong></div>
      <div className="timeline-end"><span className="label">Duração</span><strong className="mono subtle">{formatClock(lastFrame.time, lastFrame.time)}</strong></div>
    </div>
    <input className="scrubber" type="range" min="0" max={dataset.frames.length - 1} value={index}
      style={{ '--progress': `${(progress * 100).toFixed(2)}%` }}
      aria-label="Linha do tempo" aria-valuetext={formatTime(frame.time)}
      onChange={event => seek(Number(event.target.value))} />
    <div className="timeline-controls">
      <div className="transport">
        <button className="icon-button" type="button" aria-label="Voltar ao início" title="Início (Home)" onClick={reset}><Icon name="restart" /></button>
        <button className="icon-button" type="button" aria-label="Amostra anterior" title="Anterior (←)" onClick={() => seek(index - 1)}><Icon name="stepBack" /></button>
        <button className={`play-button${playing ? ' playing' : ''}`} type="button" onClick={toggle}
          aria-label={playing ? 'Pausar' : 'Reproduzir'} title="Reproduzir / pausar (Espaço)">
          <Icon name={playing ? 'pause' : 'play'} size={18} /><span>{playing ? 'Pausar' : 'Reproduzir'}</span>
        </button>
        <button className="icon-button" type="button" aria-label="Próxima amostra" title="Próxima (→)" onClick={() => seek(index + 1)}><Icon name="stepForward" /></button>
      </div>
      <div className="speed-control" role="group" aria-label="Velocidade de reprodução">
        {speeds.map(value => <button type="button" key={value} className={speed === value ? 'active' : ''}
          aria-pressed={speed === value} onClick={() => setSpeed(value)}>{String(value).replace('.', ',')}×</button>)}
      </div>
    </div>
  </div>;
}
