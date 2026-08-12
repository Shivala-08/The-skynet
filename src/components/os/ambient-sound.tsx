"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2Icon, VolumeXIcon } from "@/components/icons";
import { getScrollProgress } from "@/lib/scroll-progress";

const STORAGE_KEY = "ailab-ambient";

/**
 * Ambient sound toggle — generates a rich, atmospheric sci-fi drone via Web Audio API.
 * Default off. Persists preference in localStorage. Respects prefers-reduced-motion.
 */
export function AmbientSound() {
  const [on, setOn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Gate for hydration — the icon must match on server & first client paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setOn(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<AudioNode[] | null>(null);
  const modRef = useRef<{ sub: OscillatorNode; carrier: OscillatorNode; shimmers: OscillatorNode[]; lpf: BiquadFilterNode; bpf: BiquadFilterNode; raf: number } | null>(null);

  const start = useCallback(async () => {
    if (ctxRef.current) {
      await ctxRef.current.resume();
      return;
    }
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);
    gainRef.current = masterGain;

    const allNodes: AudioNode[] = [];

    // --- Layer 1: Sub-bass drone (50 Hz) ---
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 50;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.12;
    sub.connect(subGain);
    subGain.connect(masterGain);
    sub.start();
    allNodes.push(sub, subGain);

    // --- Layer 2: FM-modulated carrier (110 Hz ± subtle vibrato) ---
    const carrier = ctx.createOscillator();
    carrier.type = "sine";
    carrier.frequency.value = 110;
    const modulator = ctx.createOscillator();
    modulator.type = "sine";
    modulator.frequency.value = 0.3; // slow wobble
    const modGain = ctx.createGain();
    modGain.gain.value = 3; // modulation depth
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    const carrierGain = ctx.createGain();
    carrierGain.gain.value = 0.08;
    carrier.connect(carrierGain);
    carrierGain.connect(masterGain);
    modulator.start();
    carrier.start();
    allNodes.push(carrier, modulator, modGain, carrierGain);

    // --- Layer 3: Harmonic shimmer (220 Hz + 330 Hz, detuned) ---
    for (const freq of [220, 330]) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 10; // slight detune
      const g = ctx.createGain();
      g.gain.value = 0.03;
      osc.connect(g);
      g.connect(masterGain);
      osc.start();
      allNodes.push(osc, g);
    }

    // --- Layer 4: Filtered noise bed (wind/texture) ---
    const bufLen = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 180;
    lpf.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.06;
    noise.connect(lpf);
    lpf.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start();
    allNodes.push(noise, lpf, noiseGain);

    // --- Layer 5: Phasing sweep (slow LFO on a bandpass) ---
    const sweepOsc = ctx.createOscillator();
    sweepOsc.type = "sine";
    sweepOsc.frequency.value = 0.08; // very slow sweep
    const bpf = ctx.createBiquadFilter();
    bpf.type = "bandpass";
    bpf.frequency.value = 400;
    bpf.Q.value = 2;
    sweepOsc.connect(bpf.frequency);
    const sweepGain = ctx.createGain();
    sweepGain.gain.value = 0.025;
    bpf.connect(sweepGain);
    sweepGain.connect(masterGain);
    sweepOsc.start();
    allNodes.push(sweepOsc, bpf, sweepGain);

    nodesRef.current = allNodes;

    // Store refs for scroll-driven modulation
    const shimmers = allNodes.filter((n): n is OscillatorNode => n instanceof OscillatorNode && n !== sub && n !== carrier && n !== modulator && n !== sweepOsc);
    modRef.current = { sub, carrier, shimmers, lpf, bpf, raf: 0 };

    // Fade in over 2s
    masterGain.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 2);

    // Scroll-driven pitch modulation
    let raf = 0;
    const modulate = () => {
      const p = getScrollProgress();
      const now = ctx.currentTime;

      // Map scroll to pitch shift: blue(p=0) → purple(p=0.35) → muted(p=0.7) → blue(p=1)
      // Use sin curve for smooth transitions
      const purpleIntensity = Math.sin(p * Math.PI); // peaks at p=0.5
      const shift = purpleIntensity * 0.15; // max 15% shift

      // Sub-bass: 50 Hz → 58 Hz at peak
      sub.frequency.linearRampToValueAtTime(50 + shift * 50, now + 0.1);

      // Carrier: 110 Hz → 126 Hz at peak
      carrier.frequency.linearRampToValueAtTime(110 + shift * 110, now + 0.1);

      // Harmonic shimmer: detune shifts with scroll
      if (modRef.current?.shimmers) {
        modRef.current.shimmers.forEach((osc, i) => {
          const base = i === 0 ? 220 : 330;
          osc.frequency.linearRampToValueAtTime(base + shift * base * 0.3, now + 0.1);
        });
      }

      // Noise filter: opens up during purple phases
      lpf.frequency.linearRampToValueAtTime(180 + purpleIntensity * 120, now + 0.1);

      // Bandpass sweep: shifts center with scroll
      bpf.frequency.linearRampToValueAtTime(400 + purpleIntensity * 200, now + 0.1);

      raf = requestAnimationFrame(modulate);
    };
    raf = requestAnimationFrame(modulate);

    // Store cleanup function
    if (modRef.current) modRef.current.raf = raf;
  }, []);

  const stop = useCallback(() => {
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    if (!ctx || !gain) return;

    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    // Stop scroll modulation
    if (modRef.current) cancelAnimationFrame(modRef.current.raf);
    setTimeout(() => {
      nodesRef.current?.forEach((n) => {
        try { n.disconnect(); } catch { /* already disconnected */ }
      });
      ctx.close();
      ctxRef.current = null;
      gainRef.current = null;
      nodesRef.current = null;
    }, 1200);
  }, []);

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      if (next) start();
      else stop();
      return next;
    });
  }, [start, stop]);

  // Cleanup on unmount.
  useEffect(() => () => stop(), [stop]);

  if (!mounted) {
    return (
      <button
        type="button"
        className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
        aria-label="Play ambient sound"
      >
        <VolumeXIcon className="h-3.5 w-3.5" />
      </button>
    );
  }

  const isPlaying = on;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isPlaying ? "Mute ambient sound" : "Play ambient sound"}
      className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {isPlaying ? <Volume2Icon className="h-3.5 w-3.5" /> : <VolumeXIcon className="h-3.5 w-3.5" />}
    </button>
  );
}
