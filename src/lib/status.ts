// ---------------------------------------------------------------------------
// status.ts — shared, client-safe status logic used by both the terminal
// `status` command and the persistent corner widget. One fetch, one set of
// formatters, so the two surfaces can never drift.
//
// Everything comes from /api/status (server): commit/deploy time baked at
// build time, visits a real KV counter. When visits is null (KV not
// configured) callers omit the metric — never fake it.
// ---------------------------------------------------------------------------

export type SiteStatus = {
  status: string;
  build: {
    commit: string;
    branch: string | null;
    environment: string;
    deployedAt: string | null;
  };
  visits: number | null;
  telemetry: { visitCounter: string };
};

export async function fetchSiteStatus(): Promise<SiteStatus> {
  const res = await fetch("/api/status", { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as SiteStatus;
}

/** "da8131d3302…" → "da8131d" (Git's default short form). */
export function shortCommit(commit: string): string {
  return commit.length > 7 ? commit.slice(0, 7) : commit;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/** "2h 14m" / "5d 3h" / "< 1m" — age since the current build deployed. */
export function formatAge(iso: string | null): string {
  if (!iso) return "unknown";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "< 1m";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}
