# Agent Build Brief — PALLAV // AI LAB OS
### Written for an agentic IDE (Google Antigravity-style: plans → executes → verifies across editor, terminal, and a live browser)

Quality bar reference: **[unfor-dev.vercel.app](https://unfor-dev.vercel.app/?ref=threejsresources)** — an R3F/Three.js portfolio that won Site of the Day on ThreeJS Resources. Point the agent at it not to copy scenes, but to match its restraint: minimal black canvas, no clutter, every interaction purposeful. That's the polish level "PALLAV // AI LAB OS" needs to hit — the 3D is confident because it's sparse, not because it's dense.

Don't hand this whole file to the agent as one giant prompt — feed it **mission by mission**, in order. Each mission has a goal, guardrails, and a verification step the agent should run itself (via its browser surface) before you approve moving on.

---

## Standing context (paste once, at the start of the workspace/session)

```
CONTEXT.md

Project: Personal portfolio site — "Pallav // AI LAB OS"
Stack: Next.js (App Router), React Three Fiber + drei, GSAP + ScrollTrigger,
Framer Motion, Lenis, Tailwind. 3D assets from Blender (.glb, Draco-compressed).

Identity, not decoration: this is not "a cool 3D portfolio." It is an AI/ML
student's portfolio built AS an interactive AI system — the neural network is
literal navigation, not a hero-section prop. Every 3D element must map to a
real interaction or piece of content, never pure decoration.

Content formula (enforce this ratio across the whole build):
  60% — clean, highly usable UI (readable text, real nav, fast)
  25% — 3D / WebGL / neural-network visualization
  10% — AI interactions (the live inference demo)
   5% — easter eggs (cap at 2, not 47)

Quality reference: unfor-dev.vercel.app — minimal black canvas, sparse and
confident, no clutter. Match that restraint, not density.

Design direction: black/charcoal background, white typography, small electric-blue
accents. NOT neon-cyberpunk, NOT glassmorphism-heavy, no "AI enthusiast 🚀" clichés.

Hard rule: the site must be fully functional, readable, and crawlable with
JavaScript-heavy 3D features OFF. Build the plain version first in every mission,
then layer 3D/experimental enhancement on top, feature-detected.

Experimental feature in scope: Chrome's HTML-in-Canvas API
(ctx.drawElementImage / THREE.HTMLTexture) — Chrome 148-150 origin trial only,
no cross-origin iframes, main-thread-driven scroll. Always gate behind:
  const supportsHtmlInCanvas = () => typeof
    document.createElement('canvas').getContext('2d').drawElementImage === 'function'
Never make this a hard dependency for core content (resume, contact, project text).

After every mission: take a screenshot/recording of the result in the live browser
and report back before I approve the next mission.
```

---

## Mission 1 — Scaffold + content skeleton (no 3D at all)

**Prompt to the agent:**
> Scaffold a Next.js App Router project with Tailwind. Build the full DOM-only version of the site: a Pallav.OS-style desktop shell, a working terminal component, and a project filesystem view for these projects: Synapse, DeployForge, Omnitrix OS, CineVault, Marlboro Red. No animation libraries yet, no 3D. Deploy-ready, keyboard-navigable, Lighthouse-clean.

**Verification:** Lighthouse screenshot (90+ perf/accessibility with 3D off), terminal-commands recording, `next build` succeeds with zero console errors.

**Guardrail:** reject the plan if it reaches for a 3D library before this mission is verified working.

---

## Mission 2 — Motion layer (Framer Motion + Lenis, still no WebGL)

**Prompt to the agent:**
> Add Framer Motion for window/panel transitions and Lenis for smooth scroll on the existing DOM shell. No Three.js yet. Respect `prefers-reduced-motion` — motion must degrade to instant transitions when that's set.

**Verification:** recording with `prefers-reduced-motion` toggled on and off.

---

## Mission 3 — 3D shell + the neural network as real navigation

**Prompt to the agent:**
> Add React Three Fiber. Build the boot sequence (black screen → "PALLAV.OS" boot text → camera move into the lab). The centerpiece is a node-and-edge neural network diagram rendered in 3D — this is NOT decorative. Each visible node is a real navigation target: clicking a node routes to Research, Builds, Systems, or About, the same way clicking a link would. Under the hood this can be a thin R3F wrapper around real `<Link>`/router calls, so it stays crawlable and keyboard-accessible (tab order should reach every node even with 3D rendering off). Keep .glb assets under 5MB total, Draco-compressed, lazy-loaded behind the boot screen.

**Verification:**
- Recording of clicking a node and landing on the correct route
- Confirm every node is also reachable by Tab + Enter with no mouse
- Network waterfall showing 3D assets load after first paint

---

## Mission 4 — RESEARCH section (interactive learning log, not a skills bar)

**Prompt to the agent:**
> Build the Research section as a numbered log (Probability → Linear Algebra → Regression → Neural Networks → Transformers → LLMs → AI Agents), not a percentage skill bar. Clicking an entry (e.g. "Neural Networks") expands an interactive diagram of Input → Hidden Layers → Activation → Output that the visitor can step through. Keep this real and explanatory, not a fake progress meter — if a topic isn't genuinely something Pallav has studied in depth, list it plainly rather than inflating it.

**Verification:** recording of expanding one log entry and stepping through its diagram; confirm it works with the DOM fallback (no 3D) too.

---

## Mission 5 — BUILDS section (systems, not project cards)

**Prompt to the agent:**
> Build the DeployForge project page as a system diagram the visitor explores, not a card with a screenshot: Connect → Detect → Build → Process → Deploy. Clicking a stage shows what it actually does. Repeat this pattern for Synapse, Omnitrix OS, CineVault and Marlboro Red once DeployForge is verified. Where a stage's panel would benefit from being "on" a 3D object (e.g. a console mesh) instead of a flat DOM card, feature-detect `supportsHtmlInCanvas()` and use `THREE.HTMLTexture` on the *same* DOM node — never a duplicated copy of the content.

**Verification:**
- Standard-browser recording: all three system diagrams fully readable, no missing content
- HTML-in-Canvas-capable browser (Canary + flag): confirm text is selectable and Ctrl/Cmd+F finds it inside the mesh
- Confirm no unique content exists only inside the HTML-in-Canvas path

**Guardrail:** if the agent proposes gating any unique content (project descriptions, links, resume) only inside the 3D/HTML-in-Canvas path with no DOM equivalent, stop and reject.

---

## Mission 6 — SYSTEMS section (agent architecture, if applicable)

**Prompt to the agent:**
> If Pallav has built any multi-step or agentic AI workflow, represent it as an orchestrator → sub-agent → synthesizer diagram (e.g. Orchestrator → Researcher/Analyst/Critic → Synthesizer → Output). Clicking a node in this diagram shows its purpose, inputs, tools, and output. Skip this section entirely rather than inventing an architecture that doesn't exist — the whole point is authenticity over spectacle.

**Verification:** recording of the diagram plus confirmation every claim in it maps to something real.

---

## Mission 7 — LIVE INFERENCE demo (the 10%)

**Prompt to the agent:**
> Add one small, real interactive AI demo — e.g. a text box that sends a short prompt about Pallav to a real backend/model call and streams back an answer, with a lightweight "Embedding → Retrieval → Reasoning → Generation" progress visualization while it runs. This must call a real endpoint, not a hardcoded fake response. Rate-limit it server-side so it can't be abused into a cost sink, and fail gracefully with a plain-text fallback message if the call errors.

**Verification:** recording of a successful run, and a recording of the graceful-failure path (e.g. simulate the API being down).

---

## Mission 8 — Scroll choreography

**Prompt to the agent:**
> Wire GSAP ScrollTrigger across Lab → Research → Builds → Systems → About → Contact, pinning and scrubbing camera/mesh transforms. Throttle any HTML-in-Canvas `onpaint` redraws to once per animation frame.

**Verification:** full scroll-through recording plus a performance profile flagging any dropped frames during scroll.

---

## Mission 9 — Terminal easter eggs (cap at 2)

**Prompt to the agent:**
> Add exactly two terminal easter eggs — `sudo hire-pallav` (returns something like "Permission granted. Initiating contact protocol...") and one more of your choice. Do not add more; the brief caps this at 2 by design, not as a suggestion.

**Verification:** recording of both commands.

---

## Mission 10 — Polish + audit pass

**Prompt to the agent:**
> Final pass: contrast check against the black/white/electric-blue palette, full keyboard-only navigation test end to end, ambient sound toggle (default off), and a Lighthouse + axe accessibility audit on both the JS-off fallback and the full 3D experience. Compare overall restraint against unfor-dev.vercel.app as the polish bar — flag anything that feels cluttered or decorative-only relative to that reference.

**Verification:** both audit reports as artifacts, recording of full keyboard-only navigation.

---

## How to run this with an agent day-to-day

- Keep `CONTEXT.md` in the repo root so the 60/25/10/5 formula and the "authenticity over spectacle" rule survive across missions — agents drift back toward "more effects" without a persistent anchor.
- Review each mission's artifacts like a PR before saying "next."
- The guardrail worth manually double-checking every time: nothing unique to the portfolio's actual content should live only behind a 3D/HTML-in-Canvas path.

---

## Resources

- [Unfor portfolio (quality reference)](https://unfor-dev.vercel.app/?ref=threejsresources)
- [HTML-in-Canvas explainer (WICG)](https://github.com/WICG/html-in-canvas/blob/main/README.md)
- [Three.js HTMLTexture docs](https://threejs.org/docs/#HTMLTexture)
- [GSAP ScrollTrigger docs](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
- [Origin trial registration](https://developer.chrome.com/origintrials/#/view_trial/3478467762190286849)
