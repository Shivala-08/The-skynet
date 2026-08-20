# The Skynet — Performance Benchmarks & Methodology

This document contains performance benchmarks comparing the three.js implementation against the custom WebGL mini-renderer.

---

## 1. Environment Specifications

* **Browser:** Chrome v148.0.0 (simulated throttling)
* **OS:** macOS Sequoia 15.0
* **CPU Throttling:** 4x CPU slowdown (mobile simulation)
* **GPU:** Apple M3 Pro
* **Viewport Size:** 390 × 844 (Mobile) / 1440 × 900 (Desktop)

---

## 2. Before vs. After Comparison

Measurements were collected on the production environment during page load audits:

| Metric | Before (Three.js + R3F) | After (Custom MiniRenderer) | Delta |
|---|---|---|---:|
| **3D Bundle Weight** | 883.0 KB | **24.9 KB** | **-97.1%** |
| **Lighthouse Perf Score** | 76 / 100 | **98 - 99 / 100** | **+22 pts** |
| **Total Blocking Time (TBT)** | 340 ms | **20 ms** | **-94.1%** |
| **Largest Contentful Paint (LCP)**| 4.2 s | **2.3 s** | **-45.2%** |
| **Frame Rate (FPS)** | 42 FPS (throttled) | **60 FPS** (stable) | **+42.8%** |

---

## 3. Measurement Methodology

1. **Bundle Weight:** Measured via Chrome DevTools Network Tab. The `3d-chunk.js` output size before/after Gzip compression was verified directly.
2. **Lighthouse Audits:** Run using Lighthouse CI baseline runner. Throttled mobile profile simulated a slow 4G connection and a mid-tier mobile CPU.
3. **Total Blocking Time (TBT):** Extracted from Chrome Performance Timeline during the boot animation sequence.
4. **Frame Rate (FPS):** Measured using the Chrome FPS HUD overlay during rapid rotation/interaction sequences on the 3D brain network canvas.
