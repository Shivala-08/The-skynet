"use client";

// ---------------------------------------------------------------------------
// DebugOverlay — the Konami-code easter egg (↑↑↓↓←→←→BA).
//
// Toggles a fixed debug panel showing:
//   - live FPS (measured by the panel's own rAF loop)
//   - a wireframe toggle that the BrainLab render loop reads every frame
//   - the raw shader uniform values actually uploaded to the GPU
//
// Purely additive: nothing here runs or renders unless the code is entered,
// and the panel never intercepts focus, so core nav stays untouched.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { debugFps, debugState, debugTicks, debugUniforms } from "@/lib/debug";

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

function isTypingTarget(el: Element | null): boolean {
  return !!(
    el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.getAttribute("contenteditable") === "true")
  );
}

export function DebugOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [wireframe, setWireframe] = useState(debugState.wireframe);
  const [, forceTick] = useState(0);

  // FPS + uniform readout — throttled re-render (~4 Hz) is plenty for display.
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => forceTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [enabled]);

  // rAF loop measuring real frame rate.
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const loop = (now: number) => {
      frames++;
      if (now - last >= 1000) {
        debugFps.value = Math.round((frames * 1000) / (now - last));
        frames = 0;
        last = now;
      }
      debugTicks.value++;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  useEffect(() => {
    let seq = 0;
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(document.activeElement)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === KONAMI[seq]) {
        seq++;
        if (seq === KONAMI.length) {
          seq = 0;
          setEnabled((prev) => {
            debugState.overlay = !prev;
            return !prev;
          });
        }
      } else {
        // Re-check from the start (the classic buffered matcher also accepts
        // overlapping input, but a strict reset is fine for an easter egg).
        seq = key === KONAMI[0] ? 1 : 0;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    debugState.overlay = enabled;
  }, [enabled]);

  const toggleWireframe = () => {
    setWireframe((prev) => {
      debugState.wireframe = !prev;
      return !prev;
    });
  };

  if (!enabled) return null;

  const u = debugUniforms;
  const cam = u.cameraPos.map((v) => v.toFixed(2)).join(", ");

  return (
    <div
      className="pointer-events-auto fixed bottom-3 right-3 z-[999] select-none rounded border border-accent/40 bg-[#050507]/95 px-3 py-2 font-mono text-[11px] leading-relaxed text-ink shadow-[0_0_24px_rgba(77,141,255,0.15)]"
      role="presentation"
      aria-hidden="true"
    >
      <div className="mb-1 flex items-center justify-between gap-4 border-b border-line pb-1">
        <span className="text-accent">DEBUG // KONAMI</span>
        <span className="text-ink-dim">{debugFps.value} fps</span>
      </div>

      <button
        type="button"
        onClick={toggleWireframe}
        className="mb-1 block w-full cursor-pointer text-left hover:text-accent"
      >
        wireframe: <span className={wireframe ? "text-accent" : "text-ink-dim"}>{wireframe ? "ON" : "OFF"}</span>
      </button>

      <div className="text-ink-dim">
        <div>point size    {u.pointSize.toFixed(3)}</div>
        <div>point opacity {u.pointOpacity.toFixed(3)}</div>
        <div>line opacity  {u.lineOpacity.toFixed(3)}</div>
        <div>mesh emissive {u.meshEmissive.toFixed(2)}</div>
        <div>mesh opacity  {u.meshOpacity.toFixed(3)}</div>
        <div>rim power     {u.rimPower.toFixed(2)}</div>
        <div>rim strength  {u.rimStrength.toFixed(2)}</div>
        <div>uTime         {u.uTime.toFixed(2)}</div>
        <div>camera        [{cam}]</div>
      </div>
    </div>
  );
}
