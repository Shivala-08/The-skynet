"use client";

// ---------------------------------------------------------------------------
// StatusWidget — a persistent corner readout of real site telemetry, same
// data source as the terminal `status` command (src/lib/status.ts).
//
//   ● ONLINE · da8131d
//   visits 4 · live 2h 14m
//
// Clicking it opens the terminal and runs `status` for the full panel.
// Polls /api/status every 45s (plus on tab refocus); the deploy age refreshes
// with each poll (minute-granularity display). Visits is shown only when the
// server reports a real KV count — otherwise the metric is omitted, never
// faked.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import { fetchSiteStatus, formatAge, shortCommit, type SiteStatus } from "@/lib/status";

type StatusWidgetProps = {
  /** Opens the terminal and runs `status` (full panel). */
  onOpenStatus?: () => void;
};

const POLL_MS = 45_000;

export function StatusWidget({ onOpenStatus }: StatusWidgetProps) {
  const [status, setStatus] = useState<SiteStatus | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await fetchSiteStatus());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    // First poll shortly after mount (deferred so the fetch never sets state
    // synchronously during the effect commit), then on a fixed interval, and
    // again whenever the tab comes back into view.
    const first = setTimeout(load, 50);
    const id = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  // Age refreshes on each poll (minute-granularity display, so that's plenty).
  const deployedAt = status?.build.deployedAt ?? null;
  const age = deployedAt ? formatAge(deployedAt) : "";

  const commit = status?.build.commit ? shortCommit(status.build.commit) : "—";
  const online = status?.status === "online";
  const visits = status?.visits ?? null;

  return (
    <button
      type="button"
      onClick={onOpenStatus}
      aria-label="Open site status in the terminal"
      title="Open full status in the terminal"
      className="fixed bottom-16 right-3 z-[60] cursor-pointer select-none rounded border border-line bg-surface/80 px-2.5 py-1.5 text-left font-mono text-[10px] leading-tight tracking-[0.12em] backdrop-blur-md transition-colors hover:border-accent/40 hover:bg-surface-2 focus-visible:border-accent/60"
    >
      {error ? (
        <span className="text-ink-faint">telemetry offline — retrying</span>
      ) : (
        <>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-rose-500"}`} />
            <span className="text-ink">{online ? "ONLINE" : "OFFLINE"}</span>
            <span className="text-ink-dim">·</span>
            <span className="text-accent">{commit}</span>
          </span>
          <span className="block whitespace-nowrap text-ink-dim">
            {visits != null && (
              <>
                <span>visits {visits.toLocaleString()}</span>
                <span className="text-ink-faint"> · </span>
              </>
            )}
            {age ? `live ${age}` : "live —"}
          </span>
        </>
      )}
    </button>
  );
}
