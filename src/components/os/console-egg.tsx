"use client";

// ---------------------------------------------------------------------------
// ConsoleEgg — a tiny on-load console easter egg for the developer who opens
// devtools. Pure decoration, zero functional impact. Runs once on mount.
// ---------------------------------------------------------------------------

import { useEffect } from "react";

const MONO = "font-family: ui-monospace, SFMono-Regular, Menlo, monospace;";

export function ConsoleEgg() {
  useEffect(() => {
    const dim = `color: #9c9ca8; ${MONO}`;
    const blue = `color: #4d8dff; ${MONO}`;
    const ink = `color: #f4f4f6; ${MONO}`;

    console.log(
      "%c╔════════════════════════════════════════╗\n%c║      SKYNET // AI LAB OS — v1.0         ║\n%c╚════════════════════════════════════════╝",
      blue,
      blue,
      blue,
    );
    console.log(
      "%cPallav Dholariya — AI/ML · full-stack · creative tech. He builds AI agents, RAG systems, and this OS.",
      ink,
    );
    console.log(
      "%cHiring? → pallavdholariya@gmail.com  ·  github.com/Shivala-08  ·  or run 'sudo hire-skynet' in the terminal below.",
      dim,
    );
  }, []);

  return null;
}
