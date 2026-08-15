import { deployEvents, deployMeta } from "@/lib/deploy-log";

// Replay-only by deliberate decision (Mission 1): this endpoint streams a real
// historical build log at a realistic pace. It never triggers a live deploy,
// so no rate limiting or kill switch is required. If this ever becomes a live
// trigger, per-IP rate limiting + an env-var kill switch MUST be added first.
export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const header: { text: string; tone: "dim" | "accent" }[] = [
        { text: "▸ DeployForge // pipeline replay", tone: "accent" },
        { text: `▸ deploy id:  ${deployMeta.id} · commit ${deployMeta.commit}`, tone: "dim" },
        { text: `▸ source:     real ${deployMeta.framework} build log (${deployMeta.recordedAt})`, tone: "dim" },
        { text: "▸ status:     REPLAY — no live deployment is triggered", tone: "dim" },
        { text: "", tone: "dim" },
      ];
      for (const line of header) {
        controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
        await new Promise((r) => setTimeout(r, 90));
      }

      for (const ev of deployEvents) {
        if (ev.delayMs) await new Promise((r) => setTimeout(r, ev.delayMs));
        controller.enqueue(encoder.encode(JSON.stringify({ text: ev.text, tone: ev.tone ?? "default" }) + "\n"));
      }

      const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
      controller.enqueue(
        encoder.encode(
          JSON.stringify({
            text: `✓ replay complete in ${secs}s — this was a replay of a real historical build, nothing was deployed.`,
            tone: "ok",
          }) + "\n",
        ),
      );
      controller.enqueue(
        encoder.encode(
          JSON.stringify({
            text: "▸ run 'deploy' again to replay it. (No live trigger — by design.)",
            tone: "dim",
          }) + "\n",
        ),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
