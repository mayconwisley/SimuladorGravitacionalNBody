import { parseDiagnostics, parseEvents, parseParticles, parseTrajectory } from '../data.mjs';
import { createDataset } from './dataset.mjs';

// Builds a viewer dataset from CLI output files: trajectory.csv (required), diagnostics.csv,
// events.csv and particles.csv (optional). Imported data cannot be recomputed.
export async function datasetFromFiles(fileList) {
  const files = new Map([...fileList].map(file => [file.name.toLowerCase(), file]));
  const trajectory = files.get('trajectory.csv');
  if (!trajectory) throw new Error('Selecione trajectory.csv. diagnostics.csv, events.csv e particles.csv são opcionais.');
  const text = name => files.get(name)?.text() ?? Promise.resolve('');
  const parsed = parseTrajectory(await trajectory.text());
  const particles = parseParticles(await text('particles.csv'), parsed.frames.map(frame => frame.step));
  const frames = parsed.frames.map(frame => ({ ...frame, particles: particles?.byStep.get(frame.step) ?? null,
    report: null }));
  return { ...createDataset({ particleGroups: particles?.particleGroups ?? [],
    particleCount: particles?.particleCount ?? 0, expectedSamples: frames.length }),
  frames, names: parsed.names, diagnostics: parseDiagnostics(await text('diagnostics.csv')),
  events: parseEvents(await text('events.csv')), complete: true };
}
