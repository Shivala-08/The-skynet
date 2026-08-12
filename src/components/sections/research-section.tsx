"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SectionShell } from "./section-shell";
import { StepDiagram } from "./step-diagram";
import { ChevronDownIcon } from "@/components/icons";
import { researchLog, type ResearchEntry } from "@/lib/data";

const diagramCount = researchLog.filter((e) => e.diagram?.length).length;

const rowGap = "flex flex-col gap-1.5 py-5 sm:flex-row sm:items-baseline sm:gap-6";

function ResearchRow({ entry }: { entry: ResearchEntry }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const steps = entry.diagram ?? [];
  const hasDiagram = steps.length > 0;

  const number = <span className="font-mono text-sm text-accent">{String(entry.id).padStart(2, "0")}</span>;

  const titleBlock = (
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-base font-medium text-ink">{entry.title}</span>
        <span className="font-mono text-[10px] text-ink-faint">{entry.tag}</span>
      </span>
    </span>
  );

  if (!hasDiagram) {
    return (
      <li className="group">
        <div className={rowGap}>
          {number}
          {titleBlock}
          <span className="shrink-0 self-start font-mono text-[10px] uppercase tracking-wider text-ink-faint sm:self-auto">
            {entry.status}
          </span>
        </div>
        <p className="max-w-xl text-sm text-ink-dim sm:pl-10">{entry.note}</p>
      </li>
    );
  }

  return (
    <li className="group">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`diagram-${entry.id}`}
          className={`w-full text-left ${rowGap}`}
        >
          {number}
          {titleBlock}
          <span className="flex shrink-0 items-center gap-2 self-start font-mono text-[10px] uppercase tracking-wider text-ink-faint transition-colors group-hover:text-accent sm:self-auto">
            {entry.status}
            <ChevronDownIcon
              className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </span>
        </button>
      </h3>
      <p className="max-w-xl text-sm text-ink-dim sm:pl-10">{entry.note}</p>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="diagram"
            id={`diagram-${entry.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-6 sm:pl-10">
              <StepDiagram steps={steps} label={entry.title} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export function ResearchSection() {
  return (
    <SectionShell id="research" title="research.log" tag={`// 0${researchLog.length} entries · ${diagramCount} interactive`}>
      <p className="max-w-2xl text-sm leading-relaxed text-ink-dim">
        A numbered learning log, not a skills bar. Everything below is real work — some studied, some shipped.
        Topics studied in depth expand into diagrams you can step through, one stage at a time.
      </p>
      <ol className="mt-6 divide-y divide-line-soft">
        {researchLog.map((e) => (
          <ResearchRow key={e.id} entry={e} />
        ))}
      </ol>
    </SectionShell>
  );
}
