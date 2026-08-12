"use client";

import { useEffect, useRef } from "react";
import { getLobeLabel } from "@/lib/lobe-label";

/**
 * Floating label that follows the hovered lobe-landmark node (Research,
 * Builds, Systems, …). The position is written by the 3D scene every frame and
 * applied here via rAF directly to the DOM — no React re-renders at 60fps.
 */
export function LobeLabel() {
  const pillRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const lastText = useRef<string | null>(null);
  const lastHint = useRef<string | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = getLobeLabel();
      const pill = pillRef.current;
      const textEl = textRef.current;
      const hintEl = hintRef.current;
      if (pill && textEl && hintEl) {
        if (s.text !== lastText.current || s.hint !== lastHint.current) {
          lastText.current = s.text;
          lastHint.current = s.hint;
          textEl.textContent = s.text;
          hintEl.textContent = s.hint ? `· ${s.hint}` : "";
          pill.style.opacity = s.text ? "1" : "0";
        }
        if (s.text) {
          pill.style.transform = `translate3d(${s.x}px, ${s.y}px, 0) translate(-50%, -190%)`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={pillRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-50 opacity-0 transition-opacity duration-150 will-change-transform"
    >
      <div className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-accent/50 bg-surface/90 px-2.5 py-1 font-mono text-[10px] tracking-[0.2em] text-ink shadow-lg shadow-black/30 backdrop-blur-sm">
        <span aria-hidden="true" className="text-accent">
          ◆
        </span>
        <span ref={textRef} />
        <span ref={hintRef} className="text-ink-faint" />
      </div>
      {/* Caret pointing down at the node */}
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-full h-1.5 w-1.5 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-accent/50 bg-surface"
      />
    </div>
  );
}
