import { useState, useCallback, useRef } from 'react';

type SoundType = 'message' | 'join' | 'leave' | 'invite' | 'move' | 'win' | 'lose' | 'click';

const FREQUENCIES: Record<SoundType, { freq: number[]; duration: number[]; type: OscillatorType }> = {
  message: { freq: [800, 600], duration: [0.05, 0.05], type: 'sine' },
  join: { freq: [400, 500, 700], duration: [0.08, 0.08, 0.12], type: 'sine' },
  leave: { freq: [500, 350, 250], duration: [0.1, 0.1, 0.15], type: 'sine' },
  invite: { freq: [600, 800, 600, 800], duration: [0.1, 0.1, 0.1, 0.15], type: 'sine' },
  move: { freq: [500], duration: [0.04], type: 'square' },
  win: { freq: [523, 659, 784, 1047], duration: [0.12, 0.12, 0.12, 0.25], type: 'sine' },
  lose: { freq: [400, 350, 300, 200], duration: [0.15, 0.15, 0.15, 0.3], type: 'sawtooth' },
  click: { freq: [600], duration: [0.03], type: 'square' },
};

export function useSoundEffects() {
  const [enabled, setEnabled] = useState(() => {
    const saved = localStorage.getItem('miniplay-sound');
    return saved !== 'false';
  });
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const play = useCallback((sound: SoundType) => {
    if (!enabled) return;
    try {
      const ctx = getCtx();
      const { freq, duration, type } = FREQUENCIES[sound];
      let time = ctx.currentTime;
      freq.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f, time);
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration[i]);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + duration[i]);
        time += duration[i];
      });
    } catch {
      // Audio not available
    }
  }, [enabled, getCtx]);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      localStorage.setItem('miniplay-sound', String(next));
      return next;
    });
  }, []);

  return { enabled, toggle, play };
}
