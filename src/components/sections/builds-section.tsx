import { SectionShell } from "./section-shell";
import { StepDiagram } from "./step-diagram";
import { projects, type ProjectStatus } from "@/lib/data";
import { OpenInFilesLink } from "@/components/os/open-in-files";
import { Reveal } from "@/components/reveal";

// Restrained status colors — only "live" gets the electric-blue accent; the
// rest are neutral ink tones so the palette stays black/white/electric-blue.
const statusColor: Record<ProjectStatus, string> = {
  live: "border-accent/25 bg-accent/10 text-accent-soft",
  "in development": "border-line bg-surface-2/60 text-ink-dim",
  concept: "border-line-soft bg-surface-2/40 text-ink-faint",
  hobby: "border-line-soft bg-surface-2/40 text-ink-faint",
};

export function BuildsSection() {
  const liveProjects = projects.filter((p) => p.link);
  const numWords = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];
  const numWord = numWords[projects.length] || projects.length.toString();

  return (
    <SectionShell id="builds" title="builds.exe" tag={`// 0${projects.length} systems`}>
      <p className="mb-8 max-w-2xl text-sm leading-relaxed text-ink-dim">
        {numWord} systems, each one a diagram you can walk through — click a stage to see what it actually does.
        No screenshots, no mockups: the pipeline is the picture. Every project also lives on the lab
        filesystem, so you can open its folder and read the source of truth.
      </p>

      {/* Quick links — all live demos at a glance */}
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

      {/* Gallery — each system rendered as its own window, the pipeline as the view */}
      <div className="grid gap-6 md:grid-cols-2">
        {projects.map((p, i) => (
          <Reveal key={p.slug} delay={(i % 2) * 0.06}>
            <article className="flex h-full flex-col overflow-hidden rounded-lg border border-line-soft bg-surface-2/40">
              {/* Window chrome */}
              <header className="flex items-center gap-2.5 border-b border-line bg-surface-2/70 px-4 py-2.5">
                <span className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
                </span>
                <h3 className="min-w-0 truncate font-mono text-xs text-ink">{p.name}.exe</h3>
                <span className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${statusColor[p.status]}`}>
                  {p.status}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-ink-faint">{p.year}</span>
              </header>

              <div className="flex flex-1 flex-col p-4 sm:p-5">
                <p className="text-sm italic text-accent-soft">{p.tagline}</p>
                <p className="mt-2.5 max-w-2xl text-[13px] leading-relaxed text-ink-dim">{p.description}</p>

                {/* Stack */}
                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  {p.stack.map((s) => (
                    <span key={s} className="rounded border border-line px-2 py-0.5 font-mono text-[10px] text-ink-faint">
                      {s}
                    </span>
                  ))}
                </div>

                {/* The system itself — the diagram is the view */}
                <div className="mt-4 flex-1">
                  <StepDiagram steps={p.pipeline} label={p.name} />
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line-soft pt-4">
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
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
