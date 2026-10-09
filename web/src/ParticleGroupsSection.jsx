import Icon from './Icons.jsx';
import { particleColor } from './OrbitCanvas.jsx';
import { SelectField, TextField, massiveOptions } from './fields.jsx';
import { emptyParticleGroup, limits } from './scenario.mjs';

// Disks of massless test particles: rings, belts and galactic disks around a body.
export default function ParticleGroupsSection({ groups, bodies, onChange }) {
  const options = massiveOptions(bodies);
  const update = (id, patch) => onChange(groups.map(group => group.id === id ? { ...group, ...patch } : group));
  const total = groups.reduce((sum, group) => sum + (Number(group.count) || 0), 0);
  return <div className="particle-section">
    {groups.map((group, index) => <article className="group-card" key={group.id} style={{ '--swatch': particleColor(index) }}>
      <div className="group-card-header">
        <span className="swatch" />
        <strong>{group.name || 'Grupo'}</strong>
        <button type="button" className="icon-button danger" aria-label={`Remover ${group.name}`} title="Remover grupo"
          onClick={() => onChange(groups.filter(item => item.id !== group.id))}><Icon name="trash" /></button>
      </div>
      <div className="config-grid">
        <TextField label="Nome" value={group.name} inputMode="text" onChange={value => update(group.id, { name: value })} />
        <SelectField label="Em torno de" value={group.around} options={options} onChange={value => update(group.id, { around: value })} />
        <TextField label="Partículas" value={group.count} inputMode="numeric" onChange={value => update(group.id, { count: value })} />
        <TextField label="Raio interno" unit="m" value={group.innerRadiusMeters} onChange={value => update(group.id, { innerRadiusMeters: value })} />
        <TextField label="Raio externo" unit="m" value={group.outerRadiusMeters} onChange={value => update(group.id, { outerRadiusMeters: value })} />
        <TextField label="Excentricidade" value={group.eccentricity} onChange={value => update(group.id, { eccentricity: value })} />
        <TextField label="Inclinação" unit="°" value={group.inclinationDegrees} onChange={value => update(group.id, { inclinationDegrees: value })} />
        <TextField label="Nodo ascendente" unit="°" value={group.ascendingNodeDegrees} onChange={value => update(group.id, { ascendingNodeDegrees: value })} />
      </div>
    </article>)}
    <button type="button" className="add-button" disabled={groups.length >= limits.particleGroups || options.length === 0}
      onClick={() => onChange([...groups, emptyParticleGroup(options[0]?.value ?? '')])}>
      <Icon name="plus" /> Adicionar grupo de partículas</button>
    <p className="field-hint">{total.toLocaleString('pt-BR')} de {limits.particles.toLocaleString('pt-BR')} partículas.
      Partículas não têm massa: custam pouco e mostram anéis, cinturões e discos.</p>
  </div>;
}
