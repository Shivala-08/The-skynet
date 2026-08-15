"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2Icon, VolumeXIcon } from "@/components/icons";
import { getScrollProgress } from "@/lib/scroll-progress";

const STORAGE_KEY = "ailab-ambient";

/**
 * Ambient sound toggle — plays dark ambient background music (music.mp3)
 * routed through a Web Audio API lowpass filter that sweeps based on scroll.
 * Default off. Persists preference in localStorage.
 */
export function AmbientSound() {
  const [on, setOn] = useState(false);
  const [mounted, setMounted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const onRef = useRef(false);

  // Synchronize on state with onRef for the timeout closure
  useEffect(() => {
    onRef.current = on;
  }, [on]);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setOn(true);
      }
    } catch {
      /* ignore */
    }

    // Initialize HTMLAudioElement on client mount
    const audio = new Audio("/music.mp3");
    audio.loop = true;
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = "";
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const ctx = ctxRef.current;
      if (ctx) {
        ctx.close();
      }
    };
  }, []);

  const initAudio = () => {
    if (ctxRef.current) return;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    ctxRef.current = ctx;

    const audio = audioRef.current;
    if (!audio) return;

    const source = ctx.createMediaElementSource(audio);
    sourceRef.current = source;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    // Start with filter fully open (20,000 Hz)
    filter.frequency.setValueAtTime(20000, ctx.currentTime);
    filterRef.current = filter;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gainRef.current = gain;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
  };

  const start = useCallback(async () => {
    initAudio();
    const ctx = ctxRef.current;
    const audio = audioRef.current;
    const gain = gainRef.current;
    if (!ctx || !audio || !gain) return;

    try {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
    } catch (err) {
      console.warn("Could not resume AudioContext", err);
    }

    audio.play().catch((err) => {
      console.warn("Audio element play failed", err);
    });

    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    // Smooth fade-in to target volume 0.35 over 2 seconds
    gain.gain.linearRampToValueAtTime(0.35, now + 2.0);

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    const modulate = () => {
      const p = getScrollProgress();
      const currentCtx = ctxRef.current;
      const currentFilter = filterRef.current;

      if (currentCtx && currentFilter) {
        const currentTime = currentCtx.currentTime;
        // Frequency range: 20000 Hz at scroll=0, down to 700 Hz at scroll=1.
        // We use an exponential mapping or a power mapping to make the sweep smoother
        const targetFreq = 20000 - Math.pow(p, 1.5) * 19300;
        currentFilter.frequency.setTargetAtTime(targetFreq, currentTime, 0.1);
      }

      rafRef.current = requestAnimationFrame(modulate);
    };
    rafRef.current = requestAnimationFrame(modulate);
  }, []);

  const stop = useCallback(() => {
    const ctx = ctxRef.current;
    const audio = audioRef.current;
    const gain = gainRef.current;
    if (!ctx || !audio || !gain) return;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    // Smooth fade-out to 0 over 1.2 seconds
    gain.gain.linearRampToValueAtTime(0, now + 1.2);

    // Delay pausing the audio element until volume fades out completely
    setTimeout(() => {
      if (!onRef.current && audioRef.current) {
        audioRef.current.pause();
      }
    }, 1200);
  }, []);

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (next) start();
      else stop();
      return next;
    });
  }, [start, stop]);

  // Handle initial auto-play trigger if user had it on in previous session
  useEffect(() => {
    if (mounted && on) {
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  if (!mounted) {
    return (
      <button
        type="button"
        className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
        aria-label="Play ambient music"
      >
        <VolumeXIcon className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={on ? "Mute ambient music" : "Play ambient music"}
      className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {on ? <Volume2Icon className="h-3.5 w-3.5" /> : <VolumeXIcon className="h-3.5 w-3.5" />}
    </button>
  );
}
