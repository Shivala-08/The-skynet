"use client";

import type { ReactNode } from "react";
import { type FloatingAppId } from "@/lib/data";
import { useClock } from "@/lib/use-clock";
import { FolderIcon, LogoMark, TerminalIcon } from "@/components/icons";
import type { WindowState } from "./window";

const appMeta: Record<FloatingAppId, { label: string; icon: ReactNode }> = {
  terminal: { label: "Terminal", icon: <TerminalIcon className="h-3.5 w-3.5" /> },
  files: { label: "Files", icon: <FolderIcon className="h-3.5 w-3.5" /> },
};

type TaskBarProps = {
  windows: Record<FloatingAppId, WindowState>;
  onOpen: (app: FloatingAppId) => void;
  onMinimize: (app: FloatingAppId) => void;
  onFocus: (app: FloatingAppId) => void;
};

export function TaskBar({ windows, onOpen, onMinimize, onFocus }: TaskBarProps) {
  const clock = useClock();
  const topZ = Math.max(...(Object.values(windows) as WindowState[]).map((w) => (w.open && !w.minimized ? w.z : -1)));

  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 flex h-12 items-center gap-2 border-t border-line bg-canvas/85 px-3 backdrop-blur-md">
      <a
        href="#top"
        className="flex h-8 items-center gap-2 rounded-md px-2.5 font-mono text-[11px] tracking-widest text-ink transition-colors hover:bg-surface-2"
        aria-label="Skynet AI Lab OS — back to top"
      >
        <LogoMark className="h-3.5 w-3.5 text-accent" />
        SKYNET
      </a>
      <div className="mx-1 h-5 w-px bg-line" aria-hidden="true" />

      <div className="flex items-center gap-1.5">
        {(Object.keys(appMeta) as FloatingAppId[]).map((id) => {
          const st = windows[id];
          const active = st.open && !st.minimized && st.z === topZ;
          return (
            <button
              key={id}
              type="button"
              aria-label={appMeta[id].label}
              aria-pressed={active}
              onClick={() => {
                if (!st.open || st.minimized) onOpen(id);
                else if (active) onMinimize(id);
                else onFocus(id);
              }}
              className={`flex h-8 items-center gap-2 rounded-md border px-2.5 font-mono text-[11px] transition-colors ${
                active
                  ? "border-accent/40 bg-accent/10 text-ink"
                  : "border-transparent text-ink-dim hover:bg-surface-2 hover:text-ink"
              }`}
            >
              {appMeta[id].icon}
              <span className="hidden sm:inline">{appMeta[id].label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1" />
      <span className="font-mono text-[11px] tabular-nums text-ink-faint">{clock}</span>
    </footer>
  );
}
