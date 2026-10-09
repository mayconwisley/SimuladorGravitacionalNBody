function parseCsv(text) {
  const records = [];
  let record = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { record.push(field); field = ''; }
    else if (char === '\n') {
      record.push(field.replace(/\r$/, ''));
      if (record.some(value => value !== '')) records.push(record);
      record = []; field = '';
    } else field += char;
  }
  if (quoted) throw new Error('CSV com aspas não fechadas.');
  if (field !== '' || record.length) {
    record.push(field.replace(/\r$/, ''));
    if (record.some(value => value !== '')) records.push(record);
  }
  if (!records.length) throw new Error('CSV vazio.');
  records[0][0] = records[0][0].replace(/^\uFEFF/, '');
  return { header: records[0], rows: records.slice(1) };
}

function column(header, name) {
  const index = header.indexOf(name);
  if (index < 0) throw new Error(`Coluna obrigatória ausente: ${name}.`);
  return index;
}

function numeric(row, index, label) {
  if (row[index] === undefined || row[index].trim() === '')
    throw new Error(`Valor ausente em ${label}.`);
  const value = Number(row[index]);
  if (!Number.isFinite(value)) throw new Error(`Valor numérico inválido em ${label}.`);
  return value;
}

function optionalColumn(header, name) {
  const index = header.indexOf(name);
  return index < 0 ? null : index;
}

// trajectory.csv from the CLI. radius_m and active are optional (older files lack them);
// masses may change when bodies merge, time may decrease in reverse-time runs, and mass 0
// marks a named test particle. The centre is the centre of mass of active massive bodies.
export function parseTrajectory(text) {
  const { header, rows } = parseCsv(text);
  const fields = Object.fromEntries(
    ['step', 'time_s', 'body', 'mass_kg', 'x_m', 'y_m', 'z_m', 'vx_m_s', 'vy_m_s', 'vz_m_s']
      .map(name => [name, column(header, name)]));
  const radiusField = optionalColumn(header, 'radius_m');
  const activeField = optionalColumn(header, 'active');
  const byStep = new Map();
  for (const row of rows) {
    const step = numeric(row, fields.step, 'step');
    const time = numeric(row, fields.time_s, 'time_s');
    const name = row[fields.body];
    const mass = numeric(row, fields.mass_kg, 'mass_kg');
    if (!Number.isSafeInteger(step) || step < 0)
      throw new Error('O passo deve ser um inteiro não negativo.');
    if (!name?.trim() || mass < 0) throw new Error('Cada corpo precisa de nome e massa não negativa.');
    if (!byStep.has(step)) byStep.set(step, { step, time, bodies: new Map() });
    const frame = byStep.get(step);
    if (frame.time !== time || frame.bodies.has(name))
      throw new Error(`Dados duplicados ou inconsistentes no passo ${step}.`);
    frame.bodies.set(name, {
      name, mass,
      x: numeric(row, fields.x_m, 'x_m'), y: numeric(row, fields.y_m, 'y_m'),
      z: numeric(row, fields.z_m, 'z_m'), vx: numeric(row, fields.vx_m_s, 'vx_m_s'),
      vy: numeric(row, fields.vy_m_s, 'vy_m_s'), vz: numeric(row, fields.vz_m_s, 'vz_m_s'),
      radius: radiusField === null ? 0 : numeric(row, radiusField, 'radius_m'),
      active: activeField === null ? true : numeric(row, activeField, 'active') !== 0,
      orbit: null
    });
  }
  const frames = [...byStep.values()].sort((a, b) => a.step - b.step);
  if (!frames.length) throw new Error('O CSV não contém amostras.');
  const names = [...frames[0].bodies.keys()];
  const direction = frames.length > 1 ? Math.sign(frames[1].time - frames[0].time) : 1;
  if (direction === 0) throw new Error('O tempo deve mudar entre amostras.');
  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index];
    if (index > 0 && Math.sign(frame.time - frames[index - 1].time) !== direction)
      throw new Error('O tempo deve avançar sempre no mesmo sentido entre amostras.');
    if (frame.bodies.size !== names.length || names.some(name => !frame.bodies.has(name)))
      throw new Error(`Corpos ausentes no passo ${frame.step}.`);
    let totalMass = 0, x = 0, y = 0, z = 0;
    for (const body of frame.bodies.values()) {
      if (!body.active || body.mass <= 0) continue;
      totalMass += body.mass;
      x += body.mass * body.x;
      y += body.mass * body.y;
      z += body.mass * body.z;
    }
    if (!(totalMass > 0)) throw new Error(`Nenhum corpo ativo com massa no passo ${frame.step}.`);
    frame.center = { x: x / totalMass, y: y / totalMass, z: z / totalMass };
    if (![frame.center.x, frame.center.y, frame.center.z].every(Number.isFinite))
      throw new Error('Centro de massa fora do intervalo numérico.');
  }
  return { frames, names };
}

// events.csv from the CLI (optional).
export function parseEvents(text) {
  if (!text) return [];
  const { header, rows } = parseCsv(text);
  const fields = Object.fromEntries(['step', 'time_s', 'kind', 'body', 'other', 'distance_m']
    .map(name => [name, column(header, name)]));
  return rows.map(row => ({
    step: numeric(row, fields.step, 'step'), time: numeric(row, fields.time_s, 'time_s'),
    kind: row[fields.kind], body: row[fields.body], other: row[fields.other] || null,
    distance: row[fields.distance_m] ? numeric(row, fields.distance_m, 'distance_m') : null
  }));
}

// particles.csv from the CLI (optional): positions per step as Float32Array per frame plus
// the group layout, matching what the API streams.
export function parseParticles(text, steps) {
  if (!text) return null;
  const { header, rows } = parseCsv(text);
  const fields = Object.fromEntries(['step', 'group', 'particle', 'x_m', 'y_m', 'z_m']
    .map(name => [name, column(header, name)]));
  const counts = new Map();
  for (const row of rows) {
    const group = row[fields.group];
    counts.set(group, Math.max(counts.get(group) ?? 0, numeric(row, fields.particle, 'particle')));
  }
  let start = 0;
  const particleGroups = [...counts].map(([name, count]) => {
    const group = { name, around: '', start, count };
    start += count;
    return group;
  });
  const offsets = new Map(particleGroups.map(group => [group.name, group.start]));
  const byStep = new Map(steps.map(step => [step, new Float32Array(3 * start).fill(NaN)]));
  for (const row of rows) {
    const positions = byStep.get(numeric(row, fields.step, 'step'));
    if (!positions) continue;
    const index = 3 * (offsets.get(row[fields.group]) + numeric(row, fields.particle, 'particle') - 1);
    positions[index] = numeric(row, fields.x_m, 'x_m');
    positions[index + 1] = numeric(row, fields.y_m, 'y_m');
    positions[index + 2] = numeric(row, fields.z_m, 'z_m');
  }
  return { particleGroups, particleCount: start, byStep };
}

export function parseDiagnostics(text) {
  if (!text) return new Map();
  const { header, rows } = parseCsv(text);
  const fields = Object.fromEntries(
    ['step', 'energy_j', 'px_kg_m_s', 'py_kg_m_s', 'pz_kg_m_s']
      .map(name => [name, column(header, name)]));
  const diagnostics = new Map();
  for (const row of rows) {
    const step = numeric(row, fields.step, 'step');
    if (!Number.isSafeInteger(step) || step < 0 || diagnostics.has(step))
      throw new Error(`Passo de diagnóstico inválido ou duplicado: ${step}.`);
    const optional = name => {
      const index = optionalColumn(header, name);
      return index === null ? undefined : numeric(row, index, name);
    };
    diagnostics.set(step, {
      energy: numeric(row, fields.energy_j, 'energy_j'),
      px: numeric(row, fields.px_kg_m_s, 'px_kg_m_s'),
      py: numeric(row, fields.py_kg_m_s, 'py_kg_m_s'),
      pz: numeric(row, fields.pz_kg_m_s, 'pz_kg_m_s'),
      lx: optional('lx_kg_m2_s'), ly: optional('ly_kg_m2_s'), lz: optional('lz_kg_m2_s'),
      kinetic: optional('kinetic_j'), potential: optional('potential_j')
    });
  }
  return diagnostics;
}
