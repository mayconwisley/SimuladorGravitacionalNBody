import { presets, presetDraft, toScenario } from '../web/src/scenario.mjs';

const apiUrl = process.env.ORBITALSIM_API_URL ?? 'http://127.0.0.1:5080';
let highestDrift = { key: '', value: 0 };

for (const [key, preset] of Object.entries(presets)) {
  const scenario = toScenario(presetDraft(key));
  const response = await fetch(`${apiUrl}/api/simulations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario),
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`${key}: HTTP ${response.status}: ${await response.text()}`);
  const { samples } = await response.json();
  const expected = 2 + Math.floor((scenario.steps - 1) / scenario.sampleEverySteps);
  if (samples.length !== expected || samples.at(-1).step !== scenario.steps)
    throw new Error(`${key}: amostras inesperadas (${samples.length}/${expected}).`);
  for (const sample of samples) {
    if (sample.bodies.length !== scenario.bodies.length ||
        !Number.isFinite(sample.diagnostics.energyJoules) ||
        sample.bodies.some(item => !['x', 'y', 'z'].every(axis =>
          Number.isFinite(item.positionMeters[axis]) &&
          Number.isFinite(item.velocityMetersPerSecond[axis]))))
      throw new Error(`${key}: resultado incompleto ou não finito.`);
  }
  const initial = samples[0].diagnostics.energyJoules;
  const final = samples.at(-1).diagnostics.energyJoules;
  const drift = initial ? Math.abs((final - initial) / initial) : 0;
  if (drift > highestDrift.value) highestDrift = { key, value: drift };
  console.log(`${key}: ${samples.length} amostras, deriva=${drift.toExponential(2)}`);
}

console.log(`Validamos ${Object.keys(presets).length} cenários. Maior deriva: ${highestDrift.key} (${highestDrift.value.toExponential(2)}).`);
