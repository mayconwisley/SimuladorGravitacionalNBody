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

export function parseTrajectory(text) {
  const { header, rows } = parseCsv(text);
  const fields = Object.fromEntries(
    ['step', 'time_s', 'body', 'mass_kg', 'x_m', 'y_m', 'z_m', 'vx_m_s', 'vy_m_s', 'vz_m_s']
      .map(name => [name, column(header, name)]));
  const byStep = new Map();
  for (const row of rows) {
    const step = numeric(row, fields.step, 'step');
    const time = numeric(row, fields.time_s, 'time_s');
    const name = row[fields.body];
    const mass = numeric(row, fields.mass_kg, 'mass_kg');
    if (!Number.isSafeInteger(step) || step < 0 || time < 0)
      throw new Error('Passo e tempo devem ser não negativos.');
    if (!name?.trim() || mass <= 0) throw new Error('Cada corpo precisa de nome e massa positiva.');
    if (!byStep.has(step)) byStep.set(step, { step, time, bodies: new Map() });
    const frame = byStep.get(step);
    if (frame.time !== time || frame.bodies.has(name))
      throw new Error(`Dados duplicados ou inconsistentes no passo ${step}.`);
    frame.bodies.set(name, {
      name, mass,
      x: numeric(row, fields.x_m, 'x_m'), y: numeric(row, fields.y_m, 'y_m'),
      z: numeric(row, fields.z_m, 'z_m'), vx: numeric(row, fields.vx_m_s, 'vx_m_s'),
      vy: numeric(row, fields.vy_m_s, 'vy_m_s'), vz: numeric(row, fields.vz_m_s, 'vz_m_s')
    });
  }
  const frames = [...byStep.values()].sort((a, b) => a.step - b.step);
  if (!frames.length) throw new Error('O CSV não contém amostras.');
  const names = [...frames[0].bodies.keys()];
  const firstMasses = new Map(names.map(name => [name, frames[0].bodies.get(name).mass]));
  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index];
    if (index > 0 && frame.time <= frames[index - 1].time)
      throw new Error('O tempo deve aumentar entre amostras.');
    if (frame.bodies.size !== names.length || names.some(name => !frame.bodies.has(name)))
      throw new Error(`Corpos ausentes no passo ${frame.step}.`);
    let totalMass = 0, x = 0, y = 0, z = 0;
    for (const body of frame.bodies.values()) {
      if (body.mass !== firstMasses.get(body.name))
        throw new Error(`A massa de ${body.name} mudou no passo ${frame.step}.`);
      totalMass += body.mass;
      x += body.mass * body.x;
      y += body.mass * body.y;
      z += body.mass * body.z;
    }
    frame.center = { x: x / totalMass, y: y / totalMass, z: z / totalMass };
    if (![frame.center.x, frame.center.y, frame.center.z].every(Number.isFinite))
      throw new Error('Centro de massa fora do intervalo numérico.');
  }
  return { frames, names };
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
    diagnostics.set(step, {
      energy: numeric(row, fields.energy_j, 'energy_j'),
      px: numeric(row, fields.px_kg_m_s, 'px_kg_m_s'),
      py: numeric(row, fields.py_kg_m_s, 'py_kg_m_s'),
      pz: numeric(row, fields.pz_kg_m_s, 'pz_kg_m_s')
    });
  }
  return diagnostics;
}
