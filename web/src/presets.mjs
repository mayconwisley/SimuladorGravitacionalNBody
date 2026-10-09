// Educational initial conditions in SI units. These are illustrative systems,
// not ephemerides or predictions for named real objects.
const G = 6.67430e-11;
const centralMass = 1e23;
const earthMass = 5.972e24;

const body = (name, massKg, positionMeters, velocityMetersPerSecond) =>
  [name, massKg, positionMeters, velocityMetersPerSecond];
const center = (name = 'Estrela') => body(name, centralMass, [0, 0, 0], [0, 0, 0]);

function orbiter(name, massKg, radiusMeters, phaseDegrees = 0,
  speedFactor = 1, inclinationDegrees = 0, primaryMassKg = centralMass) {
  const phase = phaseDegrees * Math.PI / 180;
  const inclination = inclinationDegrees * Math.PI / 180;
  const speed = speedFactor * Math.sqrt(G * primaryMassKg / radiusMeters);
  return body(name, massKg,
    [radiusMeters * Math.cos(phase),
      radiusMeters * Math.sin(phase) * Math.cos(inclination),
      radiusMeters * Math.sin(phase) * Math.sin(inclination)],
    [-speed * Math.sin(phase),
      speed * Math.cos(phase) * Math.cos(inclination),
      speed * Math.cos(phase) * Math.sin(inclination)]);
}

function binary(massA, massB, separationMeters) {
  const total = massA + massB;
  const relativeSpeed = Math.sqrt(G * total / separationMeters);
  return [
    body('Estrela A', massA, [-separationMeters * massB / total, 0, 0],
      [0, -relativeSpeed * massB / total, 0]),
    body('Estrela B', massB, [separationMeters * massA / total, 0, 0],
      [0, relativeSpeed * massA / total, 0])
  ];
}

function preset(label, category, description, bodies, options = {}) {
  return {
    label, category, description, gravity: String(G),
    softeningMeters: String(options.softeningMeters ?? 0),
    timeStepSeconds: String(options.timeStepSeconds ?? 15),
    steps: String(options.steps ?? 2600),
    sampleEverySteps: String(options.sampleEverySteps ?? 13),
    bodies
  };
}

const equalBinary = binary(1e23, 1e23, 4e6);
const unequalBinary = binary(2e23, 5e22, 5e6);

export const presets = {
  satellite: preset('Terra e satélite', 'Órbitas',
    'Uma volta baixa ao redor da Terra, usando valores aproximados.', [
      body('Terra', earthMass, [0, 0, 0], [0, 0, 0]),
      body('Satélite', 1000, [7e6, 0, 0], [0, 7545.947, 0])
    ], { timeStepSeconds: 5, steps: 1200, sampleEverySteps: 20 }),
  lowEarth: preset('Órbita baixa', 'Órbitas',
    'Compare uma órbita mais próxima da Terra com o exemplo padrão.', [
      body('Terra', earthMass, [0, 0, 0], [0, 0, 0]),
      orbiter('Sonda baixa', 1000, 6.8e6, 0, 1, 0, earthMass)
    ], { timeStepSeconds: 5, steps: 1300, sampleEverySteps: 13 }),
  highEarth: preset('Órbita alta', 'Órbitas',
    'Uma órbita ampla, com período bem maior que o da órbita baixa.', [
      body('Terra', earthMass, [0, 0, 0], [0, 0, 0]),
      orbiter('Sonda alta', 1000, 2.6e7, 0, 1, 0, earthMass)
    ], { timeStepSeconds: 60, steps: 1500, sampleEverySteps: 15 }),
  polarEarth: preset('Órbita polar', 'Órbitas',
    'A sonda cruza o plano equatorial; gire a vista para ver a inclinação.', [
      body('Terra', earthMass, [0, 0, 0], [0, 0, 0]),
      orbiter('Sonda polar', 1000, 7e6, 0, 1, 90, earthMass)
    ], { timeStepSeconds: 5, steps: 1300, sampleEverySteps: 13 }),
  solar: preset('Sol e Terra', 'Órbitas',
    'Uma volta anual aproximada da Terra ao redor do Sol.', [
      body('Sol', 1.98847e30, [0, 0, 0], [0, 0, 0]),
      body('Terra', earthMass, [149597870700, 0, 0], [0, 29780, 0])
    ], { timeStepSeconds: 3600, steps: 8760, sampleEverySteps: 24 }),
  planetMoons: preset('Planeta e duas luas', 'Coleções',
    'Duas luas leves em raios diferentes ao redor de um planeta idealizado.', [
      center('Planeta'),
      orbiter('Lua interna', 1e17, 3e6),
      orbiter('Lua externa', 2e17, 5e6, 135)
    ]),
  concentric: preset('Quatro órbitas concêntricas', 'Coleções',
    'Satélites em quatro raios mostram períodos orbitais distintos.', [
      center(),
      orbiter('Órbita 1', 1e14, 2.8e6, 0),
      orbiter('Órbita 2', 1e14, 4e6, 90),
      orbiter('Órbita 3', 1e14, 5.4e6, 180),
      orbiter('Órbita 4', 1e14, 7e6, 270)
    ]),
  progradeRetrograde: preset('Prógrado e retrógrado', 'Órbitas',
    'Duas sondas giram em sentidos opostos ao redor da mesma estrela.', [
      center(),
      orbiter('Prógrada', 1e13, 4e6, 0),
      orbiter('Retrógrada', 1e13, 6e6, 180, -1)
    ]),
  inclined: preset('Planos inclinados', 'Órbitas',
    'Quatro inclinações tornam a profundidade da cena mais visível.', [
      center(),
      orbiter('Equatorial', 1e13, 3e6, 0),
      orbiter('Inclinação 25°', 1e13, 4e6, 90, 1, 25),
      orbiter('Inclinação 55°', 1e13, 5e6, 180, 1, 55),
      orbiter('Polar', 1e13, 6e6, 270, 1, 90)
    ]),
  mildEllipse: preset('Elipse suave', 'Experimentos',
    'Velocidade inicial abaixo da circular produz uma elipse moderada.', [
      center(), orbiter('Sonda', 1e12, 4e6, 0, 0.85)
    ], { timeStepSeconds: 10, steps: 3000, sampleEverySteps: 15 }),
  strongEllipse: preset('Elipse acentuada', 'Experimentos',
    'A sonda passa mais perto do centro e acelera no periastro.', [
      center(), orbiter('Sonda', 1e12, 4e6, 0, 0.65)
    ], { timeStepSeconds: 5, steps: 5000, sampleEverySteps: 25 }),
  comet: preset('Cometa didático', 'Experimentos',
    'Uma trajetória bastante alongada em torno de uma estrela idealizada.', [
      center(), orbiter('Cometa', 1e11, 8e6, 0, 0.57)
    ], { timeStepSeconds: 8, steps: 6000, sampleEverySteps: 30 }),
  nearEscape: preset('Quase escape', 'Experimentos',
    'Velocidade próxima da velocidade de escape: uma grande curva orbital.', [
      center(), orbiter('Sonda', 1e12, 4e6, 0, 1.38)
    ], { timeStepSeconds: 15, steps: 2200, sampleEverySteps: 11 }),
  escape: preset('Trajetória de escape', 'Experimentos',
    'A sonda parte acima da velocidade de escape e se afasta sem retornar.', [
      center(), orbiter('Sonda', 1e12, 4e6, 0, 1.55)
    ], { timeStepSeconds: 15, steps: 1800, sampleEverySteps: 9 }),
  resonance: preset('Ressonância 2:1', 'Órbitas',
    'O corpo interno completa aproximadamente duas voltas para cada volta externa.', [
      center(),
      orbiter('Interno', 1e12, 3e6),
      orbiter('Externo', 1e12, 3e6 * Math.pow(2, 2 / 3), 180)
    ], { timeStepSeconds: 10, steps: 3400, sampleEverySteps: 17 }),
  trojans: preset('Companheiros troianos', 'Coleções',
    'Dois corpos leves começam a 60° de um planeta, na mesma faixa orbital.', [
      center(), orbiter('Planeta', 1e19, 5e6),
      orbiter('Troiano L4', 1e10, 5e6, 60),
      orbiter('Troiano L5', 1e10, 5e6, -60)
    ]),
  ringEight: preset('Anel de oito', 'Coleções',
    'Oito satélites leves e igualmente espaçados em uma órbita.', [
      center(), ...Array.from({ length: 8 }, (_, index) =>
        orbiter(`Satélite ${index + 1}`, 1e11, 5e6, index * 45))
    ]),
  inclinedRing: preset('Anel inclinado', 'Coleções',
    'Doze satélites ocupam um plano inclinado; experimente girar a câmera.', [
      center(), ...Array.from({ length: 12 }, (_, index) =>
        orbiter(`Satélite ${index + 1}`, 1e10, 5e6, index * 30, 1, 45))
    ]),
  orbitalCloud: preset('Nuvem de 24 corpos', 'Coleções',
    'Três anéis com 24 satélites leves mostram um sistema N-body maior.', [
      center(), ...Array.from({ length: 24 }, (_, index) =>
        orbiter(`Corpo ${index + 1}`, 1e10, [3e6, 5e6, 7e6][Math.floor(index / 8)],
          (index % 8) * 45 + Math.floor(index / 8) * 14))
    ], { timeStepSeconds: 12, steps: 2200, sampleEverySteps: 22 }),
  miniSolarThree: preset('Sistema de três planetas', 'Coleções',
    'Planetas leves em três faixas ao redor de uma estrela idealizada.', [
      center(),
      orbiter('Planeta 1', 1e17, 3e6, 0),
      orbiter('Planeta 2', 2e17, 4.8e6, 120),
      orbiter('Planeta 3', 3e17, 7.2e6, 240)
    ]),
  miniSolarSix: preset('Sistema de seis planetas', 'Coleções',
    'Seis órbitas de raios crescentes compõem um sistema ilustrativo.', [
      center(), ...Array.from({ length: 6 }, (_, index) =>
        orbiter(`Planeta ${index + 1}`, (index + 1) * 1e16,
          2.7e6 + index * 1.1e6, index * 60))
    ]),
  equalBinary: preset('Estrelas binárias iguais', 'Múltiplos',
    'Duas massas iguais giram em torno do centro de massa comum.', equalBinary,
    { timeStepSeconds: 10, steps: 2800, sampleEverySteps: 14 }),
  unequalBinary: preset('Estrelas binárias desiguais', 'Múltiplos',
    'A estrela mais leve descreve uma órbita maior ao redor do baricentro.', unequalBinary,
    { timeStepSeconds: 10, steps: 3000, sampleEverySteps: 15 }),
  circumbinary: preset('Planeta circumbinário', 'Múltiplos',
    'Um planeta leve orbita o par de estrelas.', [
      ...equalBinary, orbiter('Planeta', 1e16, 1.8e7, 90, 1, 0, 2e23)
    ], { timeStepSeconds: 10, steps: 4000, sampleEverySteps: 20 }),
  twoCircumbinary: preset('Dois planetas circumbinários', 'Múltiplos',
    'Dois planetas observam a dança de uma estrela binária.', [
      ...equalBinary,
      orbiter('Planeta interno', 1e16, 1.8e7, 90, 1, 0, 2e23),
      orbiter('Planeta externo', 1e16, 2.6e7, 240, 1, 0, 2e23)
    ], { timeStepSeconds: 10, steps: 4500, sampleEverySteps: 25 }),
  hierarchicalTriple: preset('Sistema triplo hierárquico', 'Múltiplos',
    'Uma terceira estrela, mais leve e distante, orbita um par compacto.', [
      ...equalBinary, orbiter('Estrela C', 1e21, 2e7, 90, 1, 0, 2e23)
    ], { timeStepSeconds: 10, steps: 4000, sampleEverySteps: 20 })
};
