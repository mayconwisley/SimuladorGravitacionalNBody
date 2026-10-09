import { presets } from './presets.mjs';

export { presets };

// Interactive limits, mirrored from src/OrbitalSim.Api/InteractiveScenarioLimits.cs.
export const limits = {
  bodies: 32, particles: 2000, particleGroups: 8, maneuvers: 100, steps: 20000, samples: 1001,
  particleSamples: 400000, pairEvaluations: 6e8
};

export const integrators = {
  verlet: { label: 'Velocity Verlet', order: 2, evaluations: 1,
    description: '2ª ordem, simplético: a energia oscila sem derivar. Rápido e robusto.' },
  yoshida4: { label: 'Yoshida', order: 4, evaluations: 3,
    description: '4ª ordem, simplético: muito mais preciso por passo, 3× o custo.' },
  rk4: { label: 'Runge-Kutta 4', order: 4, evaluations: 4,
    description: '4ª ordem, não simplético: preciso a curto prazo, mas a energia deriva.' }
};

const axes = ['X', 'Y', 'Z'];
const newId = () => crypto.randomUUID();

const emptyOrbit = () => ({ around: '', semiMajorAxisMeters: '', eccentricity: '0', inclinationDegrees: '0',
  ascendingNodeDegrees: '0', argumentOfPeriapsisDegrees: '0', trueAnomalyDegrees: '0' });

export const emptyPhysics = () => ({ centralBody: '', j2: '0', centralRadiusMeters: '0',
  atmosphereDensityKgPerCubicMeter: '0', atmosphereScaleHeightMeters: '0', lightSpeedMetersPerSecond: '0',
  collisions: false });

function body(values) {
  const vectors = Array.isArray(values);
  const [name, massKg, positionMeters, velocityMetersPerSecond] = vectors ? values :
    [values.name, values.massKg, values.positionMeters ?? [0, 0, 0], values.velocityMetersPerSecond ?? [0, 0, 0]];
  const orbit = !vectors && values.orbit ? Object.fromEntries(Object.entries({ ...emptyOrbit(), ...values.orbit })
    .map(([key, value]) => [key, String(value)])) : emptyOrbit();
  return { id: newId(), name, massKg: String(massKg), mode: !vectors && values.orbit ? 'orbit' : 'vectors',
    positionMeters: positionMeters.map(String), velocityMetersPerSecond: velocityMetersPerSecond.map(String),
    orbit, radiusMeters: String(vectors ? 0 : values.radiusMeters ?? 0),
    dragAreaPerMass: String(vectors ? 0 : values.dragAreaPerMassSquareMetersPerKg ?? 0) };
}

export function emptyParticleGroup(around = '') {
  return { id: newId(), name: 'Anel', around, count: '300', innerRadiusMeters: '', outerRadiusMeters: '',
    eccentricity: '0', inclinationDegrees: '0', ascendingNodeDegrees: '0' };
}

export function emptyManeuver(bodyName = '') {
  return { id: newId(), body: bodyName, step: '0', deltaVelocityMetersPerSecond: ['0', '0', '0'],
    deltaPositionMeters: ['0', '0', '0'] };
}

function draftFrom(source) {
  return {
    gravity: String(source.gravity), softeningMeters: String(source.softeningMeters ?? 0),
    timeStepSeconds: String(source.timeStepSeconds), steps: String(source.steps),
    sampleEverySteps: String(source.sampleEverySteps), integrator: source.integrator ?? 'verlet',
    bodies: source.bodies.map(body),
    physics: { ...emptyPhysics(), ...Object.fromEntries(Object.entries(source.physics ?? {})
      .map(([key, value]) => [key, typeof value === 'boolean' ? value : String(value)])) },
    particleGroups: (source.particleGroups ?? []).map(group => ({ ...emptyParticleGroup(),
      ...Object.fromEntries(Object.entries(group).map(([key, value]) => [key, String(value)])) })),
    maneuvers: (source.maneuvers ?? []).map(item => ({ ...emptyManeuver(), body: item.body, step: String(item.step),
      deltaVelocityMetersPerSecond: (item.deltaVelocityMetersPerSecond ?? [0, 0, 0]).map(String),
      deltaPositionMeters: (item.deltaPositionMeters ?? [0, 0, 0]).map(String) }))
  };
}

export function presetDraft(key = 'satellite') {
  const preset = presets[key];
  if (!preset) throw new Error(`Cenário pronto desconhecido: ${key}.`);
  return draftFrom(preset);
}

export function emptyBody() {
  return body(['Novo corpo', '1000', [0, 0, 0], [0, 0, 0]]);
}

function finite(value, label, { positive = false, nonnegative = false, integer = false, nonzero = false } = {}) {
  if (value === null || value === undefined || String(value).trim() === '')
    throw new Error(`Preencha ${label}.`);
  const parsed = Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(parsed) || (positive && parsed <= 0) || (nonzero && parsed === 0) ||
      (nonnegative && parsed < 0) || (integer && !Number.isSafeInteger(parsed)))
    throw new Error(`Valor inválido em ${label}.`);
  return parsed;
}

const sampleCount = (steps, every) => 2 + Math.floor((steps - 1) / every);

function vector(values, label) {
  if (!Array.isArray(values) || values.length !== 3) throw new Error(`Informe os três eixos de ${label}.`);
  return values.map((value, index) => finite(value, `${label} ${axes[index]}`));
}

function orbitOf(item, name, known) {
  const orbit = item.orbit ?? {};
  const around = String(orbit.around ?? '').trim();
  const central = known.get(around.toLocaleLowerCase('pt-BR'));
  if (!central) throw new Error(`A órbita de ${name} deve referenciar um corpo listado antes dele.`);
  if (!(central.massKg > 0)) throw new Error(`O corpo central de ${name} precisa ter massa positiva.`);
  const result = {
    around: central.name,
    semiMajorAxisMeters: finite(orbit.semiMajorAxisMeters, `semi-eixo maior de ${name}`, { nonzero: true }),
    eccentricity: finite(orbit.eccentricity, `excentricidade de ${name}`, { nonnegative: true }),
    inclinationDegrees: finite(orbit.inclinationDegrees, `inclinação de ${name}`),
    ascendingNodeDegrees: finite(orbit.ascendingNodeDegrees, `nodo ascendente de ${name}`),
    argumentOfPeriapsisDegrees: finite(orbit.argumentOfPeriapsisDegrees, `argumento do periastro de ${name}`),
    trueAnomalyDegrees: finite(orbit.trueAnomalyDegrees, `anomalia verdadeira de ${name}`)
  };
  const { semiMajorAxisMeters: a, eccentricity: e } = result;
  if (e === 1 || (e < 1 && a <= 0) || (e > 1 && a >= 0))
    throw new Error(`Órbita de ${name}: elipses usam a > 0 e 0 ≤ e < 1; hipérboles usam a < 0 e e > 1.`);
  if (e > 1 && 1 + e * Math.cos(result.trueAnomalyDegrees * Math.PI / 180) <= 0)
    throw new Error(`Órbita de ${name}: a anomalia verdadeira está além da assíntota da hipérbole.`);
  return result;
}

// Builds the JSON sent to the API and validates it with the same limits; optional sections
// are omitted when unused so classic scenarios keep their original shape.
export function toScenario(draft) {
  if (!draft || !Array.isArray(draft.bodies) || draft.bodies.length < 1 || draft.bodies.length > limits.bodies)
    throw new Error(`Use entre 1 e ${limits.bodies} corpos.`);
  const scenario = {
    gravity: finite(draft.gravity, 'constante gravitacional', { positive: true }),
    softeningMeters: finite(draft.softeningMeters, 'suavização', { nonnegative: true }),
    timeStepSeconds: finite(draft.timeStepSeconds, 'passo de tempo', { nonzero: true }),
    steps: finite(draft.steps, 'número de passos', { positive: true, integer: true }),
    sampleEverySteps: finite(draft.sampleEverySteps, 'intervalo de amostragem', { positive: true, integer: true }),
    bodies: []
  };
  if (scenario.steps > limits.steps) throw new Error('O limite é 20.000 passos.');
  if (!Number.isFinite(scenario.steps * scenario.timeStepSeconds))
    throw new Error('O tempo final está fora do intervalo numérico.');
  const samples = sampleCount(scenario.steps, scenario.sampleEverySteps);
  if (samples > limits.samples) throw new Error('O limite é 1.001 amostras. Aumente o intervalo de amostragem.');
  const integrator = draft.integrator ?? 'verlet';
  if (!integrators[integrator]) throw new Error('Integrador desconhecido.');
  if (integrator !== 'verlet') scenario.integrator = integrator;

  const known = new Map();
  for (const item of draft.bodies) {
    const name = String(item?.name ?? '').trim();
    if (!name || known.has(name.toLocaleLowerCase('pt-BR'))) throw new Error('Cada corpo precisa de um nome único.');
    const entry = { name, massKg: finite(item.massKg, `massa de ${name}`, { nonnegative: true }) };
    if (item.mode === 'orbit') entry.orbit = orbitOf(item, name, known);
    else {
      entry.positionMeters = vector(item.positionMeters, `posição de ${name}`);
      entry.velocityMetersPerSecond = vector(item.velocityMetersPerSecond, `velocidade de ${name}`);
    }
    const radius = finite(item.radiusMeters ?? 0, `raio de ${name}`, { nonnegative: true });
    const drag = finite(item.dragAreaPerMass ?? 0, `coeficiente de arrasto de ${name}`, { nonnegative: true });
    if (radius > 0) entry.radiusMeters = radius;
    if (drag > 0) entry.dragAreaPerMassSquareMetersPerKg = drag;
    known.set(name.toLocaleLowerCase('pt-BR'), entry);
    scenario.bodies.push(entry);
  }
  if (!scenario.bodies.some(item => item.massKg > 0)) throw new Error('Ao menos um corpo precisa ter massa positiva.');

  const physics = physicsOf(draft.physics ?? emptyPhysics(), known);
  if (physics) scenario.physics = physics;

  const groups = (draft.particleGroups ?? []).map(group => particleGroupOf(group, known));
  if (groups.length > limits.particleGroups) throw new Error(`Use no máximo ${limits.particleGroups} grupos de partículas.`);
  const particles = groups.reduce((total, group) => total + group.count, 0);
  if (particles > limits.particles) throw new Error(`Use no máximo ${limits.particles.toLocaleString('pt-BR')} partículas.`);
  if (particles * samples > limits.particleSamples)
    throw new Error('Partículas demais para tantas amostras. Aumente o intervalo de amostragem.');
  if (groups.length) scenario.particleGroups = groups;

  const maneuvers = (draft.maneuvers ?? []).map(item => maneuverOf(item, known, scenario.steps));
  if (maneuvers.length > limits.maneuvers) throw new Error(`Use no máximo ${limits.maneuvers} manobras.`);
  if (maneuvers.length) scenario.maneuvers = maneuvers;

  if (estimatePairEvaluations(scenario) > limits.pairEvaluations)
    throw new Error('Cenário pesado demais para a execução interativa. Reduza passos, partículas ou corpos com massa.');
  return scenario;
}

function physicsOf(physics, known) {
  const centralName = String(physics.centralBody ?? '').trim();
  const values = {
    j2: finite(physics.j2 ?? 0, 'J2'),
    centralRadiusMeters: finite(physics.centralRadiusMeters ?? 0, 'raio do corpo central', { nonnegative: true }),
    atmosphereDensityKgPerCubicMeter: finite(physics.atmosphereDensityKgPerCubicMeter ?? 0,
      'densidade da atmosfera', { nonnegative: true }),
    atmosphereScaleHeightMeters: finite(physics.atmosphereScaleHeightMeters ?? 0, 'altura de escala', { nonnegative: true }),
    lightSpeedMetersPerSecond: finite(physics.lightSpeedMetersPerSecond ?? 0, 'velocidade da luz', { nonnegative: true })
  };
  const usesCentral = values.j2 !== 0 || values.atmosphereDensityKgPerCubicMeter > 0 || values.lightSpeedMetersPerSecond > 0;
  if (!usesCentral && !physics.collisions) return null;
  const result = {};
  if (usesCentral) {
    const central = known.get(centralName.toLocaleLowerCase('pt-BR'));
    if (!central || !(central.massKg > 0)) throw new Error('J2, arrasto e relatividade precisam de um corpo central com massa.');
    if (values.j2 !== 0 && values.centralRadiusMeters <= 0) throw new Error('O J2 precisa do raio equatorial do corpo central.');
    if (values.atmosphereDensityKgPerCubicMeter > 0 &&
        (values.centralRadiusMeters <= 0 || values.atmosphereScaleHeightMeters <= 0))
      throw new Error('O arrasto precisa do raio do corpo central e de uma altura de escala positiva.');
    result.centralBody = central.name;
    for (const [key, value] of Object.entries(values)) if (value !== 0) result[key] = value;
  }
  if (physics.collisions) result.collisions = true;
  return result;
}

function particleGroupOf(group, known) {
  const name = String(group?.name ?? '').trim();
  if (!name) throw new Error('Cada grupo de partículas precisa de um nome.');
  const central = known.get(String(group.around ?? '').trim().toLocaleLowerCase('pt-BR'));
  if (!central || !(central.massKg > 0)) throw new Error(`O grupo ${name} precisa orbitar um corpo com massa.`);
  const result = {
    name, around: central.name,
    count: finite(group.count, `quantidade do grupo ${name}`, { positive: true, integer: true }),
    innerRadiusMeters: finite(group.innerRadiusMeters, `raio interno do grupo ${name}`, { positive: true }),
    outerRadiusMeters: finite(group.outerRadiusMeters, `raio externo do grupo ${name}`, { positive: true }),
    eccentricity: finite(group.eccentricity ?? 0, `excentricidade do grupo ${name}`, { nonnegative: true }),
    inclinationDegrees: finite(group.inclinationDegrees ?? 0, `inclinação do grupo ${name}`),
    ascendingNodeDegrees: finite(group.ascendingNodeDegrees ?? 0, `nodo do grupo ${name}`)
  };
  if (result.outerRadiusMeters < result.innerRadiusMeters) throw new Error(`Use raio interno ≤ raio externo no grupo ${name}.`);
  if (result.eccentricity >= 1) throw new Error(`A excentricidade do grupo ${name} deve ser menor que 1.`);
  return result;
}

function maneuverOf(item, known, steps) {
  const target = known.get(String(item?.body ?? '').trim().toLocaleLowerCase('pt-BR'));
  if (!target) throw new Error('Cada manobra precisa de um corpo existente.');
  const step = finite(item.step, `passo da manobra de ${target.name}`, { nonnegative: true, integer: true });
  if (step >= steps) throw new Error(`A manobra de ${target.name} deve ocorrer antes do passo ${steps}.`);
  const result = { body: target.name, step,
    deltaVelocityMetersPerSecond: vector(item.deltaVelocityMetersPerSecond, `Δv da manobra de ${target.name}`) };
  const shift = vector(item.deltaPositionMeters ?? [0, 0, 0], `Δr da manobra de ${target.name}`);
  if (shift.some(value => value !== 0)) result.deltaPositionMeters = shift;
  return result;
}

// Pair interactions evaluated by the motor; mirrors the API budget.
export function estimatePairEvaluations(scenario) {
  const massive = scenario.bodies.filter(item => item.massKg > 0).length;
  const light = scenario.bodies.length - massive +
    (scenario.particleGroups ?? []).reduce((total, group) => total + group.count, 0);
  let evaluations = integrators[scenario.integrator ?? 'verlet'].evaluations;
  if (scenario.physics?.atmosphereDensityKgPerCubicMeter > 0 || scenario.physics?.lightSpeedMetersPerSecond > 0)
    evaluations *= 2;
  return scenario.steps * evaluations * (massive * massive / 2 + massive * light);
}

export function fromScenario(scenario) {
  const valid = toScenario(draftFrom({ ...scenario, bodies: scenario?.bodies ?? [] }));
  return draftFrom(valid);
}
