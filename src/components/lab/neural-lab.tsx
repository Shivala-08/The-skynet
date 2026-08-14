"use client";

import { Canvas } from "@react-three/fiber";
import { NetworkScene } from "./network-scene";
import { ColorGrade } from "./color-grade";
import type { FloatingAppId } from "@/lib/data";

type NeuralLabProps = {
  booted: boolean;
  onOpenApp: (app: FloatingAppId) => void;
};

/**
 * The 3D brain lab. Renders a large, interactive 3D human brain neural network
 * that serves as an immersive backdrop. The network reacts to the cursor,
 * evolves through scroll stages, and its lobes navigate to sections on click.
 */
export function NeuralLab({ booted, onOpenApp }: NeuralLabProps) {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        frameloop="always"
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 7.5], fov: 45 }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[0, 4, 5]} intensity={20} color="#4d8dff" />
        <pointLight position={[-4, -3, 3]} intensity={10} color="#8ab0ff" />
        {/* Global color grade — one onBeforeCompile pass over every material,
            the reference site's restraint trick. Keeps the scene inside the
            black/white/electric-blue palette no matter what renders. */}
        <ColorGrade />
        <NetworkScene booted={booted} onOpenApp={onOpenApp} />
      </Canvas>
    </div>
  );
}
