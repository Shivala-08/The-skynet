import type { ReactNode } from "react";
import { Reveal } from "@/components/reveal";
import type { SectionId } from "@/lib/data";

type SectionShellProps = {
  id: SectionId;
  title: string;
  tag: string;
  children: ReactNode;
};

export function SectionShell({ id, title, tag, children }: SectionShellProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mx-auto w-full max-w-5xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20">
      <Reveal className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_28px_90px_-40px_rgba(0,0,0,0.9)]">
        <header className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-4 py-3 sm:px-5">
          <span className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
          </span>
          <h2 id={`${id}-title`} className="font-mono text-sm text-ink">
            {title}
          </h2>
          <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-faint">{tag}</span>
        </header>
        <div className="p-5 sm:p-8">{children}</div>
      </Reveal>
    </section>
  );
}
