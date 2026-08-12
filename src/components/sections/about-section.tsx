import { SectionShell } from "./section-shell";
import { about } from "@/lib/data";

export function AboutSection() {
  return (
    <SectionShell id="about" title="about.me" tag="// identity">
      <div className="grid gap-8 md:grid-cols-[1.6fr_1fr]">
        <div>
          <p className="font-mono text-xs text-accent">{about.handle}</p>
          <h3 className="mt-2 text-2xl font-medium text-ink">{about.name}</h3>
          <p className="mt-1 text-sm text-ink-dim">{about.role}</p>
          <div className="mt-5 space-y-4">
            {about.bio.map((para) => (
              <p key={para.slice(0, 24)} className="max-w-xl text-sm leading-relaxed text-ink-dim">
                {para}
              </p>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-1.5">
            {about.focus.map((f) => (
              <span key={f} className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-[10px] text-accent-soft">
                {f}
              </span>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-line bg-surface-2/40 p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">sysinfo</p>
            <dl className="mt-3 space-y-2">
              {about.facts.map((f) => (
                <div key={f.label} className="flex items-baseline justify-between gap-3">
                  <dt className="font-mono text-[11px] text-ink-faint">{f.label}</dt>
                  <dd className="text-right font-mono text-[11px] text-ink">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-lg border border-dashed border-line p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">quick start</p>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-ink-dim">
              <span className="text-accent">$</span> whoami
              <br />
              pallav@ailab-os
              <br />
              <span className="text-accent">$</span> open projects
            </p>
          </div>
        </aside>
      </div>
    </SectionShell>
  );
}
