/**
 * Tiny module-level store for the lobe-landmark hover label.
 *
 * The 3D scene writes the label text + screen position every frame (while a
 * landmark node is hovered); the DOM label component reads it imperatively via
 * rAF so the pill can follow the node at 60fps without React re-renders.
 */

export type LobeLabelState = {
  text: string | null;
  /** Optional secondary hint rendered dimly after the name (e.g. "click to open"). */
  hint: string | null;
  x: number; // viewport px
  y: number; // viewport px
};

const state: LobeLabelState = { text: null, hint: null, x: 0, y: 0 };

/** Called from the 3D frame loop with the hovered landmark + screen position. */
export function setLobeLabel(
  text: string | null,
  x = 0,
  y = 0,
  hint: string | null = null,
): void {
  state.text = text;
  state.hint = hint;
  state.x = x;
  state.y = y;
}

export function getLobeLabel(): LobeLabelState {
  return state;
}

// ---------------------------------------------------------------------------
// Last-hovered landmark — persisted so the top bar can show a breadcrumb as
// an extra navigation affordance, even after the cursor has moved away.
// ---------------------------------------------------------------------------

export type LastHoveredLandmark = {
  id: string | null;
  label: string | null;
};

const lastHovered: LastHoveredLandmark = { id: null, label: null };
let lastHoveredSnapshot: LastHoveredLandmark = { id: null, label: null };
const lastHoveredListeners = new Set<() => void>();

/** Record a newly hovered landmark (no-op if unchanged, so no spurious emits). */
export function setLastHoveredLandmark(id: string, label: string): void {
  const changed = lastHovered.id !== id || lastHovered.label !== label;
  if (changed) {
    lastHovered.id = id;
    lastHovered.label = label;
    lastHoveredSnapshot = { ...lastHovered };
    lastHoveredListeners.forEach((fn) => fn());
  }
  // Every hover touch (the scene reports each frame while hovering) refreshes
  // the inactivity clock — the breadcrumb clears a while after the last hover.
  lastHoverAt = Date.now();
  scheduleAutoClear();
}

/** Dismiss the breadcrumb. */
export function clearLastHoveredLandmark(): void {
  cancelAutoClear();
  if (lastHovered.id === null && lastHovered.label === null) return;
  lastHovered.id = null;
  lastHovered.label = null;
  lastHoveredSnapshot = { ...lastHovered };
  lastHoveredListeners.forEach((fn) => fn());
}

export function getLastHoveredLandmark(): LastHoveredLandmark {
  return lastHoveredSnapshot;
}

export function subscribeLastHoveredLandmark(fn: () => void): () => void {
  lastHoveredListeners.add(fn);
  return () => lastHoveredListeners.delete(fn);
}

// ---------------------------------------------------------------------------
// Auto-clear — the breadcrumb disappears after AUTO_CLEAR_MS without any
// landmark hover. A single timer is re-armed lazily; while the cursor keeps
// hovering a landmark the breadcrumb stays alive.
// ---------------------------------------------------------------------------

const AUTO_CLEAR_MS = 6000;
let lastHoverAt = 0;
let autoClearTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutoClear(): void {
  if (autoClearTimer !== null) return;
  autoClearTimer = setTimeout(() => {
    autoClearTimer = null;
    if (Date.now() - lastHoverAt >= AUTO_CLEAR_MS) {
      clearLastHoveredLandmark();
    } else {
      scheduleAutoClear(); // hovered again recently — check again later
    }
  }, AUTO_CLEAR_MS);
}

function cancelAutoClear(): void {
  if (autoClearTimer !== null) {
    clearTimeout(autoClearTimer);
    autoClearTimer = null;
  }
}

