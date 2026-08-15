# RENDERING.md — The Custom WebGL Stack

Everything about how the 3D on this site works, why three.js is gone, and how
the hero scene was ported on top.

---

## 1. Why a custom renderer?

The original hero used **three.js + React Three Fiber** to draw a
node-and-edge brain network. The 3D chunk was **883 KB** and produced long
main-thread tasks on load. The site only ever drew four things:

1. a point cloud with per-vertex colors (the brain nodes),
2. line segments (the edges),
3. one shaded sphere (the grab indicator),
4. a camera + ray-to-plane picking.

That is a sliver of what three.js provides. So `mini-renderer.ts` (~500 lines,
~24 KB) implements exactly those primitives against raw WebGL and replaces the
whole library. The fixed black/white/electric-blue palette is **baked into the
fragment shaders** as a `gradeColor()` function — the same idea as the
reference site's `onBeforeCompile` color-grade injection, but in-shader and
dependency-free.

**Results (measured on the live deploy, Lighthouse 13.4.1):**

- 3D chunk: **883 KB → 24.9 KB**
- Long tasks from 3D load gone from TBT
- Live baseline: **perf 98–99, TBT 20 ms, LCP 2.3 s, 100/100/100 a11y/BP/SEO**
- Removing the three.js dependency entirely (`77ad0c1`): −2,722 lines, 23
  lockfile packages dropped. Measured payload delta on production:
  **−0.2 KB JS** — the deleted R3F scene files were dead code (never imported),
  so they were already tree-shaken; the commit's value is a real dependency
  cleanup, not bytes.

**Bonus bug found during the migration:** the old matrix-inversion code was
column-major-ordered incorrectly, which had silently broken hover/click
picking on the brain. Fixed in `mini-math.ts` (`Mat4.invert`).

---

## 2. MiniRenderer API

`src/components/lab/mini-renderer.ts`

### Lifecycle

```ts
const renderer = new MiniRenderer({ canvas, dpr });
renderer.setSize(w, h);

// per frame:
renderer.clear();
renderer.begin(cameraPos, lookAt, groupModel);
// ...draw calls...
```

### Primitives

| Call | What it draws |
|---|---|
| `drawPoints(attr, size, opacity, additive)` | Brain point cloud (instance 0) |
| `drawLines(color, opacity)` | Brain edges (instance 0) |
| `drawSphere(x, y, z, r, color, emissive)` | Grab indicator sphere |
| `drawPointsInstance / drawLinesInstance / drawMeshInstance` | Hero-layer instances |

### Multi-instance model

The renderer originally supported one points buffer, one lines buffer, one
sphere. The hero port generalized it:

- `addPointsInstance()`, `addLinesInstance()`, `addMeshInstance(pos, norm, idx)`
  allocate new GPU buffers and return an **instance id**.
- Each instance draws with its **own model matrix** (`Mat4`, T×R×S):
  `uMVP = viewProj × groupModel × instanceModel`.
- `updateMeshPositions(id, ...)` re-uploads a mesh's position buffer for
  per-frame deformation (the noise sphere).
- `updatePointsInstance(id, data, componentCount)` accepts raw `[x,y,z]`
  positions (single color via tint uniform) or interleaved `[x,y,z,r,g,b]`.
- The legacy brain calls (`updatePoints` / `updateLines` / `buildSphere`)
  are preserved as instance 0, so brain-lab didn't have to change its draw
  calls.

### Picking

`rayToPlane(ndcX, ndcY, planeZ)` casts a ray from the camera through NDC
and intersects the **group-local z=0 plane** — matching the old
`Raycaster.setFromCamera + intersectPlane(z=0)` behavior. `begin()` stores
the inverse of the group model so hits come back in group-local coordinates,
where the node positions live.

---

## 3. The brain scene

- **`src/lib/mini-math.ts`** — Vec3 / Mat4 math (column-major, right-handed):
  lookAt, perspective, multiply, invert, unproject, applyMat4.
- **`src/components/lab/network.ts`** — the brain's data: node positions,
  edges, lobe groupings, landmark coordinates.
- **`src/components/lab/neural-lab.tsx`** — mounts the canvas, creates the
  renderer, wires pointer events, and owns the scene lifecycle. It renders
  **twice** (two canvas layers: the fade-in point cloud and the lines) and
  restores the group matrix between draws so picking stays correct.
- **`src/components/lab/brain-lab.tsx`** — the frame loop: advances the
  brain's rotation/signal drift, draws brain points + edges + grab sphere,
  **then draws the hero layer**, then handles hover/click hit-testing.
- **`src/components/lab/lobe-label.tsx` + `src/lib/lobe-label.ts`** — the
  ⌖lobe breadcrumb in the top bar, driven by a tiny external store updated
  on hover.

Scroll stages come from `src/lib/scroll-progress.ts`; the whole canvas is
deferred until the main thread is idle and falls back to a DOM icon grid when
WebGL is unavailable.

---

## 4. The hero port (shapes over the brain)

`src/components/lab/hero-shapes.ts` (~1,000 lines) — a faithful port of the
old three.js hero scene, which lived in git history but was **never mounted**
(dead code from the start). The user decision: *layer the shapes over the
brain* and do a *full faithful port*.

### What it contains

| Shape | Rendering | Interactions |
|---|---|---|
| **DataSphere** | noise-deformed solid mesh (positions re-uploaded per frame) + wireframe | drag-rotate, click → pulse + particle burst, scroll fade |
| **ScrollTorus** | solid + wireframe + glow ring | click → spin, scroll crossfade |
| **ScrollIcosahedron** | solid + wireframe + glow ring | click → spin, scroll crossfade |
| **300 morphing particles** | sphere → torus → ico formations | cursor repulsion, morphs with scroll |
| **60 connection particles** | thin additive points | drift |
| **Cursor trail** (40 particles) + **cursor glow ring** | additive points | follows pointer |

### How it layers

- Hero instances are allocated **after** the brain's (ids ≥ 1).
- brain-lab renders the hero layer in the same frame loop, after the brain
  draws, with `begin()` re-invoked with an identity model so shapes live in
  **absolute world space** while the brain keeps its group transform.
- Hit-testing: on hover/click, the hero layer's own pick runs **first**; if it
  hits a shape, the brain's node picking is skipped and the lobe label is
  suppressed. Shapes project under the cursor via `renderer.projectToNdc`
  with the stored per-frame parallax offset.
- The old scroll-driven camera keyframes became **parallax translation** —
  the layer drifts with scroll without hijacking the brain's camera.

### Tooltips

- **`src/lib/hero-tooltip.ts` + `src/components/lab/hero-tooltip.tsx`** — a
  rAF-driven DOM pill that follows the cursor (mirrors the LobeLabel store
  pattern). Hovering a shape shows its project name + blurb:
  sphere = **AI Core**, torus = **DeployForge**, ico = **Synapse**.
- Hover/click sounds route through `src/lib/sounds.ts` (Web Audio).
- `prefers-reduced-motion` disables the deformation/morph animation.

### Verification (real Chrome via CDP)

- Shapes render: center radii 40/90/140 px showed **100/99/78% blue
  coverage** locally vs **0/0/0** on the live site (which has no shapes).
- The scene **animates**: 10.5% of sphere-region pixels change between frames
  1.2 s apart.
- Tooltip appears on hover ("DeployForge — CI/CD pipeline engine").
- **Zero console errors** through a full-page scroll (all morph phases and
  crossfades exercised).
- Layout note: the shapes obey the same visibility rules as the brain — the
  sticky canvas is covered by opaque content cards as you scroll, so the
  choreography reads in the hero and side gutters.

---

## 5. Performance & the audit story

- `beec79c` — Terminal + Files **lazy-loaded**: 0 app chunks on initial load;
  exactly 1 new chunk (~10–13 KB) per app on first open. Verified via CDP
  network capture.
- `lighthouse-live*.json` — committed Lighthouse 13.4.1 reports (mobile,
  simulated throttling) against `https://pallav-os.vercel.app/`.
- A local TBT reading of 300 ms turned out to be **environment noise** (stray
  Chrome instances from a CDP session stealing CPU); clean runs measure
  **6–14 ms TBT** locally. Production measures 20 ms steady-state.
- The `-nojs` report files: note that with Chrome 151 + Lighthouse 13.4.1,
  JavaScript **cannot actually be disabled during load** (Chrome ignores
  `--disable-javascript`; Lighthouse only uses `disableJavaScript` for
  hung-page recovery). Treat them as a second JS-enabled run.

---

## 6. Files at a glance

```
src/lib/mini-math.ts                 Vec3/Mat4 math (column-major)
src/components/lab/mini-renderer.ts  WebGL renderer: points/lines/meshes + picking
src/components/lab/neural-lab.tsx    canvas mount, renderer lifecycle, pointer events
src/components/lab/brain-lab.tsx     frame loop, scroll stages, hero-layer integration
src/components/lab/hero-shapes.ts    hero port: shapes, particles, parallax, hit-testing
src/components/lab/hero-tooltip.tsx  cursor-following tooltip pill
src/lib/hero-tooltip.ts              tooltip store
src/lib/lobe-label.ts                brain lobe label store
src/lib/scroll-progress.ts           scroll stage math
```
