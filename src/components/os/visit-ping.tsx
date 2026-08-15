"use client";

// ---------------------------------------------------------------------------
// VisitPing — fires once per page load so the server can increment the real
// visit counter (Vercel KV). No UI. When KV isn't configured the server
// no-ops and returns visits: null — nothing here ever invents a number.
// ---------------------------------------------------------------------------

import { useEffect } from "react";

export function VisitPing() {
  useEffect(() => {
    fetch("/api/visit", { method: "POST", keepalive: true }).catch(() => {
      // Counting is best-effort; a failed beacon must never break the page.
    });
  }, []);

  return null;
}
