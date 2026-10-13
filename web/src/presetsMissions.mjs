// Space missions and close encounters. Planet positions come from the JPL mean elements with
// their rates at each date; trajectories that must hit a target (flybys, entry, capture) were
// found by shooting through this same motor and are stored as exact initial states and burns,
// so the gallery reproduces them step by step. SI units; angles in degrees.
import { AU, G, day, earthJ2, earthMass, earthRadius, orbit, preset, sunMass, trueAnomaly } from './presetHelpers.mjs';

const degree = Math.PI / 180;

// a (AU), e, I, L, ϖ, Ω and their rates per Julian century (JPL, valid 1800–2050), mass (kg).
const meanElements = {
  Vênus: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
    [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418], 4.8675e24],
  Terra: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0], earthMass],
  Marte: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343], 6.4171e23],
  Júpiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106], 1.89813e27],
  Saturno: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794], 5.6834e26],
  Urano: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
    [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589], 8.6810e25],
  Netuno: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
    [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664], 1.02413e26]
};
export const planetRadii = { Vênus: 6.0518e6, Terra: 6.371e6, Marte: 3.3895e6, Júpiter: 7.1492e7, Saturno: 6.0268e7,
  Urano: 2.5559e7, Netuno: 2.4764e7 };

export const julianDate = (year, month, dayOfMonth, hour = 0, minute = 0) =>
  Date.UTC(year, month - 1, dayOfMonth, hour, minute) / 86400000 + 2440587.5;

// Heliocentric planet (ecliptic J2000) at a Julian date, as an element-form body.
export function planetOn(name, julian) {
  const [base, rate, mass] = meanElements[name];
  const centuries = (julian - 2451545) / 36525;
  const [a, e, i, longitude, perihelion, node] = base.map((value, k) => value + rate[k] * centuries);
  return orbit(name, mass, 'Sol', a * AU, e, { inclination: i, node, argument: perihelion - node,
    anomaly: trueAnomaly(longitude - perihelion, e) }, { radiusMeters: planetRadii[name] });
}
export const planetMass = name => meanElements[name][2];
const sun = () => ({ name: 'Sol', massKg: sunMass, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: 6.957e8 });
const vectorBody = (name, massKg, [positionMeters, velocityMetersPerSecond], radiusMeters) =>
  ({ name, massKg, positionMeters, velocityMetersPerSecond, ...(radiusMeters && { radiusMeters }) });
const burn = (name, step, vector) => ({ body: name, step, deltaVelocityMetersPerSecond: vector });

// --- Apollo 13 free return (1970). Parking orbit at 185 km; translunar injection 50 min in;
// the Moon's phase and the burn were shot to pass 254 km over the far side and come back
// into the atmosphere, as the crippled spacecraft did. ---
const moonMass = 7.342e22, moonDistance = 3.844e8, moonRadius = 1.7374e6;
const apolloParking = 6.556e6; // 185 km above a mean Earth radius of 6.371 km
const apolloStep = 10, apolloInjection = 300;
const apolloSpeed = Math.sqrt(G * earthMass / apolloParking);
const apolloAngle = apolloSpeed / apolloParking * apolloInjection * apolloStep;
const apolloMoonPhase = -23.690817 * degree, apolloDelta = 3162.5;
const moonSpeed = Math.sqrt(G * (earthMass + moonMass) / moonDistance);

// --- Perseverance, Mars 2020 window: launched 30 July 2020, aimed at Mars (entry, Feb. 2021). ---
const marsLaunch = julianDate(2020, 7, 30, 11, 50);
const perseverance = [[94247323812.9365, -119907194940.8482, 616373791.2964371],
  [26414.453830026963, 19330.19740824689, 1112.8128610945923]];

// --- Molniya: 12-hour orbits (half a sidereal day) with e = 0,74 and perigee in the south. ---
const molniyaPeriod = 86164.0905 / 2;
const molniyaAxis = Math.cbrt(G * earthMass * (molniyaPeriod / (2 * Math.PI)) ** 2);
const molniya = (name, inclination, node, meanAnomaly) => orbit(name, 1600, 'Terra', molniyaAxis, 0.74,
  { inclination, node, argument: 270, anomaly: trueAnomaly(meanAnomaly, 0.74) });

// --- Apophis, 13 April 2029: 38.000 km from Earth's centre at 5,84 km/s excess speed. ---
const apophisExcess = 5840, apophisPeriapsis = 3.8012e7;
const apophisAxis = -G * earthMass / apophisExcess ** 2;
const apophisE = 1 - apophisPeriapsis / apophisAxis;
const apophisTurn = 2 * Math.asin(1 / apophisE) / degree;

// --- Temporary capture of a small asteroid (states found by integrating back from a captured
// state inside Earth's Hill sphere; illustrative, inspired by 2024 PT5). ---
const minimoon = {
  Sol: [[925573.5763744119, -800153.0772837485, 44.9508180790166], [-0.06893553848599485, 0.1557200807294913, -0.000008748007373642705]],
  Terra: [[-112476098353.30225, -100398375481.70354, 5640157.164710201], [19352.24010581156, -22335.633766346575, 1.2547661673924249]],
  asteroid: [[-105239126841.38771, -116530455799.04361, 6546421.513580188], [20831.00357143161, -19633.3234777612, 1.1029563929582593]]
};

// --- Voyager 2 Grand Tour (1977–1989): launch state and three trajectory corrections (TCM) found
// by aiming each flyby in the B-plane through this motor, from Lambert arcs between the planets. ---
const voyagerLaunch = julianDate(1977, 8, 20, 14, 29);
const voyager = [[128467042880.15538, -78897899926.52873, 640256653.8216653],
  [17579.105237400334, 34693.884190748766, 3326.4535180514717]];
const voyagerBurns = [[210606, [109.26188356854703, -296.30433922164394, -19.998830504271652]],
  [434805, [-28.0344920611933, -2.9214491643164195, 9.081947229189147]],
  [896903, [96.26477347851512, 47.840021274927054, -3.7023326231596405]]];

// --- Galileo VEEGA (1989–1996): Venus, Earth, Earth gravity assists to Jupiter, then the orbit
// insertion burn at perijove. Same design method as Voyager; the second Earth flyby needs the
// Jupiter arrival about 4 months later than the real one with these approximate positions. ---
const galileoLaunch = julianDate(1989, 10, 19);
const galileo = [[135401993419.30037, 63425269315.069695, 1019013352.3881143],
  [-10963.920374352056, 24190.679105151325, 2125.319444196537]];
const galileoBurns = [[115134, [-0.8687134266149871, -0.9607447772193337, 3.4013357116621994]],
  [411209, [-4.5934652694297755, -28.926989960646523, 12.125487953241276]],
  [1042641, [-181.60756995719078, 19.79901784667733, -20.361149672372413]],
  [2030115, [442.1275096952989, 657.1064368191954, -17.398741953737073]]];

const earthAtRest = (extra = {}) => ({ name: 'Terra', massKg: earthMass, positionMeters: [0, 0, 0],
  velocityMetersPerSecond: [0, 0, 0], radiusMeters: 6.371e6, ...extra });

export const missionPresets = {
  apollo13: preset('Apollo 13: retorno livre', 'Missões',
    'Depois da explosão de 1970, a tripulação contou com a trajetória de retorno livre: a nave contorna o lado oculto da Lua a 254 km, sem precisar do motor, e volta à Terra desenhando um oito. Injeção de 3,16 km/s; reentrada cerca de 6 dias depois.', [
      earthAtRest(),
      { name: 'Lua', massKg: moonMass, radiusMeters: moonRadius,
        positionMeters: [moonDistance * Math.cos(apolloMoonPhase), moonDistance * Math.sin(apolloMoonPhase), 0],
        velocityMetersPerSecond: [-moonSpeed * Math.sin(apolloMoonPhase), moonSpeed * Math.cos(apolloMoonPhase), 0] },
      { name: 'Apollo 13', massKg: 4.4e4, positionMeters: [apolloParking, 0, 0], velocityMetersPerSecond: [0, apolloSpeed, 0], radiusMeters: 5 }
    ], { timeStepSeconds: apolloStep, steps: 69120, sampleEverySteps: 70, integrator: 'yoshida4', physics: { collisions: true },
      maneuvers: [burn('Apollo 13', apolloInjection, [-Math.sin(apolloAngle) * apolloDelta, Math.cos(apolloAngle) * apolloDelta, 0])] }),
  marsWindow: preset('Janela para Marte (2020)', 'Missões',
    'Lançada em 30 de julho de 2020, quando Marte estava 26° à frente da Terra, a Perseverance percorre quase meia volta em torno do Sol e alcança Marte em fevereiro de 2021, chegando a 2,65 km/s. A próxima janela só se abre 26 meses depois. A sonda começa já a 2 milhões de km da Terra.', [
      sun(), planetOn('Terra', marsLaunch), planetOn('Marte', marsLaunch),
      vectorBody('Perseverance', 1025, perseverance, 3)
    ], { timeStepSeconds: 300, steps: 59725, sampleEverySteps: 60, integrator: 'yoshida4', physics: { collisions: true } }),
  molniya: preset('Órbitas Molniya', 'Missões',
    `Três satélites em órbitas de 12 h (e = 0,74) a 63,4°, 8 h um atrás do outro: sempre há um perto do apogeu, a ${ptBr(molniyaAxis * 1.74 / 1e3 - 6371)} km sobre o hemisfério norte. Com o J2, só nessa inclinação o apogeu não gira; o quarto satélite, a 30°, vê o apogeu girar cerca de 0,5° por dia.`, [
      { ...earthAtRest(), radiusMeters: earthRadius },
      molniya('Molniya 1', 63.435, 0, 180), molniya('Molniya 2', 63.435, 120, 300), molniya('Molniya 3', 63.435, 240, 60),
      molniya('Molniya a 30°', 30, 60, 0)
    ], { timeStepSeconds: 30, steps: 72000, sampleEverySteps: 72, integrator: 'yoshida4',
      physics: { centralBody: 'Terra', j2: earthJ2, centralRadiusMeters: earthRadius } }),
  apophis: preset('Apophis em 2029', 'Missões',
    `Em 13 de abril de 2029, o asteroide Apophis (340 m) passará a 32 mil km da superfície, abaixo dos satélites geoestacionários e visível a olho nu. A Terra desvia sua trajetória em ${ptBr(apophisTurn)}° e muda sua órbita em torno do Sol (o período passa de 0,89 para 1,16 ano). Plano da aproximação ilustrativo.`, [
      earthAtRest(),
      orbit('Apophis', 6.1e10, 'Terra', apophisAxis, apophisE, { inclination: 40, anomaly: -100 }, { radiusMeters: 170 }),
      ...[0, 120, 240].map(phase => orbit(`GEO ${phase}°`, 3000, 'Terra', 4.2164e7, 0, { anomaly: phase + 30 }))
    ], { timeStepSeconds: 20, steps: 12960, sampleEverySteps: 13, integrator: 'yoshida4' }),
  voyager2: preset('Voyager 2: o Grand Tour', 'Missões',
    'Lançada em 1977, a Voyager 2 aproveitou um alinhamento que se repete a cada 175 anos: Júpiter (1979), Saturno (1981), Urano (1986) e Netuno (1989), cada estilingue apontando para o seguinte. Sobrevoos a 600 mil, 84 mil, 69 mil e 4.900 km das nuvens; três correções de rota somam cerca de 450 m/s (posições planetárias aproximadas). 12 anos.', [
      sun(), ...['Terra', 'Júpiter', 'Saturno', 'Urano', 'Netuno'].map(name => planetOn(name, voyagerLaunch)),
      vectorBody('Voyager 2', 0, voyager, 5)
    ], { timeStepSeconds: 300, steps: 1280897, sampleEverySteps: 1283, integrator: 'yoshida4',
      maneuvers: voyagerBurns.map(([step, vector]) => burn('Voyager 2', step, vector)) }),
  galileo: preset('Galileo: Vênus, Terra, Terra, Júpiter', 'Missões',
    'Sem foguete para ir direto a Júpiter, a Galileo (1989) passou por Vênus e duas vezes pela Terra, ganhando velocidade em cada estilingue. Sobrevoos a 14,9 mil, 4,4 mil e 1,3 mil km; em Júpiter, freia 792 m/s a 4 raios do planeta e fica numa órbita de 200 dias. Correções de rota somam cerca de 220 m/s; com posições planetárias aproximadas, chega em março de 1996 (na realidade, dezembro de 1995).', [
      sun(), ...['Vênus', 'Terra', 'Júpiter'].map(name => planetOn(name, galileoLaunch)),
      vectorBody('Galileo', 0, galileo, 5)
    ], { timeStepSeconds: 100, steps: 2210000, sampleEverySteps: 2213, integrator: 'yoshida4',
      maneuvers: galileoBurns.map(([step, vector]) => burn('Galileo', step, vector)) }),
  minimoon: preset('Minilua temporária', 'Missões',
    'Um asteroide de 10 m numa órbita quase igual à da Terra chega devagar e fica preso por 57 dias (energia em relação à Terra negativa) sem completar uma volta, e depois segue em torno do Sol, como o 2024 PT5 em 2024. Trajetória ilustrativa, no referencial que gira com a Terra.', [
      vectorBody('Sol', sunMass, minimoon.Sol), vectorBody('Terra', earthMass, minimoon.Terra, 6.371e6),
      vectorBody('2024 PT5', 0, minimoon.asteroid)
    ], { timeStepSeconds: 3600, steps: 7200, sampleEverySteps: 8, integrator: 'yoshida4', view: 'rotating' })
};

function ptBr(value, digits = 0) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: digits });
}
