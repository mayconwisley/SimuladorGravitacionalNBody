import { useState } from 'react';
import Icon from './Icons.jsx';
import { impulseVector, orbitalFrame } from './sandbox.mjs';

const components = [
  { key: 'prograde', label: 'Prógrado', hint: 'ao longo da velocidade' },
  { key: 'radial', label: 'Radial', hint: 'para fora da órbita' },
  { key: 'normal', label: 'Normal', hint: 'perpendicular ao plano' }
];

// Sandbox: an impulse at the current instant, in the orbital frame of the body.
export default function ImpulseForm({ body, reference, onApply, busy }) {
  const [values, setValues] = useState({ prograde: '0', radial: '0', normal: '0' });
  const frame = orbitalFrame(body, reference);
  const parsed = Object.fromEntries(Object.entries(values)
    .map(([key, value]) => [key, Number(String(value).replace(',', '.'))]));
  const valid = Object.values(parsed).every(Number.isFinite) && Object.values(parsed).some(value => value !== 0);

  return <form className="impulse-form" onSubmit={event => {
    event.preventDefault();
    if (frame && valid) onApply(impulseVector(frame, parsed));
  }}>
    <div className="impulse-title"><Icon name="rocket" size={15} /><strong>Sandbox: impulso neste instante</strong></div>
    {!frame ? <p className="panel-note">Sem direção orbital definida neste instante.</p> : <>
      <div className="impulse-grid">
        {components.map(item => <label className="field compact" key={item.key} title={item.hint}>
          <span className="field-label">{item.label}</span>
          <span className="field-control"><input type="text" inputMode="decimal" value={values[item.key]}
            onChange={event => setValues(previous => ({ ...previous, [item.key]: event.target.value }))}
            aria-label={`Impulso ${item.label.toLowerCase()} em m/s`} />
            <span className="field-unit">m/s</span></span>
        </label>)}
      </div>
      <button className="button primary small" type="submit" disabled={busy || !valid}>
        <Icon name="rocket" size={13} /> Aplicar e recalcular</button>
      <p className="panel-note">O impulso vira uma manobra no passo atual e o motor recalcula a trajetória. Para
        reposicionar o corpo, use a ferramenta de mover no canto do visualizador.</p>
    </>}
  </form>;
}
