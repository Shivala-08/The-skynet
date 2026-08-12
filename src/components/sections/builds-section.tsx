import { SectionShell } from "./section-shell";
import { StepDiagram } from "./step-diagram";
import { projects, type ProjectStatus } from "@/lib/data";
import { OpenInFilesLink } from "@/components/os/open-in-files";
import { Reveal } from "@/components/reveal";

const statusColor: Record<ProjectStatus, string> = {
  live: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  "in development": "border-amber-400/25 bg-amber-400/10 text-amber-300",
  concept: "border-zinc-400/25 bg-zinc-400/10 text-zinc-300",
  hobby: "border-violet-400/25 bg-violet-400/10 text-violet-300",
};

export function BuildsSection() {
  const liveProjects = projects.filter((p) => p.link);

  return (
    <SectionShell id="builds" title="builds.exe" tag={`// 0${projects.length} projects`}>
      <p className="mb-8 max-w-2xl text-sm leading-relaxed text-ink-dim">
        Systems, not screenshots. Each build is a system diagram you can walk through — click a stage to see what
        it actually does. Every project also lives on the lab filesystem, so you can open its folder and read the
        source of truth.
      </p>

      {/* Quick links section — all live demos at a glance */}
      {liveProjects.length > 0 && (
        <div className="mb-8 rounded-lg border border-accent/20 bg-accent/5 p-4">
          <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-accent-soft">
            Live Demos — Click to explore
          </h3>
          <div className="flex flex-wrap gap-3">
            {liveProjects.map((p) => (
              <a
                key={p.slug}
                href={p.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-md border border-accent/30 bg-accent/10 px-4 py-2.5 font-mono text-sm text-accent transition-all hover:bg-accent/20 hover:border-accent/50 hover:shadow-[0_0_20px_rgba(77,141,255,0.2)]"
              >
                <span className="text-base">➡</span>
                <span className="font-medium">{p.name}</span>
                <span className="text-[10px] text-ink-faint group-hover:text-accent-soft transition-colors">
                  {p.status === "live" ? "● live" : "○ " + p.status}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {projects.map((p, i) => (
          <Reveal key={p.slug} delay={i * 0.05}>
            <article className="rounded-lg border border-line-soft bg-surface-2/40 p-5 sm:p-6">
              <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-lg font-medium text-ink">{p.name}</h3>
                <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${statusColor[p.status]}`}>
                  {p.status}
                </span>
                <span className="font-mono text-[11px] text-ink-faint">{p.year}</span>
              </header>
              <p className="mt-1.5 text-sm italic text-accent-soft">{p.tagline}</p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-dim">{p.description}</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.stack.map((s) => (
                  <span key={s} className="rounded border border-line px-2 py-0.5 font-mono text-[10px] text-ink-faint">
                    {s}
                  </span>
                ))}
              </div>

              <div className="mt-5">
                <StepDiagram steps={p.pipeline} label={p.name} />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line-soft pt-4">
                <OpenInFilesLink slug={p.slug} />
                {p.link && (
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open ${p.name} live demo: ${p.link}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 font-mono text-xs text-accent transition-all hover:bg-accent/20 hover:border-accent/50 hover:shadow-[0_0_15px_rgba(77,141,255,0.15)]"
                  >
                    <span className="text-sm">➡</span>
                    live demo
                  </a>
                )}
                <span className="font-mono text-[10px] text-ink-faint">or run: open {p.slug}</span>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
