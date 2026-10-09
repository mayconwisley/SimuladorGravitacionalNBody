// Interactive changes to a running scenario. They become maneuvers at the current step and
// the scenario is recomputed, so the motor stays the single source of the trajectory.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => { const length = norm(a); return length > 0 ? a.map(value => value / length) : null; };

// Orbital frame of `body` relative to `reference` (objects with x, y, z, vx, vy, vz):
// prograde along the relative velocity, normal along r x v, radial = prograde x normal
// (pointing away from the reference for a circular orbit).
export function orbitalFrame(body, reference) {
  const r = sub([body.x, body.y, body.z], reference ? [reference.x, reference.y, reference.z] : [0, 0, 0]);
  const v = sub([body.vx, body.vy, body.vz], reference ? [reference.vx, reference.vy, reference.vz] : [0, 0, 0]);
  const prograde = unit(v);
  const normal = unit(cross(r, v));
  if (!prograde || !normal) return null;
  return { prograde, normal, radial: cross(prograde, normal) };
}

// Inertial Δv (m/s) for prograde, radial and normal components.
export function impulseVector(frame, { prograde = 0, radial = 0, normal = 0 }) {
  return [0, 1, 2].map(axis =>
    prograde * frame.prograde[axis] + radial * frame.radial[axis] + normal * frame.normal[axis]);
}

// Scenario with one more maneuver; steps must stay inside [0, steps - 1].
export function withManeuver(scenario, maneuver) {
  if (!(maneuver.step >= 0 && maneuver.step < scenario.steps))
    throw new Error('Não há passos depois deste ponto para aplicar a mudança.');
  return { ...scenario, maneuvers: [...(scenario.maneuvers ?? []), maneuver] };
}
