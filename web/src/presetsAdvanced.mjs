// Further scenarios: Solar System dynamics, exoplanet systems, a relativistic binary pulsar,
// classic few-body problems and galaxies. SI units; angles in degrees. Published values are
// approximate, and every illustrative or scaled choice is stated in the description.
import { AU, G, binary, body, day, earthMass, jupiterMass, orbit, planet, preset, sunMass, trueAnomaly, year }
  from './presetHelpers.mjs';

const degree = Math.PI / 180;
const parsec = 3.0857e16;
const kiloparsec = 1e3 * parsec;
const earthRadiusMean = 6.371e6;
const at = (name, massKg, radiusMeters = 0) => ({ name, massKg, positionMeters: [0, 0, 0],
  velocityMetersPerSecond: [0, 0, 0], ...(radiusMeters && { radiusMeters }) });
// Semi-major axis (m) of an orbit of period `periodDays` around a total mass (kg).
const axisFor = (periodDays, totalMassKg) => Math.cbrt(G * totalMassKg * (periodDays * day / (2 * Math.PI)) ** 2);
const ptBr = (value, digits = 0) => value.toLocaleString('pt-BR', { maximumFractionDigits: digits });

// --- Saturn's co-orbital moons Janus and Epimetheus (orbits 50 km apart). ---
const saturnMass = 5.6834e26, saturnRadius = 6.0268e7;
const saturn = () => at('Saturno', saturnMass, saturnRadius);

// --- J2000 giant planets (JPL mean elements), for the Sun's wobble and Planet Nine. ---
const giants = {
  Júpiter: [5.20288700, 0.04838624, 1.30439695, 100.47390909, 14.72847983, 34.39644051, jupiterMass],
  Saturno: [9.53667594, 0.05386179, 2.48599187, 113.66242448, 92.59887831, 49.95424423, 5.6834e26],
  Urano: [19.18916464, 0.04725744, 0.77263783, 74.01692503, 170.95427630, 313.23810451, 8.6810e25],
  Netuno: [30.06992276, 0.00859048, 1.77004347, 131.78422574, 44.96476227, -55.12002969, 1.02413e26]
};
const giant = name => {
  const [a, e, i, node, perihelion, longitude, mass] = giants[name];
  return planet(name, mass, 'Sol', a, e, i, node, perihelion, longitude);
};

// Extreme trans-Neptunian objects [name, a (AU), e, i, Ω, ω, true anomaly] (approximate elements;
// anomalies near perihelion, where they were discovered).
const extremeObjects = [
  ['Sedna', 506, 0.855, 11.93, 144.4, 311.3, -40],
  ['2012 VP113', 271, 0.70, 24.1, 90.8, 293.8, -25],
  ['Leleākūhonua', 1090, 0.94, 11.7, 300.9, 118.2, -30],
  ['2010 GB174', 350, 0.86, 21.5, 130.7, 347.2, 20],
  ['2004 VN112', 327, 0.85, 25.6, 66.0, 327.3, 25],
  ['2013 RF98', 350, 0.89, 29.6, 67.6, 311.8, 15],
  ['2007 TG422', 483, 0.93, 18.6, 112.9, 285.8, 20],
  ['2013 SY99', 730, 0.93, 4.2, 29.5, 32.3, -20],
  ['2014 SR349', 290, 0.84, 18.0, 34.9, 341.4, 10],
  ['2015 RX245', 430, 0.89, 12.1, 8.6, 65.1, -15]
];

// --- HD 110067: six sub-Neptunes in a 3:2, 3:2, 3:2, 4:3, 4:3 chain (Luque et al. 2023). ---
const hd110067Mass = 0.80 * sunMass;
const hd110067Planets = [['b', 9.113678, 5.7], ['c', 13.673694, 6.8], ['d', 20.519617, 8.5], ['e', 30.793091, 3.9],
  ['f', 41.05854, 5.0], ['g', 54.76992, 8.4]];

// --- PSR B1257+12: the first exoplanets, around a pulsar (Wolszczan & Frail 1992). ---
const pulsarMass = 1.4 * sunMass;

// --- Kepler-9: two Saturn-sized planets near the 2:1 resonance (Freudenthal et al. 2018). ---
const kepler9Mass = 1.022 * sunMass;

// --- Hulse–Taylor binary pulsar PSR B1913+16 (Weisberg & Huang 2016). ---
const pulsarA = 1.4398 * sunMass, pulsarB = 1.3886 * sunMass;
const binaryPeriod = 27906.98; // s
const binaryAxis = axisFor(binaryPeriod / day, pulsarA + pulsarB);
const binaryEccentricity = 0.6171334;
const binaryStep = binaryPeriod / 1200; // finer steps keep the numerical precession at 0,03°/year

// --- Castor: three binaries; A and B on an eccentric orbit (e = 0,34), C circling the pair.
// Scales compressed from 0,1 / 100 / 1.000 AU to 0,4 / 4 / 40 AU so every level shows on screen. ---
function castor() {
  const [aa, ab, ba, bb, ca, cb] = [2.37, 0.6, 1.79, 0.5, 0.6, 0.6].map(value => value * sunMass);
  const massA = aa + ab, massB = ba + bb, massAB = massA + massB, massC = ca + cb, total = massAB + massC;
  // A–B released at apoastron.
  const outerAxis = 4 * AU, outerE = 0.34, apart = outerAxis * (1 + outerE);
  const relative = Math.sqrt(G * massAB * (1 - outerE) / apart);
  // C on a circular orbit around the A–B pair, inclined 30°.
  const farAxis = 40 * AU, farSpeed = Math.sqrt(G * total / farAxis), tilt = 30 * degree;
  const pairShift = [-farAxis * massC / total, 0, 0], pairDrift = [0, -farSpeed * massC / total * Math.cos(tilt),
    -farSpeed * massC / total * Math.sin(tilt)];
  const cShift = [farAxis * massAB / total, 0, 0], cDrift = [0, farSpeed * massAB / total * Math.cos(tilt),
    farSpeed * massAB / total * Math.sin(tilt)];
  const offset = (position, velocity) => [...position, ...velocity];
  const a = [pairShift[0] - apart * massB / massAB, 0, 0], b = [pairShift[0] + apart * massA / massAB, 0, 0];
  const va = [0, pairDrift[1] - relative * massB / massAB, pairDrift[2]];
  const vb = [0, pairDrift[1] + relative * massA / massAB, pairDrift[2]];
  return [
    ...binary(aa, ab, 0.4 * AU, ['Castor Aa', 'Castor Ab'], offset(a, va)),
    ...binary(ba, bb, 0.3 * AU, ['Castor Ba', 'Castor Bb'], offset(b, vb)),
    ...binary(ca, cb, 0.2 * AU, ['Castor Ca', 'Castor Cb'], offset(cShift, cDrift))
  ];
}

// --- Kozai–Lidov: planet at 3 AU, inclined 65° to a solar-mass companion at 30 AU. ---
const kozaiInner = 3 * AU;
const kozaiPeriod = 2 * Math.PI * Math.sqrt(kozaiInner ** 3 / (G * (sunMass + jupiterMass)));
const kozaiStep = kozaiPeriod / 2000;

// --- Butterfly choreography of Šuvakov & Dmitrašinović (2013), G = m = 1 units scaled. ---
const butterflyMass = 1e24, butterflyLength = 1e7;
const butterflySpeed = Math.sqrt(G * butterflyMass / butterflyLength);
const butterflyTime = butterflyLength / butterflySpeed;
const [p1, p2] = [0.306893, 0.125507];
const butterflyPeriod = 6.235641 * butterflyTime;

// --- Sitnikov problem: equal stars on an eccentric binary, planets on the axis. ---
const sitnikovAxis = AU, sitnikovEccentricity = 0.2, sitnikovHeight = 1.55 * AU;

// --- Routh's limit: mass ratio 0,05 > 0,0385 makes L4 and L5 unstable. ---
const routhPlanet = 0.05 / 0.95 * sunMass;
const routhRate = Math.sqrt(G * (sunMass + routhPlanet) / AU ** 3);
const routhPeriod = 2 * Math.PI / routhRate;
const routhSun = -AU * routhPlanet / (sunMass + routhPlanet), routhX = AU * sunMass / (sunMass + routhPlanet);
const atLagrange = (name, angle) => {
  const radius = 1.001 * AU, x = routhSun + radius * Math.cos(angle * degree), y = radius * Math.sin(angle * degree);
  return body(name, 0, [x, y, 0], [-routhRate * y, routhRate * x, 0]);
};

// --- Hills mechanism: a binary of two 3-solar-mass stars falls on Sgr A* (4,3 million suns). ---
const blackHoleMass = 4.297e6 * sunMass;
const hillsBinaryMass = 6 * sunMass, hillsSeparation = 0.5 * AU, hillsPeriapsis = 15 * AU, hillsStart = 2000 * AU;
function hillsBinary(phaseDegrees) {
  const mu = G * (blackHoleMass + hillsBinaryMass), p = 2 * hillsPeriapsis;
  const anomaly = -Math.acos(p / hillsStart - 1), speed = Math.sqrt(mu / p);
  const offset = [hillsStart * Math.cos(anomaly), hillsStart * Math.sin(anomaly), 0,
    -speed * Math.sin(anomaly), speed * (1 + Math.cos(anomaly)), 0];
  const turn = phaseDegrees * degree, cos = Math.cos(turn), sin = Math.sin(turn);
  return binary(hillsBinaryMass / 2, hillsBinaryMass / 2, hillsSeparation, ['Estrela A', 'Estrela B']).map(([name, mass, r, v]) =>
    [name, mass, [r[0] * cos - r[1] * sin + offset[0], r[0] * sin + r[1] * cos + offset[1], offset[2]],
      [v[0] * cos - v[1] * sin + offset[3], v[0] * sin + v[1] * cos + offset[4], offset[5]]]);
}

// --- Roche limit: a rubble moon inside Saturn's Roche limit. ---
const rocheMoon = 4e19, rocheDistance = 7e7;

// --- Galaxies (point-mass cores with massless star disks). ---
const milkyWay = 1.0e12 * sunMass, andromeda = 1.5e12 * sunMass;

export const advancedPresets = {
  janusEpimetheus: preset('Jano e Epimeteu', 'Sistema Solar',
    'Duas luas de Saturno dividem quase a mesma órbita, com raios só 50 km diferentes: a de dentro alcança a de fora e, quando chegam a cerca de 12 mil km, as duas trocam de faixa sem nunca se tocar. Oito anos no referencial de Jano, com duas trocas.', [
      saturn(),
      orbit('Jano', 1.8975e18, 'Saturno', 1.51472e8),
      orbit('Epimeteu', 5.266e17, 'Saturno', 1.51422e8, 0, { anomaly: 180 })
    ], { timeStepSeconds: 600, steps: 420000, sampleEverySteps: 420, integrator: 'yoshida4', view: 'rotating' }),
  fRingShepherds: preset('Luas pastoras do anel F', 'Sistema Solar',
    'Prometeu e Pandora ladeiam o estreito anel F. A cada passagem, Prometeu puxa as partículas e deixa ondulações que se repetem ao longo do anel (massas ampliadas 100× para que se vejam nesta escala; o confinamento real também depende das colisões entre partículas, que o motor não simula).', [
      saturn(),
      orbit('Prometeu (ampliada)', 1.595e17 * 100, 'Saturno', 1.3938e8, 0.0022),
      orbit('Pandora (ampliada)', 1.371e17 * 100, 'Saturno', 1.4172e8, 0.0042, { anomaly: 140 })
    ], { softeningMeters: 2e4, timeStepSeconds: 300, steps: 17280, sampleEverySteps: 66, integrator: 'yoshida4', view: 'rotating',
      particleGroups: [{ name: 'Anel F', around: 'Saturno', count: 1500, innerRadiusMeters: 1.4005e8, outerRadiusMeters: 1.4035e8 }] }),
  kirkwood: preset('Lacunas de Kirkwood', 'Sistema Solar',
    'Faixas de asteroides nas ressonâncias 3:1 e 2:1 com Júpiter (massa real) ganham excentricidade: em 5 mil anos ficam 2 a 4 vezes mais largas, enquanto as faixas fora de ressonância seguem estreitas (a 5:2 reage mais devagar). Em milhões de anos esse espalhamento leva os asteroides a cruzar Marte e esvazia as lacunas.', [
      at('Sol', sunMass), giant('Júpiter')
    ], { timeStepSeconds: 0.1 * year, steps: 50000, sampleEverySteps: 200, integrator: 'yoshida4',
      particleGroups: [
        { name: 'Faixa a 2,30 UA', around: 'Sol', count: 200, innerRadiusMeters: 2.28 * AU, outerRadiusMeters: 2.32 * AU, eccentricity: 0.03 },
        { name: 'Ressonância 3:1', around: 'Sol', count: 200, innerRadiusMeters: 2.49 * AU, outerRadiusMeters: 2.51 * AU, eccentricity: 0.03 },
        { name: 'Faixa a 2,65 UA', around: 'Sol', count: 200, innerRadiusMeters: 2.63 * AU, outerRadiusMeters: 2.67 * AU, eccentricity: 0.03 },
        { name: 'Ressonância 5:2', around: 'Sol', count: 200, innerRadiusMeters: 2.815 * AU, outerRadiusMeters: 2.835 * AU, eccentricity: 0.03 },
        { name: 'Faixa a 3,05 UA', around: 'Sol', count: 200, innerRadiusMeters: 3.03 * AU, outerRadiusMeters: 3.07 * AU, eccentricity: 0.03 },
        { name: 'Ressonância 2:1', around: 'Sol', count: 200, innerRadiusMeters: 3.267 * AU, outerRadiusMeters: 3.287 * AU, eccentricity: 0.03 }
      ] }),
  sunWobble: preset('Oscilação do Sol', 'Sistema Solar',
    'Júpiter, Saturno, Urano e Netuno puxam o Sol, que dá voltas em torno do centro de massa do Sistema Solar, às vezes saindo de dentro de si mesmo. A cena enquadra só o Sol; os planetas ficam fora do quadro. É esse balanço que revela exoplanetas.', [
      at('Sol', sunMass, 6.957e8), ...Object.keys(giants).map(giant)
    ], { timeStepSeconds: 5 * day, steps: 5844, sampleEverySteps: 6, integrator: 'yoshida4', fit: ['Sol'] }),
  planetNine: preset('Planeta Nove', 'Sistema Solar',
    'Dez objetos transnetunianos extremos (elementos aproximados) têm os periélios agrupados de um mesmo lado. A hipótese do Planeta Nove (Batygin e Brown) explica o agrupamento com um planeta de 5 massas terrestres a 400 UA, na direção oposta. 100 mil anos.', [
      at('Sol', sunMass), giant('Netuno'),
      orbit('Planeta Nove', 5 * earthMass, 'Sol', 400 * AU, 0.25, { inclination: 20, node: 100, argument: 154, anomaly: 180 }),
      ...extremeObjects.map(([name, a, e, i, node, argument, anomaly]) =>
        orbit(name, 0, 'Sol', a * AU, e, { inclination: i, node, argument, anomaly }))
    ], { timeStepSeconds: 2 * year, steps: 50000, sampleEverySteps: 50, integrator: 'yoshida4' }),

  hd110067: preset('HD 110067', 'Exoplanetas',
    'Seis sub-Netunos em cadeia de ressonância 3:2, 3:2, 3:2, 4:3 e 4:3 (descoberta em 2023): enquanto b dá 6 voltas, g dá uma. Massas aproximadas, algumas são limites superiores.', [
      at('HD 110067', hd110067Mass, 0.79 * 6.957e8),
      ...hd110067Planets.map(([letter, period, mass], index) => orbit(`HD 110067 ${letter}`, mass * earthMass, 'HD 110067',
        axisFor(period, hd110067Mass), 0, { anomaly: index * 137.5 }))
    ], { timeStepSeconds: 0.06 * day, steps: 12175, sampleEverySteps: 13, integrator: 'yoshida4' }),
  pulsarPlanets: preset('Planetas do pulsar PSR B1257+12', 'Exoplanetas',
    'Os primeiros exoplanetas confirmados (1992) orbitam uma estrela de nêutrons. B e C, perto da ressonância 3:2, perturbam-se mutuamente; os atrasos que isso causa nos pulsos confirmaram que eram planetas.', [
      at('PSR B1257+12', pulsarMass, 1e4),
      orbit('PSR B1257+12 A', 0.020 * earthMass, 'PSR B1257+12', axisFor(25.262, pulsarMass)),
      orbit('PSR B1257+12 B', 4.3 * earthMass, 'PSR B1257+12', axisFor(66.5419, pulsarMass), 0.0186, { argument: 250.4, anomaly: 40 }),
      orbit('PSR B1257+12 C', 3.9 * earthMass, 'PSR B1257+12', axisFor(98.2114, pulsarMass), 0.0252, { argument: 108.3, anomaly: 200 })
    ], { timeStepSeconds: 0.1 * day, steps: 7305, sampleEverySteps: 8, integrator: 'yoshida4' }),
  kepler9: preset('Kepler-9 e as variações nos trânsitos', 'Exoplanetas',
    'Dois planetas do tamanho de Saturno quase em ressonância 2:1 adiantam e atrasam os trânsitos um do outro, num ciclo de 4,6 anos: foi a primeira detecção por variação nos tempos de trânsito (2010). No referencial que gira com b.', [
      at('Kepler-9', kepler9Mass, 0.958 * 6.957e8),
      orbit('Kepler-9 b', 43.4 * earthMass, 'Kepler-9', axisFor(19.247, kepler9Mass), 0.06, { argument: 357, anomaly: 0 }),
      orbit('Kepler-9 c', 29.9 * earthMass, 'Kepler-9', axisFor(38.944, kepler9Mass), 0.07, { argument: 168, anomaly: 30 })
    ], { timeStepSeconds: 0.05 * day, steps: 36500, sampleEverySteps: 37, integrator: 'yoshida4', view: 'rotating' }),

  hulseTaylor: preset('Pulsar binário Hulse–Taylor', 'Física',
    'Duas estrelas de nêutrons numa órbita de 7,75 h e e = 0,62. Com a velocidade da luz real, a correção 1PN gira o periastro 4,26° por ano (4,23° medidos desde 1974). Amostrado a cada 1,02 órbita, como um estroboscópio: cada elipse desenhada resume 50 voltas.', [
      at('PSR B1913+16', pulsarA, 1e4),
      orbit('PSR B1913+16 B', pulsarB, 'PSR B1913+16', binaryAxis, binaryEccentricity, { anomaly: 0 }, { radiusMeters: 1e4 })
    ], { timeStepSeconds: binaryStep, steps: 1224000, sampleEverySteps: 1224, integrator: 'yoshida4',
      physics: { centralBody: 'PSR B1913+16', lightSpeedMetersPerSecond: 299792458 } }),

  castor: preset('Castor, estrela sêxtupla', 'Múltiplos',
    'Três binárias em hierarquia: Castor A e B giram uma em torno da outra, e Castor C (YY Geminorum) orbita o par. Massas reais; escalas comprimidas para caber na tela (na realidade, 0,1 UA, 100 UA e 1.000 UA).', [
      ...castor()
    ], { timeStepSeconds: 0.3 * day, steps: 120000, sampleEverySteps: 120, integrator: 'yoshida4' }),
  butterfly: preset('Coreografia borboleta', 'Múltiplos',
    'Três massas iguais, a do meio parada no começo, desenham uma borboleta e voltam ao início a cada período: uma das órbitas periódicas descobertas por Šuvakov e Dmitrašinović em 2013, junto com a mariposa e o yin-yang. É instável: em 13 voltas os desvios já começam a crescer, e logo um encontro próximo desfaria a coreografia.', [
      body('Estrela A', butterflyMass, [-butterflyLength, 0, 0], [p1 * butterflySpeed, p2 * butterflySpeed, 0]),
      body('Estrela B', butterflyMass, [butterflyLength, 0, 0], [p1 * butterflySpeed, p2 * butterflySpeed, 0]),
      body('Estrela C', butterflyMass, [0, 0, 0], [-2 * p1 * butterflySpeed, -2 * p2 * butterflySpeed, 0])
    ], { timeStepSeconds: butterflyPeriod / 100000, steps: 1360000, sampleEverySteps: 1362, integrator: 'yoshida4' }),
  sitnikov: preset('Problema de Sitnikov', 'Múltiplos',
    'Duas estrelas iguais numa órbita excêntrica (e = 0,2) e dois planetas sobre o eixo perpendicular, soltos a 1,55 UA e a só 15 mil km um do outro: atravessam o plano da binária de forma caótica, andam juntos por quase 30 anos e depois seguem caminhos diferentes. Gire a vista.', [
      ...binary(sunMass, sunMass, sitnikovAxis * (1 + sitnikovEccentricity), ['Estrela A', 'Estrela B']).map(([name, mass, r, v]) =>
        [name, mass, r, v.map(value => value * Math.sqrt(1 - sitnikovEccentricity))]),
      body('Planeta 1', 0, [0, 0, sitnikovHeight], [0, 0, 0]),
      body('Planeta 2', 0, [0, 0, sitnikovHeight + 1.5e7], [0, 0, 0])
    ], { timeStepSeconds: 0.5 * day, steps: 43830, sampleEverySteps: 44, integrator: 'yoshida4' }),
  routhLimit: preset('Limite de Routh', 'Múltiplos',
    'Um planeta com 5% da massa do sistema, acima do limite de Routh (3,85%): os pontos L4 e L5 deixam de ser estáveis e os troianos, colocados 0,1% fora deles, fogem em poucas voltas. Com Júpiter (0,1%), os troianos ficam presos por bilhões de anos.', [
      body('Estrela', sunMass, [routhSun, 0, 0], [0, routhRate * routhSun, 0]),
      body('Planeta', routhPlanet, [routhX, 0, 0], [0, routhRate * routhX, 0]),
      atLagrange('Troiano em L4', 60), atLagrange('Troiano em L5', -60)
    ], { timeStepSeconds: routhPeriod / 500, steps: 15000, sampleEverySteps: 15, integrator: 'yoshida4', view: 'rotating' }),
  kozaiLidov: preset('Efeito Kozai–Lidov', 'Múltiplos',
    'Um planeta a 3 UA, inclinado 65° em relação à órbita de uma estrela companheira a 30 UA, troca inclinação por excentricidade: a órbita estica até e ≈ 0,8 e depois volta, em ciclos de milhares de anos. Amostrado a cada 1,025 volta do planeta: o desenho mostra a forma da órbita mudando.', [
      at('Estrela', sunMass),
      orbit('Planeta', jupiterMass, 'Estrela', kozaiInner, 0.01, { inclination: 65 }),
      orbit('Companheira', sunMass, 'Estrela', 30 * AU, 0, { anomaly: 90 })
    ], { timeStepSeconds: kozaiStep, steps: 2050000, sampleEverySteps: 2050, integrator: 'yoshida4' }),
  hillsMechanism: preset('Mecanismo de Hills', 'Múltiplos',
    'Uma binária de duas estrelas de 3 massas solares cai em direção a Sgr A*: a maré do buraco negro separa o par, prende uma estrela numa órbita excêntrica, como as estrelas S, e lança a outra a mais de 1.000 km/s, uma estrela de hipervelocidade.', [
      at('Sgr A*', blackHoleMass),
      ...hillsBinary(0)
    ], { timeStepSeconds: 0.1 * day, steps: 36500, sampleEverySteps: 37, integrator: 'yoshida4' }),
  rocheLimit: preset('Limite de Roche: uma lua vira anel', 'Partículas',
    'Uma lua de entulho dentro do limite de Roche de Saturno: a maré arranca o material pelas duas extremidades, e ele se espalha ao longo da órbita até formar um anel (hipótese de origem dos anéis). O núcleo tem massa; o entulho são partículas sem massa.', [
      saturn(),
      orbit('Lua de entulho', rocheMoon, 'Saturno', rocheDistance)
    ], { timeStepSeconds: 100, steps: 26000, sampleEverySteps: 100, integrator: 'yoshida4',
      particleGroups: [{ name: 'Entulho', around: 'Lua de entulho', count: 1500, innerRadiusMeters: 1e5, outerRadiusMeters: 2.6e5 }] }),
  milkyWayAndromeda: preset('Via Láctea e Andrômeda', 'Partículas',
    'Andrômeda se aproxima a 110 km/s e passa a cerca de 100 mil parsecs da Via Láctea em 4,3 bilhões de anos, arrancando caudas de maré dos dois discos. Com núcleos pontuais, sem halo de matéria escura extenso, falta o atrito dinâmico que na realidade leva à fusão.', [
      at('Via Láctea', milkyWay),
      body('Andrômeda', andromeda, [770 * kiloparsec, 0, 0], [-110e3, 57e3, 0])
    ], { softeningMeters: kiloparsec, timeStepSeconds: 0.5e6 * year, steps: 12000, sampleEverySteps: 60, integrator: 'yoshida4',
      particleGroups: [
        { name: 'Disco da Via Láctea', around: 'Via Láctea', count: 950, innerRadiusMeters: 4 * kiloparsec, outerRadiusMeters: 20 * kiloparsec },
        { name: 'Disco de Andrômeda', around: 'Andrômeda', count: 950, innerRadiusMeters: 4 * kiloparsec, outerRadiusMeters: 25 * kiloparsec,
          inclinationDegrees: 77, ascendingNodeDegrees: 40 }
      ] }),
  sagittarius: preset('Corrente de Sagitário', 'Partículas',
    'A galáxia anã de Sagitário, numa órbita polar em torno da Via Láctea, perde estrelas a cada passagem pelo pericentro, a 15 mil parsecs: em 4 bilhões de anos forma uma corrente que dá voltas na Galáxia.', [
      at('Via Láctea', 5e11 * sunMass),
      orbit('Sagitário', 1e9 * sunMass, 'Via Láctea', 37.5 * kiloparsec, 0.6, { inclination: 90, anomaly: 180 })
    ], { softeningMeters: 0.1 * kiloparsec, timeStepSeconds: 0.5e6 * year, steps: 8000, sampleEverySteps: 40, integrator: 'yoshida4',
      particleGroups: [
        { name: 'Estrelas de Sagitário', around: 'Sagitário', count: 1300, innerRadiusMeters: 0.5 * kiloparsec, outerRadiusMeters: 3 * kiloparsec },
        { name: 'Disco da Via Láctea', around: 'Via Láctea', count: 600, innerRadiusMeters: 3 * kiloparsec, outerRadiusMeters: 15 * kiloparsec }
      ] })
};
