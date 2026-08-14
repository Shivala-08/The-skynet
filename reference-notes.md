# Reference Teardown — unfor-dev.vercel.app

DevTools-style analysis of the quality reference site (Unfor — Creative Developer &
3D Artist portfolio), captured from the live production deploy on Vercel.
Goal: know exactly what the reference runs on, how heavy its assets are, and what
its signature shader trick is, so "PALLAV // AI LAB OS" can match the restraint
without copying the scenes.

---

## 1. Framework & bundle structure (Network tab)

- **Not Next.js, not Vite.** It's a **Create React App (webpack) SPA**:
  - `/static/js/main.10bc4e50.js` — single app bundle (content-hashed `main.<hash>.js` = CRA convention; Vite would be `/assets/index-<hash>.js`, Next.js would have `/_next/static/...`)
  - `/static/css/main.6f30011b.css`
  - `<div id="root"></div>` shell — **100% client-side rendered, zero SSR/SSG HTML**
  - Service worker at `/sw.js` (`CACHE_NAME = 'portfolio-v1'`)
- **JS weight:** `main.js` = **1.56 MB raw / ~431 KB gzipped** — that's the entire app in one file (no code-split chunks found). CSS = 45.5 KB.
- **Source maps shipped to prod:** `main.10bc4e50.js.map` (6 MB, HTTP 200). The original source is fully recoverable from the live site.
- Fonts via **Adobe Fonts/Typekit** (`use.typekit.net/hky5sxh.css`): **Aeonik** (weights 3/4/5), **Dimensions**, **Michroma**, **Roboto Flex** (monospace).

## 2. Asset request inventory (sizes = asset budget)

| Asset | Size | Role |
|---|---|---|
| `/Untitle.glb` | 692 KB | Main intro model — **MacBook Pro** (4 meshes) |
| `/model1.glb` | 840 KB | **Character model** ("Ch44_Body", 74 nodes) |
| `/model3.glb` | 402 KB | **Light-panel wall** (131 meshes / 175 nodes, screens + light covers) |
| `/studioEnv.hdr` | 1.6 MB | HDR environment map (studio lighting), precached by SW |
| `/music.mp3` | 1.19 MB | Looped background music (see §5) |
| `/img/endd.mp4` | **10.4 MB** | Video texture on the end screen — lazy-loaded (3 s timer or scroll past 2× viewport) |
| `/img/Roof.jpg`, `/img/Wall.jpg`, `/img/Wall-end.jpg` | — | Wall/roof textures in the 3D scene (RepeatWrapping, rotated 90°/180°) |
| `/img/img/a1.1.png … a18.3.png` | 54 × ~41 KB (~2.2 MB total) | Project screenshots (18 projects × 3 views) |
| `/cover.jpg` | 57 KB | og:image |

- **All three GLBs use `KHR_draco_mesh_compression` + embedded `EXT_texture_webp`** textures (no external texture files). `model3` also uses `KHR_materials_unlit`; `Untitle` adds `KHR_materials_clearcoat`. **Total 3D payload ≈ 2.5 MB models + 1.6 MB HDR ≈ 4.1 MB**, before media.
- Service worker strategy: **cache-first** for `.glb/.hdr/.cube/.jpg/.png/.mp4/.mp3/.woff2`; **network-first** for HTML/JS/CSS. Precaches `/`, `/studioEnv.hdr`, `/music.mp3`.

## 3. Library fingerprints (searchable strings in `main.js`)

- **three.js r168** (`const u="168"` next to the `MOUSE` constants) — WebGL2 (`getContext("webgl2")`)
- **@react-three/fiber v9** ("R3F: Hooks can only be used within the Canvas component!", `internal.frames` frameloop logic)
- **@react-three/postprocessing** — `EffectComposer` + `Bloom`
- **drei** — `useGLTF` (x3 models), `useEnvironment` (x4), texture loader with `RepeatWrapping`
- **GLTFLoader + DRACOLoader** (Draco) + **KTX2Loader** imported
- **GSAP** (57 hits, incl. `gsap.to` tweening) + **ScrollTrigger** (6 hits)
- **Lenis** 1.x (anchors, `scrollend` event dispatch) — the reference uses the *same* Lenis + GSAP ScrollTrigger combo we do
- No framer-motion, no Tailwind (plain CSS), no state lib, no maath

## 4. The signature shader trick (GLSL recovered from bundle)

One global **color grade injected into every material** via `onBeforeCompile`
(4 injections in the bundle) — replaced at the `#include <dithering_fragment>`
and `#include <common>` points. Defaults: `uHueShift = 1.8`, `uSaturation = 0`,
`uBrightness = 0`.

```glsl
vec3 rgb2hsv(vec3 c) { /* standard formula */ }

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 applyColorGrading(vec3 color, float hueShift, float saturation, float brightness) {
  vec3 hsv = rgb2hsv(color);
  hsv.x = fract(hsv.x + hueShift / (2.0 * 3.14159265));
  hsv.y = clamp(hsv.y + saturation, 0.0, 1.0);
  hsv.z = clamp(hsv.z + brightness, 0.0, 1.0);

  // green -> blue hue remap (the site's cyan-blue identity)
  float greenHue = hsv.x;
  if (greenHue > 0.2 && greenHue < 0.45) {
    hsv.x = 0.58;  // Blue hue (cyan-blue)
  }

  return hsv2rgb(hsv);
}
```

Applied per-pixel: `gl_FragColor.rgb = applyColorGrading(gl_FragColor.rgb, uHueShift, uSaturation, uBrightness);`
— one cohesive look across the whole scene for the cost of a single string
injection, no per-material work. Also a custom screen `ShaderMaterial`
(`gl_FragColor = vec4(uColor * uIntensity, 1.0)`) for the video-texture screens.

## 5. Interaction / rendering architecture (Elements + bundle)

- **Real WebGL, not a CSS illusion:** CSS forces a single **`position: fixed`, full-viewport (`100dvh`) canvas** (`touch-action: pan-y`) — one fixed R3F canvas, DOM content layered over it. The `<canvas>` is created by JS (HTML shell is empty).
- **Background music:** `<audio src="/music.mp3" preload="auto" loop>` — no autoplay; toggle button calls `play()` on gesture, and **GSAP tweens volume** (`gsap.to(el,{volume:0,duration:1,ease:"power2.in"})`) to fade in/out.
- **Video texture:** `endd.mp4` is created as a JS `HTMLVideoElement` (`muted`, `playsInline`, `preload="metadata"`, `rotation=Math.PI/-2`, `repeat(1,-1)`) and **deferred** — only after a 3 s timer or when `scrollY > 2 × innerHeight`.
- Projects are real data objects (title, description, techStack, liveUrl, sourceUrl, images[], year, category) rendered as DOM over the canvas — the canvas is the atmosphere, the DOM is the content.

## 6. Performance read (Lighthouse-frame)

- Single ~431 KB gz JS bundle blocking all rendering (SPA, no SSR) — first paint waits on JS. That's the price of the CRA shell.
- 3D asset budget is disciplined: **~4.1 MB** (three Draco+WebP GLBs + HDR), all behind the boot/shell, with the heaviest media (10 MB video) lazy-loaded and the HDR/music precached by the SW.
- 54 PNG screenshots (~2.2 MB) are the flabbiest part — PNG, not WebP.
- Motion is scroll-driven via Lenis smoothing + GSAP ScrollTrigger (same pairing our build uses), not scroll-driven CSS.

## 7. Takeaways for PALLAV // AI LAB OS

1. **One fixed canvas + DOM overlay is the reference pattern** — matches our planned R3F-lab-over-DOM-shell architecture exactly. Keep content in the DOM; let WebGL own atmosphere.
2. **Global `onBeforeCompile` color grade is the restraint trick** — one hue-shift pass (their green→cyan) unifies the whole scene. We can adopt the same mechanism for our black/white/electric-blue palette (a blue-shift, not a green-remap) instead of hand-tuning 40 materials.
3. **Stack parity confirmed:** three r168 / R3F v9 / GSAP + ScrollTrigger / Lenis is exactly our stack's shape (we're on r185/R3F 9.7/GSAP 3.15/Lenis 1.3 — newer, compatible).
4. **Asset budget bar to beat:** ~4.1 MB 3D + ~1.2 MB audio + 10 MB lazy video, Draco + embedded WebP textures. Our brief's 5 MB total GLB budget is in the right ballpark; prefer embedded WebP textures like theirs.
5. **Avoid their weaknesses:** no SSR (our Next.js gives us crawlable HTML for free — keep it), 1.5 MB single JS bundle, 6 MB source maps in prod, PNG screenshots, 10 MB video. We can ship leaner on every axis while keeping the sparse black-canvas feel.
6. **Audio pattern to copy:** gesture-gated play + GSAP volume fade, never autoplay.
