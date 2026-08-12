import type { FloatingAppId } from "@/lib/data";

export type LabNode = {
  id: string;
  label: string;
  pos: [number, number, number];
  href?: string;
  app?: FloatingAppId;
  isNav: boolean;
};

// 7 key navigation landmarks, placed in correct anatomical brain lobes
export const NAV_NODES = [
  { id: "research", label: "Research", pos: [0.0, 1.2, 0.2], href: "#research" },
  { id: "builds", label: "Builds", pos: [-0.9, 0.8, -0.8], href: "#builds" },
  { id: "systems", label: "Systems", pos: [0.9, 0.8, -0.8], href: "#systems" },
  { id: "about", label: "About", pos: [-1.1, -0.2, 0.4], href: "#about" },
  { id: "contact", label: "Contact", pos: [0.0, -1.3, -0.3], href: "#contact" },
  { id: "terminal", label: "Terminal", pos: [-0.6, 0.7, 1.1], app: "terminal" as const },
  { id: "files", label: "Files", pos: [0.6, 0.7, 1.1], app: "files" as const },
];

function isInBrain(x: number, y: number, z: number): boolean {
  // Cerebrum (Cortex) - symmetric hemispheres split by x=0 fissure
  const hx = Math.abs(x) - 0.12;
  
  // Tapering scale factor (narrower at frontal pole Z > 0, wider at parietal, tapered at occipital Z < -0.3)
  let scale = 1.0;
  if (z > 0) {
    scale = 1.0 - 0.28 * z;
  } else {
    scale = 1.0 - 0.28 * Math.abs(z + 0.2);
  }
  
  const rx = hx / (1.1 * scale);
  const ry = y / (0.85 * scale);
  const rz = z / (1.35 * scale);
  
  // Periodic folding pattern mimicking brain gyri (folds) & sulci (grooves)
  const folds = 1.0 + 0.08 * Math.sin(x * 12) * Math.sin(y * 12) * Math.sin(z * 12);
  if (rx*rx + ry*ry + rz*rz < folds && y > -0.5) return true;

  // Cerebellum (Lower back portion)
  const cx = (Math.abs(x) - 0.08) - 0.0;
  const cy = y - (-0.65);
  const cz = z - (-0.75);
  if ((cx/0.52)**2 + (cy/0.38)**2 + (cz/0.45)**2 < 1.0) return true;

  // Brainstem (Base center column extending down)
  if (y >= -1.3 && y <= -0.5) {
    const distSq = x*x + (z + 0.25)*(z + 0.25);
    if (distSq < 0.22*0.22) return true;
  }

  return false;
}

/**
 * Hard cap on generated nodes. network-scene.tsx sizes its mutable simulation
 * buffers from this constant — keep them in sync (see BRAIN_NODE_CAPACITY).
 */
export const BRAIN_NODE_LIMIT = 600;

export function generateBrainNodes(): LabNode[] {
  const nodes: LabNode[] = NAV_NODES.map((n) => ({
    id: n.id,
    label: n.label,
    pos: n.pos as [number, number, number],
    href: n.href,
    app: n.app,
    isNav: true,
  }));

  const minDistance = 0.16; // strict spacing to keep node density uniform
  const limit = BRAIN_NODE_LIMIT; // total nodes inside the brain model
  
  let attempts = 0;
  while (nodes.length < limit && attempts < 25000) {
    attempts++;
    
    // Random sample inside the bounding box
    const x = (Math.random() - 0.5) * 2.8;
    const y = (Math.random() - 0.5) * 3.0;
    const z = (Math.random() - 0.5) * 3.6;

    if (isInBrain(x, y, z)) {
      let ok = true;
      for (const n of nodes) {
        const dx = x - n.pos[0];
        const dy = y - n.pos[1];
        const dz = z - n.pos[2];
        const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (d < minDistance) {
          ok = false;
          break;
        }
      }
      if (ok) {
        nodes.push({
          id: `node-${nodes.length}`,
          label: "",
          pos: [x, y, z],
          isNav: false,
        });
      }
    }
  }
  return nodes;
}

export function generateBrainEdges(nodes: LabNode[]): [number, number][] {
  const edges: [number, number][] = [];
  const maxDist = 0.42; // connect nodes only within immediate synaptic distance

  for (let i = 0; i < nodes.length; i++) {
    const list: { idx: number; dist: number }[] = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const dx = nodes[i].pos[0] - nodes[j].pos[0];
      const dy = nodes[i].pos[1] - nodes[j].pos[1];
      const dz = nodes[i].pos[2] - nodes[j].pos[2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < maxDist) {
        list.push({ idx: j, dist });
      }
    }
    list.sort((a, b) => a.dist - b.dist);
    // Connect to 2 closest neighbors to form a dense grid lattice
    for (let k = 0; k < Math.min(2, list.length); k++) {
      const target = list[k].idx;
      if (!edges.some(([a, b]) => (a === i && b === target) || (a === target && b === i))) {
        edges.push([i, target]);
      }
    }
  }

  // Corpus Callosum bridges linking left & right hemispheres
  const left = nodes.map((n, idx) => ({ n, idx })).filter(item => item.n.pos[0] < 0 && item.n.isNav === false);
  const right = nodes.map((n, idx) => ({ n, idx })).filter(item => item.n.pos[0] > 0 && item.n.isNav === false);
  let bridges = 0;

  for (const l of left) {
    for (const r of right) {
      if (Math.abs(l.n.pos[1] - r.n.pos[1]) < 0.20 && Math.abs(l.n.pos[2] - r.n.pos[2]) < 0.20) {
        const dx = l.n.pos[0] - r.n.pos[0];
        const dy = l.n.pos[1] - r.n.pos[1];
        const dz = l.n.pos[2] - r.n.pos[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 0.45 && bridges < 30) {
          edges.push([l.idx, r.idx]);
          bridges++;
        }
      }
    }
  }

  return edges;
}
