/**
 * Module-level scroll progress (0 → 1) across the full page.
 * Updated by the ScrollChoreography component; read by anything that
 * needs scroll position without prop-drilling (e.g. the 3D camera rig).
 */
let _progress = 0;

export function getScrollProgress(): number {
  return _progress;
}

export function setScrollProgress(p: number): void {
  _progress = p;
}
