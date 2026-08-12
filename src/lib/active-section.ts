/**
 * Module store for the "active" section shown in the top-bar nav.
 * Updated by a scrollspy (IntersectionObserver) and set immediately when the
 * landmark breadcrumb navigates, so the target section highlights on click.
 */

let active: string | null = null;
let snapshot: string | null = null;
const listeners = new Set<() => void>();

export function setActiveSection(id: string | null): void {
  if (active === id) return;
  active = id;
  snapshot = id;
  listeners.forEach((fn) => fn());
}

export function getActiveSection(): string | null {
  return snapshot;
}

export function subscribeActiveSection(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
