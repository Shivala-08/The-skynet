import { NextResponse } from "next/server";
import { getBuildInfo, getVisits, kvConfigured } from "@/lib/site-telemetry";

// Real-time telemetry (deploy age, visit counter) — never cache.
export const dynamic = "force-dynamic";

export async function GET() {
  const build = getBuildInfo();
  const visits = await getVisits();

  return NextResponse.json({
    status: "online",
    build,
    visits,
    telemetry: {
      // Honest capability flag — the visit counter row is omitted client-side
      // unless visits is a real number, and this explains why when it isn't.
      visitCounter: kvConfigured() ? "live" : "not-configured",
    },
  });
}
