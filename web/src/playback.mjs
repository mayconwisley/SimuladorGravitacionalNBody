// Fractional sample position after `elapsedMs` of playback, kept inside [0, lastIndex].
// requestAnimationFrame timestamps can precede the start time, so negative elapsed time is ignored.
export function advancePosition(position, elapsedMs, samplesPerSecond, lastIndex) {
  const step = Math.max(0, elapsedMs) / 1000 * samplesPerSecond;
  return clampIndex(position + step, lastIndex);
}

export function clampIndex(value, lastIndex) {
  if (!Number.isFinite(value) || lastIndex <= 0) return 0;
  return Math.min(lastIndex, Math.max(0, value));
}
