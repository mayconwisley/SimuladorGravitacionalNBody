import Icon from './Icons.jsx';
import { trailColor } from './bodyAppearance.mjs';
import { SelectField, Segmented, TextField, VectorField, massiveOptions } from './fields.jsx';
import { formatNumber } from './format.mjs';

function massLabel(value) {
  const parsed = Number(String(value).trim().replace(',', '.'));
  if (!String(value).trim() || !Number.isFinite(parsed)) return '—';
  return parsed === 0 ? 'partícula de teste' : `${formatNumber(parsed)} kg`;
}

const orbitFields = [
  { key: 'semiMajorAxisMeters', label: 'Semi-eixo maior a', unit: 'm', hint: 'Negativo para hipérbole' },
  { key: 'eccentricity', label: 'Excentricidade e', hint: '0 circular · < 1 elipse · > 1 hipérbole' },
  { key: 'inclinationDegrees', label: 'Inclinação i', unit: '°' },
  { key: 'ascendingNodeDegrees', label: 'Nodo ascendente Ω', unit: '°' },
  { key: 'argumentOfPeriapsisDegrees', label: 'Argumento do periastro ω', unit: '°' },
  { key: 'trueAnomalyDegrees', label: 'Anomalia verdadeira ν', unit: '°', hint: '0 = no periastro' }
];

export default function BodyCard({ item, index, bodies, open, onToggle, onChange, onRemove, removable }) {
  const updateVector = (key, axis, value) => {
    const vector = [...item[key]];
    vector[axis] = value;
    onChange({ [key]: vector });
  };
  const updateOrbit = (key, value) => onChange({ orbit: { ...item.orbit, [key]: value } });
  const centrals = massiveOptions(bodies, index);
  return <article className={`body-card${open ? ' open' : ''}`} style={{ '--swatch': trailColor(item.name, Number(item.massKg) || 0, index) }}>
    <div className="body-card-header">
      <button type="button" className="body-card-toggle" aria-expanded={open} onClick={onToggle}>
        <span className="swatch" />
        <span className="body-card-title"><strong>{item.name || 'Sem nome'}</strong>
          <span className="mono">#{String(index + 1).padStart(2, '0')} · {massLabel(item.massKg)}
            {item.mode === 'orbit' && item.orbit.around ? ` · órbita de ${item.orbit.around}` : ''}</span></span>
        <Icon name="chevron" className="chevron" />
      </button>
      <button type="button" className="icon-button danger" disabled={!removable}
        aria-label={`Remover ${item.name || `corpo ${index + 1}`}`} title="Remover corpo" onClick={onRemove}><Icon name="trash" /></button>
    </div>
    {open && <div className="body-card-content">
      <div className="body-basics">
        <label className="field"><span className="field-label">Nome</span>
          <span className="field-control"><input required value={item.name}
            onChange={event => onChange({ name: event.target.value })} /></span></label>
        <TextField label="Massa" unit="kg" value={item.massKg} hint="0 = partícula de teste (sente, mas não exerce gravidade)"
          onChange={value => onChange({ massKg: value })} />
      </div>
      <Segmented label="Estado inicial" value={item.mode} onChange={mode => onChange({ mode })} options={[
        { value: 'vectors', label: 'Vetores XYZ', title: 'Posição e velocidade no referencial inercial' },
        { value: 'orbit', label: 'Elementos orbitais', title: 'Órbita em torno de um corpo listado antes' }]} />
      {item.mode === 'orbit' ? <>
        {centrals.length === 0 && <p className="field-hint">Para usar elementos orbitais, liste antes um corpo com massa.</p>}
        <div className="orbit-grid">
          <SelectField label="Em torno de" value={item.orbit.around} options={centrals}
            onChange={value => updateOrbit('around', value)} />
          {orbitFields.map(field => <TextField key={field.key} label={field.label} unit={field.unit} hint={field.hint}
            value={item.orbit[field.key]} onChange={value => updateOrbit(field.key, value)} />)}
        </div>
      </> : <>
        <VectorField label="Posição inicial" unit="m" values={item.positionMeters}
          onChange={(axis, next) => updateVector('positionMeters', axis, next)} />
        <VectorField label="Velocidade inicial" unit="m/s" values={item.velocityMetersPerSecond}
          onChange={(axis, next) => updateVector('velocityMetersPerSecond', axis, next)} />
      </>}
      <details className="advanced">
        <summary>Colisão e arrasto</summary>
        <div className="body-basics">
          <TextField label="Raio físico" unit="m" value={item.radiusMeters} hint="Usado nas colisões; 0 desliga"
            onChange={value => onChange({ radiusMeters: value })} />
          <TextField label="Coeficiente balístico Cd·A/m" unit="m²/kg" value={item.dragAreaPerMass}
            hint="Usado no arrasto atmosférico; 0 desliga" onChange={value => onChange({ dragAreaPerMass: value })} />
        </div>
      </details>
    </div>}
  </article>;
}
