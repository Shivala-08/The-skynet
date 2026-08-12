"use client";

import { useEffect, useSyncExternalStore } from "react";
import { sections, type FloatingAppId, type SectionId } from "@/lib/data";
import { useClock } from "@/lib/use-clock";
import { LogoMark, TerminalIcon } from "@/components/icons";
import { scrollToId } from "@/lib/scroll";
import {
  clearLastHoveredLandmark,
  getLastHoveredLandmark,
  subscribeLastHoveredLandmark,
} from "@/lib/lobe-label";
import {
  getActiveSection,
  setActiveSection,
  subscribeActiveSection,
} from "@/lib/active-section";
import { AmbientSound } from "./ambient-sound";

export function TopBar({ onOpenApp }: { onOpenApp: (app: FloatingAppId) => void }) {
  const clock = useClock();
  const active = useSyncExternalStore(subscribeActiveSection, getActiveSection, getActiveSection);

  // Scrollspy — highlight the section currently crossing the viewport band.
  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (window.scrollY < 80) {
          setActiveSection(null);
          return;
        }
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-25% 0px -45% 0px", threshold: 0.01 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="flex h-12 items-center gap-2 px-3 sm:gap-4 sm:px-4">
        <a
          href="#top"
          className="flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-2"
          aria-label="Skynet AI Lab OS — back to top"
        >
          <LogoMark className="h-4 w-4 text-accent" />
          <span className="font-mono text-xs tracking-widest text-ink">
            SKYNET<span className="text-accent">{"//"}</span>
            <span className="hidden sm:inline">AI LAB OS</span>
          </span>
        </a>

        {/* Last-hovered lobe landmark — persisted as a clickable breadcrumb */}
        <LandmarkBreadcrumb onOpenApp={onOpenApp} />

        <nav
          aria-label="Primary"
          data-lenis-prevent
          className="ml-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto no-scrollbar sm:ml-4 md:gap-1"
        >
          <button
            type="button"
            onClick={() => onOpenApp("terminal")}
            className="relative shrink-0 rounded-md px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink sm:px-2.5"
          >
            Terminal
          </button>
          <button
            type="button"
            onClick={() => onOpenApp("files")}
            className="relative shrink-0 rounded-md px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink sm:px-2.5"
          >
            Files
          </button>
          {sections.map((s) => {
            const isActive = active === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                aria-current={isActive ? "true" : undefined}
                className={
                  "relative shrink-0 rounded-md px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors hover:bg-surface-2 hover:text-ink sm:px-2.5 " +
                  (isActive
                    ? "text-ink after:absolute after:inset-x-2 after:bottom-0.5 after:h-[2px] after:rounded-full after:bg-accent"
                    : "text-ink-dim")
                }
              >
                {s.label}
              </a>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => onOpenApp("terminal")}
          className="hidden shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 font-mono text-[11px] text-ink-dim transition-colors hover:border-accent/40 hover:text-accent sm:flex"
        >
          <TerminalIcon className="h-3.5 w-3.5" />
          terminal
        </button>

        <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-ink-faint">
          <AmbientSound />
          <span className="hidden h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent md:block" aria-hidden="true" />
          <span className="hidden md:inline">v1.0</span>
          <span className="tabular-nums">{clock}</span>
        </div>
      </div>
    </header>
  );
}

/**
 * Breadcrumb for the last-hovered lobe landmark. Clicking the name navigates
 * (scrolls to the section, or opens Terminal/Files); the × clears it.
 */
function LandmarkBreadcrumb({ onOpenApp }: { onOpenApp: (app: FloatingAppId) => void }) {
  const last = useSyncExternalStore(subscribeLastHoveredLandmark, getLastHoveredLandmark, getLastHoveredLandmark);

  if (!last.id || !last.label) return null;

  const isSection = sections.some((s) => s.id === last.id);
  const isApp = last.id === "terminal" || last.id === "files";
  if (!isSection && !isApp) return null;

  const navigate = () => {
    if (!last.id) return;
    if (isSection) {
      // Highlight the target immediately; the scrollspy confirms on arrival
      setActiveSection(last.id);
      scrollToId(last.id as SectionId);
    } else if (isApp) {
      onOpenApp(last.id as FloatingAppId);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-accent/25 bg-accent/[0.06] py-0.5 pl-1 pr-0.5 font-mono text-[11px] text-accent sm:pl-1.5">
      <button
        type="button"
        onClick={navigate}
        className="flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent sm:gap-1.5"
        title={isSection ? `Go to ${last.label}` : `Open ${last.label}`}
      >
        <span aria-hidden="true" className="text-accent">
          ⌖
        </span>
        {/* Compact on mobile: truncate the name so the nav still has room */}
        <span className="max-w-[4.5rem] truncate uppercase tracking-wider sm:max-w-none">
          {last.label}
        </span>
      </button>
      <button
        type="button"
        onClick={clearLastHoveredLandmark}
        aria-label="Clear landmark breadcrumb"
        className="rounded px-1 py-0.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        ✕
      </button>
    </div>
  );
}
