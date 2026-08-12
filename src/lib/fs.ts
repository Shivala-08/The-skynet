import { contact, projects, researchLog, type Project } from "./data";

// ---------------------------------------------------------------------------
// A small virtual filesystem powering both the Files app and the Terminal's
// ls / cd / cat commands. Everything is derived from src/lib/data.ts so the
// content never drifts between the two surfaces.
// ---------------------------------------------------------------------------

export type FSNode =
  | { type: "folder"; name: string; children: FSNode[] }
  | { type: "file"; name: string; kind: "md" | "txt"; size: string; content: string };

export type Cursor = string; // e.g. "/projects/udhaar-ledger"

const file = (name: string, kind: "md" | "txt", size: string, content: string): FSNode => ({
  type: "file",
  name,
  kind,
  size,
  content,
});

const folder = (name: string, children: FSNode[]): FSNode => ({ type: "folder", name, children });

// ---- generated documents ---------------------------------------------------

function projectReadme(p: Project): string {
  return [
    `# ${p.name}`,
    p.tagline,
    "",
    `STATUS: ${p.status} · ${p.year}`,
    "",
    p.description,
    "",
    "## STACK",
    ...p.stack.map((s) => `- ${s}`),
    "",
    "## PIPELINE",
    ...p.pipeline.map((s, i) => `${i + 1}. ${s.label} — ${s.blurb}${s.detail ? `\n   ${s.detail}` : ""}`),
    "",
    ...(p.link ? ["\u27a1  Live: " + p.link] : []),
    `Open this project from the desktop, or run:  open ${p.slug}`,
  ].join("\n");
}

const deployforgeText = [
  "DEPLOYFORGE — HOW IT WORKS",
  "",
  "1. Connect — link a GitHub repository to a project.",
  "2. Detect — framework detection configures the right build.",
  "3. Build — isolated build pipelines via GitHub Actions.",
  "4. Process — generated assets prepared for serving.",
  "5. Deploy — Git-backed infrastructure ships it to production.",
  "",
  "A lightweight developer platform, built from scratch.",
].join("\n");

const marlboroText = [
  "MARLBORO RED — IMMERSIVE BRAND EXPERIENCE",
  "",
  "A cinematic brand experience: scroll-driven animations, smooth",
  "transitions, layered typography and interactive storytelling.",
  "",
  "React + TypeScript + Vite, Framer Motion, Lenis, 3D/WebGL.",
].join("\n");

const omnitrixText = [
  "OMNITRIX OS — EXPERIENCE LAYERS",
  "",
  "- Render: real-time 3D scene, cinematic animation",
  "- Interact: interactive controls + dynamic UI systems",
  "- Listen: audio feedback + voice interactions",
  "- Transform: the interface shifts like the Omnitrix",
  "",
  "A website that feels more like an operating system.",
].join("\n");

const ben10Text = [
  "BEN 10 OS — IMMERSIVE 3D EXPERIENCE",
  "",
  "- Render: real-time 3D scene with Ben 10 themed visuals",
  "- Interact: interactive controls + dynamic UI systems",
  "- Animate: GSAP-powered transitions and motion design",
  "- Theme: Ben 10 visual identity woven into every element",
  "",
  "An immersive WebGL experience inspired by the Ben 10 universe.",
].join("\n");

const cinevaultText = [
  "CINEVAULT — THE EXPERIENCE",
  "",
  "- Browse: cinematic, animated browsing across the catalogue",
  "- Discover: infinite discovery powered by movie APIs",
  "- Curate: watchlists, favorites, mood-based exploration",
  "- Explore: detailed movie experiences",
  "",
  "A movie database turned into a polished consumer product.",
].join("\n");

const synapseText = [
  "SYNAPSE — RETRIEVAL PIPELINE",
  "",
  "1. Ingest — parse regulatory + operational documents",
  "2. Index — hybrid search + knowledge graph",
  "3. Retrieve — semantic retrieval with caching",
  "4. Route — adaptive LLM routing per query",
  "5. Answer — citation-backed answers + confidence scoring",
  "",
  "Actionable insight from complex documents, traceable to a source.",
].join("\n");

const rootReadme = [
  "# SKYNET — AI LAB OS",
  "",
  "AI/ML student. I build systems where models are part of a working product,",
  "not a demo.",
  "",
  "## CURRENT FOCUS",
  "- LLMs & AI agents — reasoning, tool use, orchestration",
  "- End-to-end products (see /projects)",
  "",
  "## RESEARCH PATH",
  "01 Probability & Statistics",
  "02 Linear Algebra",
  "03 Regression",
  "04 Neural Networks",
  "05 Transformers",
  "06 LLMs",
  "07 AI Agents",
  "",
  "## RUN",
  "- `open projects` — browse the builds",
  "- `open <project>` — jump to a project folder",
  "- `open research` — research.log",
  "- `whoami` — who is behind this OS",
].join("\n");

const contactReadme = [
  "# CONTACT",
  "",
  `email    ${contact.email}`,
  `github   ${contact.github}`,
  `linkedin ${contact.linkedin}`,
  "",
  contact.note,
].join("\n");

const researchLogText = [
  `RESEARCH.LOG — ${researchLog.length} ENTRIES`, 
  "",
  ...researchLog.map((r) => `${String(r.id).padStart(2, "0")} ${r.title} — ${r.tag}${r.diagram?.length ? " [interactive]" : ""}`),
  "",
  "Each entry is a topic actually studied. Topics marked [interactive] expand",
  "into step-through diagrams on the site. Nothing is inflated to fill the list.",
].join("\n");

const systemsWorkflow = [
  "SYSTEMS — WORKFLOW LOG",
  "",
  "SYNAPSE — AGENT ARCHITECTURE",
  "",
  "A multi-agent RAG pipeline for industrial intelligence:",
  "",
  "1. Orchestrator — query decomposition and pipeline coordination",
  "2. Retrieval Agent — hybrid search + knowledge graph traversal",
  "3. Routing Agent — complexity scoring and LLM selection",
  "4. Synthesis Agent — grounded answer generation with citations",
  "5. Confidence Scorer — evidence evaluation and score assignment",
  "",
  "Every stage is real. Nothing is invented to fill the slot.",
].join("\n");

// ---- tree ------------------------------------------------------------------

const extraFiles: Record<string, FSNode[]> = {
  synapse: [file("pipeline.txt", "txt", "0.8 KB", synapseText)],
  deployforge: [file("deploy.txt", "txt", "0.6 KB", deployforgeText)],
  "omnitrix-os": [file("experience.txt", "txt", "0.8 KB", omnitrixText)],
  "ben-10-os": [file("experience.txt", "txt", "0.7 KB", ben10Text)],
  cinevault: [file("experience.txt", "txt", "0.6 KB", cinevaultText)],
  "marlboro-red": [file("brand.txt", "txt", "0.6 KB", marlboroText)],
};

export const rootFs: FSNode = folder("~", [
  file("README.md", "md", "1.4 KB", rootReadme),
  file("contact.md", "md", "0.4 KB", contactReadme),
  folder(
    "projects",
    projects.map((p) =>
      folder(p.slug, [
        file("README.md", "md", "2.2 KB", projectReadme(p)),
        ...(extraFiles[p.slug] ?? []),
      ]),
    ),
  ),
  folder("research", [file("log.md", "md", "0.8 KB", researchLogText)]),
  folder("systems", [file("workflow.md", "md", "0.6 KB", systemsWorkflow)]),
]);

// ---- path helpers ----------------------------------------------------------

export function displayPath(cursor: Cursor): string {
  const parts = cursor.split("/").filter(Boolean);
  return parts.length === 0 ? "~" : `~/${parts.join("/")}`;
}

export function join(cursor: Cursor, name: string): Cursor {
  const parts = cursor.split("/").filter(Boolean);
  parts.push(name);
  return "/" + parts.join("/");
}

export function getNode(cursor: Cursor): FSNode | null {
  let node: FSNode = rootFs;
  for (const part of cursor.split("/").filter(Boolean)) {
    if (node.type !== "folder") return null;
    const next = node.children.find((c) => c.name === part);
    if (!next) return null;
    node = next;
  }
  return node;
}

export function getEntries(cursor: Cursor): FSNode[] {
  const node = getNode(cursor);
  return node && node.type === "folder" ? node.children : [];
}

/**
 * Resolves a terminal-style path argument ("README.md", "..", "projects/x")
 * against a working directory. Returns null when any segment is missing.
 */
export function resolve(cwd: Cursor, arg: string): Cursor | null {
  const parts = cwd.split("/").filter(Boolean);
  for (const seg of arg.trim().split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "~") {
      parts.length = 0;
      continue;
    }
    if (seg === "..") {
      parts.pop();
      continue;
    }
    const dir = "/" + parts.join("/");
    const node = getNode(dir);
    if (!node || node.type !== "folder") return null;
    if (!node.children.some((c) => c.name === seg)) return null;
    parts.push(seg);
  }
  const out = "/" + parts.join("/");
  return getNode(out) ? out : null;
}
