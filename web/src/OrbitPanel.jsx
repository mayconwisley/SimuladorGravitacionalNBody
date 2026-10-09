import Icon from './Icons.jsx';
import ImpulseForm from './ImpulseForm.jsx';
import { formatNumber, formatTime } from './format.mjs';

const degrees = radians => `${formatNumber(radians * 180 / Math.PI, 2)}°`;

// Osculating orbit of the focused body (computed by the motor) and the sandbox impulse form.
export default function OrbitPanel({ frame, focus, sandbox, onImpulse, busy }) {
  const body = frame.bodies.get(focus);
  if (!body) return null;
  const orbit = body.orbit;
  const bound = orbit && orbit.eccentricity < 1 && orbit.specificEnergyJoulesPerKg < 0;
  return <section className="panel orbit-panel">
    <header className="panel-header">
      <div><p className="eyebrow">Corpo selecionado</p><h2>{focus}</h2></div>
      <span className="panel-icon"><Icon name="orbit" /></span>
    </header>
    {!body.active ? <p className="panel-note">Este corpo colidiu e foi incorporado a outro.</p>
      : !orbit ? <p className="panel-note">Referência do sistema: as órbitas dos outros corpos são medidas em relação a ele.</p>
        : <>
          <p className="orbit-reference">Órbita {bound ? 'ligada' : 'de escape'} em torno de <strong>{orbit.reference}</strong></p>
          <div className="stat-grid">
            <div className="stat"><span className="label">Semi-eixo a</span>
              <strong className="mono">{formatNumber(orbit.semiMajorAxisMeters)}<small>m</small></strong></div>
            <div className="stat"><span className="label">Excentricidade e</span>
              <strong className="mono">{orbit.eccentricity < 1e-9 ? '0' : formatNumber(orbit.eccentricity, 4)}</strong></div>
            <div className="stat"><span className="label">Inclinação i</span>
              <strong className="mono">{degrees(orbit.inclinationRadians)}</strong></div>
            <div className="stat"><span className="label">Nodo Ω · periastro ω</span>
              <strong className="mono">{degrees(orbit.ascendingNodeRadians)} · {degrees(orbit.argumentOfPeriapsisRadians)}</strong></div>
            <div className="stat"><span className="label">Periastro</span>
              <strong className="mono">{formatNumber(orbit.periapsisMeters)}<small>m</small></strong></div>
            <div className="stat"><span className="label">{bound ? 'Apoastro' : 'Energia específica'}</span>
              <strong className="mono">{bound ? formatNumber(orbit.apoapsisMeters)
                : formatNumber(orbit.specificEnergyJoulesPerKg)}<small>{bound ? 'm' : 'J/kg'}</small></strong></div>
            {bound && <div className="stat stat-wide"><span className="label">Período orbital</span>
              <strong className="mono accent">{formatTime(orbit.periodSeconds)}</strong></div>}
          </div>
        </>}
    {sandbox && body.active && <ImpulseForm body={body} reference={orbit ? frame.bodies.get(orbit.reference) : null}
      onApply={onImpulse} busy={busy} />}
  </section>;
}
