# CONTEXT.md

Project: Personal portfolio site — "Pallav // AI LAB OS"
Stack: Next.js (App Router), custom WebGL renderer (no three.js — see
docs/RENDERING.md), GSAP + ScrollTrigger, Framer Motion, Lenis, Tailwind.
3D is procedural (generated geometry), not asset-based.

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
and report back before the next mission is approved.
