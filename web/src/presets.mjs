// Educational initial conditions in SI units. The classic gallery below uses illustrative
// systems; the Solar System and exoplanet scenarios use approximate published elements.
import { binary, body, center, centralMass, earthMass, earthRadius, orbit, orbiter, preset, sunMass }
  from './presetHelpers.mjs';
import { solarSystemPresets } from './presetsSolarSystem.mjs';
import { exoplanetPresets } from './presetsExoplanets.mjs';
import { laboratoryPresets } from './presetsLaboratory.mjs';
import { advancedPresets } from './presetsAdvanced.mjs';
import { missionPresets } from './presetsMissions.mjs';

const equalBinary = binary(1e23, 1e23, 4e6);
const unequalBinary = binary(2e23, 5e22, 5e6);

const classicPresets = {
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
  planetMoons: preset('Marte e suas duas luas', 'Coleções',
    'Fobos e Deimos em raios diferentes ao redor de Marte, em escala idealizada.', [
      center('Marte'),
      orbiter('Fobos', 1e17, 3e6),
      orbiter('Deimos', 2e17, 5e6, 135)
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
    'Dois corpos leves começam a 60° de Júpiter, na mesma faixa orbital (escala idealizada).', [
      center('Sol'), orbiter('Júpiter', 1e19, 5e6),
      orbiter('Troiano L4', 1e10, 5e6, 60),
      orbiter('Troiano L5', 1e10, 5e6, -60)
    ], { view: 'rotating' }),
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
    'Mercúrio, Vênus e Terra em três faixas ao redor do Sol, em escala idealizada.', [
      center('Sol'),
      orbiter('Mercúrio', 1e17, 3e6, 0),
      orbiter('Vênus', 2e17, 4.8e6, 120),
      orbiter('Terra', 3e17, 7.2e6, 240)
    ]),
  miniSolarSix: preset('Sistema de seis planetas', 'Coleções',
    'De Mercúrio a Saturno: seis órbitas de raios crescentes em escala idealizada.', [
      center('Sol'), ...['Mercúrio', 'Vênus', 'Terra', 'Marte', 'Júpiter', 'Saturno'].map((name, index) =>
        orbiter(name, (index + 1) * 1e16,
          2.7e6 + index * 1.1e6, index * 60))
    ]),
  equalBinary: preset('Estrelas binárias iguais', 'Múltiplos',
    'Duas massas iguais giram em torno do centro de massa comum.', equalBinary,
    { timeStepSeconds: 10, steps: 2800, sampleEverySteps: 14 }),
  unequalBinary: preset('Estrelas binárias desiguais', 'Múltiplos',
    'A estrela mais leve descreve uma órbita maior ao redor do baricentro.', unequalBinary,
    { timeStepSeconds: 10, steps: 3000, sampleEverySteps: 15 }),
  circumbinary: preset('Planeta circumbinário', 'Múltiplos',
    'Kepler-16 b, o primeiro planeta circumbinário confirmado, orbita o par de estrelas (escala idealizada).', [
      ...equalBinary, orbiter('Kepler-16 b', 1e16, 1.8e7, 90, 1, 0, 2e23)
    ], { timeStepSeconds: 10, steps: 4000, sampleEverySteps: 20 }),
  twoCircumbinary: preset('Dois planetas circumbinários', 'Múltiplos',
    'Kepler-47 b e Kepler-47 c observam a dança de uma estrela binária (escala idealizada).', [
      ...equalBinary,
      orbiter('Kepler-47 b', 1e16, 1.8e7, 90, 1, 0, 2e23),
      orbiter('Kepler-47 c', 1e16, 2.6e7, 240, 1, 0, 2e23)
    ], { timeStepSeconds: 10, steps: 4500, sampleEverySteps: 25 }),
  hierarchicalTriple: preset('Sistema triplo hierárquico', 'Múltiplos',
    'Uma terceira estrela, mais leve e distante, orbita um par compacto.', [
      ...equalBinary, orbiter('Estrela C', 1e21, 2e7, 90, 1, 0, 2e23)
    ], { timeStepSeconds: 10, steps: 4000, sampleEverySteps: 20 }),
  horseshoe: preset('Órbita em ferradura', 'Múltiplos',
    'No referencial girante, um corpo 1% fora da órbita da Terra desenha uma ferradura; outro, perto de L4, um girino (escala idealizada).', [
      center('Sol'), orbit('Terra', 1e20, 'Sol', 5e6),
      orbit('Ferradura', 0, 'Sol', 5.05e6, 0, { anomaly: 180 }),
      orbit('Girino L4', 0, 'Sol', 5.015e6, 0, { anomaly: 60 })
    ], { timeStepSeconds: 180, steps: 20000, sampleEverySteps: 20, integrator: 'yoshida4', view: 'rotating' }),
  j2Precession: preset('Precessão por achatamento (J2)', 'Física',
    'O achatamento da Terra gira o plano das órbitas: a 45° cerca de 5°/dia para oeste, a 98° cerca de 1°/dia para leste (órbita heliossíncrona).', [
      body('Terra', earthMass, [0, 0, 0], [0, 0, 0]),
      orbit('Inclinada 45°', 1000, 'Terra', 7e6, 0.001, { inclination: 45 }),
      orbit('Heliossíncrona 98°', 1000, 'Terra', 7e6, 0.001, { inclination: 98, anomaly: 120 }),
      orbit('Polar 90°', 1000, 'Terra', 7e6, 0.001, { inclination: 90, node: 90, anomaly: 240 })
    ], { timeStepSeconds: 30, steps: 14400, sampleEverySteps: 15, integrator: 'yoshida4',
      physics: { centralBody: 'Terra', j2: 1.08263e-3, centralRadiusMeters: earthRadius } }),
  dragDecay: preset('Decaimento por arrasto', 'Física',
    'Atmosfera exponencial didática (H = 60 km): a 200 km o satélite espirala e reentra em cerca de 13 horas; a 400 km desce só alguns quilômetros.', [
      { name: 'Terra', massKg: earthMass, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: earthRadius },
      orbit('Satélite a 200 km', 100, 'Terra', earthRadius + 2e5, 0, {}, { radiusMeters: 1, dragAreaPerMassSquareMetersPerKg: 0.1 }),
      orbit('Satélite a 400 km', 100, 'Terra', earthRadius + 4e5, 0, { anomaly: 180 }, { radiusMeters: 1, dragAreaPerMassSquareMetersPerKg: 0.1 })
    ], { timeStepSeconds: 20, steps: 8640, sampleEverySteps: 9, integrator: 'yoshida4',
      physics: { centralBody: 'Terra', centralRadiusMeters: earthRadius, atmosphereDensityKgPerCubicMeter: 7e-9,
        atmosphereScaleHeightMeters: 6e4, collisions: true } }),
  hohmann: preset('Transferência de Hohmann', 'Experimentos',
    'Duas manobras levam um satélite da órbita baixa (7.000 km) à geoestacionária: Δv₁ = 2.337 m/s e, meia elipse depois, Δv₂ = 1.434 m/s.', [
      body('Terra', earthMass, [0, 0, 0], [0, 0, 0]),
      orbit('Satélite', 1000, 'Terra', 7e6)
    ], { timeStepSeconds: 10, steps: 6810, sampleEverySteps: 7, integrator: 'yoshida4',
      maneuvers: [
        { body: 'Satélite', step: 583, deltaVelocityMetersPerSecond: [-3.53, 2336.77, 0] },
        { body: 'Satélite', step: 2501, deltaVelocityMetersPerSecond: [2.17, -1433.91, 0] }
      ] }),
  relativity: preset('Precessão relativística', 'Física',
    'Órbita de Mercúrio com a velocidade da luz reduzida a 1.000 km/s: a correção 1PN gira o periélio cerca de 2,4° por volta (2,6° pela fórmula de primeira ordem).', [
      body('Sol', sunMass, [0, 0, 0], [0, 0, 0]),
      orbit('Mercúrio', 3.3e23, 'Sol', 5.79e10, 0.2056)
    ], { timeStepSeconds: 7598, steps: 20000, sampleEverySteps: 20, integrator: 'yoshida4',
      physics: { centralBody: 'Sol', lightSpeedMetersPerSecond: 1e6 } }),
  planetesimals: preset('Acreção de planetesimais', 'Física',
    'Trinta planetesimais em órbitas que se cruzam colidem e se fundem, conservando massa e momento.', [
      { name: 'Estrela', massKg: centralMass, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: 3e5 },
      // Spread semi-major axes and golden-ratio angles: crossing orbits, no overlap at t = 0
      // (smallest initial separation 6e5 m, more than twice the sum of radii).
      ...Array.from({ length: 30 }, (_, index) => orbit(`Planetesimal ${index + 1}`, 1e19, 'Estrela',
        3.4e6 + 1.2e6 * index / 29, 0.05 + 0.17 * ((index * 0.618034) % 1),
        { argument: (index * 113) % 360, anomaly: (index * 160) % 360 }, { radiusMeters: 1.3e5 }))
    ], { timeStepSeconds: 40, steps: 20000, sampleEverySteps: 20, physics: { collisions: true } }),
  integratorComparison: preset('Comparar integradores', 'Física',
    'Cometa muito excêntrico com passo grosso: o Verlet e o Yoshida mantêm a energia oscilando; o RK4 a deixa derivar.', [
      center(), orbit('Cometa', 1e11, 'Estrela', 6e6, 0.75, { anomaly: 180 })
    ], { timeStepSeconds: 240, steps: 6000, sampleEverySteps: 6, compare: true }),
  ringShepherd: preset('Anel de Saturno e Mimas', 'Partículas',
    '1.500 partículas formam o anel de Saturno; Mimas, com massa ampliada (≈ 13.000×), excita as órbitas em ressonância 2:1 (na faixa de 1,17 × 10⁸ m, onde fica a divisão de Cassini).', [
      { name: 'Saturno', massKg: 5.683e26, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: 6.0268e7 },
      orbit('Mimas (ampliada)', 5e23, 'Saturno', 1.85e8, 0.02)
    ], { timeStepSeconds: 300, steps: 20000, sampleEverySteps: 80, integrator: 'yoshida4',
      particleGroups: [{ name: 'Anel', around: 'Saturno', count: 1500, innerRadiusMeters: 1e8, outerRadiusMeters: 1.45e8 }] }),
  asteroidBelt: preset('Cinturão e Júpiter', 'Partículas',
    'Um Júpiter com massa exagerada (10×) agita o cinturão de asteroides; as órbitas em ressonância ganham excentricidade.', [
      body('Sol', sunMass, [0, 0, 0], [0, 0, 0]),
      orbit('Júpiter (10×)', 1.898e28, 'Sol', 7.785e11, 0.048)
    ], { timeStepSeconds: 4e5, steps: 20000, sampleEverySteps: 80, integrator: 'yoshida4',
      particleGroups: [{ name: 'Cinturão', around: 'Sol', count: 1500, innerRadiusMeters: 3e11, outerRadiusMeters: 5.2e11 }] }),
  galaxies: preset('Colisão de galáxias', 'Partículas',
    'Dois núcleos com discos de 1.000 estrelas passam um pelo outro; as forças de maré arrancam caudas e pontes (como Toomre & Toomre, 1972).', [
      body('Galáxia A', 2e41, [0, 0, 0], [0, 0, 0]),
      orbit('Galáxia B', 2e41, 'Galáxia A', -4e22, 1.01, { anomaly: -117 })
    ], { softeningMeters: 1e19, timeStepSeconds: 7e11, steps: 20000, sampleEverySteps: 125, integrator: 'yoshida4',
      particleGroups: [
        { name: 'Disco A', around: 'Galáxia A', count: 1000, innerRadiusMeters: 8e19, outerRadiusMeters: 2.5e20 },
        { name: 'Disco B', around: 'Galáxia B', count: 1000, innerRadiusMeters: 8e19, outerRadiusMeters: 2.5e20, inclinationDegrees: 40 }
      ] })
};

// Gallery order: the classic scenarios first, then real systems and the laboratory set.
export const presets = { ...classicPresets, ...solarSystemPresets, ...exoplanetPresets, ...laboratoryPresets,
  ...missionPresets, ...advancedPresets };
