import Icon from './Icons.jsx';
import { SelectField, TextField, VectorField } from './fields.jsx';
import { emptyManeuver, limits } from './scenario.mjs';
import { formatTime } from './format.mjs';

// Impulses applied at given steps (e.g. the two burns of a Hohmann transfer).
export default function ManeuversSection({ maneuvers, bodies, timeStep, onChange }) {
  const names = bodies.map(item => String(item.name).trim()).filter(Boolean).map(name => ({ value: name, label: name }));
  const update = (id, patch) => onChange(maneuvers.map(item => item.id === id ? { ...item, ...patch } : item));
  const updateVector = (item, key, axis, value) => {
    const vector = [...item[key]];
    vector[axis] = value;
    update(item.id, { [key]: vector });
  };
  const dt = Number(String(timeStep).replace(',', '.'));
  return <div className="maneuver-section">
    {maneuvers.map(item => {
      const step = Number(item.step);
      return <article className="group-card" key={item.id}>
        <div className="group-card-header">
          <Icon name="rocket" size={15} />
          <strong>{item.body || 'Manobra'}</strong>
          <span className="mono muted">{Number.isFinite(step) && Number.isFinite(dt) ? `t = ${formatTime(step * dt)}` : ''}</span>
          <button type="button" className="icon-button danger" aria-label="Remover manobra" title="Remover manobra"
            onClick={() => onChange(maneuvers.filter(other => other.id !== item.id))}><Icon name="trash" /></button>
        </div>
        <div className="body-basics">
          <SelectField label="Corpo" value={item.body} options={names} onChange={value => update(item.id, { body: value })} />
          <TextField label="No passo" value={item.step} inputMode="numeric" onChange={value => update(item.id, { step: value })} />
        </div>
        <VectorField label="Δv impulso" unit="m/s" values={item.deltaVelocityMetersPerSecond}
          onChange={(axis, value) => updateVector(item, 'deltaVelocityMetersPerSecond', axis, value)} />
        <details className="advanced">
          <summary>Deslocamento instantâneo</summary>
          <VectorField label="Δr deslocamento" unit="m" values={item.deltaPositionMeters}
            onChange={(axis, value) => updateVector(item, 'deltaPositionMeters', axis, value)} />
        </details>
      </article>;
    })}
    <button type="button" className="add-button" disabled={maneuvers.length >= limits.maneuvers || names.length === 0}
      onClick={() => onChange([...maneuvers, emptyManeuver(names.at(-1)?.value ?? '')])}>
      <Icon name="plus" /> Adicionar manobra</button>
  </div>;
}
