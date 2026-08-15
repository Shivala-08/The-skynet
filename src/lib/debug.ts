// ---------------------------------------------------------------------------
// Debug store — the shared mutable state behind the Konami-code debug overlay.
//
// Two worlds talk through this module without React plumbing:
//   - the overlay component (React) flips `overlay` / `wireframe` and reads
//     `uniforms` + `fps` for display
//   - the BrainLab render loop (rAF) reads `wireframe` every frame and writes
//     the raw shader uniform snapshot from MiniRenderer into `uniforms`
//
// This is intentionally a plain module-level singleton — the debug overlay is
// an easter egg, not core app state.
// ---------------------------------------------------------------------------

export type UniformSnapshot = {
  pointSize: number;
  pointOpacity: number;
  lineOpacity: number;
  meshEmissive: number;
  meshOpacity: number;
  rimPower: number;
  rimStrength: number;
  cameraPos: [number, number, number];
  uTime: number;
};

const INITIAL_UNIFORMS: UniformSnapshot = {
  pointSize: 0,
  pointOpacity: 0,
  lineOpacity: 0,
  meshEmissive: 0,
  meshOpacity: 0,
  rimPower: 0,
  rimStrength: 0,
  cameraPos: [0, 0, 0],
  uTime: 0,
};

export const debugState = {
  /** Konami overlay visible. */
  overlay: false,
  /** Wireframe rendering toggle (read every frame by the render loop). */
  wireframe: false,
};

export const debugUniforms: UniformSnapshot = { ...INITIAL_UNIFORMS };

/** Frames per second, written by the overlay's own rAF loop. */
export const debugFps = { value: 0 };

/** Counts rAF ticks — used by the overlay loop to measure FPS. */
export const debugTicks = { value: 0 };

// Minimal instrumentation: exposes the live overlay state on window so a
// devtools session (or an agent driving the page) can inspect it directly.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__skynetDebug = {
    state: debugState,
    fps: debugFps,
    ticks: debugTicks,
    uniforms: debugUniforms,
  };
}
