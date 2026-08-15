// ---------------------------------------------------------------------------
// PrintResume — a clean, single-page, print-ready resume driven by the same
// content layer as the OS (src/lib/data.ts).
//
// Invisible on screen (see .print-resume in globals.css); when the visitor
// hits Ctrl/Cmd+P the OS shell is hidden and only this document prints.
// ---------------------------------------------------------------------------

import { about, contact, projects, researchLog } from "@/lib/data";

export function PrintResume() {
  return (
    <div className="print-resume" aria-hidden="true">
      <header className="pr-header">
        <h1>{about.name}</h1>
        <p className="pr-role">{about.role}</p>
        <p className="pr-contact">
          {contact.email} · {contact.github.replace(/^https?:\/\//, "")} ·{" "}
          {contact.linkedin.replace(/^https?:\/\//, "")}
        </p>
      </header>

      <section className="pr-section">
        <h2>About</h2>
        {about.bio.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p className="pr-meta">Focus: {about.focus.join(" · ")}</p>
      </section>

      <section className="pr-section">
        <h2>Selected Projects</h2>
        {projects.map((p) => (
          <article key={p.slug} className="pr-project">
            <div className="pr-project-head">
              <span className="pr-project-name">{p.name}</span>
              <span className="pr-project-meta">
                {p.year} · {p.status}
              </span>
            </div>
            <p className="pr-project-tagline">{p.tagline}</p>
            <p className="pr-project-desc">{p.description}</p>
            <p className="pr-project-stack">{p.stack.join(" · ")}</p>
          </article>
        ))}
      </section>

      <section className="pr-section">
        <h2>Research Path</h2>
        <ul className="pr-research">
          {researchLog.map((r) => (
            <li key={r.id}>
              {r.title} <span className="pr-meta">— {r.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="pr-section">
        <h2>Education</h2>
        <p>
          B.Tech, Computer Science (AI/ML) — Newton School of Technology, Pune
          <span className="pr-meta"> · in progress</span>
        </p>
      </section>

      <footer className="pr-footer">
        Printed from SKYNET // AI LAB OS · {contact.resume}
      </footer>
    </div>
  );
}
