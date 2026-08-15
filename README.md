# PALLAV // AI LAB OS

Personal portfolio for Pallav, built as an interactive AI system — an operating
system whose neural network is the navigation, not a prop. See `CONTEXT.md` for
the standing design rules, `antigravity-agent-build-brief.md` for the full
mission plan this repo is built from, and `docs/RENDERING.md` for a deep dive on
the custom WebGL renderer and the hero scene port.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- **Custom WebGL renderer** (`src/components/lab/mini-renderer.ts`, ~24 KB) —
  in-house replacement for three.js. No 3D library in the bundle.
- Framer Motion, Lenis, GSAP + ScrollTrigger
- Web Audio API (procedural drone synthesizer)
- NVIDIA API (chat streaming endpoint)

## Recent work — what we've been cooking

The site has been through two major engineering pushes since the original build:

### 1. Custom WebGL renderer (three.js → zero dependencies)

The 3D brain in the hero was originally rendered with three.js + React Three
Fiber (~883 KB of 3D chunk). It was fully replaced with an in-house WebGL
renderer that draws points, lines, and meshes directly against the GPU:

- **`mini-renderer.ts`** (~500 lines) — a small immediate-mode renderer: a
  camera with perspective/ray-to-plane picking, point-cloud drawing with
  per-vertex colors and a fade-in shader, line segments, and shaded meshes with
  per-instance model matrices (T×R×S), mesh opacity, and dynamic position
  updates.
- **3D chunk: 883 KB → 24.9 KB** — and the long tasks it spawned vanished from
  TBT.
- Fixed a **column-major matrix-inversion bug** that had silently broken
  hover/click picking on the brain.
- **`cf863df`** — `feat: replace three.js brain with a custom 24KB WebGL renderer`
- **`77ad0c1`** — `chore: remove three.js entirely — complete the MiniRenderer
  migration` (dropped `three`, `@react-three/fiber`, `@react-three/postprocessing`,
  `postprocessing`, `@types/three` + 23 lockfile packages, −2,722 lines).
- The deleted three.js scene files were dead code — nothing imported them, so
  the migration shipped ~nothing extra to the browser (measured −0.2 KB JS on a
  live deploy audit, perf 98/98).

### 2. Hero scene port (sphere → torus → icosahedron over the brain)

The old three.js hero scene (recovered from git history — it was written but
never mounted) was ported onto MiniRenderer as a layer **over** the brain:

- **`hero-shapes.ts`** (~1,000 lines) — DataSphere (noise-deformed solid +
  wireframe, drag-rotate, click pulse + particle burst), ScrollTorus (solid +
  wireframe + glow ring), ScrollIcosahedron (wireframe + solid + glow), 300
  morphing particles (sphere → torus → ico formations with cursor repulsion),
  60 connection particles, 40-particle cursor trail, cursor glow, scroll
  crossfades + parallax drift, hover tooltips (AI Core / DeployForge / Synapse),
  hover/click sounds, reduced-motion respect.
- **`hero-tooltip.ts` + `hero-tooltip.tsx`** — rAF-driven DOM tooltip pill
  following the cursor (mirrors the LobeLabel pattern).
- **`brain-lab.tsx`** — renders the hero layer after the brain, hit-tests
  shapes before brain-node picking, suppresses lobe labels under a shape.
- Verified in real Chrome via CDP: shapes render (100/99/78% blue coverage at
  center radii vs 0/0/0 on live), animate (10.5% pixel change between frames),
  tooltip works, zero console errors through a full-page scroll.

### 3. Performance work

- **Lazy-loading** (`beec79c`) — Terminal + Files apps load on demand: 0 app
  chunks on initial load, exactly 1 new chunk (~10–13 KB) per app on open.
- **Lighthouse baselines** committed to the repo (`lighthouse-live*.json`,
  LH 13.4.1, mobile/simulated, live URL) — refreshed in `58fe2bd`. Current
  live baseline: **perf 98–99, TBT 20 ms, LCP 2.3 s, 100/100/100
  a11y/BP/SEO**.
- A TBT "regression" scare turned out to be environment noise (stray Chrome
  processes from a CDP session stealing CPU) — clean runs measure 6–14 ms TBT
  locally.

> Note: the hero port (section 2) is currently **uncommitted** in the working
> tree (7 files) — it was stashed for the live audit and restored. Commit it
> when ready; the live site currently runs the three.js removal without the
> hero shapes.

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
- [x] **M3 — 3D shell + neural-network navigation** — a node-and-edge network
      where every node is a real link (sections scroll, Terminal/Files open
      windows) rendered via HTML anchors/buttons projected onto the 3D nodes
      (Tab + Enter reachable), camera moves into the lab after boot, WebGL
      detection with the DOM icon grid as fallback. Rendered by the custom
      MiniRenderer, not three.js.
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
  app/                  — root layout, metadata, page
  components/
    os/                 — boot screen, top bar, desktop, taskbar, windows, shell, scroll/sound effects
    apps/               — Terminal + Files apps (lazy-loaded on open)
    lab/                — custom WebGL stack: mini-renderer, brain-lab, hero-shapes, hero-tooltip, neural-lab, lobe-label, network, train-model
    sections/           — Research / Builds / Systems / About / Contact
  lib/
    data.ts             — about, research log, projects, contact
    fs.ts               — virtual filesystem (powers Files + terminal ls/cd/cat)
    mini-math.ts        — Vec3/Mat4 math for the renderer (column-major, right-handed)
    scroll-progress.ts  — scroll stages for the 3D scenes
    hero-tooltip.ts     — hero shape tooltip store (rAF-driven)
    lobe-label.ts       — brain lobe label store
    sounds.ts           — Web Audio procedural sounds
    events.ts           — section → shell event bridge
    use-clock.ts        — live clock hook
```

## Docs

- `CONTEXT.md` — standing design rules and content formula.
- `antigravity-agent-build-brief.md` — full mission plan.
- `reference-notes.md` — teardown of the quality reference site.
- `docs/RENDERING.md` — MiniRenderer API, brain scene, hero port, verification.
- `docs/USER-GUIDE.md` — how to use the site: the terminal, apps, sections, and easter eggs.
- `lighthouse-live*.json` — Lighthouse audit reports from the live deploy.
