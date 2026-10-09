import { presets, presetDraft, toScenario } from '../web/src/scenario.mjs';

const apiUrl = process.env.ORBITALSIM_API_URL ?? 'http://127.0.0.1:5080';
let highestDrift = { key: '', value: 0 };

// Maneuvers, drag, the 1PN correction and inelastic merges change the energy by design,
// so those presets are reported but kept out of the conservation summary.
function nonConservative(scenario) {
  const physics = scenario.physics ?? {};
  return Boolean(scenario.maneuvers?.length || physics.atmosphereDensityKgPerCubicMeter ||
    physics.lightSpeedMetersPerSecond || physics.collisions);
}

for (const [key, preset] of Object.entries(presets)) {
  const scenario = toScenario(presetDraft(key));
  const response = await fetch(`${apiUrl}/api/simulations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario),
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`${key}: HTTP ${response.status}: ${await response.text()}`);
  const { samples, particleCount } = await response.json();
  const expected = 2 + Math.floor((scenario.steps - 1) / scenario.sampleEverySteps);
  if (samples.length !== expected || samples.at(-1).step !== scenario.steps)
    throw new Error(`${key}: amostras inesperadas (${samples.length}/${expected}).`);
  const particles = (scenario.particleGroups ?? []).reduce((total, group) => total + group.count, 0);
  if ((particleCount ?? 0) !== particles)
    throw new Error(`${key}: ${particleCount} partículas, esperado ${particles}.`);
  for (const sample of samples) {
    if (sample.bodies.length !== scenario.bodies.length ||
        !Number.isFinite(sample.diagnostics.energyJoules) ||
        sample.bodies.some(item => !['x', 'y', 'z'].every(axis =>
          Number.isFinite(item.positionMeters[axis]) &&
          Number.isFinite(item.velocityMetersPerSecond[axis]))))
      throw new Error(`${key}: resultado incompleto ou não finito.`);
    if (particles && Buffer.from(sample.particles ?? '', 'base64').length !== 12 * particles)
      throw new Error(`${key}: posições de partículas incompletas.`);
  }
  const initial = samples[0].diagnostics.energyJoules;
  const final = samples.at(-1).diagnostics.energyJoules;
  const drift = initial ? Math.abs((final - initial) / initial) : 0;
  const skip = nonConservative(scenario);
  if (!skip && drift > highestDrift.value) highestDrift = { key, value: drift };
  const events = samples.reduce((total, sample) => total + (sample.events?.length ?? 0), 0);
  console.log(`${key}: ${samples.length} amostras, deriva=${drift.toExponential(2)}` +
    `${skip ? ' (energia muda por projeto)' : ''}${events ? `, ${events} eventos` : ''}`);
}

console.log(`Validamos ${Object.keys(presets).length} cenários. Maior deriva entre os conservativos: ` +
  `${highestDrift.key} (${highestDrift.value.toExponential(2)}).`);
