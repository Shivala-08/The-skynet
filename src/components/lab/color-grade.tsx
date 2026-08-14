"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type * as THREE from "three";

/**
 * One global color grade injected into every material's shader via
 * onBeforeCompile — the reference site's (unfor-dev) signature restraint
 * trick: a single hue/grade pass unifies the whole scene instead of
 * hand-tuning each material. Their pass remaps green→cyan; ours is a cool
 * pass for the black/white/electric-blue system: warm hues are pulled
 * toward neutral so nothing reads off-palette, contrast gets a gentle
 * S-curve, and pure whites stay white.
 *
 * Injected at two points:
 *   - `#include <common>`              → define the grade function
 *   - `#include <colorspace_fragment>` → apply it to the final output color
 *
 * `colorspace_fragment` is the one include present in every built-in shader
 * (points and line included — they have no `dithering_fragment`), and it is
 * where `gl_FragColor` receives its final output-space color, so the grade
 * lands last in the pipeline for the whole scene.
 */
const GRADE_FN = /* glsl */ `
vec3 gradeColor(vec3 c) {
  // Pull warm hues (r > b) toward neutral so the palette stays electric-blue
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float warm = clamp(c.r - c.b, 0.0, 1.0);
  c = mix(c, vec3(lum), warm * 0.45);
  // Gentle S-curve contrast lift
  c = c * c * (3.0 - 2.0 * c);
  return max(c, vec3(0.0));
}
`;

const GRADE_APPLY = "gl_FragColor.rgb = gradeColor(gl_FragColor.rgb);";

// Guard so re-traversals (the delayed re-patch below) don't re-wrap an
// already-patched material — every re-wrap would force another full shader
// recompile of every material, which shows up as main-thread blocking.
const patched = new WeakSet<THREE.Material>();

function patchMaterial(material: THREE.Material): void {
  if (patched.has(material)) return;
  patched.add(material);
  if (!material.onBeforeCompile) return;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${GRADE_FN}`)
      .replace("#include <colorspace_fragment>", `#include <colorspace_fragment>\n${GRADE_APPLY}`);
  };
  // Force a recompile so the injection takes effect immediately.
  material.needsUpdate = true;
}

/**
 * Mount inside the Canvas. On mount (and whenever the scene graph changes)
 * it walks every object and patches all materials — including ones added
 * later by children — so the grade covers the whole scene for the cost of
 * a single string injection, exactly like the reference.
 */
export function ColorGrade() {
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const patchAll = () => {
      scene.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach(patchMaterial);
        else if (mat) patchMaterial(mat);
      });
    };
    patchAll();
    // Materials are usually declared in JSX (already in the scene by the
    // time this effect runs), but re-patch after a beat to catch any that
    // mount asynchronously (e.g. the grabbed-node mesh).
    const t = window.setTimeout(patchAll, 250);
    return () => window.clearTimeout(t);
  }, [scene]);

  return null;
}
