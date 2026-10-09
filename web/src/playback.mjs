// Fractional sample position after `elapsedMs` of playback, kept inside [0, lastIndex].
// requestAnimationFrame timestamps can precede the start time, so negative elapsed time is ignored.
// With `loop`, the position runs over [0, lastIndex + 1): the last sample is shown for one sample
// period and playback wraps to the start. Clamping it to lastIndex would freeze playback whenever a
// single animation frame advances less than one sample.
export function advancePosition(position, elapsedMs, samplesPerSecond, lastIndex, { loop = false } = {}) {
  const step = Math.max(0, elapsedMs) / 1000 * samplesPerSecond;
  const next = clampIndex(position, loop ? lastIndex + 1 : lastIndex) + step;
  if (loop && lastIndex > 0 && Number.isFinite(next)) return next % (lastIndex + 1);
  return clampIndex(next, lastIndex);
}

export function clampIndex(value, lastIndex) {
  if (!Number.isFinite(value) || lastIndex <= 0) return 0;
  return Math.min(lastIndex, Math.max(0, value));
}
