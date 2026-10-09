import { useCallback, useEffect, useRef, useState } from 'react';

const samplesPerSecond = 12;

// Animation-frame driven playback over the sampled frames of a dataset.
export default function usePlayback(frameCount) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const position = useRef(0);
  const last = frameCount - 1;

  useEffect(() => {
    if (!playing || frameCount < 2) return;
    let frame;
    let previous = performance.now();
    position.current = index;
    const tick = now => {
      position.current = Math.min(last, position.current + (now - previous) / 1000 * samplesPerSecond * speed);
      previous = now;
      setIndex(Math.floor(position.current));
      if (position.current >= last) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // index is read only when playback starts; including it would restart the loop every frame.
  },[playing, speed, frameCount, last]);

  const seek = useCallback(next => {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(last, next)));
  }, [last]);

  const toggle = useCallback(() => {
    if (frameCount < 2) return;
    setIndex(current => current >= last ? 0 : current);
    setPlaying(value => !value);
  }, [frameCount, last]);

  const reset = useCallback(() => { setPlaying(false); setIndex(0); }, []);

  return { index, playing, speed, setSpeed, seek, toggle, reset };
}
