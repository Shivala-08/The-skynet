"use client";

import { useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getTrainingState, startTraining, subscribeTraining } from "@/lib/training";

/**
 * NEURAL CORE — a small floating control for the 3D brain. Clicking
 * TRAIN MODEL runs a fake training loop: the network randomises, then
 * gradually stabilises as the HUD counts epochs, loss and accuracy.
 */
export function TrainModel() {
  const t = useSyncExternalStore(subscribeTraining, getTrainingState, getTrainingState);
  const running = t.phase === "training";
  const converged = t.phase === "converged";
  const active = running || converged;
  const q = t.totalEpochs > 0 ? t.epoch / t.totalEpochs : 0;
  const pct = Math.round(q * 100);
  const accPct = (t.accuracy * 100).toFixed(1);

  return (
    <div className="pointer-events-auto absolute bottom-6 right-4 z-20 w-56 sm:bottom-8 sm:right-6">
      <div
        className={
          "overflow-hidden rounded-lg border bg-surface/70 shadow-lg shadow-black/30 backdrop-blur-sm transition-colors duration-300 " +
          (running
            ? "border-accent/50"
            : converged
              ? "border-amber-400/50"
              : "border-line-soft")
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line-soft px-3 py-2">
          <span className="font-mono text-[10px] tracking-[0.2em] text-ink-faint">NEURAL CORE</span>
          <span
            className={
              "flex items-center gap-1.5 font-mono text-[10px] " +
              (converged ? "text-amber-400" : active ? "text-accent" : "text-ink-faint")
            }
          >
            <span
              className={
                "h-1.5 w-1.5 rounded-full " +
                (converged ? "bg-amber-400" : active ? "animate-pulse-dot bg-accent" : "bg-ink-faint")
              }
            />
            {converged ? "CONVERGED" : active ? "COMPUTING" : "STANDBY"}
          </span>
        </div>

        <div className="p-3">
          <AnimatePresence mode="wait" initial={false}>
            {!active ? (
              <motion.button
                key="train"
                type="button"
                onClick={startTraining}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="group flex w-full items-center justify-center gap-2 rounded-md border border-line-soft bg-surface-2/60 px-3 py-2 font-mono text-[11px] tracking-[0.2em] text-ink-dim transition-all hover:border-accent/60 hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent/70 transition-colors group-hover:bg-accent" />
                TRAIN MODEL
              </motion.button>
            ) : (
              <motion.div
                key="hud"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <p
                  className="font-mono text-[10px] tracking-[0.15em] text-ink-dim"
                  aria-live="polite"
                >
                  {converged ? (
                    <span className="text-amber-400">MODEL CONVERGED</span>
                  ) : (
                    "TRAINING NEURAL NETWORK"
                  )}
                </p>

                <div className="mt-2 space-y-1 font-mono text-[11px] text-ink-dim">
                  <div className="flex justify-between">
                    <span>Epoch</span>
                    <span className="text-ink">
                      {t.epoch} <span className="text-ink-faint">/ {t.totalEpochs}</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Loss</span>
                    <span className={converged ? "text-amber-400" : "text-accent"}>
                      {t.loss.toFixed(3)} ↓
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Accuracy</span>
                    <span className={converged ? "text-amber-400" : "text-accent"}>
                      {accPct}% ↑
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={
                      "h-full rounded-full transition-[width] duration-150 ease-linear " +
                      (converged ? "bg-amber-400" : "bg-accent")
                    }
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {converged && (
                  <button
                    type="button"
                    onClick={startTraining}
                    className="mt-2 w-full rounded-md border border-line-soft bg-surface-2/60 px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] text-ink-dim transition-all hover:border-amber-400/60 hover:bg-amber-400/10 hover:text-amber-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                  >
                    TRAIN AGAIN
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
