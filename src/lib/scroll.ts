"use client";

import type Lenis from "lenis";

// Module-level handle to the active Lenis instance. Registered by the
// LenisProvider; null when Lenis is disabled (reduced motion) or not mounted.
let lenis: Lenis | null = null;

export function registerLenis(instance: Lenis | null): void {
  lenis = instance;
}

const HEADER_OFFSET = -72; // fixed top bar (48px) + breathing room

/**
 * Scroll to a pixel offset or element, smoothing through Lenis when it is
 * active and falling back to an instant native jump otherwise (so
 * prefers-reduced-motion users never get animated scrolling).
 */
export function smoothScrollTo(target: number | HTMLElement, offset = HEADER_OFFSET): void {
  if (typeof target === "number") {
    if (lenis) {
      lenis.scrollTo(target, { duration: 1.1 });
    } else {
      window.scrollTo({ top: target, behavior: "auto" });
    }
    return;
  }

  if (lenis) {
    lenis.scrollTo(target, { offset, duration: 1.1 });
    return;
  }

  const top = Math.max(target.getBoundingClientRect().top + window.scrollY + offset, 0);
  window.scrollTo({ top, behavior: "auto" });
}

/** Scroll to a section by element id ("top" scrolls to the page head). */
export function scrollToId(id: string): void {
  if (id === "top") {
    smoothScrollTo(0, 0);
    return;
  }
  const el = document.getElementById(id);
  if (el) smoothScrollTo(el);
}
