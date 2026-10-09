// Laboratory scenarios: Earth orbits, maneuvers, classic N-body problems, extra physics and
// particle systems. Maneuver steps and Δv vectors are computed here from two-body formulas, so
// the burns stay consistent with each preset's time step.
import { AU, G, binary, body, center, centralMass, day, earthJ2, earthMass, earthRadius, jupiterMass, orbit,
  orbiter, preset, random, sunMass, year } from './presetHelpers.mjs';

const earthMu = G * earthMass;
const degree = Math.PI / 180;
const earth = (extra = {}) => ({ name: 'Terra', massKg: earthMass, positionMeters: [0, 0, 0],
  velocityMetersPerSecond: [0, 0, 0], radiusMeters: earthRadius, ...extra });
const ptBr = (value, digits = 0) => value.toLocaleString('pt-BR', { maximumFractionDigits: digits });
const visViva = (mu, r, a) => Math.sqrt(mu * (2 / r - 1 / a));
const circularSpeed = (mu, r) => Math.sqrt(mu / r);
// Prograde unit vector of a circular orbit in the xy plane at polar angle θ (radians).
const tangent = angle => [-Math.sin(angle), Math.cos(angle), 0];
const scale = (vector, factor) => vector.map(value => value * factor);
const burn = (name, step, vector) => ({ body: name, step, deltaVelocityMetersPerSecond: vector });

// --- Phasing rendezvous: the chaser starts 30° behind and drops into an orbit 1/12 shorter. ---
const phasingRadius = 7e6;
const phasingMotion = Math.sqrt(earthMu / phasingRadius ** 3);
const phasingPeriod = 2 * Math.PI / phasingMotion;
const phasingOrbit = phasingPeriod * 11 / 12;
const phasingStep = phasingOrbit / 1000; // one phasing orbit is exactly 1000 steps
const phasingAxis = phasingRadius * Math.pow(11 / 12, 2 / 3);
const phasingDelta = visViva(earthMu, phasingRadius, phasingAxis) - circularSpeed(earthMu, phasingRadius);
const phasingAngle = phasingMotion * 100 * phasingStep;

// --- Bi-elliptic versus Hohmann from 7.000 km to 105.000 km (apoapsis of the first ellipse 300.000 km). ---
const lowRadius = 7e6, highRadius = 1.05e8, farRadius = 3e8, transferStep = 45, firstBurn = 40;
const firstAxis = (lowRadius + farRadius) / 2, secondAxis = (farRadius + highRadius) / 2;
const hohmannAxis = (lowRadius + highRadius) / 2;
const halfPeriod = axis => Math.PI * Math.sqrt(axis ** 3 / earthMu);
const lowAngle = circularSpeed(earthMu, lowRadius) / lowRadius * firstBurn * transferStep;
const biellipticBurns = [
  visViva(earthMu, lowRadius, firstAxis) - circularSpeed(earthMu, lowRadius),
  visViva(earthMu, farRadius, secondAxis) - visViva(earthMu, farRadius, firstAxis),
  circularSpeed(earthMu, highRadius) - visViva(earthMu, highRadius, secondAxis)
];
const hohmannBurns = [
  visViva(earthMu, lowRadius, hohmannAxis) - circularSpeed(earthMu, lowRadius),
  circularSpeed(earthMu, highRadius) - visViva(earthMu, highRadius, hohmannAxis)
];
const secondBurnStep = firstBurn + Math.round(halfPeriod(firstAxis) / transferStep);
const thirdBurnStep = secondBurnStep + Math.round(halfPeriod(secondAxis) / transferStep);
const hohmannArrival = firstBurn + Math.round(halfPeriod(hohmannAxis) / transferStep);
const totalKm = burns => ptBr(burns.reduce((total, value) => total + Math.abs(value), 0) / 1000, 2);

// --- Plane change of 30° at 7.000 km: the velocity turns about the radial direction. ---
const planeStep = 5, planeBurn = 300;
const planeSpeed = circularSpeed(earthMu, lowRadius);
const planeAngle = planeSpeed / lowRadius * planeBurn * planeStep;
const planeChange = 30 * degree;
const planeDelta = [-Math.sin(planeAngle) * (Math.cos(planeChange) - 1), Math.cos(planeAngle) * (Math.cos(planeChange) - 1),
  Math.sin(planeChange)].map(value => value * planeSpeed);

// --- Translunar injection from a 200 km parking orbit after one revolution. ---
const moonMass = 7.342e22, moonDistance = 3.844e8;
const parkingRadius = earthRadius + 2e5;
const parkingPeriod = 2 * Math.PI * Math.sqrt(parkingRadius ** 3 / earthMu);
const lunarStep = 30;
const injectionStep = Math.round(parkingPeriod / lunarStep);
const injectionAngle = injectionStep * lunarStep * 2 * Math.PI / parkingPeriod;
const transferAxis = (parkingRadius + moonDistance) / 2;
const injectionDelta = visViva(earthMu, parkingRadius, transferAxis) - circularSpeed(earthMu, parkingRadius);
const moonPeriod = 2 * Math.PI * Math.sqrt(moonDistance ** 3 / (G * (earthMass + moonMass)));
// The Moon must reach the apogee point when the spacecraft does (plus a lead that sends it ahead of the Moon).
const moonPhase = (injectionAngle + Math.PI - 2 * Math.PI * (injectionStep * lunarStep + halfPeriod(transferAxis))
  / moonPeriod) / degree + 8;

// --- DART: Dimorphos slowed by 2,7 mm/s along its orbit, one day into the run. ---
const didymosMass = 5.36e11, dimorphosMass = 4.3e9, dimorphosDistance = 1189;
const dimorphosMotion = Math.sqrt(G * (didymosMass + dimorphosMass) / dimorphosDistance ** 3);
const dartStep = 60, dartImpact = 1440;
const dartDelta = scale(tangent(dimorphosMotion * dartImpact * dartStep), -2.7e-3);

// --- Sun–Earth Lagrange points (circular restricted problem around the barycentre). ---
const earthSunTotal = sunMass + earthMass;
const sunX = -AU * earthMass / earthSunTotal, earthX = AU * sunMass / earthSunTotal;
const earthOrbitRate = Math.sqrt(G * earthSunTotal / AU ** 3);
const collinearForce = x => -G * sunMass * Math.sign(x - sunX) / (x - sunX) ** 2
  - G * earthMass * Math.sign(x - earthX) / (x - earthX) ** 2 + earthOrbitRate ** 2 * x;
function bisect(f, low, high) {
  for (let i = 0; i < 200; i++) {
    const middle = (low + high) / 2;
    if (Math.sign(f(middle)) === Math.sign(f(low))) low = middle; else high = middle;
  }
  return (low + high) / 2;
}
const lagrange1 = bisect(collinearForce, earthX - 0.05 * AU, earthX - 1e6);
const lagrange2 = bisect(collinearForce, earthX + 1e6, earthX + 0.05 * AU);
const corotating = (name, x, y) => body(name, 0, [x, y, 0], [-earthOrbitRate * y, earthOrbitRate * x, 0]);
const lagrange4 = [sunX + AU / 2, AU * Math.sqrt(3) / 2];

// --- Figure-eight choreography (Chenciner–Montgomery), scaled to M = 10²⁴ kg and L = 10⁷ m. ---
const eightMass = 1e24, eightLength = 1e7;
const eightSpeed = Math.sqrt(G * eightMass / eightLength);
const eightBody = (name, [x, y], [vx, vy]) => body(name, eightMass, [x * eightLength, y * eightLength, 0],
  [vx * eightSpeed, vy * eightSpeed, 0]);
const eightPeriod = 6.32591398 * eightLength / eightSpeed;

// --- Lagrange equilateral and Euler collinear solutions for three equal masses. ---
const equalMass = 1e23, triangleRadius = 4e6;
const triangleSide = triangleRadius * Math.sqrt(3);
const triangleRate = Math.sqrt(G * 3 * equalMass / triangleSide ** 3);
const triangle = [90, 210, 330].map((angle, index) => body(`Estrela ${'ABC'[index]}`, equalMass,
  [triangleRadius * Math.cos(angle * degree), triangleRadius * Math.sin(angle * degree), 0],
  // Star C starts 0,1% faster: the equal-mass triangle is unstable and the error grows.
  scale(tangent(angle * degree), triangleRate * triangleRadius * (index === 2 ? 1.001 : 1))));
const eulerSpeed = Math.sqrt(5 * G * equalMass / (4 * triangleRadius));

// --- Burrau's Pythagorean problem: masses 3, 4, 5 at rest at the corners of a 3-4-5 triangle. ---
const unitMass = 1e23, unitLength = 1e7;
const pythagorean = [[3, 1, 3], [4, -2, -1], [5, 1, -1]].map(([mass, x, y]) =>
  body(`Massa ${mass}`, mass * unitMass, [x * unitLength, y * unitLength, 0], [0, 0, 0]));
const unitTime = unitLength / Math.sqrt(G * unitMass / unitLength);

// --- Star clusters: Plummer sphere in virial equilibrium and a cold uniform sphere. ---
const parsec = 3.0857e16, solarStar = 2e30, clusterSize = 30;
function centred(bodies) {
  const mass = bodies.reduce((total, item) => total + item[1], 0);
  const mean = index => [0, 1, 2].map(axis => bodies.reduce((total, item) => total + item[1] * item[index][axis], 0) / mass);
  const [position, velocity] = [mean(2), mean(3)];
  return bodies.map(([name, m, r, v]) => [name, m, r.map((value, axis) => value - position[axis]),
    v.map((value, axis) => value - velocity[axis])]);
}
function direction(next) {
  const z = 2 * next() - 1, angle = 2 * Math.PI * next(), radial = Math.sqrt(1 - z * z);
  return [radial * Math.cos(angle), radial * Math.sin(angle), z];
}
function plummer(count, radius, mass, seed) {
  const next = random(seed);
  const scaleSpeed = Math.sqrt(G * count * mass / radius);
  return centred(Array.from({ length: count }, (_, index) => {
    let r;
    do r = 1 / Math.sqrt(Math.pow(Math.max(next(), 1e-6), -2 / 3) - 1); while (r > 8);
    let q, g;
    do { q = next(); g = 0.1 * next(); } while (g > q * q * Math.pow(1 - q * q, 3.5));
    const speed = q * Math.SQRT2 * Math.pow(1 + r * r, -0.25);
    return body(`Estrela ${index + 1}`, mass, scale(direction(next), r * radius), scale(direction(next), speed * scaleSpeed));
  }));
}
function coldSphere(count, radius, mass, seed) {
  const next = random(seed);
  return centred(Array.from({ length: count }, (_, index) =>
    body(`Estrela ${index + 1}`, mass, scale(direction(next), radius * Math.cbrt(next())), [0, 0, 0])));
}
const plummerTime = Math.sqrt(parsec ** 3 / (G * clusterSize * solarStar));
const collapseTime = Math.PI / 2 * Math.sqrt(parsec ** 3 / (2 * G * clusterSize * solarStar));

// --- Hierarchical quadruple: two binaries on a circular outer orbit. ---
function quadruple() {
  const [a1, a2, b1, b2] = [1e23, 8e22, 9e22, 7e22];
  const massA = a1 + a2, massB = b1 + b2, outer = 2e7;
  const outerSpeed = Math.sqrt(G * (massA + massB) / outer);
  const xA = -outer * massB / (massA + massB), xB = outer * massA / (massA + massB);
  const vA = -outerSpeed * massB / (massA + massB), vB = outerSpeed * massA / (massA + massB);
  return [...binary(a1, a2, 2e6, ['Estrela Aa', 'Estrela Ab'], [xA, 0, 0, 0, vA, 0]),
    ...binary(b1, b2, 1.6e6, ['Estrela Ba', 'Estrela Bb'], [xB, 0, 0, 0, vB, 0])];
}

// --- Hill sphere of a planet of 10²⁵ kg at 10¹⁰ m from a star of 10³⁰ kg. ---
const hillStar = 1e30, hillPlanet = 1e25, hillDistance = 1e10;
const hillRadius = hillDistance * Math.cbrt(hillPlanet / (3 * hillStar));

// --- Gravity assist: a probe crosses Jupiter's orbit on a hyperbola about Jupiter. ---
const jupiterMu = G * jupiterMass;
const assistInfinity = 1e4, assistPeriapsis = 5 * 7.1492e7;
const assistAxis = -jupiterMu / assistInfinity ** 2;

// --- Shoemaker-Levy 9: 21 fragments on a jovicentric orbit with perijove inside Jupiter. ---
const fragmentNames = 'ABCDEFGHJKLMNPQRSTUVW'.split('');
const fragmentAxis = 2.5e10, fragmentEccentricity = 1 - 3e7 / 2.5e10;

const marsRadius = 3.3895e6, marsMass = 6.4171e23;
const marsHyperbola = (name, periapsisAltitude, extra) => {
  const axis = -G * marsMass / 3000 ** 2;
  return orbit(name, 1000, 'Marte', axis, 1 - (marsRadius + periapsisAltitude) / axis, { anomaly: -110 }, extra);
};

export const laboratoryPresets = {
  geostationary: preset('Satélites geoestacionários', 'Órbitas',
    'Três satélites a 35.786 km de altitude completam uma volta em um dia sideral (23 h 56 min) e ficam parados sobre o equador.', [
      earth(), ...[0, 120, 240].map(phase => orbit(`GEO ${phase}°`, 3000, 'Terra', 4.2164e7, 0, { anomaly: phase }))
    ], { timeStepSeconds: 60, steps: 1440, sampleEverySteps: 2, integrator: 'yoshida4' }),
  gps: preset('Constelação GPS', 'Órbitas',
    '24 satélites em seis planos inclinados a 55°, a 20.200 km de altitude, com período de meio dia sideral.', [
      earth(), ...Array.from({ length: 24 }, (_, index) => {
        const plane = Math.floor(index / 4), slot = index % 4;
        return orbit(`GPS ${'ABCDEF'[plane]}${slot + 1}`, 2000, 'Terra', 2.656e7, 0,
          { inclination: 55, node: plane * 60, anomaly: slot * 90 + plane * 15 });
      })
    ], { timeStepSeconds: 30, steps: 2880, sampleEverySteps: 3, integrator: 'yoshida4' }),
  leoConstellation: preset('Constelação em órbita baixa', 'Órbitas',
    '30 satélites em cinco planos a 550 km e 53°, como as camadas das constelações de internet: uma volta a cada 95 minutos.', [
      earth(), ...Array.from({ length: 30 }, (_, index) => {
        const plane = Math.floor(index / 6), slot = index % 6;
        return orbit(`Plano ${plane + 1} · ${slot + 1}`, 260, 'Terra', earthRadius + 5.5e5, 0,
          { inclination: 53, node: plane * 72, anomaly: slot * 60 + plane * 12 });
      })
    ], { timeStepSeconds: 5, steps: 2160, sampleEverySteps: 3, integrator: 'yoshida4' }),
  lunarOrbiter: preset('Sondas em órbita lunar', 'Órbitas',
    'Uma sonda polar a 50 km, como a LRO, e outra equatorial a 100 km: sem atmosfera, a Lua permite órbitas baixíssimas de menos de 2 horas.', [
      { name: 'Lua', massKg: moonMass, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: 1.7374e6 },
      orbit('Sonda polar (50 km)', 0, 'Lua', 1.7374e6 + 5e4, 0, { inclination: 90 }),
      orbit('Sonda equatorial (100 km)', 0, 'Lua', 1.7374e6 + 1e5, 0, { anomaly: 180 })
    ], { timeStepSeconds: 10, steps: 8640, sampleEverySteps: 9, integrator: 'yoshida4' }),

  phasing: preset('Encontro orbital', 'Experimentos',
    `O perseguidor começa 30° atrás do alvo, freia ${ptBr(Math.abs(phasingDelta), 1)} m/s para uma órbita mais curta, dá uma volta e acelera de novo exatamente ao lado do alvo.`, [
      body('Terra', earthMass, [0, 0, 0], [0, 0, 0]),
      orbit('Alvo', 0, 'Terra', phasingRadius, 0, { anomaly: 30 }),
      orbit('Perseguidor', 0, 'Terra', phasingRadius)
    ], { timeStepSeconds: phasingStep, steps: 2200, sampleEverySteps: 3, integrator: 'yoshida4',
      maneuvers: [burn('Perseguidor', 100, scale(tangent(phasingAngle), phasingDelta)),
        burn('Perseguidor', 1100, scale(tangent(phasingAngle), -phasingDelta))] }),
  bielliptic: preset('Bi-elíptica contra Hohmann', 'Experimentos',
    `De 7.000 km a 105.000 km: a Hohmann gasta ${totalKm(hohmannBurns)} km/s em 18 horas; a bi-elíptica, passando por 300.000 km, gasta ${totalKm(biellipticBurns)} km/s, mas leva quase 9 dias.`, [
      body('Terra', earthMass, [0, 0, 0], [0, 0, 0]),
      orbit('Bi-elíptica', 0, 'Terra', lowRadius),
      orbit('Hohmann', 0, 'Terra', lowRadius, 0, { anomaly: 180 })
    ], { timeStepSeconds: transferStep, steps: 19000, sampleEverySteps: 19, integrator: 'yoshida4',
      maneuvers: [
        burn('Bi-elíptica', firstBurn, scale(tangent(lowAngle), biellipticBurns[0])),
        burn('Hohmann', firstBurn, scale(tangent(lowAngle + Math.PI), hohmannBurns[0])),
        burn('Hohmann', hohmannArrival, scale(tangent(lowAngle), hohmannBurns[1])),
        burn('Bi-elíptica', secondBurnStep, scale(tangent(lowAngle + Math.PI), biellipticBurns[1])),
        burn('Bi-elíptica', thirdBurnStep, scale(tangent(lowAngle), biellipticBurns[2]))
      ] }),
  planeChange: preset('Mudança de plano orbital', 'Experimentos',
    `Girar a órbita em 30° a 7.000 km custa ${ptBr(Math.hypot(...planeDelta), 0)} m/s (2·v·sen 15°), mais que ir da órbita baixa à geoestacionária em altitude. Compare com a sonda que segue no equador.`, [
      body('Terra', earthMass, [0, 0, 0], [0, 0, 0]),
      orbit('Sonda que muda de plano', 0, 'Terra', lowRadius),
      orbit('Sonda no equador', 0, 'Terra', lowRadius, 0, { anomaly: 180 })
    ], { timeStepSeconds: planeStep, steps: 2400, sampleEverySteps: 3, integrator: 'yoshida4',
      maneuvers: [burn('Sonda que muda de plano', planeBurn, planeDelta)] }),
  gravityAssist: preset('Estilingue gravitacional', 'Experimentos',
    'Uma sonda numa elipse presa ao Sol passa por trás de Júpiter, a 5 raios do planeta, e rouba um pouco do seu movimento: sai a 23 km/s, em trajetória de escape do Sistema Solar. Selecione a sonda e compare a órbita antes e depois.', [
      body('Sol', sunMass, [0, 0, 0], [0, 0, 0]),
      orbit('Júpiter', jupiterMass, 'Sol', 5.2026 * AU, 0, {}, { radiusMeters: 7.1492e7 }),
      orbit('Sonda', 0, 'Júpiter', assistAxis, 1 - assistPeriapsis / assistAxis, { argument: 300, anomaly: -120 })
    ], { timeStepSeconds: 300, steps: 17280, sampleEverySteps: 18, integrator: 'yoshida4' }),
  deorbit: preset('Reentrada controlada', 'Experimentos',
    'Um freio de 110 m/s baixa o perigeu da cápsula para 25 km, dentro da atmosfera didática, e o arrasto termina a descida. O satélite vizinho segue em órbita.', [
      earth(),
      orbit('Cápsula', 1000, 'Terra', earthRadius + 4e5, 0, {}, { radiusMeters: 2, dragAreaPerMassSquareMetersPerKg: 0.1 }),
      orbit('Satélite vizinho', 1000, 'Terra', earthRadius + 4e5, 0, { anomaly: 180 }, { radiusMeters: 2, dragAreaPerMassSquareMetersPerKg: 0.1 })
    ], { timeStepSeconds: 10, steps: 8640, sampleEverySteps: 9, integrator: 'yoshida4',
      physics: { centralBody: 'Terra', centralRadiusMeters: earthRadius, atmosphereDensityKgPerCubicMeter: 7e-9,
        atmosphereScaleHeightMeters: 6e4, collisions: true },
      maneuvers: [burn('Cápsula', 300, scale(tangent(circularSpeed(earthMu, earthRadius + 4e5) / (earthRadius + 4e5) * 3000), -110))] }),
  translunar: preset('Rumo à Lua', 'Experimentos',
    `Após uma volta na órbita de estacionamento a 200 km, a nave acelera ${ptBr(injectionDelta, 0)} m/s e sobe até a distância da Lua em cerca de 4 dias. Ela passa a menos de 100 km da superfície lunar e é desviada para longe da Terra.`, [
      earth(),
      orbit('Lua', moonMass, 'Terra', moonDistance, 0, { anomaly: moonPhase }, { radiusMeters: 1.7374e6 }),
      orbit('Nave', 0, 'Terra', parkingRadius)
    ], { timeStepSeconds: lunarStep, steps: 17280, sampleEverySteps: 18, integrator: 'yoshida4',
      physics: { collisions: true },
      maneuvers: [burn('Nave', injectionStep, scale(tangent(injectionAngle), injectionDelta))] }),
  oberth: preset('Efeito Oberth', 'Experimentos',
    'Duas sondas na mesma elipse aplicam o mesmo Δv de 500 m/s. A que queima no perigeu, onde vai mais rápido, ganha 5 vezes mais energia: o apogeu salta de 42 mil para 123 mil km, enquanto a outra só ergue o perigeu de 7 mil para 13 mil km.', [
      body('Terra', earthMass, [0, 0, 0], [0, 0, 0]),
      orbit('Queima no perigeu', 0, 'Terra', 2.45e7, 5 / 7),
      orbit('Queima no apogeu', 0, 'Terra', 2.45e7, 5 / 7, { anomaly: 180 })
    ], { timeStepSeconds: 20, steps: 8640, sampleEverySteps: 9, integrator: 'yoshida4',
      maneuvers: [burn('Queima no perigeu', 0, [0, 500, 0]), burn('Queima no apogeu', 0, [0, -500, 0])] }),
  dart: preset('Missão DART', 'Experimentos',
    'Em 2022 a sonda DART atingiu Dimorphos: um freio de só 2,7 mm/s encurtou a órbita em torno de Didymos de 11 h 55 min para cerca de 11 h 23 min. Veja o período no painel do corpo.', [
      ...binary(didymosMass, dimorphosMass, dimorphosDistance, ['Didymos', 'Dimorphos'])
    ].map((item, index) => withRadius(item, index ? 75 : 390)),
    { timeStepSeconds: dartStep, steps: 5760, sampleEverySteps: 6, integrator: 'yoshida4',
      maneuvers: [burn('Dimorphos', dartImpact, dartDelta)] }),
  equalPeriod: preset('Mesmo semi-eixo, mesmo período', 'Experimentos',
    'Quatro órbitas com o mesmo semi-eixo e excentricidades de 0 a 0,85: todas têm a mesma energia e voltam juntas ao ponto de partida.', [
      center(), ...[0, 0.3, 0.6, 0.85].map((e, index) =>
        orbit(`e = ${String(e).replace('.', ',')}`, 0, 'Estrela', 5e6, e, { argument: index * 90 }))
    ], { timeStepSeconds: 5, steps: 10877, sampleEverySteps: 11, integrator: 'yoshida4' }),
  radialFall: preset('Queda radial', 'Experimentos',
    'Um corpo solto em repouso cai em linha reta até colidir com a estrela; outro, com um leve empurrão lateral, passa raspando e volta.', [
      { name: 'Estrela', massKg: centralMass, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: 3e5 },
      { name: 'Em repouso', massKg: 1e12, positionMeters: [5e6, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: 1e4 },
      { name: 'Empurrão lateral', massKg: 1e12, positionMeters: [-5e6, 0, 0], velocityMetersPerSecond: [0, -500, 0], radiusMeters: 1e4 }
    ], { timeStepSeconds: 1, steps: 12000, sampleEverySteps: 12, integrator: 'yoshida4', physics: { collisions: true } }),
  hillSphere: preset('Esfera de Hill', 'Experimentos',
    `Luas a 0,25, 0,4 e 0,8 do raio de Hill do planeta (${ptBr(hillRadius / 1e6, 0)} mil km): as internas continuam presas; a externa é arrancada pela estrela.`, [
      center('Estrela', hillStar),
      orbit('Planeta', hillPlanet, 'Estrela', hillDistance),
      ...[0.25, 0.4, 0.8].map((fraction, index) => orbit(`Lua a ${String(fraction).replace('.', ',')} r_H`, 0, 'Planeta',
        fraction * hillRadius, 0, { anomaly: index * 120 }))
    ], { timeStepSeconds: 360, steps: 8545, sampleEverySteps: 9, integrator: 'yoshida4', view: 'rotating' }),
  lagrangePoints: preset('Pontos de Lagrange Sol–Terra', 'Experimentos',
    'Sondas paradas em L1, L2 e L4 no referencial que gira com a Terra: L1 e L2 são instáveis (SOHO e JWST precisam de correções); L4 é estável.', [
      ...binary(sunMass, earthMass, AU, ['Sol', 'Terra']),
      corotating('Sonda em L1', lagrange1, 0), corotating('Sonda em L2', lagrange2, 0),
      corotating('Sonda em L4', ...lagrange4)
    ], { timeStepSeconds: 10800, steps: 5844, sampleEverySteps: 6, integrator: 'yoshida4', view: 'rotating' }),

  figureEight: preset('Coreografia em oito', 'Múltiplos',
    'Três massas iguais perseguem-se sobre a mesma curva em forma de oito (Chenciner e Montgomery, 2000): uma solução periódica e estável.', [
      eightBody('Estrela A', [0.97000436, -0.24308753], [0.466203685, 0.43236573]),
      eightBody('Estrela B', [-0.97000436, 0.24308753], [0.466203685, 0.43236573]),
      eightBody('Estrela C', [0, 0], [-0.93240737, -0.86473146])
    ], { timeStepSeconds: eightPeriod / 2400, steps: 7200, sampleEverySteps: 8, integrator: 'yoshida4' }),
  lagrangeTriangle: preset('Triângulo de Lagrange', 'Múltiplos',
    'Três massas iguais nos vértices de um triângulo equilátero giram como um corpo rígido. Para massas iguais a solução é instável: 0,1% a mais de velocidade numa estrela basta para desfazê-la.',
    triangle, { timeStepSeconds: 10, steps: 12800, sampleEverySteps: 13, integrator: 'yoshida4' }),
  eulerCollinear: preset('Solução colinear de Euler', 'Múltiplos',
    'Três massas iguais alinhadas, a do meio parada: giram juntas, mas a do meio começa só 1 km fora da linha e o desvio cresce até a configuração se desfazer.', [
      body('Estrela A', equalMass, [-triangleRadius, 0, 0], [0, -eulerSpeed, 0]),
      body('Estrela B', equalMass, [0, 1e3, 0], [0, 0, 0]), // 1 km off the line seeds the instability
      body('Estrela C', equalMass, [triangleRadius, 0, 0], [0, eulerSpeed, 0])
    ], { timeStepSeconds: 8, steps: 13000, sampleEverySteps: 13, integrator: 'yoshida4' }),
  pythagorean: preset('Problema pitagórico', 'Múltiplos',
    'Massas 3, 4 e 5 em repouso nos vértices de um triângulo 3-4-5 (Burrau, 1913): encontros caóticos até que 4 e 5 formam uma binária e expulsam a massa 3, como no resultado clássico. Com passo fixo, usa amaciamento de 0,1 unidade.',
    pythagorean, { softeningMeters: 0.1 * unitLength, timeStepSeconds: 70 * unitTime / 20000, steps: 20000,
      sampleEverySteps: 20, integrator: 'yoshida4' }),
  plummerCluster: preset('Aglomerado estelar', 'Múltiplos',
    'Trinta estrelas de 1 massa solar numa esfera de Plummer em equilíbrio virial: o aglomerado pulsa, troca energia e às vezes evapora uma estrela.',
    plummer(clusterSize, parsec, solarStar, 7), { softeningMeters: 0.05 * parsec, timeStepSeconds: plummerTime / 1000,
      steps: 10000, sampleEverySteps: 10, integrator: 'yoshida4' }),
  coldCollapse: preset('Colapso frio', 'Múltiplos',
    'Trinta estrelas em repouso numa esfera caem juntas, ricocheteiam e se acomodam num aglomerado: relaxação violenta em poucos tempos de queda livre.',
    coldSphere(clusterSize, parsec, solarStar, 31), { softeningMeters: 0.05 * parsec, timeStepSeconds: 4 * collapseTime / 15000,
      steps: 15000, sampleEverySteps: 15, integrator: 'yoshida4' }),
  stellarFlyby: preset('Estrela intrusa', 'Múltiplos',
    'Uma estrela de meia massa solar cruza o Sistema Solar a 4 UA do Sol: Júpiter e Saturno são fortemente perturbados; a Terra quase não sente.', [
      body('Sol', sunMass, [0, 0, 0], [0, 0, 0]),
      orbiter('Terra', earthMass, AU, 0, 1, 0, sunMass), orbiter('Marte', 6.4171e23, 1.524 * AU, 70, 1, 0, sunMass),
      orbiter('Júpiter', jupiterMass, 5.203 * AU, 160, 1, 0, sunMass), orbiter('Saturno', 5.6834e26, 9.537 * AU, 250, 1, 0, sunMass),
      orbit('Estrela intrusa', 0.5 * sunMass, 'Sol', -G * 1.5 * sunMass / 2e4 ** 2, 1 + 4 * AU * 2e4 ** 2 / (G * 1.5 * sunMass),
        { inclination: 30, argument: 200, anomaly: -110 })
    ], { timeStepSeconds: day, steps: 10957, sampleEverySteps: 11, integrator: 'yoshida4' }),
  quadruple: preset('Sistema quádruplo', 'Múltiplos',
    'Duas binárias apertadas giram uma em torno da outra, como em Épsilon Lyrae, a "dupla dupla" (massas ilustrativas).',
    quadruple(), { timeStepSeconds: 10, steps: 16500, sampleEverySteps: 17, integrator: 'yoshida4' }),
  circumbinaryLimit: preset('Limite de estabilidade circumbinário', 'Múltiplos',
    'Perto demais da binária (1,3 vez a separação) o planeta é desestabilizado e expulso ou engolido; a 3,5 vezes ele segue estável.', [
      ...binary(1e23, 1e23, 4e6).map(item => withRadius(item, 2e5)),
      withRadius(orbiter('Planeta instável', 1e16, 5.2e6, 90, 1, 0, 2e23), 1e4),
      withRadius(orbiter('Planeta estável', 1e16, 1.4e7, 270, 1, 0, 2e23), 1e4)
    ], { timeStepSeconds: 12, steps: 17200, sampleEverySteps: 18, integrator: 'yoshida4', physics: { collisions: true } }),
  alphaCentauri: preset('Alfa Centauri A e B', 'Múltiplos',
    'A binária mais próxima do Sol (79,9 anos, e = 0,52) com um planeta hipotético a 1,25 UA de A: a companheira chega a 11 UA, mas o planeta resiste.', [
      { name: 'Alfa Centauri A', massKg: 1.1 * sunMass, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: 8.5e8 },
      orbit('Alfa Centauri B', 0.907 * sunMass, 'Alfa Centauri A', 23.4 * AU, 0.5179, {}, { radiusMeters: 6e8 }),
      orbit('Planeta hipotético', earthMass, 'Alfa Centauri A', 1.25 * AU, 0, { anomaly: 90 })
    ], { timeStepSeconds: 80 * year / 20000, steps: 20000, sampleEverySteps: 20, integrator: 'yoshida4' }),

  perigeeJ2: preset('Avanço do perigeu (J2)', 'Física',
    'O J2 também gira o perigeu: ≈ 9°/dia a 10° de inclinação, nada na inclinação crítica de 63,4° (por isso a usam as órbitas Molniya) e para trás na polar.', [
      body('Terra', earthMass, [0, 0, 0], [0, 0, 0]),
      ...[[10, 'Inclinação 10°'], [63.435, 'Inclinação crítica 63,4°'], [90, 'Polar 90°']].map(([inclination, name], index) =>
        orbit(name, 1000, 'Terra', 8e6, 0.1, { inclination, node: index * 120, anomaly: index * 120 }))
    ], { timeStepSeconds: 20, steps: 8640, sampleEverySteps: 9, integrator: 'yoshida4',
      physics: { centralBody: 'Terra', j2: earthJ2, centralRadiusMeters: earthRadius } }),
  dragCircularize: preset('Circularização por arrasto', 'Física',
    'Perigeu a 150 km, apogeu a 2.000 km: o arrasto atua quase só no perigeu e derruba o apogeu, deixando a órbita mais circular. O balão (A/m 10× maior) circulariza e reentra em cerca de 38 horas; o compacto mal muda.', [
      earth(),
      orbit('Satélite-balão', 50, 'Terra', earthRadius + 1.075e6, 1.85e6 / (2 * earthRadius + 2.15e6), {},
        { radiusMeters: 10, dragAreaPerMassSquareMetersPerKg: 1 }),
      orbit('Satélite compacto', 500, 'Terra', earthRadius + 1.075e6, 1.85e6 / (2 * earthRadius + 2.15e6), { anomaly: 180 },
        { radiusMeters: 1, dragAreaPerMassSquareMetersPerKg: 0.1 })
    ], { timeStepSeconds: 20, steps: 8640, sampleEverySteps: 9, integrator: 'yoshida4',
      physics: { centralBody: 'Terra', centralRadiusMeters: earthRadius, atmosphereDensityKgPerCubicMeter: 7e-9,
        atmosphereScaleHeightMeters: 6e4, collisions: true } }),
  s2SgrA: preset('Estrela S2 e Sgr A*', 'Física',
    'A estrela S2 orbita o buraco negro do centro da Galáxia em 16 anos, chegando a 120 UA. Com a velocidade da luz real, a correção 1PN avança o pericentro ≈ 0,2° por volta, como mediu o GRAVITY (2020).', [
      { name: 'Sgr A*', massKg: 4.297e6 * sunMass, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0] },
      orbit('S2', 14 * sunMass, 'Sgr A*', 1031 * AU, 0.8839, { anomaly: 180 })
    ], { timeStepSeconds: 5.07e4, steps: 20000, sampleEverySteps: 20, integrator: 'yoshida4',
      physics: { centralBody: 'Sgr A*', lightSpeedMetersPerSecond: 299792458 } }),
  theiaImpact: preset('Impacto de Theia', 'Física',
    'Hipótese do impacto gigante: um corpo do tamanho de Marte atinge a proto-Terra de raspão e os dois se fundem, conservando massa e momento.', [
      { name: 'Proto-Terra', massKg: 0.9 * earthMass, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: 6.1e6 },
      { name: 'Theia', massKg: 6.4e23, positionMeters: [6e7, 6e6, 2e6], velocityMetersPerSecond: [-4000, 0, 0], radiusMeters: 3.39e6 }
    ], { timeStepSeconds: 10, steps: 4000, sampleEverySteps: 4, integrator: 'yoshida4', physics: { collisions: true } }),
  softeningPass: preset('Atravessando com amaciamento', 'Física',
    'Com amaciamento ε = 2 × 10¹⁰ m a gravidade some no centro: os dois corpos caem um no outro, se atravessam sem colidir e oscilam.', [
      body('Corpo A', 1e30, [-5e10, 0, 0], [0, 0, 0]), body('Corpo B', 1e30, [5e10, 0, 0], [0, 0, 0])
    ], { softeningMeters: 2e10, timeStepSeconds: 2500, steps: 19600, sampleEverySteps: 20, integrator: 'yoshida4' }),
  aerocapture: preset('Aerocaptura em Marte', 'Física',
    'Duas sondas chegam a 3 km/s. A que mergulha a 65 km perde velocidade na atmosfera marciana (ρ₀ = 0,02 kg/m³, H = 11 km) e fica numa órbita de 23 h; a que passa a 300 km escapa. O corredor é estreito: a 60 km a sonda cai, a 70 km escapa.', [
      { name: 'Marte', massKg: marsMass, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: marsRadius },
      marsHyperbola('Sonda a 65 km', 6.5e4, { radiusMeters: 2, dragAreaPerMassSquareMetersPerKg: 0.01 }),
      marsHyperbola('Sonda a 300 km', 3e5, { radiusMeters: 2, dragAreaPerMassSquareMetersPerKg: 0.01 })
    ], { timeStepSeconds: 5, steps: 17280, sampleEverySteps: 18, integrator: 'yoshida4',
      physics: { centralBody: 'Marte', centralRadiusMeters: marsRadius, atmosphereDensityKgPerCubicMeter: 0.02,
        atmosphereScaleHeightMeters: 1.11e4, collisions: true } }),
  shoemakerLevy: preset('Shoemaker-Levy 9', 'Física',
    'Em julho de 1994, 21 fragmentos do cometa caíram em Júpiter um após o outro, durante horas. Cada impacto aparece como uma colisão.', [
      { name: 'Júpiter', massKg: jupiterMass, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: 7.1492e7 },
      ...fragmentNames.map((name, index) => orbit(`Fragmento ${name}`, 1e12, 'Júpiter', fragmentAxis, fragmentEccentricity,
        { inclination: 5, anomaly: -150 - index * 0.5 }, { radiusMeters: 1e3 }))
    ], { timeStepSeconds: 60, steps: 2880, sampleEverySteps: 3, integrator: 'yoshida4', physics: { collisions: true } }),

  tidalStream: preset('Aglomerado desfeito por maré', 'Partículas',
    'Um aglomerado de estrelas numa órbita excêntrica em torno de um buraco negro de 5 milhões de massas solares: a cada passagem a maré arranca uma corrente de estrelas.', [
      body('Buraco negro', 1e37, [0, 0, 0], [0, 0, 0]),
      orbit('Aglomerado', 1e35, 'Buraco negro', 3e19, 0.6, { anomaly: 180 })
    ], { timeStepSeconds: 8e12, steps: 10000, sampleEverySteps: 40, integrator: 'yoshida4',
      particleGroups: [{ name: 'Estrelas do aglomerado', around: 'Aglomerado', count: 1500, innerRadiusMeters: 5e17,
        outerRadiusMeters: 1.5e18, inclinationDegrees: 30 }] }),
  coorbitalCloud: preset('Nuvem coorbital de Júpiter', 'Partículas',
    'Partículas perto da órbita de Júpiter: as instáveis são varridas e restam as populações em girino (L4 e L5) e em ferradura, vistas no referencial de Júpiter.', [
      body('Sol', sunMass, [0, 0, 0], [0, 0, 0]),
      orbit('Júpiter', jupiterMass, 'Sol', 5.2026 * AU)
    ], { timeStepSeconds: 0.1 * year, steps: 20000, sampleEverySteps: 101, integrator: 'yoshida4', view: 'rotating',
      particleGroups: [{ name: 'Nuvem coorbital', around: 'Sol', count: 1900, innerRadiusMeters: 4.6 * AU, outerRadiusMeters: 5.8 * AU }] }),
  truncatedDisk: preset('Disco truncado por companheira', 'Partículas',
    'Um disco de partículas em torno da estrela A é cortado pela companheira excêntrica: só a parte interna, até cerca de um terço da separação, sobrevive.', [
      body('Estrela A', 1e30, [0, 0, 0], [0, 0, 0]),
      orbit('Estrela B', 5e29, 'Estrela A', 1e11, 0.3, { anomaly: 180 })
    ], { timeStepSeconds: 7700, steps: 20000, sampleEverySteps: 80, integrator: 'yoshida4',
      particleGroups: [{ name: 'Disco', around: 'Estrela A', count: 1500, innerRadiusMeters: 1e10, outerRadiusMeters: 6e10 }] }),
  inclinedRingsJ2: preset('Anéis inclinados e J2', 'Partículas',
    'Três anéis hipotéticos inclinados em torno de Saturno (J2 = 0,0163): cada raio precessa num ritmo diferente e os anéis se torcem até virar um toro.', [
      { name: 'Saturno', massKg: 5.6834e26, positionMeters: [0, 0, 0], velocityMetersPerSecond: [0, 0, 0], radiusMeters: 6.0268e7 }
    ], { timeStepSeconds: 450, steps: 19200, sampleEverySteps: 80, integrator: 'yoshida4',
      physics: { centralBody: 'Saturno', j2: 0.016298, centralRadiusMeters: 6.0268e7 },
      particleGroups: [
        { name: 'Anel a 10°', around: 'Saturno', count: 550, innerRadiusMeters: 1e8, outerRadiusMeters: 1.1e8, inclinationDegrees: 10 },
        { name: 'Anel a 20°', around: 'Saturno', count: 550, innerRadiusMeters: 1.3e8, outerRadiusMeters: 1.4e8, inclinationDegrees: 20 },
        { name: 'Anel a 30°', around: 'Saturno', count: 500, innerRadiusMeters: 1.6e8, outerRadiusMeters: 1.7e8, inclinationDegrees: 30 }
      ] }),
  cartwheel: preset('Galáxia Roda de Carro', 'Partículas',
    'Uma galáxia companheira atravessa o centro de um disco de frente: a onda de choque gravitacional espalha um anel de estrelas, como na galáxia Roda de Carro.', [
      body('Galáxia alvo', 2e41, [0, 0, 0], [0, 0, 0]),
      body('Intrusa', 6e40, [2e19, 0, 4e20], [0, 0, -3e4])
    ], { softeningMeters: 3e19, timeStepSeconds: 7e11, steps: 17000, sampleEverySteps: 68, integrator: 'yoshida4',
      particleGroups: [{ name: 'Disco', around: 'Galáxia alvo', count: 1500, innerRadiusMeters: 5e19, outerRadiusMeters: 2.5e20 }] }),
  kuiperBelt: preset('Cinturão de Kuiper e Netuno', 'Partículas',
    '20 mil anos de Netuno esculpindo o cinturão: a ressonância 3:2 (39,4 UA, os plutinos) protege objetos que cruzam sua órbita. Veja no referencial de Netuno.', [
      body('Sol', sunMass, [0, 0, 0], [0, 0, 0]),
      orbit('Netuno', 1.02413e26, 'Sol', 30.07 * AU)
    ], { timeStepSeconds: year, steps: 20000, sampleEverySteps: 101, integrator: 'yoshida4', view: 'rotating',
      particleGroups: [{ name: 'Cinturão de Kuiper', around: 'Sol', count: 1900, innerRadiusMeters: 33 * AU,
        outerRadiusMeters: 55 * AU, eccentricity: 0.1, inclinationDegrees: 5 }] })
};

// Vector-form body tuple with a physical radius (needed for collisions and drawn to scale).
function withRadius([name, massKg, positionMeters, velocityMetersPerSecond], radiusMeters) {
  return { name, massKg, positionMeters, velocityMetersPerSecond, radiusMeters };
}
