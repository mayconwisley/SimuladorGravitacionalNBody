const gravity = '6.67430e-11';

function body(name, massKg, positionMeters, velocityMetersPerSecond) {
  return { id: crypto.randomUUID(), name, massKg: String(massKg),
    positionMeters: positionMeters.map(String),
    velocityMetersPerSecond: velocityMetersPerSecond.map(String) };
}

export const presets = {
  satellite: {
    label: 'Terra e satélite', gravity, softeningMeters: '0',
    timeStepSeconds: '5', steps: '1200', sampleEverySteps: '20',
    bodies: [
      ['Terra', '5.972e24', [0, 0, 0], [0, 0, 0]],
      ['Satélite', '1000', [7000000, 0, 0], [0, 7545.947, 0]]
    ]
  },
  solar: {
    label: 'Sol e Terra', gravity, softeningMeters: '0',
    timeStepSeconds: '3600', steps: '8760', sampleEverySteps: '24',
    bodies: [
      ['Sol', '1.98847e30', [0, 0, 0], [0, 0, 0]],
      ['Terra', '5.972e24', [149597870700, 0, 0], [0, 29780, 0]]
    ]
  }
};

export function presetDraft(key = 'satellite') {
  const preset = presets[key];
  return { ...preset, bodies: preset.bodies.map(values => body(...values)) };
}

export function emptyBody() {
  return body('Novo corpo', '1000', [0, 0, 0], [0, 0, 0]);
}

function finite(value, label, { positive = false, nonnegative = false, integer = false } = {}) {
  if (value === null || value === undefined || String(value).trim() === '')
    throw new Error(`Preencha ${label}.`);
  const parsed = Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(parsed) || (positive && parsed <= 0) ||
      (nonnegative && parsed < 0) || (integer && !Number.isSafeInteger(parsed)))
    throw new Error(`Valor inválido em ${label}.`);
  return parsed;
}

export function toScenario(draft) {
  if (!draft || !Array.isArray(draft.bodies) ||
      draft.bodies.length < 1 || draft.bodies.length > 32)
    throw new Error('Use entre 1 e 32 corpos.');
  const scenario = {
    gravity: finite(draft.gravity, 'constante gravitacional', { positive: true }),
    softeningMeters: finite(draft.softeningMeters, 'suavização', { nonnegative: true }),
    timeStepSeconds: finite(draft.timeStepSeconds, 'passo de tempo', { positive: true }),
    steps: finite(draft.steps, 'número de passos', { positive: true, integer: true }),
    sampleEverySteps: finite(draft.sampleEverySteps, 'intervalo de amostragem',
      { positive: true, integer: true }),
    bodies: []
  };
  if (scenario.steps > 20000) throw new Error('O limite é 20.000 passos.');
  if (!Number.isFinite(scenario.steps * scenario.timeStepSeconds))
    throw new Error('O tempo final está fora do intervalo numérico.');
  if (2 + Math.floor((scenario.steps - 1) / scenario.sampleEverySteps) > 1001)
    throw new Error('O limite é 1.001 amostras. Aumente o intervalo de amostragem.');
  const names = new Set();
  for (const item of draft.bodies) {
    const name = String(item?.name ?? '').trim();
    if (!name || names.has(name.toLocaleLowerCase('pt-BR')))
      throw new Error('Cada corpo precisa de um nome único.');
    names.add(name.toLocaleLowerCase('pt-BR'));
    if (!Array.isArray(item.positionMeters) || item.positionMeters.length !== 3 ||
        !Array.isArray(item.velocityMetersPerSecond) || item.velocityMetersPerSecond.length !== 3)
      throw new Error(`Informe os três eixos de ${name}.`);
    scenario.bodies.push({
      name,
      massKg: finite(item.massKg, `massa de ${name}`, { positive: true }),
      positionMeters: item.positionMeters.map((value, index) => finite(value,
        `posição ${'XYZ'[index]} de ${name}`)),
      velocityMetersPerSecond: item.velocityMetersPerSecond.map((value, index) => finite(value,
        `velocidade ${'XYZ'[index]} de ${name}`))
    });
  }
  return scenario;
}

export function fromScenario(scenario) {
  const valid = toScenario(scenario);
  return { ...Object.fromEntries(
    ['gravity', 'softeningMeters', 'timeStepSeconds', 'steps', 'sampleEverySteps']
      .map(key => [key, String(valid[key])])),
  bodies: valid.bodies.map(item => body(item.name, item.massKg,
    item.positionMeters, item.velocityMetersPerSecond)) };
}

export function fromApi(response) {
  if (!Array.isArray(response?.samples) || !response.samples.length)
    throw new Error('A API não retornou amostras.');
  const frames = response.samples.map(sample => ({
    step: sample.step, time: sample.timeSeconds,
    bodies: new Map(sample.bodies.map(item => [item.name, {
      name: item.name, mass: item.massKg,
      x: item.positionMeters.x, y: item.positionMeters.y, z: item.positionMeters.z,
      vx: item.velocityMetersPerSecond.x, vy: item.velocityMetersPerSecond.y,
      vz: item.velocityMetersPerSecond.z
    }]))
  }));
  const diagnostics = new Map(response.samples.map(sample => [sample.step, {
    energy: sample.diagnostics.energyJoules,
    px: sample.diagnostics.momentumKgMetersPerSecond.x,
    py: sample.diagnostics.momentumKgMetersPerSecond.y,
    pz: sample.diagnostics.momentumKgMetersPerSecond.z
  }]));
  for (const frame of frames) {
    let mass = 0, x = 0, y = 0, z = 0;
    for (const item of frame.bodies.values()) {
      mass += item.mass; x += item.mass * item.x;
      y += item.mass * item.y; z += item.mass * item.z;
    }
    frame.center = { x: x / mass, y: y / mass, z: z / mass };
  }
  return { frames, diagnostics, names: [...frames[0].bodies.keys()] };
}
