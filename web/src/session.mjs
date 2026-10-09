// Per-tab persistence (sessionStorage) so F5 keeps the editor draft and can recompute
// the last simulation. Simulation results are not stored: they can exceed the browser
// quota, and rerunning the deterministic scenario is fast. Storage may be unavailable
// (private mode, blocked site data), so every access is optional.
const draftKey = 'orbitalsim.session.draft';
const lastRunKey = 'orbitalsim.session.lastRun';

function read(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function write(storage, key, value) {
  try { storage?.setItem(key, JSON.stringify(value)); } catch { /* persistence is optional */ }
}

const defaultStorage = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage);

export function loadDraft(storage = defaultStorage()) {
  const draft = read(storage, draftKey);
  return draft && Array.isArray(draft.bodies) && draft.bodies.length ? draft : null;
}

export function saveDraft(draft, storage = defaultStorage()) { write(storage, draftKey, draft); }

// `scenario` is the validated SI scenario sent to the API; imported CSVs have none.
export function loadLastRun(storage = defaultStorage()) {
  const run = read(storage, lastRunKey);
  return run && typeof run.label === 'string' ? run : null;
}

export function saveLastRun(run, storage = defaultStorage()) { write(storage, lastRunKey, run); }
