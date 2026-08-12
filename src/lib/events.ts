// Tiny event bridge so static sections can tell the OS shell what to open.

export const OPEN_PROJECT_EVENT = "pallav:open-project";

export function openProjectInFiles(slug: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(OPEN_PROJECT_EVENT, { detail: slug }));
}
