/**
 * Fake "train the neural network" simulation.
 *
 * A module-level store (no React state) so both the DOM HUD and the 3D scene
 * can read the same run in real time:
 *   - the 3D frame loop advances the sim each frame (`advanceTraining`)
 *   - the DOM panel subscribes to throttled snapshots (`subscribeTraining`)
 */

export type TrainingPhase = "idle" | "training" | "converged";

export type TrainingState = {
  phase: TrainingPhase;
  epoch: number;
  totalEpochs: number;
  /** 0..1 — decreasing */
  loss: number;
  /** 0..1 — increasing */
  accuracy: number;
};

export const TOTAL_EPOCHS = 100;
const EPOCH_SECONDS = 0.09; // ~9s per full run

const state: TrainingState = {
  phase: "idle",
  epoch: 0,
  totalEpochs: TOTAL_EPOCHS,
  loss: 1,
  accuracy: 0,
};

// Snapshot emitted to subscribers — replaced on emit so useSyncExternalStore
// sees a stable reference between updates (and a new one on each update).
let snapshot: TrainingState = { ...state };

type Listener = () => void;
const listeners = new Set<Listener>();

let elapsed = 0;
let lastEmit = 0;

function emit(): void {
  snapshot = { ...state };
  listeners.forEach((fn) => fn());
}

/** Kick off (or restart) a training run. */
export function startTraining(): void {
  state.phase = "training";
  state.epoch = 0;
  state.loss = 1;
  state.accuracy = 0;
  elapsed = 0;
  lastEmit = 0;
  emit();
}

/** Latest snapshot for React (stable reference between emits). */
export function getTrainingState(): TrainingState {
  return snapshot;
}

/** Raw live state for the 3D scene (fresh every frame). */
export function getTrainingStateRaw(): TrainingState {
  return state;
}

export function subscribeTraining(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Advance the run by dt seconds. Called from the 3D frame loop so the network
 * visualises each epoch in real time. Subscribers are notified at most ~12x/s
 * so the HUD stays cheap.
 */
export function advanceTraining(dt: number): void {
  if (state.phase !== "training") return;

  elapsed += dt;
  const prevEpoch = state.epoch;
  state.epoch = Math.min(TOTAL_EPOCHS, Math.floor(elapsed / EPOCH_SECONDS));

  if (state.epoch !== prevEpoch) {
    const q = state.epoch / TOTAL_EPOCHS;
    // Loss decays fast then flattens; accuracy saturates near 98%
    state.loss = Math.max(0.012, (1 - q) * (1 - q) * 0.55 + 0.03);
    state.accuracy = Math.min(0.984, 0.3 + 0.684 * Math.pow(q, 0.85));

    if (state.epoch >= TOTAL_EPOCHS) {
      state.phase = "converged";
      state.loss = 0.012;
      state.accuracy = 0.984;
      emit(); // flip the HUD to MODEL CONVERGED immediately
      return;
    }

    if (typeof performance !== "undefined" && performance.now() - lastEmit > 80) {
      lastEmit = performance.now();
      emit();
    }
  }
}
