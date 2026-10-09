// Shared form controls for the scenario editor. Values stay as strings until toScenario.
const axes = ['X', 'Y', 'Z'];

export function TextField({ label, value, onChange, unit, hint, compact = false, inputMode = 'decimal' }) {
  return <label className={`field${compact ? ' compact' : ''}`}>
    <span className="field-label">{label}</span>
    <span className="field-control">
      <input type="text" inputMode={inputMode} required value={value} spellCheck="false"
        onChange={event => onChange(event.target.value)} aria-label={`${label}${unit ? ` em ${unit}` : ''}`} />
      {unit && <span className="field-unit">{unit}</span>}
    </span>
    {hint && <span className="field-hint">{hint}</span>}
  </label>;
}

export function VectorField({ label, unit, values, onChange }) {
  return <fieldset className="vector-field">
    <legend>{label} <span>{unit}</span></legend>
    <div className="vector-grid">{values.map((value, axis) =>
      <TextField key={axis} compact label={`${label.split(' ')[0]} ${axes[axis]}`} value={value}
        onChange={next => onChange(axis, next)} />)}</div>
  </fieldset>;
}

export function SelectField({ label, value, onChange, options, hint, placeholder = 'Selecione…' }) {
  return <label className="field">
    <span className="field-label">{label}</span>
    <span className="field-control select-control">
      <select value={value} onChange={event => onChange(event.target.value)} aria-label={label}>
        {!options.some(option => option.value === value) && <option value={value}>{value || placeholder}</option>}
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </span>
    {hint && <span className="field-hint">{hint}</span>}
  </label>;
}

export function Segmented({ label, value, options, onChange }) {
  return <div className="segmented form-segmented" role="group" aria-label={label}>
    {options.map(option => <button type="button" key={option.value} className={value === option.value ? 'active' : ''}
      aria-pressed={value === option.value} title={option.title} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}

export function Toggle({ label, checked, onChange, hint }) {
  return <label className="toggle">
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
    <span className="toggle-track" aria-hidden="true"><span /></span>
    <span><span className="field-label">{label}</span>{hint && <span className="field-hint">{hint}</span>}</span>
  </label>;
}

export function massiveOptions(bodies, before = bodies.length) {
  return bodies.slice(0, before)
    .filter(item => Number(String(item.massKg).replace(',', '.')) > 0 && String(item.name).trim())
    .map(item => ({ value: item.name.trim(), label: item.name.trim() }));
}
