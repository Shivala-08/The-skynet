"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MinusIcon, XIcon } from "@/components/icons";

export type WindowState = {
  open: boolean;
  minimized: boolean;
  z: number;
  x: number;
  y: number;
  w: number;
  h: number;
  placed: boolean;
};

type FloatingWindowProps = {
  title: string;
  icon?: ReactNode;
  state: WindowState;
  focused: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  children: ReactNode;
};

export function FloatingWindow({
  title,
  icon,
  state,
  focused,
  onFocus,
  onClose,
  onMinimize,
  onMove,
  onResize,
  children,
}: FloatingWindowProps) {
  const drag = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const resize = useRef({ active: false, sx: 0, sy: 0, ow: 0, oh: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Move focus into the window when it opens, unless a child (e.g. the
  // terminal input) already claimed it.
  useEffect(() => {
    if (!state.open || state.minimized) return;
    const el = rootRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      if (!el.contains(document.activeElement)) el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [state.open, state.minimized]);

  // Escape closes the focused window (unless a nested input handles it first).
  useEffect(() => {
    if (!focused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, onClose]);


  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (window.innerWidth < 768) return;
    if ((e.target as HTMLElement).closest("button")) return;
    onFocus();
    drag.current = { active: true, sx: e.clientX, sy: e.clientY, ox: state.x, oy: state.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.active) return;
    const nx = Math.min(Math.max(d.ox + e.clientX - d.sx, -state.w + 140), window.innerWidth - 140);
    const ny = Math.min(Math.max(d.oy + e.clientY - d.sy, 8), window.innerHeight - 64);
    onMove(nx, ny);
  };
  const endDrag = () => {
    drag.current.active = false;
  };

  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (window.innerWidth < 768) return;
    onFocus();
    resize.current = { active: true, sx: e.clientX, sy: e.clientY, ow: state.w, oh: state.h };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = resize.current;
    if (!r.active) return;
    const nw = Math.min(Math.max(r.ow + e.clientX - r.sx, 360), window.innerWidth - 40);
    const nh = Math.min(Math.max(r.oh + e.clientY - r.sy, 240), window.innerHeight - 80);
    onResize(nw, nh);
  };
  const endResize = () => {
    resize.current.active = false;
  };

  const windowTransition = reduce
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.32, 0.72, 0, 1] as const };

  return (
    <AnimatePresence initial={false}>
      {state.open && (
        <motion.div
          key={title}
          ref={rootRef}
          role="dialog"
          aria-label={title}
          tabIndex={-1}
          inert={state.minimized}
          className={`fixed flex flex-col overflow-hidden rounded-xl border bg-surface shadow-[0_32px_90px_-24px_rgba(0,0,0,0.9)] max-md:!left-2 max-md:!right-2 max-md:!top-16 max-md:!bottom-14 max-md:!h-auto max-md:!w-auto ${
            focused ? "border-accent/35" : "border-line"
          }`}
          style={{ left: state.x, top: state.y, width: state.w, height: state.h, zIndex: state.z }}
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{
            opacity: state.minimized ? 0 : 1,
            scale: state.minimized ? 0.97 : 1,
            y: state.minimized ? 6 : 0,
          }}
          exit={{ opacity: 0, scale: 0.97, y: 6 }}
          transition={windowTransition}
          onPointerDown={onFocus}
        >
          <div
            className="flex h-10 shrink-0 cursor-grab touch-none select-none items-center gap-3 border-b border-line bg-surface-2/70 px-3 active:cursor-grabbing"
            onPointerDown={startDrag}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <span className="flex items-center gap-1.5" aria-hidden="true">
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Close ${title}`}
                onClick={onClose}
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#ff5f57] transition-transform hover:scale-110"
              >
                <XIcon className="h-2 w-2 text-black/70" />
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Minimize ${title}`}
                onClick={onMinimize}
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#febc2e] transition-transform hover:scale-110"
              >
                <MinusIcon className="h-2 w-2 text-black/70" />
              </button>
            </span>
            {icon && <span className="text-ink-faint">{icon}</span>}
            <span className={`truncate font-mono text-xs ${focused ? "text-ink" : "text-ink-dim"}`}>{title}</span>
          </div>

          <div className="min-h-0 flex-1 bg-canvas/40">{children}</div>

          <div
            aria-hidden="true"
            className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-se-resize touch-none"
            onPointerDown={startResize}
            onPointerMove={onResizeMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
