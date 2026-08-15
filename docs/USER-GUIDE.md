# SKYNET // AI LAB OS — User Guide

**Pallav Dholariya's portfolio, built as an interactive operating system.** The
site is an AI/ML student's resume rendered as a desktop OS: a neural network
is the navigation, the terminal is a working shell, and the content — research
log, builds, systems architecture, about, contact — is the actual portfolio.
Everything below is real: the terminal commands, the streaming AI, the
telemetry, the build-log replay. The easter eggs are the only "hidden" parts.

---

## 1. The boot

The site opens with a short boot animation, then drops you onto a desktop:

- **Top bar** — SKYNET logo, section nav (Research · Builds · Systems · About ·
  Contact), Terminal/Files buttons, ambient-sound toggle, live clock.
- **Hero** — "SKYNET // AI LAB OS · v1.0" over a 3D brain rendered entirely in
  a custom WebGL engine (no three.js — ~24 KB, built in-house).
- **Icon grid** — the primary navigation: **Terminal**, **Files**, and the five
  sections, laid out like desktop icons. `Tab` to focus, `Enter` to open.
- **NEURAL CORE** — a small floating control, bottom-right of the desktop.

> No WebGL? No problem. The DOM icon grid is the fallback; the whole site is
> readable and navigable with JavaScript-heavy 3D features off, and reduced
> motion (`prefers-reduced-motion`) disables all animation.

---

## 2. The 3D brain

The backdrop is a live neural network: **every node is a real link**. Nodes map
to sections and apps — hover one and it glows, click and it scrolls to the
section or opens an app. Drag the empty canvas to rotate the brain. As you
scroll, the network activates, clusters, and finally converges toward the
contact node.

Three **hero shapes** float over the brain (hover for a tooltip):

| Shape | Name | What it links to |
|---|---|---|
| Blue data sphere | **AI Core** | the neural hub — drag to spin it, click for a particle burst |
| Torus | **DeployForge** | the CI/CD project |
| Icosahedron | **Synapse** | the RAG retrieval project |

Clicking a lobe landmark in the top bar shows a **⌖ breadcrumb** of the last
hovered landmark — click the name to navigate there, ✕ to clear it.

**NEURAL CORE** — click **TRAIN MODEL** to run the network through a fake
training loop: the HUD counts epochs, loss (↓) and accuracy (↑) until it
converges, then offers TRAIN AGAIN. It's a visual metaphor, clearly labeled.

---

## 3. The Terminal

Open it from the icon grid, the top bar, or the taskbar. It's a real shell with
a virtual filesystem. Type `help` for the command list.

### Command reference

| Command | What it does |
|---|---|
| `help` | list all commands |
| `ask <question>` | stream a real AI answer about Pallav / his projects / tech (NVIDIA API, rate-limited) |
| `deploy` | replay the last real production build log, streamed (~7 s) — *a replay, never a live trigger* |
| `status` | live site telemetry: status, environment, commit, deploy time, deploy age, visits |
| `about` | who is behind this OS |
| `projects` | list the builds |
| `research` | read the research log |
| `contact` | contact channels (email, GitHub, LinkedIn, resume) |
| `whoami` | current user |
| `date` | current date and time |
| `echo <text>` | print text |
| `pwd` | print working directory |
| `ls [path]` | list directory contents |
| `cd <path>` | change directory |
| `cat <file>` | print a file |
| `open <target>` | open Files/Terminal, scroll to a section, or open a project folder |
| `clear` / `cls` | clear the terminal |
| `exit` | close the terminal window |
| `sudo hire-skynet` | permission granted — contact protocol initiated |
| `coffee` | brew a virtual cup (productivity +15%) |

**Keyboard:** `↑`/`↓` command history, `Ctrl+L`/`Cmd+L` clear, `Esc` clears the
current line.

### `ask` — the live AI

`ask <question>` streams a real response about Pallav, his projects, or general
tech, with a thinking indicator. It's rate-limited server-side (10/min/IP),
streams token-by-token, and degrades gracefully to local fallback answers if
the upstream API is unavailable.

### `deploy` — replay of a real build

`deploy` streams the actual `next build` output of this site — verbatim lines
(compile, typecheck, static generation, route table), paced to how long the
real build stages took. It is **clearly framed as a replay**: the header says
`REPLAY — no live deployment is triggered`, and the footer confirms
`nothing was deployed`. A second `deploy` while one is streaming fails
gracefully instead of stacking. This was a deliberate design decision — the
wow of a streaming deploy without the abuse surface of a real trigger.

### `status` — real telemetry

`status` shows real numbers, not placeholders:
- **commit** — the actual git hash the build was compiled from
- **deployed / deploy age** — when the current build went live and how long ago
- **visits** — a real counter (only when a KV store is configured; otherwise
  the row is honestly labeled unavailable rather than faked)

---

## 4. The corner status widget

Bottom-right of the screen, a persistent readout shows the same live telemetry:
`● ONLINE · <commit> · visits N · live 2h`. **Click it** to open the terminal
and auto-run `status` for the full panel. It polls every 45 seconds and
refreshes when you return to the tab.

---

## 5. Files

The Files app is a virtual filesystem built from the same content as the
terminal, so the two never drift:

```
~/
├── README.md
├── contact.md
├── projects/
│   ├── synapse/         README.md · pipeline.txt
│   ├── deployforge/     README.md · deploy.txt
│   ├── omnitrix-os/     README.md · experience.txt
│   ├── cinevault/       README.md · experience.txt
│   └── marlboro-red/    README.md · brand.txt
├── research/
│   └── log.md
└── systems/
    └── workflow.md
```

Open any folder by clicking through, or jump straight there from the terminal
(`open projects/synapse`, `cat projects/synapse/README.md`, …).

---

## 6. The sections

Scroll down (or use the nav) through the actual portfolio:

- **Research** — a numbered learning log (Probability & Statistics → Linear
  Algebra → Regression → Neural Networks → Transformers → LLMs → AI Agents).
  Topics studied in depth expand into **steppable node-and-edge diagrams**:
  use the prev/next buttons or `←`/`→` arrow keys to walk through each stage.
- **Builds** — the five projects (Synapse, DeployForge, Omnitrix OS, CineVault,
  Marlboro Red). Every card embeds an **interactive pipeline diagram**: click a
  stage to read what it actually does, step with arrow keys.
- **Systems** — Synapse's real multi-agent RAG architecture as an interactive
  diagram: Orchestrator → Retrieval → Routing → Synthesis → Confidence Scorer.
- **About** — the bio, focus areas, and facts.
- **Contact** — email, GitHub, LinkedIn, resume.

---

## 7. Easter eggs & hidden features

| Trigger | What happens |
|---|---|
| Type **`skynet`** anywhere (not in an input) | opens the Terminal |
| **Konami code** — `↑ ↑ ↓ ↓ ← → ← → B A` | toggles the **debug overlay**: live FPS, a **wireframe toggle** for the 3D scene, and raw shader uniform values (point size/opacity, mesh emissive, rim strength, `uTime`, camera) |
| Open **DevTools console** on load | a styled ASCII header + hiring pitch via `%c` |
| **`sudo hire-skynet`** in the terminal | contact protocol |
| **`coffee`** in the terminal | virtual coffee |
| **Ctrl/Cmd+P** | the entire OS shell is replaced by a clean, single-page, print-ready resume |
| **`llms.txt`** at `/llms.txt` | a plain-text summary of the site for AI crawlers / LLM tools |

The Konami overlay is purely additive — nothing renders until the code is
entered, and it never triggers while you're typing in the terminal.

---

## 8. Sound

The top-bar toggle plays a dark ambient drone (off by default; your preference
is remembered). A Web Audio lowpass filter sweeps the brightness of the sound
as you scroll — brighter at the top, darker as you go deeper.

---

## 9. For the technical visitor

- **Custom WebGL renderer** — the 3D scene is a hand-rolled `MiniRenderer`
  (~24 KB); no three.js in the bundle. See `docs/RENDERING.md` for the deep
  dive.
- **`/api/chat`** — the `ask` streaming endpoint (server-side rate-limited).
- **`/api/deploy`** — the replay stream (NDJSON, no-store).
- **`/api/status`** — live telemetry JSON; **`/api/visit`** — the visit
  counter increment.
- **`/robots.txt`**, **`/sitemap.xml`**, **`/llms.txt`** — crawlable and
  LLM-readable; the site is fully functional with JS off.
- **Lighthouse** — the project maintains live performance baselines (perf
  ~98–99, a11y/BP/SEO 100/100/100) in `lighthouse-live*.json`.

---

*SKYNET // AI LAB OS — a portfolio where the neural network is the
navigation, not a prop.*
