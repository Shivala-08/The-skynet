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
        doneRef.current = true;
        onDoneRef.current();
      }, 120);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShown((s) => s + 1), 120);
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
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-canvas" aria-hidden="true">
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
  );
}
