"use client";

import { useEffect, useRef } from "react";
import { getHeroTooltip } from "@/lib/hero-tooltip";

/**
 * Floating tooltip for the hero scene shapes (AI Core / DeployForge /
 * Synapse). Position is written by the 3D frame loop and applied here via rAF
 * directly to the DOM — no React re-renders at 60fps.
 */
export function HeroTooltip() {
  const pillRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const roleRef = useRef<HTMLSpanElement>(null);
  const lastVisible = useRef(false);
  const lastName = useRef("");
  const lastRole = useRef("");

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = getHeroTooltip();
      const pill = pillRef.current;
      const nameEl = nameRef.current;
      const roleEl = roleRef.current;
      if (pill && nameEl && roleEl) {
        if (s.visible !== lastVisible.current || s.name !== lastName.current || s.role !== lastRole.current) {
          lastVisible.current = s.visible;
          lastName.current = s.name;
          lastRole.current = s.role;
          nameEl.textContent = s.name;
          roleEl.textContent = s.role;
          pill.style.opacity = s.visible ? "1" : "0";
        }
        if (s.visible) {
          pill.style.transform = `translate3d(${s.x + 18}px, ${s.y - 14}px, 0) translate(-50%, -100%)`;
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
      <div className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-accent/30 bg-surface/90 px-3 py-2 shadow-lg shadow-black/30 backdrop-blur-md">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(77,141,255,0.6)]" />
        <div className="flex flex-col">
          <span ref={nameRef} className="font-mono text-xs font-medium text-ink" />
          <span ref={roleRef} className="font-mono text-[10px] text-ink-dim" />
        </div>
      </div>
    </div>
  );
}
