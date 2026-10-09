// Exoplanet systems from published periods, semi-major axes and masses (approximate; where only
// m·sin i is known the orbit is taken as seen edge-on). Orbits are drawn face-on (i = 0).
import { AU, binary, day, earthMass, jupiterMass, orbit, preset, sunMass, trueAnomaly } from './presetHelpers.mjs';

const star = (name, solarMasses, radiusMeters) => ({ name, massKg: solarMasses * sunMass,
  positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters });

// [name, a (AU), mass (kg), e, ω (deg), mean anomaly (deg)]; phases default to the golden angle.
const system = (host, list) => list.map(([name, a, mass, e = 0, argument = 0, mean = null], index) =>
  orbit(name, mass, host, a * AU, e, { argument,
    anomaly: mean === null ? (index * 137.508) % 360 : trueAnomaly(mean, e) }));

export const exoplanetPresets = {
  trappist1: preset('TRAPPIST-1', 'Exoplanetas',
    'Sete planetas rochosos em torno de uma anã vermelha, todos mais perto dela do que Mercúrio do Sol, numa cadeia de ressonâncias.', [
      star('TRAPPIST-1', 0.0898, 8.29e7),
      ...system('TRAPPIST-1', [
        ['TRAPPIST-1 b', 0.01154, 1.374 * earthMass], ['TRAPPIST-1 c', 0.01580, 1.308 * earthMass],
        ['TRAPPIST-1 d', 0.02227, 0.388 * earthMass], ['TRAPPIST-1 e', 0.02925, 0.692 * earthMass],
        ['TRAPPIST-1 f', 0.03849, 1.039 * earthMass], ['TRAPPIST-1 g', 0.04683, 1.321 * earthMass],
        ['TRAPPIST-1 h', 0.06189, 0.326 * earthMass]
      ])
    ], { timeStepSeconds: 600, steps: 5760, sampleEverySteps: 6, integrator: 'yoshida4' }),
  kepler11: preset('Kepler-11', 'Exoplanetas',
    'Seis planetas compactos: cinco cabem dentro da órbita de Mercúrio. Massas estimadas por variações nos trânsitos.', [
      star('Kepler-11', 0.961, 7.4e8),
      ...system('Kepler-11', [
        ['Kepler-11 b', 0.091, 1.9 * earthMass], ['Kepler-11 c', 0.107, 2.9 * earthMass],
        ['Kepler-11 d', 0.155, 7.3 * earthMass], ['Kepler-11 e', 0.195, 8.0 * earthMass],
        ['Kepler-11 f', 0.25, 2.0 * earthMass], ['Kepler-11 g', 0.466, 8 * earthMass]
      ])
    ], { timeStepSeconds: 4320, steps: 5000, sampleEverySteps: 5, integrator: 'yoshida4' }),
  kepler90: preset('Kepler-90', 'Exoplanetas',
    'Oito planetas, tantos quanto o Sistema Solar: rochosos por dentro e gigantes por fora, em 700 dias (massas estimadas).', [
      star('Kepler-90', 1.2, 8.3e8),
      ...system('Kepler-90', [
        ['Kepler-90 b', 0.074, 2 * earthMass], ['Kepler-90 c', 0.089, 1.8 * earthMass],
        ['Kepler-90 i', 0.107, 2 * earthMass], ['Kepler-90 d', 0.32, 8 * earthMass],
        ['Kepler-90 e', 0.42, 7 * earthMass], ['Kepler-90 f', 0.48, 8 * earthMass],
        ['Kepler-90 g', 0.71, 15 * earthMass], ['Kepler-90 h', 1.01, 0.639 * jupiterMass]
      ])
    ], { timeStepSeconds: 4320, steps: 14000, sampleEverySteps: 14, integrator: 'yoshida4' }),
  gliese876: preset('Gliese 876', 'Exoplanetas',
    'Três planetas em ressonância de Laplace 1:2:4 (30, 61 e 124 dias) em torno de uma anã vermelha; elementos de Rivera et al. (2010).', [
      star('Gliese 876', 0.37, 2.6e8),
      ...system('Gliese 876', [
        ['Gliese 876 c', 0.12959, 0.833 * jupiterMass, 0.25591, 48.76, 294.59],
        ['Gliese 876 b', 0.208317, 2.655 * jupiterMass, 0.0324, 50.3, 325.7],
        ['Gliese 876 e', 0.3343, 0.0534 * jupiterMass, 0.055, 239, 335]
      ])
    ], { timeStepSeconds: 10800, steps: 2000, sampleEverySteps: 2, integrator: 'yoshida4' }),
  hr8799: preset('HR 8799', 'Exoplanetas',
    'Quatro gigantes fotografados diretamente, de 16 a 72 UA, com períodos de 45 a 460 anos: 500 anos de evolução.', [
      star('HR 8799', 1.47, 9.9e8),
      ...system('HR 8799', [
        ['HR 8799 e', 16.4, 7.4 * jupiterMass], ['HR 8799 d', 26.7, 9.1 * jupiterMass],
        ['HR 8799 c', 41.4, 7.8 * jupiterMass], ['HR 8799 b', 71.6, 5.8 * jupiterMass]
      ].map(([name, a, mass], index) => [name, a, mass, 0, 0, index * 90]))
    ], { timeStepSeconds: 0.05 * 365.25 * day, steps: 10000, sampleEverySteps: 10, integrator: 'yoshida4' }),
  proxima: preset('Proxima Centauri', 'Exoplanetas',
    'A estrela mais próxima do Sol e seus dois planetas confirmados: Proxima b, na zona habitável (11,2 dias), e Proxima d (5,1 dias).', [
      star('Proxima Centauri', 0.1221, 1.07e8),
      ...system('Proxima Centauri', [
        ['Proxima d', 0.02885, 0.26 * earthMass], ['Proxima b', 0.04857, 1.07 * earthMass, 0.02]
      ])
    ], { timeStepSeconds: 600, steps: 8640, sampleEverySteps: 9, integrator: 'yoshida4' }),
  pegasi51: preset('51 Pegasi b', 'Exoplanetas',
    'O primeiro exoplaneta de uma estrela como o Sol (1995): um júpiter quente de 4,2 dias. A estrela gira a ~56 m/s em torno do baricentro, o sinal que o revelou.',
    binary(1.11 * sunMass, 0.47 * jupiterMass, 0.0527 * AU, ['51 Pegasi', '51 Pegasi b']),
    { timeStepSeconds: 300, steps: 2880, sampleEverySteps: 3, integrator: 'yoshida4' }),
  hd80606: preset('HD 80606 b', 'Exoplanetas',
    'Um dos planetas mais excêntricos conhecidos (e = 0,93): vai de 0,88 UA a 0,03 UA da estrela, onde passa a 240 km/s.', [
      star('HD 80606', 1.01, 6.8e8),
      orbit('HD 80606 b', 4.1 * jupiterMass, 'HD 80606', 0.449 * AU, 0.9332, { argument: 300.6, anomaly: 180 })
    ], { timeStepSeconds: 518, steps: 20000, sampleEverySteps: 20, integrator: 'yoshida4' })
};
