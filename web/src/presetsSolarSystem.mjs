// Solar System scenarios from approximate J2000 mean elements (JPL, "Keplerian elements for
// approximate positions of the major planets") and published masses. Angles in degrees.
import { AU, binary, day, earthMass, jupiterMass, orbit, orbiter, planet, preset, sunMass, trueAnomaly }
  from './presetHelpers.mjs';

const sun = (radiusMeters = 0) => ({ name: 'Sol', massKg: sunMass, positionMeters: [0, 0, 0],
  velocityMetersPerSecond: [0, 0, 0], ...(radiusMeters && { radiusMeters }) });

// a (AU), e, i, Ω, ϖ, L (degrees) and mass (kg).
const elements = {
  Mercúrio: [0.38709927, 0.20563593, 7.00497902, 48.33076593, 77.45779628, 252.25032350, 3.3011e23],
  Vênus: [0.72333566, 0.00677672, 3.39467605, 76.67984255, 131.60246718, 181.97909950, 4.8675e24],
  Terra: [1.00000261, 0.01671123, 0, 0, 102.93768193, 100.46457166, earthMass],
  Marte: [1.52371034, 0.09339410, 1.84969142, 49.55953891, -23.94362959, -4.55343205, 6.4171e23],
  Júpiter: [5.20288700, 0.04838624, 1.30439695, 100.47390909, 14.72847983, 34.39644051, jupiterMass],
  Saturno: [9.53667594, 0.05386179, 2.48599187, 113.66242448, 92.59887831, 49.95424423, 5.6834e26],
  Urano: [19.18916464, 0.04725744, 0.77263783, 74.01692503, 170.95427630, 313.23810451, 8.6810e25],
  Netuno: [30.06992276, 0.00859048, 1.77004347, 131.78422574, 44.96476227, -55.12002969, 1.02413e26],
  Plutão: [39.48211675, 0.24882730, 17.14001206, 110.30393684, 224.06891629, 238.92903833, 1.303e22]
};

const heliocentric = name => {
  const [a, e, i, node, perihelion, longitude, mass] = elements[name];
  return planet(name, mass, 'Sol', a, e, i, node, perihelion, longitude);
};
const planets = (...names) => names.map(heliocentric);

// Moons on near-circular orbits: [name, mass kg, a m, e, i deg, phase deg].
const moons = (around, list, inclinationOffset = 0) => list.map(([name, mass, a, e, i, phase]) =>
  orbit(name, mass, around, a, e, { inclination: i + inclinationOffset, anomaly: phase }));

const [jupiterA, jupiterE, jupiterI, jupiterNode, jupiterPerihelion, jupiterLongitude] = elements.Júpiter;
// Trojans share Jupiter's orbit about 60° ahead (L4, the "Greek camp") or behind (L5, the "Trojan camp").
const trojan = (name, lead, scale, inclination) => planet(name, 0, 'Sol', jupiterA * scale, jupiterE,
  inclination, jupiterNode, jupiterPerihelion, jupiterLongitude + lead);

const plutoMass = 1.303e22, charonMass = 1.586e21;

export const solarSystemPresets = {
  innerPlanets: preset('Planetas rochosos', 'Sistema Solar',
    'Mercúrio, Vênus, Terra e Marte a partir dos elementos orbitais de J2000, durante dois anos marcianos.', [
      sun(), ...planets('Mercúrio', 'Vênus', 'Terra', 'Marte')
    ], { timeStepSeconds: day / 4, steps: 5500, sampleEverySteps: 6, integrator: 'yoshida4' }),
  outerPlanets: preset('Planetas gigantes', 'Sistema Solar',
    'Júpiter, Saturno, Urano e Netuno por 328 anos: duas voltas de Netuno e quase 28 de Júpiter.', [
      sun(), ...planets('Júpiter', 'Saturno', 'Urano', 'Netuno')
    ], { timeStepSeconds: 30 * day, steps: 4000, sampleEverySteps: 4, integrator: 'yoshida4' }),
  solarSystem: preset('Sistema Solar completo', 'Sistema Solar',
    'O Sol, os oito planetas e Plutão por 55 anos, com massas reais e elementos de J2000.', [
      sun(), ...planets('Mercúrio', 'Vênus', 'Terra', 'Marte', 'Júpiter', 'Saturno', 'Urano', 'Netuno', 'Plutão')
    ], { timeStepSeconds: day, steps: 20000, sampleEverySteps: 20, integrator: 'yoshida4' }),
  earthMoon: preset('Terra e Lua', 'Sistema Solar',
    'Três meses da Lua real: órbita de 384.400 km, excentricidade 0,055 e o baricentro dentro da Terra.', [
      { name: 'Terra', massKg: earthMass, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: 6.371e6 },
      orbit('Lua', 7.342e22, 'Terra', 3.844e8, 0.0549, { inclination: 5.145, node: 125.08, argument: 318.15,
        anomaly: trueAnomaly(134.96, 0.0549) }, { radiusMeters: 1.7374e6 })
    ], { timeStepSeconds: 600, steps: 13000, sampleEverySteps: 13, integrator: 'yoshida4' }),
  sunEarthMoon: preset('Sol, Terra e Lua', 'Sistema Solar',
    'Um ano do trio: vista do Sol, a trajetória da Lua nunca dá laços, ela apenas ondula em torno da órbita da Terra.', [
      sun(), heliocentric('Terra'),
      orbit('Lua', 7.342e22, 'Terra', 3.844e8, 0.0549, { inclination: 5.145, node: 125.08, argument: 318.15,
        anomaly: trueAnomaly(134.96, 0.0549) })
    ], { timeStepSeconds: 1800, steps: 17532, sampleEverySteps: 18, integrator: 'yoshida4' }),
  galilean: preset('Luas galileanas', 'Sistema Solar',
    'Io, Europa e Ganimedes em ressonância de Laplace 1:2:4 (λ_Io − 3λ_Europa + 2λ_Ganimedes = 180°), com Calisto por fora.', [
      { name: 'Júpiter', massKg: jupiterMass, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: 7.1492e7 },
      ...moons('Júpiter', [
        ['Io', 8.9319e22, 4.217e8, 0.0041, 0.05, 0],
        ['Europa', 4.7998e22, 6.709e8, 0.009, 0.47, 120],
        ['Ganimedes', 1.4819e23, 1.0704e9, 0.0013, 0.2, 270],
        ['Calisto', 1.0759e23, 1.8827e9, 0.0074, 0.2, 45]
      ])
    ], { timeStepSeconds: 300, steps: 12000, sampleEverySteps: 12, integrator: 'yoshida4' }),
  saturnMoons: preset('Luas de Saturno', 'Sistema Solar',
    'Mimas, Encélado, Tétis, Dione, Reia e Titã por 20 dias: de 0,94 a 16 dias por volta.', [
      { name: 'Saturno', massKg: 5.6834e26, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: 6.0268e7 },
      ...moons('Saturno', [
        ['Mimas', 3.7493e19, 1.8552e8, 0.0196, 1.57, 0],
        ['Encélado', 1.08022e20, 2.3802e8, 0.0047, 0.02, 75],
        ['Tétis', 6.17449e20, 2.9466e8, 0.0001, 1.12, 150],
        ['Dione', 1.095452e21, 3.7742e8, 0.0022, 0.02, 220],
        ['Reia', 2.306518e21, 5.2704e8, 0.001, 0.35, 290],
        ['Titã', 1.3452e23, 1.22187e9, 0.0288, 0.35, 330]
      ])
    ], { timeStepSeconds: 400, steps: 4320, sampleEverySteps: 5, integrator: 'yoshida4' }),
  uranusMoons: preset('Luas de Urano', 'Sistema Solar',
    'Urano gira deitado (98°): Miranda, Ariel, Umbriel, Titânia e Oberon orbitam no plano do equador, quase perpendicular à órbita do planeta.', [
      { name: 'Urano', massKg: 8.681e25, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: 2.5559e7 },
      ...moons('Urano', [
        ['Miranda', 6.4e19, 1.2939e8, 0.0013, 4.23, 0],
        ['Ariel', 1.251e21, 1.9102e8, 0.0012, 0.26, 70],
        ['Umbriel', 1.275e21, 2.66e8, 0.0039, 0.13, 145],
        ['Titânia', 3.4e21, 4.3591e8, 0.0011, 0.34, 215],
        ['Oberon', 3.076e21, 5.835e8, 0.0014, 0.06, 300]
      ], 97.77)
    ], { timeStepSeconds: 300, steps: 4032, sampleEverySteps: 5, integrator: 'yoshida4' }),
  neptuneTriton: preset('Netuno e Tritão', 'Sistema Solar',
    'Tritão é a grande lua retrógrada (inclinação de 157°): gira ao contrário de Proteu, provável sinal de que foi capturado.', [
      { name: 'Netuno', massKg: 1.02413e26, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: 2.4764e7 },
      ...moons('Netuno', [
        ['Proteu', 4.4e19, 1.17647e8, 0.0005, 0.075, 0],
        ['Tritão', 2.139e22, 3.54759e8, 0.000016, 156.885, 140]
      ])
    ], { timeStepSeconds: 240, steps: 4320, sampleEverySteps: 5, integrator: 'yoshida4' }),
  plutoCharon: preset('Plutão e Caronte', 'Sistema Solar',
    'Caronte tem 12% da massa de Plutão: os dois giram em torno de um baricentro fora de Plutão, com Estige, Nix, Cérbero e Hidra ao redor do par.', [
      ...binary(plutoMass, charonMass, 1.9591e7, ['Plutão', 'Caronte']),
      orbiter('Estige', 7.5e15, 4.2656e7, 40, 1, 0, plutoMass + charonMass),
      orbiter('Nix', 4.5e16, 4.8694e7, 130, 1, 0, plutoMass + charonMass),
      orbiter('Cérbero', 1.65e16, 5.7783e7, 215, 1, 0, plutoMass + charonMass),
      orbiter('Hidra', 4.8e16, 6.4738e7, 300, 1, 0, plutoMass + charonMass)
    ], { timeStepSeconds: 600, steps: 6000, sampleEverySteps: 6, integrator: 'yoshida4' }),
  halley: preset('Cometa Halley', 'Sistema Solar',
    'Uma volta inteira de 76 anos, partindo do afélio além de Netuno: órbita retrógrada (162°) e periélio a 0,59 UA.', [
      sun(), ...planets('Terra', 'Júpiter', 'Saturno'),
      orbit('Halley', 2.2e14, 'Sol', 17.834 * AU, 0.96714, { inclination: 162.26, node: 58.42, argument: 111.33, anomaly: 180 })
    ], { timeStepSeconds: 1.2e5, steps: 20000, sampleEverySteps: 20, integrator: 'yoshida4' }),
  oumuamua: preset('ʻOumuamua, o visitante interestelar', 'Sistema Solar',
    'Primeiro objeto interestelar observado (2017): órbita hiperbólica (e = 1,20) que passa a 0,26 UA do Sol e não volta.', [
      sun(), ...planets('Mercúrio', 'Vênus', 'Terra', 'Marte', 'Júpiter'),
      orbit('ʻOumuamua', 0, 'Sol', 0.2556 / (1 - 1.2011) * AU, 1.2011,
        { inclination: 122.74, node: 24.597, argument: 241.81, anomaly: -130 })
    ], { timeStepSeconds: 3600, steps: 10000, sampleEverySteps: 10, integrator: 'yoshida4' }),
  venusRosette: preset('Rosácea de Vênus', 'Sistema Solar',
    'Oito anos no referencial que gira com a Terra: Vênus desenha a rosácea de cinco pétalas (13 voltas de Vênus para 8 da Terra).', [
      sun(), ...planets('Vênus', 'Terra')
    ], { timeStepSeconds: day / 4, steps: 11688, sampleEverySteps: 12, integrator: 'yoshida4', view: 'rotating' }),
  marsRetrograde: preset('Laços de Marte', 'Sistema Solar',
    'No referencial que gira com a Terra, Marte faz um laço a cada oposição: é o movimento retrógrado visto do céu.', [
      sun(), ...planets('Terra', 'Marte')
    ], { timeStepSeconds: day / 4, steps: 5844, sampleEverySteps: 6, integrator: 'yoshida4', view: 'rotating' }),
  neptunePluto: preset('Ressonância Netuno–Plutão', 'Sistema Solar',
    'Plutão cruza a órbita de Netuno, mas a ressonância 3:2 nunca deixa os dois se aproximarem: 500 anos no referencial de Netuno.', [
      sun(), ...planets('Netuno', 'Plutão')
    ], { timeStepSeconds: 1e6, steps: 15780, sampleEverySteps: 16, integrator: 'yoshida4', view: 'rotating' }),
  cruithne: preset('Cruithne, companheiro da Terra', 'Sistema Solar',
    'O asteroide 3753 Cruithne tem o mesmo período que a Terra (e = 0,51, i = 20°): no referencial que gira com a Terra ele desenha laços em forma de feijão ao longo de 30 anos (fase ilustrativa).', [
      sun(), heliocentric('Terra'),
      orbit('Cruithne', 1.3e14, 'Sol', 0.99774 * AU, 0.51485, { inclination: 19.806, node: 126.236, argument: 43.787,
        anomaly: trueAnomaly(172.3, 0.51485) })
    ], { timeStepSeconds: day, steps: 10957, sampleEverySteps: 11, integrator: 'yoshida4', view: 'rotating' }),
  jupiterTrojans: preset('Troianos de Júpiter', 'Sistema Solar',
    'Dez asteroides troianos (posições ilustrativas, nomes reais) oscilam em torno de L4 e L5 por 164 anos, no referencial de Júpiter.', [
      sun(), heliocentric('Júpiter'),
      trojan('Aquiles', 60, 1.005, 10.3), trojan('Heitor', 55, 0.995, 18.2), trojan('Nestor', 66, 1.01, 4.5),
      trojan('Agamenon', 52, 0.99, 21.8), trojan('Ulisses', 63, 1.0, 14.6),
      trojan('Pátroclo', -60, 0.995, 22), trojan('Eneias', -54, 1.008, 16.7), trojan('Príamo', -66, 1.0, 8.9),
      trojan('Anquises', -57, 0.992, 6.9), trojan('Troilo', -63, 1.006, 33.6)
    ], { timeStepSeconds: 10 * day, steps: 6000, sampleEverySteps: 6, integrator: 'yoshida4', view: 'rotating' })
};
