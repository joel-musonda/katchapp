import { useEffect } from 'react';
import { useTheme } from '@/components/theme-provider';

// Singleton AudioContext so we respect browser limits (max 6 usually)
let audioCtx: AudioContext | null = null;
const getAudioContext = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Browsers suspend audio context until user interaction
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
};

// -----------------------------------------------------
// Synthesizer Functions
// -----------------------------------------------------

export const playHoverSound = () => {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.04);
        
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.01);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.04);

        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
    } catch (e) {
        // Ignored
    }
};

export const playClickSound = () => {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
        // Ignored
    }
};

export const playTypeSound = () => {
    try {
        const ctx = getAudioContext();
        const bufferSize = ctx.sampleRate * 0.02; // 20ms of noise
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = buffer;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.015);
        
        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        noiseSource.start();
    } catch (e) {
        // Ignored
    }
};

// -----------------------------------------------------
// Global Engine Component
// -----------------------------------------------------

export const SoundEngine = () => {
    const { soundEnabled } = useTheme();

    useEffect(() => {
        if (!soundEnabled) return;

        // Global Click interceptor for buttons/links
        const handleClick = (e: MouseEvent) => {
            const el = e.target as HTMLElement;
            // Determine if element is meant to be interactive
            if (el.closest('button') || el.closest('a') || el.closest('[role="button"]') || (el.className && typeof el.className === 'string' && el.className.includes('cursor-pointer'))) {
                playClickSound();
            }
        };

        // Global Hover interceptor
        let lastHovered: HTMLElement | null = null;
        const handleMouseOver = (e: MouseEvent) => {
             const el = e.target as HTMLElement;
             const target = el.closest('button') || el.closest('a') || el.closest('[role="button"]') || (el.className && typeof el.className === 'string' && el.className.includes('cursor-pointer') ? el : null);
             
             if (target && target !== lastHovered) {
                 lastHovered = target as HTMLElement;
                 playHoverSound();
             } else if (!target) {
                 lastHovered = null; // reset when leaving interactive elements
             }
        };

        // Global Keydown interceptor for typing
        const handleKeyDown = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) {
                // Ignore modifiers to prevent double-clicks
                if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return;
                playTypeSound();
            }
        };

        document.addEventListener('click', handleClick, { capture: true, passive: true });
        document.addEventListener('mouseover', handleMouseOver, { passive: true });
        document.addEventListener('keydown', handleKeyDown, { capture: true, passive: true });

        // Wake up audio context immediately on first click to bypass browser restrictions
        const initAudio = () => {
            getAudioContext();
            document.removeEventListener('click', initAudio, true);
        };
        document.addEventListener('click', initAudio, true);

        return () => {
            document.removeEventListener('click', handleClick, { capture: true });
            document.removeEventListener('mouseover', handleMouseOver);
            document.removeEventListener('keydown', handleKeyDown, { capture: true });
            document.removeEventListener('click', initAudio, true);
        };
    }, [soundEnabled]);

    return null; // Pure logic component
};
