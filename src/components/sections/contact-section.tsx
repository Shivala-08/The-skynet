import { SectionShell } from "./section-shell";
import { contact } from "@/lib/data";
import { GithubIcon, LinkedinIcon, MailIcon, FileIcon } from "@/components/icons";

const channels = [
  { label: "email", value: contact.email, href: `mailto:${contact.email}`, icon: <MailIcon className="h-4 w-4" /> },
  { label: "github", value: contact.github, href: contact.github, icon: <GithubIcon className="h-4 w-4" /> },
  { label: "linkedin", value: contact.linkedin, href: contact.linkedin, icon: <LinkedinIcon className="h-4 w-4" /> },
  { label: "resume / cv", value: "resume.pdf", href: contact.resume, icon: <FileIcon className="h-4 w-4" /> },
];

export function ContactSection() {
  return (
    <SectionShell id="contact" title="contact.sh" tag="// open channel">
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-ink-dim">{contact.note}</p>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {channels.map((c) => (
          <a
            key={c.label}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-lg border border-line-soft bg-surface-2/40 p-4 transition-colors hover:border-accent/40 hover:bg-accent/5"
          >
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint transition-colors group-hover:text-accent">
              {c.icon}
              {c.label}
            </span>
            <span className="mt-3 block break-all font-mono text-xs text-ink-dim transition-colors group-hover:text-ink">
              {c.value}
            </span>
          </a>
        ))}
      </div>
      <p className="mt-6 font-mono text-[11px] text-ink-faint">
        or run <span className="text-accent">contact</span> in the terminal — same output, more style.
      </p>
    </SectionShell>
  );
}
