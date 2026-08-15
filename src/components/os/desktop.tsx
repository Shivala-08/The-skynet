"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";

// Lazy-load the 3D scene — the in-house MiniRenderer (~24KB) only loads
// after WebGL is detected and the boot screen finishes.
const NeuralLab = dynamic(() => import("@/components/lab/neural-lab").then((m) => m.NeuralLab), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 z-0 flex items-center justify-center" aria-hidden="true">
      <div className="relative h-40 w-40">
        {/* Outer ring — slow pulse */}
        <div className="absolute inset-0 rounded-full border border-accent/20 animate-pulse-dot" />
        {/* Inner ring — faster pulse, offset timing */}
        <div className="absolute inset-4 rounded-full border border-accent/10" style={{ animation: "pulse-dot 1.4s ease-in-out 0.3s infinite" }} />
        {/* Center dot */}
        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/40" />
      </div>
    </div>
  ),
});
import { sections, type FloatingAppId } from "@/lib/data";
import { detectWebGL } from "@/lib/webgl";
import { TrainModel } from "@/components/lab/train-model";
import { LobeLabel } from "@/components/lab/lobe-label";
import { HeroTooltip } from "@/components/lab/hero-tooltip";
import {
  AboutIcon,
  BuildsIcon,
  ChevronDownIcon,
  FolderIcon,
  MailIcon,
  ResearchIcon,
  SystemsIcon,
  TerminalIcon,
} from "@/components/icons";

const apps: { id: FloatingAppId; label: string; icon: ReactNode }[] = [
  { id: "terminal", label: "Terminal", icon: <TerminalIcon className="h-5 w-5" /> },
  { id: "files", label: "Files", icon: <FolderIcon className="h-5 w-5" /> },
];

const sectionIcons: Record<string, ReactNode> = {
  research: <ResearchIcon className="h-5 w-5" />,
  builds: <BuildsIcon className="h-5 w-5" />,
  systems: <SystemsIcon className="h-5 w-5" />,
  about: <AboutIcon className="h-5 w-5" />,
  contact: <MailIcon className="h-5 w-5" />,
};

type DesktopProps = {
  onOpenApp: (app: FloatingAppId) => void;
  booted: boolean;
};

export function Desktop({ onOpenApp, booted }: DesktopProps) {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  // The 3D brain is a backdrop, not content — the hero text and icon grid
  // are DOM and need no WebGL. Mounting it right at boot still parses the
  // renderer on the main thread inside the interaction window, so mount
  // only when the main thread is idle, with a hard timeout so the brain
  // always appears.
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setWebgl(detectWebGL()), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!booted) return;
    let cancelled = false;
    const ready = () => {
      if (!cancelled) setSceneReady(true);
    };
    const id =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(ready, { timeout: 2500 })
        : window.setTimeout(ready, 2500);
    return () => {
      cancelled = true;
      if (typeof id === "number") window.clearTimeout(id);
      else window.cancelIdleCallback(id);
    };
  }, [booted]);

  return (
    <section
      aria-label="Desktop"
      className="sticky top-0 z-0 flex min-h-[calc(100dvh-6rem)] flex-col items-center overflow-hidden bg-glow pt-12"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_75%_65%_at_50%_40%,black_35%,transparent_75%)]"
      />

      {/* 3D brain backdrop — interactive, rotates on drag, disperses on scroll.
          Mounted on idle so the page is interactive before WebGL parses. */}
      {webgl && booted && sceneReady && <NeuralLab booted={booted} onOpenApp={onOpenApp} />}

      {/* NEURAL CORE — train-the-network control (only when the 3D brain is live) */}
      {webgl && booted && sceneReady && <TrainModel />}

      {/* Hover labels for the lobe landmarks in the 3D brain */}
      {webgl && booted && sceneReady && <LobeLabel />}

      {/* Hover tooltip for the hero scene shapes (AI Core / DeployForge / Synapse) */}
      {webgl && booted && sceneReady && <HeroTooltip />}

      <div className="pointer-events-none relative z-10 mx-auto w-full max-w-3xl px-6 pt-14 text-center sm:pt-16">
        <p className="pointer-events-auto font-mono text-xs text-accent sm:text-sm">{"// AI LAB OS · v1.0 · neural net online"}</p>
        <h1 className="pointer-events-auto mt-5 text-6xl font-semibold tracking-tight text-ink sm:text-8xl">SKYNET</h1>
        <p className="pointer-events-auto mx-auto mt-5 max-w-xl text-base text-ink-dim sm:text-lg">
          Judgment Day was supposed to be the finished project.
          <br />
          This is the version still in training.
        </p>
      </div>

      {/* Navigation: Desktop icon grid sitting on top of the 3D canvas backdrop */}
      <div className="pointer-events-none relative z-10 flex min-h-[340px] w-full flex-1 items-center justify-center px-4 pb-16 pt-8">
        <div className="pointer-events-auto animate-fade-in">
          <IconGrid apps={apps} sections={sections} onOpenApp={onOpenApp} />
        </div>
      </div>

      <p className="relative z-10 pb-4 font-mono text-[11px] text-ink-faint">
        tab to focus · enter to open
      </p>

      <a
        href="#research"
        className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-ink-faint transition-colors hover:text-accent"
        aria-label="Scroll to research"
      >
        <ChevronDownIcon className="h-5 w-5 animate-pulse-dot" />
      </a>
    </section>
  );
}

function IconGrid({
  apps,
  sections,
  onOpenApp,
}: {
  apps: { id: FloatingAppId; label: string; icon: ReactNode }[];
  sections: { id: string; label: string }[];
  onOpenApp: (app: FloatingAppId) => void;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="mx-auto grid w-fit grid-cols-4 gap-3 sm:grid-cols-7">
      {apps.map((a, i) => (
        <motion.div
          key={a.id}
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={reduce ? false : { opacity: 1, y: 0 }}
          transition={
            reduce ? { duration: 0 } : { duration: 0.4, delay: 0.15 + i * 0.05, ease: [0.22, 1, 0.36, 1] as const }
          }
        >
          <DesktopItem label={a.label} icon={a.icon} onClick={() => onOpenApp(a.id)} />
        </motion.div>
      ))}
      {sections.map((s, i) => (
        <motion.div
          key={s.id}
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={reduce ? false : { opacity: 1, y: 0 }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 0.4, delay: 0.15 + (i + apps.length) * 0.05, ease: [0.22, 1, 0.36, 1] as const }
          }
        >
          <DesktopItem label={s.label} icon={sectionIcons[s.id]} href={`#${s.id}`} />
        </motion.div>
      ))}
    </div>
  );
}

function DesktopItem({
  label,
  icon,
  href,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  const cls =
    "group flex w-[76px] flex-col items-center gap-2.5 rounded-lg border border-line-soft bg-surface/50 px-2 py-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-accent/[0.06] focus-visible:-translate-y-0.5";
  const inner = (
    <>
      <span className="text-ink-faint transition-colors group-hover:text-accent">{icon}</span>
      <span className="text-xs text-ink-dim transition-colors group-hover:text-ink">{label}</span>
    </>
  );
  return href ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
