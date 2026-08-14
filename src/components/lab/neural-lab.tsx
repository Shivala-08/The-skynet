"use client";

import { BrainLab } from "./brain-lab";
import type { FloatingAppId } from "@/lib/data";

type NeuralLabProps = {
  booted: boolean;
  onOpenApp: (app: FloatingAppId) => void;
};

/**
 * The 3D brain lab. Renders a large, interactive 3D human brain neural network
 * that serves as an immersive backdrop. The network reacts to the cursor,
 * evolves through scroll stages, and its lobes navigate to sections on click.
 *
 * Rendered by the in-house MiniRenderer (points / lines / one sphere) instead
 * of three.js + R3F — same scene, ~20x smaller bundle.
 */
export function NeuralLab({ booted, onOpenApp }: NeuralLabProps) {
  return (
    <div className="absolute inset-0 z-0">
      <BrainLab booted={booted} onOpenApp={onOpenApp} />
    </div>
  );
}
