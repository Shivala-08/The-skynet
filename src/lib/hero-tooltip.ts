/**
 * Tiny module-level store for the hero-scene hover tooltip (the data sphere /
 * torus / icosahedron). The 3D frame loop writes the name + role + screen
 * position while a shape is hovered; the DOM component reads it via rAF so
 * the pill follows the cursor at 60fps without React re-renders.
 */

export type HeroTooltipState = {
  visible: boolean;
  name: string;
  role: string;
  x: number; // viewport px
  y: number; // viewport px
};

const state: HeroTooltipState = { visible: false, name: "", role: "", x: 0, y: 0 };

export function showHeroTooltip(name: string, role: string, x: number, y: number): void {
  state.visible = true;
  state.name = name;
  state.role = role;
  state.x = x;
  state.y = y;
}

export function hideHeroTooltip(): void {
  state.visible = false;
}

export function getHeroTooltip(): HeroTooltipState {
  return state;
}
