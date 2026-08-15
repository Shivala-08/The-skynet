// ---------------------------------------------------------------------------
// deploy-log.ts — the replay source for the terminal's `deploy` command.
//
// Mission 1 (deliberate decision): this is a REPLAY, not a live trigger.
// `deploy` streams a real historical build log of this site at a realistic
// pace, clearly framed as a replay — it never re-deploys production, so there
// is no rate limit, no kill switch, and no abuse surface. If this is ever
// upgraded to a live trigger, it must gain per-IP rate limiting and a kill
// switch before it ships.
//
// Every line in deployEvents is VERBATIM output from a real `next build` of
// this repo (the historical production build recorded in deployMeta). The
// delayMs values pace each line to roughly reproduce how long the real build
// stages took — the stage timings are the ones printed by the build itself.
// ---------------------------------------------------------------------------

export type DeployTone = "default" | "dim" | "accent" | "ok" | "err";

export type DeployEvent = {
  text: string;
  tone?: DeployTone;
  /** Pipeline latency before this line is emitted (ms). */
  delayMs?: number;
};

export const deployMeta = {
  id: "deploy#20260815-5ae71b3",
  commit: "5ae71b3",
  framework: "Next.js 16.3.0 (Turbopack)",
  recordedAt: "2026-08-15 · production build",
} as const;

export const deployEvents: DeployEvent[] = [
  // ---- npm script preamble ----
  { text: "> pallav-os@0.1.0 build", tone: "dim", delayMs: 150 },
  { text: "> next build", tone: "dim", delayMs: 80 },
  { text: "", tone: "dim", delayMs: 60 },

  // ---- framework detection ----
  { text: "▲ Next.js 16.3.0 (Turbopack)", tone: "accent", delayMs: 120 },
  { text: "- Environments: .env.local", tone: "dim", delayMs: 80 },
  { text: "✓ Running next.config.ts took 10ms", tone: "ok", delayMs: 250 },
  { text: "", tone: "dim", delayMs: 60 },

  // ---- compile (real: 1909ms) ----
  { text: "  Creating an optimized production build ...", delayMs: 500 },
  { text: "✓ Compiled successfully in 1909ms", tone: "ok", delayMs: 1400 },

  // ---- typecheck (real: 1063ms) ----
  { text: "  Running TypeScript ...", delayMs: 250 },
  { text: "  Finished TypeScript in 1063ms ...", delayMs: 900 },

  // ---- data collection + static generation (real: 228ms at 9 workers) ----
  { text: "  Collecting page data using 9 workers ...", delayMs: 450 },
  { text: "  Generating static pages using 9 workers (0/7) ...", delayMs: 180 },
  { text: "  Generating static pages using 9 workers (1/7) ", delayMs: 140 },
  { text: "  Generating static pages using 9 workers (3/7) ", delayMs: 140 },
  { text: "  Generating static pages using 9 workers (5/7) ", delayMs: 140 },
  { text: "✓ Generating static pages using 9 workers (7/7) in 228ms", tone: "ok", delayMs: 250 },
  { text: "  Finalizing page optimization ...", delayMs: 700 },
  { text: "", tone: "dim", delayMs: 60 },

  // ---- route table ----
  { text: "Route (app)", delayMs: 150 },
  { text: "┌ ○ /", delayMs: 50 },
  { text: "├ ○ /_not-found", delayMs: 50 },
  { text: "├ ƒ /api/chat", delayMs: 50 },
  { text: "├ ƒ /api/deploy", delayMs: 50 },
  { text: "├ ○ /robots.txt", delayMs: 50 },
  { text: "└ ○ /sitemap.xml", delayMs: 50 },
  { text: "", tone: "dim", delayMs: 60 },
  { text: "", tone: "dim", delayMs: 60 },
  { text: "○  (Static)   prerendered as static content", delayMs: 120 },
  { text: "ƒ  (Dynamic)  server-rendered on demand", delayMs: 120 },
];
