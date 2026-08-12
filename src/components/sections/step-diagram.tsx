"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

/** A diagram step: short label, one-line blurb, and an optional longer detail. */
export type DiagramStep = {
  label: string;
  blurb: string;
  detail?: string;
};

type StepDiagramProps = {
  steps: DiagramStep[];
  label: string;
};

/**
 * A steppable node-and-edge diagram. Nodes are real buttons (Tab + Enter
 * reachable, arrow keys navigate), the active node's explanation shows in a
 * detail panel below, and Prev/Next buttons walk through the whole chain.
 * Pure DOM — works identically with WebGL off, and respects
 * prefers-reduced-motion via the app-level MotionConfig.
 */
export function StepDiagram({ steps, label }: StepDiagramProps) {
  const [active, setActive] = useState(0);
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const reduce = useReducedMotion();
  const last = steps.length - 1;

  const goTo = useCallback((i: number) => {
    setActive(Math.max(0, Math.min(steps.length - 1, i)));
  }, [steps.length]);

  const step = steps[active];
  const isFirst = active === 0;
  const isLast = active === last;

  // Arrow keys move through the chain; Home/End jump to the ends.
  const onChainKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = e.key === "ArrowRight" ? Math.min(last, active + 1) : Math.max(0, active - 1);
      goTo(next);
      nodeRefs.current[next]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(0);
      nodeRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(last);
      nodeRefs.current[last]?.focus();
    }
  };

  return (
    <div className="rounded-lg border border-line bg-surface-2/30 p-4 sm:p-5">
      {/* node chain */}
      <div
        role="group"
        aria-label={`${label} flow`}
        onKeyDown={onChainKeyDown}
        className="flex flex-wrap items-center gap-1.5"
      >
        {steps.map((s, i) => {
          const isActive = i === active;
          return (
            <div key={s.label} className="flex items-center gap-1.5">
              {i > 0 && (
                <span className="font-mono text-[10px] text-accent/60" aria-hidden="true">
                  →
                </span>
              )}
              <button
                ref={(el) => {
                  nodeRefs.current[i] = el;
                }}
                type="button"
                onClick={() => goTo(i)}
                aria-current={isActive ? "step" : undefined}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                  isActive
                    ? "border-accent/60 bg-accent/10 text-ink"
                    : "border-line bg-surface text-ink-dim hover:border-accent/30 hover:text-ink"
                }`}
              >
                <span className={isActive ? "text-accent" : "text-ink-faint"}>{String(i + 1).padStart(2, "0")}</span>
                {s.label}
              </button>
            </div>
          );
        })}
      </div>

      {/* detail panel */}
      <div className="mt-4 rounded-md border border-line-soft bg-surface/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">
            step {String(active + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
          </p>
          <div className="flex items-center gap-1" aria-hidden="true">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === active ? "bg-accent" : i < active ? "bg-accent/30" : "bg-line"
                }`}
              />
            ))}
          </div>
        </div>
        <div aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={reduce ? { duration: 0 } : { duration: 0.18 }}
            >
              <h3 className="mt-2 text-sm font-medium text-ink">{step.label}</h3>
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-dim">
                {step.detail ?? step.blurb}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* stepper */}
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            disabled={isFirst}
            className="flex items-center gap-1 rounded-md border border-line px-2.5 py-1 font-mono text-[11px] text-ink-dim transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-dim"
            aria-label="Previous step"
          >
            <ChevronLeftIcon className="h-3 w-3" />
            prev
          </button>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            disabled={isLast}
            className="flex items-center gap-1 rounded-md border border-line px-2.5 py-1 font-mono text-[11px] text-ink-dim transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-dim"
            aria-label="Next step"
          >
            next
            <ChevronRightIcon className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
