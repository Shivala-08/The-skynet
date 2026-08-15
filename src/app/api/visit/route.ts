import { NextResponse } from "next/server";
import { incrementVisits } from "@/lib/site-telemetry";

export const dynamic = "force-dynamic";

export async function POST() {
  const count = await incrementVisits();
  return NextResponse.json({ ok: true, visits: count });
}
