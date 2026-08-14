"use client";

import { useEffect, useRef, useState } from "react";

const LINES = [
  "SKYNET.OS BIOS v1.0 — POST ok",
  "mounting /home/skynet ........ ok",
  "loading research.log ........ ok",
  "loading neural net .......... ok",
  "terminal ready — type 'help'",
];

export function BootScreen({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(0);
  // "leaving" = letterbox bars retract + text fades before onDone fires.
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      doneRef.current = true;
      onDoneRef.current();
      return;
    }
    if (shown >= LINES.length) {
      const t = setTimeout(() => {
        // Phase 2: the letterbox opens. onDone fires after the bars retract.
        setLeaving(true);
        const t2 = setTimeout(() => {
          doneRef.current = true;
          onDoneRef.current();
        }, 750);
        return () => clearTimeout(t2);
      }, 120);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShown((s) => s + 1), 130);
    return () => clearTimeout(t);
  }, [shown]);

  useEffect(() => {
    const skip = () => {
      if (!doneRef.current) {
        doneRef.current = true;
        onDoneRef.current();
      }
    };
    // Skip the boot on repeat visits within this tab session.
    if (sessionStorage.getItem("skynet-os-booted")) {
      skip();
      return;
    }
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, []);

  useEffect(() => {
    if (shown >= LINES.length) {
      try {
        sessionStorage.setItem("skynet-os-booted", "1");
      } catch {
        /* storage unavailable — boot still works, just shows again */
      }
    }
  }, [shown]);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-canvas" aria-hidden="true">
      {/* Letterbox bars — slide open when the boot text finishes */}
      <div
        className={`absolute inset-x-0 top-0 z-10 bg-black transition-[height] duration-700 ease-in-out ${
          leaving ? "h-0" : "h-[16dvh] min-h-24"
        }`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 z-10 bg-black transition-[height] duration-700 ease-in-out ${
          leaving ? "h-0" : "h-[16dvh] min-h-24"
        }`}
      />

      {/* Subtle scanline film texture over everything */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0 2px, #fff 2px 3px)",
        }}
      />

      <div
        className={`relative z-[5] flex h-full flex-col items-center justify-center transition-opacity duration-300 ${
          leaving ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* Title stamp — the film title card */}
        <div className="mb-8 flex items-center gap-3">
          <span className="h-px w-10 bg-accent/60" aria-hidden="true" />
          <p className="font-mono text-[11px] uppercase tracking-[0.45em] text-accent">
            Pallav // AI Lab OS
          </p>
          <span className="h-px w-10 bg-accent/60" aria-hidden="true" />
        </div>

        <div className="w-full max-w-md px-6 font-mono text-sm">
          {LINES.slice(0, shown).map((line, i) => (
            <p key={line} className={i === 0 ? "text-accent" : "text-ink-dim"}>
              {line}
            </p>
          ))}
          {shown < LINES.length && <span className="mt-0.5 inline-block h-4 w-2 animate-blink bg-accent" />}
        </div>
        <div className="mt-8 h-px w-56 bg-line" aria-hidden="true">
          <div className="h-px animate-boot-bar bg-accent" />
        </div>
        <p className="mt-4 font-mono text-[11px] text-ink-faint">press any key to skip</p>
      </div>
    </div>
  );
}
