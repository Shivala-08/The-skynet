"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { setScrollProgress } from "@/lib/scroll-progress";

gsap.registerPlugin(ScrollTrigger);

/**
 * Wires GSAP ScrollTrigger across all sections. Syncs with Lenis (the smooth
 * scroll provider), drives section-content animations, and tracks global scroll
 * progress for the 3D camera rig. All animations are scrubbed (tied to scroll
 * position) and gated behind prefers-reduced-motion — when reduced motion is
 * set, no GSAP animations run and scroll progress is still tracked for layout.
 */
export function ScrollChoreography() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---- global scroll progress (for the 3D camera rig) ----
    const updateProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? window.scrollY / max : 0);
    };
    window.addEventListener("scroll", updateProgress, { passive: true });
    updateProgress();

    if (reduced) {
      // No animations — just track progress for layout.
      return () => window.removeEventListener("scroll", updateProgress);
    }

    // ---- Lenis ↔ GSAP sync ----
    // Lenis dispatches scroll events on its own raf loop; ScrollTrigger needs
    // to recalculate positions in response.
    const onScroll = () => ScrollTrigger.update();
    window.addEventListener("scroll", onScroll, { passive: true });

    // ---- section content animations ----
    // Section fade-up reveals are managed natively and reliably by the Framer Motion
    // Reveal component on the inner window shell, preventing GSAP opacity conflicts.

    // ---- staggered children inside research + builds ----
    const researchEntries = document.querySelectorAll<HTMLElement>("#research ol > li");
    researchEntries.forEach((li) => {
      gsap.fromTo(
        li,
        { opacity: 0, x: -16 },
        {
          opacity: 1,
          x: 0,
          ease: "none",
          scrollTrigger: {
            trigger: li,
            start: "top 88%",
            end: "top 65%",
            scrub: 0.4,
          },
        },
      );
    });

    // Project card fade-up reveals are managed natively and reliably by the Framer Motion
    // Reveal component on each card container, preventing GSAP opacity conflicts.

    // ---- cleanup ----
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("scroll", onScroll);
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return null;
}
