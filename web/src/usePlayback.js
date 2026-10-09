import { useCallback, useEffect, useRef, useState } from 'react';
import { advancePosition, clampIndex } from './playback.mjs';

const samplesPerSecond = 12;
const loopStorageKey = 'orbitalsim.playback.loop';

// Remembered per browser; storage can be unavailable (private mode, blocked site data).
function readLoopPreference() {
  try { return localStorage.getItem(loopStorageKey) === '1'; } catch { return false; }
}

// Animation-frame driven playback over the sampled frames of a dataset.
export default function usePlayback(frameCount) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(readLoopPreference);
  const position = useRef(0);
  const last = frameCount - 1;

  useEffect(() => {
    if (!playing || frameCount < 2) return;
    let frame;
    let previous = performance.now();
    position.current = clampIndex(index, last);
    const tick = now => {
      position.current = advancePosition(position.current, now - previous, samplesPerSecond * speed, last, { loop });
      previous = Math.max(previous, now);
      setIndex(Math.floor(position.current));
      if (!loop && position.current >= last) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // index is read only when playback starts; including it would restart the loop every frame.
  }, [playing, speed, loop, frameCount, last]);

  const seek = useCallback(next => {
    setPlaying(false);
    setIndex(clampIndex(Math.round(next), last));
  }, [last]);

  const toggle = useCallback(() => {
    if (frameCount < 2) return;
    setIndex(current => current >= last ? 0 : current);
    setPlaying(value => !value);
  }, [frameCount, last]);

  const reset = useCallback(() => { setPlaying(false); setIndex(0); }, []);

  const toggleLoop = useCallback(() => setLoop(value => {
    try { localStorage.setItem(loopStorageKey, value ? '0' : '1'); } catch { /* preference is optional */ }
    return !value;
  }), []);

  // Consumers index dataset.frames directly, so never expose a sample outside the current dataset.
  return { index: Math.floor(clampIndex(index, last)), playing, speed, setSpeed, loop, toggleLoop, seek, toggle, reset };
}
