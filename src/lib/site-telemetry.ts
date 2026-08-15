// ---------------------------------------------------------------------------
// site-telemetry.ts — server-only helpers behind the terminal `status` panel
// and the visit counter. Every value is sourced honestly:
//
//   - commit / deployedAt: baked at build time (next.config.ts) or provided by
//     Vercel (VERCEL_GIT_COMMIT_SHA etc.)
//   - visits: real counter in Vercel KV (Upstash REST) — only when
//     KV_REST_API_URL + KV_REST_API_TOKEN are configured; otherwise the metric
//     is reported as unavailable and never fabricated.
//
// This module must only be imported from server code (route handlers) — it
// reads process.env at module scope.
// ---------------------------------------------------------------------------

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const VISITS_KEY = process.env.SKYNET_VISITS_KEY ?? "skynet:visits";

export function kvConfigured(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

export type BuildInfo = {
  commit: string;
  branch: string | null;
  environment: string;
  deployedAt: string | null;
};

export function getBuildInfo(): BuildInfo {
  return {
    commit:
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.NEXT_PUBLIC_BUILD_COMMIT ??
      "unknown",
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    deployedAt: process.env.NEXT_PUBLIC_BUILD_TIME ?? null,
  };
}

/**
 * Runs a single-argument Redis command against Vercel KV's REST API
 * (Upstash: `REST_URL/COMMAND/arg` with a Bearer token, JSON `{result}`).
 * Returns null when KV is not configured or the call fails — callers treat
 * null as "metric unavailable", never as zero.
 */
async function kvCommand(command: "get" | "incr", key: string): Promise<number | null> {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const res = await fetch(`${KV_URL}/${command}/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: unknown };
    const n = Number(data.result);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Current visit count, or null when KV is not configured. */
export function getVisits(): Promise<number | null> {
  return kvCommand("get", VISITS_KEY);
}

/** Increments the visit counter by 1 and returns the new count (null when KV is off). */
export function incrementVisits(): Promise<number | null> {
  return kvCommand("incr", VISITS_KEY);
}
