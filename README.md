# PALLAV // AI LAB OS

Personal portfolio for Pallav, built as an interactive AI system — an operating
system whose neural network is the navigation, not a prop. See `CONTEXT.md` for
the standing design rules, and `antigravity-agent-build-brief.md` for the full
mission plan this repo is built from.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- React Three Fiber + Three.js, Framer Motion, Lenis, GSAP + ScrollTrigger
- Web Audio API (procedural drone synthesizer)
- NVIDIA API (chat streaming endpoint)

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

## Mission status

- [x] **M1 — Scaffold + content skeleton** — DOM-only OS shell: boot screen, top
      bar, desktop icon grid, taskbar, draggable Terminal + Files windows, and
      Research / Builds / Systems / About / Contact sections. No animation
      libraries, no 3D.
- [x] **M2 — Motion layer** — Framer Motion window enter/exit + minimize
      transitions, `whileInView` section reveals, desktop icon stagger; Lenis
      smooth scroll with anchor routing and a hard `prefers-reduced-motion`
      gate (Lenis rendered inert, all animation durations zeroed).
- [x] **M3 — 3D shell + neural-network navigation** — React Three Fiber lab in the
      hero: a node-and-edge network where every node is a real link (sections
      scroll, Terminal/Files open windows) rendered via HTML anchors/buttons projected 
      onto the 3D nodes (Tab + Enter reachable), camera moves into the lab after boot, WebGL
      detection with the DOM icon grid as fallback, three.js loaded client-side after the boot screen.
- [x] **M4 — Research: interactive learning log** — numbered log stays; topics
      studied in depth (Regression, Neural Networks, Transformers, LLMs, AI
      Agents) expand into steppable node-and-edge diagrams with prev/next
      navigation, arrow-key support and DOM-only rendering (no WebGL
      dependency). Foundations (Probability, Linear Algebra) stay plain rows.
- [x] **M5 — Builds: system diagrams** — Every project card embeds an interactive system diagram (reusing the `StepDiagram` component): pipeline stages as clickable nodes, each stage explaining what it actually does (blurb + detail), with arrow-key navigation and prev/next stepping.
- [x] **M6 — Systems: agent architecture** — Synapse's real multi-agent RAG pipeline rendered as an interactive diagram (Orchestrator → Retrieval → Routing → Synthesis → Confidence Scorer) matching the actual backend system.
- [x] **M7 — Live inference demo** — Terminal `ask <question>` command queries a rate-limited Next.js API route that streams real-time response chunks about Pallav from NVIDIA's API with a custom thinking indicator.
- [x] **M8 — Scroll choreography (GSAP ScrollTrigger)** — GSAP ScrollTrigger coordinates section reveals and staggered entries for research logs and project cards, synced with Lenis and gated behind reduced-motion settings.
- [x] **M9 — Terminal easter eggs (max 2)** — `sudo hire-pallav` initiates the contact protocol and `coffee` brews a virtual cup.
- [x] **M10 — Polish + audit pass** — Web Audio API procedural synthesizer generates ambient space drone, toggleable in the top bar. High accessibility, contrast, and performance checklist verified.

## Content

`src/lib/data.ts` holds the real content: Pallav Dholariya's bio, contact links
(email, GitHub `Shivala-08`, LinkedIn), and the projects (Synapse, DeployForge,
Omnitrix OS, CineVault, Marlboro Red). The virtual filesystem in `src/lib/fs.ts`
is derived from the same data, so terminal and Files stay in sync. The
research log statuses and the sysinfo facts are still open to correction.

## Layout

```
src/
  app/                — root layout, metadata, page
  components/
    os/               — boot screen, top bar, desktop, taskbar, windows, shell, scroll/sound effects
    apps/             — Terminal + Files apps
    sections/         — Research / Builds / Systems / About / Contact
  lib/
    data.ts           — about, research log, projects, contact
    fs.ts             — virtual filesystem (powers Files + terminal ls/cd/cat)
    events.ts         — section → shell event bridge
    use-clock.ts      — live clock hook
```
