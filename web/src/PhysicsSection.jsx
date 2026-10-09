import { SelectField, TextField, Toggle, massiveOptions } from './fields.jsx';

const quickFills = [
  { label: 'Achatamento da Terra', values: { j2: '1.08263e-3', centralRadiusMeters: '6.378137e6' } },
  { label: 'Atmosfera exponencial', values: { centralRadiusMeters: '6.378137e6',
    atmosphereDensityKgPerCubicMeter: '1.225', atmosphereScaleHeightMeters: '8500' } },
  { label: 'Relatividade (c real)', values: { lightSpeedMetersPerSecond: '299792458' } }
];

// Optional physics of the central body: J2, exponential-atmosphere drag, 1PN and collisions.
export default function PhysicsSection({ physics, bodies, onChange }) {
  const update = patch => onChange({ ...physics, ...patch });
  const options = massiveOptions(bodies);
  return <div className="physics-section">
    <div className="chips">
      {quickFills.map(item => <button type="button" className="chip" key={item.label}
        onClick={() => update({ ...item.values, centralBody: physics.centralBody || options[0]?.value || '' })}>
        {item.label}</button>)}
    </div>
    <div className="config-grid">
      <SelectField label="Corpo central" value={physics.centralBody} options={[{ value: '', label: 'Nenhum' }, ...options]}
        hint="Fonte do J2, do arrasto e da correção relativística" onChange={value => update({ centralBody: value })} />
      <TextField label="J2 (achatamento)" value={physics.j2} hint="Terra: 1,08263e-3; 0 desliga"
        onChange={value => update({ j2: value })} />
      <TextField label="Raio equatorial R" unit="m" value={physics.centralRadiusMeters}
        onChange={value => update({ centralRadiusMeters: value })} />
      <TextField label="Densidade na superfície ρ₀" unit="kg/m³" value={physics.atmosphereDensityKgPerCubicMeter}
        hint="ρ(h) = ρ₀·e^(−h/H); 0 desliga o arrasto" onChange={value => update({ atmosphereDensityKgPerCubicMeter: value })} />
      <TextField label="Altura de escala H" unit="m" value={physics.atmosphereScaleHeightMeters}
        onChange={value => update({ atmosphereScaleHeightMeters: value })} />
      <TextField label="Velocidade da luz c" unit="m/s" value={physics.lightSpeedMetersPerSecond}
        hint="> 0 liga a correção 1PN; valores menores exageram o efeito"
        onChange={value => update({ lightSpeedMetersPerSecond: value })} />
    </div>
    <Toggle label="Colisões com fusão" checked={Boolean(physics.collisions)} onChange={value => update({ collisions: value })}
      hint="Corpos cujos raios se tocam se fundem conservando massa e momento" />
  </div>;
}
