"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";
import { BootScreen } from "./boot-screen";
import { TopBar } from "./top-bar";
import { Desktop } from "./desktop";
import { TaskBar } from "./task-bar";
import { FloatingWindow, type WindowState } from "./window";
import { Terminal } from "@/components/apps/terminal";
import { Files } from "@/components/apps/files";
import { ResearchSection } from "@/components/sections/research-section";
import { BuildsSection } from "@/components/sections/builds-section";
import { SystemsSection } from "@/components/sections/systems-section";
import { AboutSection } from "@/components/sections/about-section";
import { ContactSection } from "@/components/sections/contact-section";
import { FolderIcon, TerminalIcon } from "@/components/icons";
import { OPEN_PROJECT_EVENT } from "@/lib/events";
import { scrollToId as scrollToSectionId } from "@/lib/scroll";
import dynamic from "next/dynamic";

// Lazy-load GSAP scroll choreography — only needed after boot, off the critical path.
const ScrollChoreography = dynamic(
  () => import("./scroll-choreography").then((m) => m.ScrollChoreography),
  { ssr: false, loading: () => null },
);
import { projects, sections, type FloatingAppId, type SectionId } from "@/lib/data";
import { resolve, type Cursor } from "@/lib/fs";

const DEFAULT_SIZE: Record<FloatingAppId, { w: number; h: number }> = {
  terminal: { w: 660, h: 430 },
  files: { w: 860, h: 520 },
};

function freshWindows(): Record<FloatingAppId, WindowState> {
  return {
    terminal: { open: false, minimized: false, z: 20, x: 0, y: 0, w: 660, h: 430, placed: false },
    files: { open: false, minimized: false, z: 20, x: 0, y: 0, w: 860, h: 520, placed: false },
  };
}

export function PallavOS() {
  const [booted, setBooted] = useState(false);
  const [win, setWin] = useState<Record<FloatingAppId, WindowState>>(freshWindows);
  const [filesPath, setFilesPath] = useState("/");
  const zTop = useRef(20);

  const focusApp = useCallback((id: FloatingAppId) => {
    zTop.current += 1;
    setWin((prev) => ({ ...prev, [id]: { ...prev[id], z: zTop.current, minimized: false } }));
  }, []);

  const openApp = useCallback((id: FloatingAppId) => {
    zTop.current += 1;
    setWin((prev) => {
      const s = prev[id];
      const size = DEFAULT_SIZE[id];
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let x = s.x;
      let y = s.y;
      if (!s.placed) {
        const offset = id === "files" ? 26 : -22;
        x = Math.max(12, Math.round(vw / 2 - size.w / 2) + offset);
        y = Math.max(64, Math.round(vh / 2 - size.h / 2) - 20);
      }
      return { ...prev, [id]: { ...s, open: true, minimized: false, placed: true, z: zTop.current, x, y } };
    });
  }, []);

  const closeApp = useCallback((id: FloatingAppId) => {
    setWin((prev) => ({ ...prev, [id]: { ...prev[id], open: false, minimized: false } }));
  }, []);

  const minimizeApp = useCallback((id: FloatingAppId) => {
    setWin((prev) => ({ ...prev, [id]: { ...prev[id], minimized: true } }));
  }, []);

  const moveApp = useCallback(
    (id: FloatingAppId) => (x: number, y: number) =>
      setWin((prev) => ({ ...prev, [id]: { ...prev[id], x, y } })),
    [],
  );

  const resizeApp = useCallback(
    (id: FloatingAppId) => (w: number, h: number) =>
      setWin((prev) => ({ ...prev, [id]: { ...prev[id], w, h } })),
    [],
  );

  const scrollToSection = useCallback((id: SectionId) => {
    scrollToSectionId(id);
  }, []);

  const openProject = useCallback(
    (slug: string) => {
      setFilesPath(`/projects/${slug}`);
      openApp("files");
    },
    [openApp],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      openProject((e as CustomEvent<string>).detail);
    };
    window.addEventListener(OPEN_PROJECT_EVENT, handler);
    return () => window.removeEventListener(OPEN_PROJECT_EVENT, handler);
  }, [openProject]);

  const handleTerminalOpen = useCallback(
    (target: string, cwd: Cursor): boolean => {
      const t = target.trim().toLowerCase();
      if (t === "files" || t === "terminal") {
        openApp(t);
        return true;
      }
      if (t === "projects") {
        setFilesPath("/projects");
        openApp("files");
        return true;
      }
      if (sections.some((s) => s.id === t || s.label.toLowerCase() === t)) {
        const id = sections.find((s) => s.id === t || s.label.toLowerCase() === t)!.id;
        scrollToSection(id);
        return true;
      }
      if (projects.some((p) => p.slug === t)) {
        openProject(t);
        return true;
      }
      // Try to resolve as a relative path in the virtual filesystem
      const resolved = resolve(cwd, target);
      if (resolved) {
        setFilesPath(resolved);
        openApp("files");
        return true;
      }
      return false;
    },
    [openApp, openProject, scrollToSection],
  );

  const handleBootDone = useCallback(() => setBooted(true), []);

  const topZ = Math.max(...(Object.values(win) as WindowState[]).map((w) => (w.open && !w.minimized ? w.z : -1)));

  return (
    <MotionConfig reducedMotion="user">
    <div id="top" className="relative min-h-dvh">
      {!booted && <BootScreen onDone={handleBootDone} />}

      <TopBar onOpenApp={openApp} />
      <Desktop onOpenApp={openApp} booted={booted} />

      <main id="content" className="relative z-10">
        <ResearchSection />
        <BuildsSection />
        <SystemsSection />
        <AboutSection />
        <ContactSection />
      </main>

      <ScrollChoreography />

      <TaskBar windows={win} onOpen={openApp} onMinimize={minimizeApp} onFocus={focusApp} />

      <FloatingWindow
        title="Terminal — pallav@ailab-os"
        icon={<TerminalIcon className="h-3.5 w-3.5" />}
        state={win.terminal}
        focused={win.terminal.open && !win.terminal.minimized && win.terminal.z === topZ}
        onFocus={() => focusApp("terminal")}
        onClose={() => closeApp("terminal")}
        onMinimize={() => minimizeApp("terminal")}
        onMove={moveApp("terminal")}
        onResize={resizeApp("terminal")}
      >
        <Terminal onOpen={handleTerminalOpen} onExit={() => closeApp("terminal")} />
      </FloatingWindow>

      <FloatingWindow
        title="Files — lab filesystem"
        icon={<FolderIcon className="h-3.5 w-3.5" />}
        state={win.files}
        focused={win.files.open && !win.files.minimized && win.files.z === topZ}
        onFocus={() => focusApp("files")}
        onClose={() => closeApp("files")}
        onMinimize={() => minimizeApp("files")}
        onMove={moveApp("files")}
        onResize={resizeApp("files")}
      >
        <Files path={filesPath} onNavigate={setFilesPath} />
      </FloatingWindow>
    </div>
    </MotionConfig>
  );
}
