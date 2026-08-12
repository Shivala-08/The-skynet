"use client";

import { useSyncExternalStore } from "react";

// Minute-cached snapshot so getSnapshot returns a stable reference while the
// displayed minute is unchanged (required by useSyncExternalStore).
let cached = "--:--";
let cachedMinute = -1;

function getSnapshot(): string {
  const now = new Date();
  const minute = now.getHours() * 60 + now.getMinutes();
  if (minute !== cachedMinute) {
    cachedMinute = minute;
    cached = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return cached;
}

function subscribe(callback: () => void): () => void {
  const id = window.setInterval(callback, 10_000);
  return () => window.clearInterval(id);
}

/** Live HH:MM clock, SSR-safe (renders "--:--" on the server). */
export function useClock(): string {
  return useSyncExternalStore(subscribe, getSnapshot, () => "--:--");
}
