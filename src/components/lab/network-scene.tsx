"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { generateBrainNodes, generateBrainEdges, BRAIN_NODE_LIMIT } from "./network";
import { playSphereClick, playSphereHover } from "@/lib/sounds";
import { getScrollProgress } from "@/lib/scroll-progress";
import { scrollToId } from "@/lib/scroll";
import type { FloatingAppId } from "@/lib/data";
import { advanceTraining, getTrainingStateRaw, type TrainingPhase } from "@/lib/training";
import { setLobeLabel, setLastHoveredLandmark } from "@/lib/lobe-label";

type NetworkSceneProps = {
  booted: boolean;
  /** Opens a floating app (Terminal / Files) when its lobe is clicked. */
  onOpenApp?: (app: FloatingAppId) => void;
};

interface Signal {
  startNode: number;
  endNode: number;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  progress: number;
  speed: number;
}

const MAX_SIGNALS = 250;
const MAX_GLOWS = 350;
const WHITE = new THREE.Color("#ffffff");
const WARM = new THREE.Color("#ffe8a3");

// Mutable simulation buffers live at module level so the pointer handlers can
// write activation energy without React render purity concerns (same pattern
// as hero-scene.tsx). Sized from the generator's hard cap + margin.
const BRAIN_NODE_CAPACITY = BRAIN_NODE_LIMIT + 64;
const energy = new Float32Array(BRAIN_NODE_CAPACITY); // per-node activation 0..1
// Working colours must match the colour attribute length exactly (copyArray
// copies the whole buffer — an oversized one throws "offset out of bounds").
const workingColors = new Float32Array(BRAIN_NODE_LIMIT * 3); // per-frame colours
const glowPositions = new Float32Array(MAX_GLOWS * 3).fill(9999); // energized-node glow points

// ---------------------------------------------------------------------------
// Deterministic PRNG — node colours are picked at module level so the React
// render phase stays pure (no Math.random inside component bodies).
// ---------------------------------------------------------------------------
let _seed = 1337;
function prng(): number {
  _seed = (_seed * 16807) % 2147483647;
  return (_seed - 1) / 2147483646;
}

const BASE_PALETTES = ["#ffb700", "#ff5100", "#ff0044", "#00d2ff", "#4d8dff"].map(
  (hex) => new THREE.Color(hex),
);

// ---------------------------------------------------------------------------
// Module-level cursor state — written by the pointer handlers, read by the
// frame loop so the whole network reacts to the mouse in a single pass.
// ---------------------------------------------------------------------------
const _cursor = new THREE.Vector2(0, 0); // NDC
const _cursorWorld = new THREE.Vector3(); // world-space point on camera plane
const _cursorVelocity = new THREE.Vector2(0, 0); // px per event, smoothed
let _cursorActive = false;
let _lastScreenX = 0;
let _lastScreenY = 0;

// Scratch vector for projecting the hovered landmark to screen space
const _labelVec = new THREE.Vector3();
// Cached canvas rect for the label projection — refreshed on resize (the
// desktop section is sticky, so the rect is constant during scroll).
const _canvasRect = { left: 0, top: 0, width: 0, height: 0 };
let _canvasRectKnown = false;

// Click-to-dive camera zoom — module-level so CameraRig can yield to it.
const _camZoom = {
  active: false,
  fired: false,
  href: null as string | null,
  startTime: 0,
  durationMs: 1100,
  from: new THREE.Vector3(),
  to: new THREE.Vector3(),
  point: new THREE.Vector3(),
};

// ---------------------------------------------------------------------------
// Scroll stages — the portfolio is a neural journey:
//
//   p 0.00–0.08  HERO      → dormant, sparse idle pulses
//   p 0.08–0.30  RESEARCH  → network activates, glow ramps up
//   p 0.30–0.50  BUILDS    → clusters pulse in sync (project pathways)
//   p 0.50–0.70  SYSTEMS   → signals flow through the agent architecture
//   p 0.70–0.88  ABOUT     → denser: lines brighten, more traffic
//   p 0.88–1.00  CONTACT   → converge into a single output node
// ---------------------------------------------------------------------------

type Stage = {
  activity: number; // 0..1 overall electrical activity
  disp: number; // node dispersion scale (1 = compact)
  converge: number; // 0..1 pull toward the contact "output" node
  clusterK: number; // 0..1 synced cluster pulsing
  lineOpacity: number;
  pointOpacity: number;
  signalRate: number; // ambient signal spawn probability per frame
};

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function computeStage(p: number): Stage {
  const activate = smoothstep(0.05, 0.3, p);
  const activity = activate * (1 - smoothstep(0.92, 1, p) * 0.35);

  // Dispersion envelope: compact at hero, expands mid-page, contracts at converge
  const spread = smoothstep(0.08, 0.35, p) * (1 - smoothstep(0.72, 0.88, p));
  const disp = 1.0 + spread * 2.4;

  const converge = smoothstep(0.86, 1.0, p);
  const clusterK = smoothstep(0.28, 0.45, p) * (1 - smoothstep(0.55, 0.7, p));

  // Lines: base glow → denser mid-page → dissolve into the output at converge
  const dense = smoothstep(0.45, 0.65, p);
  const lineFade = 1 - smoothstep(0.86, 0.97, p);
  const lineOpacity = Math.max(0, 0.15 * (1 + dense * 1.2)) * lineFade;

  const pointOpacity = 0.8 * (0.75 + activity * 0.25) * (1 - converge * 0.55);

  // Signals: dormant hero → flowing mid-page
  const signalRate = 0.015 + activity * 0.2 + dense * 0.08;

  return { activity, disp, converge, clusterK, lineOpacity, pointOpacity, signalRate };
}

// ---------------------------------------------------------------------------
// Lobes = sections. Scroll lights up the region you're reading; hovering a
// lobe fires a faint signal toward the region it feeds (knowledge → projects).
// ---------------------------------------------------------------------------
const SECTION_IDS = ["research", "builds", "systems", "about", "contact"];
const SECTION_RANGES: [number, number][] = [
  [0.08, 0.3],
  [0.3, 0.5],
  [0.5, 0.7],
  [0.7, 0.88],
  [0.88, 1.0],
];
const RELATED_REGIONS: Record<string, string | null> = {
  research: "builds",
  builds: "systems",
  systems: "about",
  about: "contact",
  contact: null,
};

// Lobe membership radius around each landmark node (in base-position space).
const REGION_RADIUS = 0.8;

export function NetworkScene({ booted, onOpenApp }: NetworkSceneProps) {
  const reduce = useReducedMotion();
  const aspect = useThree((s) => s.viewport.aspect);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  // Make the brain significantly larger for an immersive backdrop
  const groupScale = Math.min(2.5, Math.max(1.3, aspect * 1.85));

  const pointsRef = useRef<THREE.Points>(null);
  const lineRef = useRef<THREE.LineSegments>(null);
  const signalRef = useRef<THREE.Points>(null);
  const glowRef = useRef<THREE.Points>(null);
  const grabbedMeshRef = useRef<THREE.Mesh>(null);
  const activeSignals = useRef<Signal[]>([]);
  const groupRef = useRef<THREE.Group>(null);

  // Simulation state clock reference
  const stateClockTime = useRef<number>(0);

  // Mouse raycasting plane (for general coordinate tracking)
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const localMouse = useMemo(() => new THREE.Vector3(), []);

  // Node Grab & Pull state
  const grabbedNode = useRef<number | null>(null);
  const grabbedDepth = useRef<number>(0);
  const [grabbedIdx, setGrabbedIdx] = useState<number | null>(null);
  const nodeOffsets = useRef<THREE.Vector3[]>([]);

  // Hover / velocity state
  const hoveredNode = useRef<number | null>(null);
  const lastHoverCheck = useRef(0);
  const lastVelocityPulse = useRef(0);

  // Track training phase transitions (for the one-shot convergence burst)
  const trainingPhase = useRef<TrainingPhase>("idle");

  // Keep the cached canvas rect fresh (label projection needs it)
  useEffect(() => {
    const refresh = () => {
      const rect = gl.domElement.getBoundingClientRect();
      _canvasRect.left = rect.left;
      _canvasRect.top = rect.top;
      _canvasRect.width = rect.width;
      _canvasRect.height = rect.height;
      _canvasRectKnown = true;
    };
    refresh();
    window.addEventListener("resize", refresh);
    return () => window.removeEventListener("resize", refresh);
  }, [gl]);

  // Drag-to-rotate state
  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0]);
  const pointerDown = useRef(false);
  const pointerStart = useRef({ x: 0, y: 0 });
  const rotationStart = useRef({ x: 0, y: 0 });

  // Generate brain shape nodes and connections once
  const nodes = useMemo(() => generateBrainNodes(), []);
  const edges = useMemo(() => generateBrainEdges(nodes), [nodes]);

  // Adjacency map — fast neighbour lookups for hover highlighting + pulses
  const neighbors = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const [a, b] of edges) {
      if (!map.has(a)) map.set(a, []);
      if (!map.has(b)) map.set(b, []);
      map.get(a)!.push(b);
      map.get(b)!.push(a);
    }
    return map;
  }, [edges]);

  // The contact node is the network's "output" — everything converges on it
  const contactIdx = useMemo(() => {
    const i = nodes.findIndex((n) => n.id === "contact");
    return i === -1 ? 0 : i;
  }, [nodes]);

  // Nav landmark lookup + section region membership (lobes = sections)
  const navIdxById = useMemo(() => {
    const map = new Map<string, number>();
    nodes.forEach((n, i) => {
      if (!n.id.startsWith("node-")) map.set(n.id, i);
    });
    return map;
  }, [nodes]);

  const sectionNavIdx = useMemo(
    () => SECTION_IDS.map((id) => navIdxById.get(id) ?? -1),
    [navIdxById],
  );

  // Lobe membership per landmark — every nav node gets a region of nearby
  // nodes so hovering a landmark can light up its whole lobe.
  const landmarkRegions = useMemo(() => {
    const map = new Map<number, boolean[]>();
    for (const [navIdx, navNode] of nodes.entries()) {
      if (navNode.id.startsWith("node-")) continue;
      const flags = new Array<boolean>(nodes.length).fill(false);
      const [nx, ny, nz] = navNode.pos;
      nodes.forEach((m, j) => {
        const dx = m.pos[0] - nx;
        const dy = m.pos[1] - ny;
        const dz = m.pos[2] - nz;
        flags[j] = dx * dx + dy * dy + dz * dz < REGION_RADIUS * REGION_RADIUS;
      });
      map.set(navIdx, flags);
    }
    return map;
  }, [nodes]);

  // Section regions (scroll highlights) reuse the same lobe membership
  const sectionRegions = useMemo(
    () =>
      sectionNavIdx.map((navIdx) =>
        navIdx >= 0
          ? (landmarkRegions.get(navIdx) ?? [])
          : new Array<boolean>(nodes.length).fill(false),
      ),
    [sectionNavIdx, landmarkRegions, nodes.length],
  );

  // Stable per-node phase so whole lobes pulse in sync during the cluster stage
  const clusterPhase = useMemo(() => {
    const arr = new Float32Array(nodes.length);
    nodes.forEach((n, i) => {
      arr[i] = Math.abs(n.pos[0]) * 13.7 + n.pos[1] * 7.3 + n.pos[2] * 3.1;
    });
    return arr;
  }, [nodes]);

  // Pre-allocate buffer arrays for high-performance CPU vertex warping updates
  const displacedPositions = useMemo(() => new Float32Array(nodes.length * 3), [nodes]);
  const activeEdgePositions = useMemo(() => new Float32Array(edges.length * 6), [edges]);

  // Base colours (deterministic) + per-frame working colours driven by energy
  const baseColors = useMemo(() => {
    const col = new Float32Array(nodes.length * 3);
    for (let i = 0; i < nodes.length; i++) {
      const r = prng();
      const color =
        r < 0.45
          ? BASE_PALETTES[0]
          : r < 0.72
            ? BASE_PALETTES[1]
            : r < 0.88
              ? BASE_PALETTES[2]
              : r < 0.96
                ? BASE_PALETTES[3]
                : BASE_PALETTES[4];
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
    }
    return col;
  }, [nodes]);
  // Initialize node offsets + reset simulation buffers on (re)mount
  useEffect(() => {
    nodeOffsets.current = nodes.map(() => new THREE.Vector3(0, 0, 0));
    energy.fill(0);
  }, [nodes]);

  // Stage-aware node position — non-allocating variant writing into `out`,
  // so the hot paths (frame loop, hover raycasts) don't churn the GC.
  const computeNodePosInto = useCallback(
    (idx: number, t: number, stage: Stage, out: THREE.Vector3): void => {
      const n = nodes[idx];
      const driftAmp = stage.activity;
      const driftX = Math.sin(t * 0.4 + idx * 0.1) * 0.25 * driftAmp;
      const driftY = Math.cos(t * 0.3 + idx * 0.2) * 0.25 * driftAmp;
      const driftZ = Math.sin(t * 0.2 + idx * 0.3) * 0.25 * driftAmp;

      // TRAINING — high-frequency jitter that settles as the model converges
      const training = getTrainingStateRaw();
      const jitterAmp =
        !reduce && training.phase === "training"
          ? (1 - training.epoch / training.totalEpochs) * 0.32
          : 0;

      const baseX = n.pos[0] * stage.disp + driftX + Math.sin(t * 7.3 + idx * 1.7) * jitterAmp;
      const baseY = n.pos[1] * stage.disp + driftY + Math.sin(t * 8.1 + idx * 2.3) * jitterAmp;
      const baseZ = n.pos[2] * stage.disp + driftZ + Math.sin(t * 6.7 + idx * 0.9) * jitterAmp;

      // CONTACT stage — the network converges into a single output ball
      if (stage.converge > 0 && contactIdx >= 0) {
        const c = nodes[contactIdx].pos;
        const k = stage.converge;
        const targetX = c[0] + n.pos[0] * 0.05 + Math.sin(idx * 1.7) * 0.02;
        const targetY = c[1] + n.pos[1] * 0.05 + Math.cos(idx * 2.3) * 0.02;
        const targetZ = c[2] + n.pos[2] * 0.05;
        out.set(
          baseX + (targetX - baseX) * k,
          baseY + (targetY - baseY) * k,
          baseZ + (targetZ - baseZ) * k,
        );
        return;
      }
      out.set(baseX, baseY, baseZ);
    },
    [nodes, contactIdx, reduce],
  );

  // Allocating convenience wrapper for non-hot call sites
  const computeNodePos = useCallback(
    (idx: number, t: number, stage: Stage): THREE.Vector3 => {
      const out = new THREE.Vector3();
      computeNodePosInto(idx, t, stage, out);
      return out;
    },
    [computeNodePosInto],
  );

  // Trigger synaptic pulse along connected pathways
  const triggerPulse = useCallback(
    (nodeIdx: number, strength = 1) => {
      if (reduce) return;
      const connected = neighbors.get(nodeIdx) ?? [];
      for (let w = 0; w < strength; w++) {
        for (const targetIdx of connected) {
          if (activeSignals.current.length >= MAX_SIGNALS) return;
          activeSignals.current.push({
            startNode: nodeIdx,
            endNode: targetIdx,
            startPos: new THREE.Vector3(...nodes[nodeIdx].pos),
            endPos: new THREE.Vector3(...nodes[targetIdx].pos),
            progress: 0,
            speed: 2.2 + Math.random() * 2.8,
          });
        }
      }
    },
    [nodes, neighbors, reduce],
  );

  // Fire one explicit signal between two lobes (region-to-region firing)
  const fireSignal = useCallback(
    (fromIdx: number, toIdx: number) => {
      if (reduce) return;
      if (activeSignals.current.length >= MAX_SIGNALS) return;
      activeSignals.current.push({
        startNode: fromIdx,
        endNode: toIdx,
        startPos: new THREE.Vector3(...nodes[fromIdx].pos),
        endPos: new THREE.Vector3(...nodes[toIdx].pos),
        progress: 0,
        speed: 2.4 + Math.random() * 0.8,
      });
    },
    [nodes, reduce],
  );

  // Click a lobe → camera dives into the region, then the section loads
  const startZoom = useCallback(
    (nodeIdx: number, href: string) => {
      if (reduce) return;
      const t = stateClockTime.current;
      const stage = computeStage(getScrollProgress());
      const local = computeNodePos(nodeIdx, t, stage);
      if (nodeOffsets.current[nodeIdx]) local.add(nodeOffsets.current[nodeIdx]);
      const world = local.clone();
      if (groupRef.current) world.applyMatrix4(groupRef.current.matrixWorld);
      const dir = world.clone().normalize();
      _camZoom.from.copy(camera.position);
      _camZoom.to.copy(world).addScaledVector(dir, 2.4);
      _camZoom.point.copy(world);
      _camZoom.href = href.replace(/^#/, "");
      _camZoom.fired = false;
      _camZoom.active = true;
      _camZoom.startTime = performance.now();
    },
    [camera, computeNodePos, reduce],
  );

  // Convert a pointer event to NDC + velocity (e.pointer is already NDC)
  const screenToNdc = useCallback((e: ThreeEvent<PointerEvent>) => {
    _cursor.copy(e.pointer);
    const dx = e.clientX - _lastScreenX;
    const dy = e.clientY - _lastScreenY;
    _lastScreenX = e.clientX;
    _lastScreenY = e.clientY;
    _cursorVelocity.x += (dx - _cursorVelocity.x) * 0.4;
    _cursorVelocity.y += (dy - _cursorVelocity.y) * 0.4;
    _cursorActive = true;
  }, []);

  const nearestNodeTo = useCallback(
    (point: THREE.Vector3, radius: number, t: number, stage: Stage): number => {
      let best = -1;
      let bestDistSq = radius * radius;
      const scratch = new THREE.Vector3(); // one allocation per call, not per node
      for (let i = 0; i < nodes.length; i++) {
        computeNodePosInto(i, t, stage, scratch);
        const dx = scratch.x - point.x;
        const dy = scratch.y - point.y;
        const dz = scratch.z - point.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestDistSq) {
          bestDistSq = d;
          best = i;
        }
      }
      return best;
    },
    [nodes, computeNodePosInto],
  );

  // -------------------------------------------------------------------------
  // Pointer handlers
  // -------------------------------------------------------------------------

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    screenToNdc(e);

    // Get mouse coordinates on the camera-aligned plane
    const planePoint = new THREE.Vector3();
    e.ray.intersectPlane(plane, planePoint);

    // Convert world mouse coordinates to group local coordinates
    const localMousePoint = planePoint.clone();
    if (groupRef.current) {
      localMousePoint.applyMatrix4(new THREE.Matrix4().copy(groupRef.current.matrixWorld).invert());
    }

    const t = stateClockTime.current;
    const stage = computeStage(getScrollProgress());
    const closestIdx = nearestNodeTo(localMousePoint, 0.62, t, stage);

    if (closestIdx !== -1) {
      const node = nodes[closestIdx];

      if (node.href || node.app) {
        // Lobe landmark — navigate instead of grabbing (the DOM icon grid
        // below is the always-accessible fallback navigation).
        energy[closestIdx] = 1;
        const connected = neighbors.get(closestIdx) ?? [];
        for (const nb of connected) energy[nb] = Math.min(1, energy[nb] + 0.6);
        triggerPulse(closestIdx, 2);
        playSphereClick();
        if (node.href) {
          if (reduce) {
            // Reduced motion — skip the camera dive, just go straight there
            scrollToId(node.href.replace(/^#/, ""));
          } else {
            startZoom(closestIdx, node.href);
          }
        } else if (node.app && onOpenApp) {
          onOpenApp(node.app);
        }
        return;
      }

      // Grab and manipulate the selected node
      grabbedNode.current = closestIdx;
      setGrabbedIdx(closestIdx);
      (e.target as HTMLElement | null)?.setPointerCapture?.(e.pointerId);

      // Record the exact 3D world depth of the node relative to the camera
      const localPos = computeNodePos(closestIdx, t, stage);
      if (nodeOffsets.current[closestIdx]) localPos.add(nodeOffsets.current[closestIdx]);
      const worldPos = localPos.clone();
      if (groupRef.current) {
        worldPos.applyMatrix4(groupRef.current.matrixWorld);
      }
      grabbedDepth.current = worldPos.distanceTo(camera.position);

      // Click → send a strong signal through the network
      energy[closestIdx] = 1;
      const connected = neighbors.get(closestIdx) ?? [];
      for (const nb of connected) energy[nb] = Math.min(1, energy[nb] + 0.6);
      playSphereClick();
      triggerPulse(closestIdx, 2);
    } else {
      // Fallback: Rotate the entire brain object
      grabbedNode.current = null;
      setGrabbedIdx(null);
      pointerDown.current = true;
      pointerStart.current = { x: e.clientX, y: e.clientY };
      rotationStart.current = { x: rotation[1], y: rotation[0] };
      (e.target as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
      playSphereClick();
    }
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    screenToNdc(e);

    const t = stateClockTime.current;
    const stage = computeStage(getScrollProgress());

    if (grabbedNode.current !== null) {
      // Dragging a node: calculate new position along pointer ray at recorded camera depth
      const idx = grabbedNode.current;
      const worldTarget = new THREE.Vector3();
      e.ray.at(grabbedDepth.current, worldTarget);

      // Convert target coordinate to local group space
      const localTarget = worldTarget.clone();
      if (groupRef.current) {
        localTarget.applyMatrix4(new THREE.Matrix4().copy(groupRef.current.matrixWorld).invert());
      }

      const base = computeNodePos(idx, t, stage);
      if (nodeOffsets.current[idx]) {
        nodeOffsets.current[idx].copy(localTarget).sub(base);
      }

      // Synaptic pulse waves emitted while stretching connections
      if (Math.random() < 0.18) {
        triggerPulse(idx);
      }
    } else if (pointerDown.current && !_camZoom.active) {
      // Rotating the brain network group (paused while the camera dives)
      const dx = (e.clientX - pointerStart.current.x) * 0.005;
      const dy = (e.clientY - pointerStart.current.y) * 0.005;
      setRotation([rotationStart.current.y + dy, rotationStart.current.x + dx, 0]);
    }

    // Hover → highlight the neuron and its connected neighbours
    const now = performance.now();
    if (grabbedNode.current === null && now - lastHoverCheck.current > 60) {
      lastHoverCheck.current = now;
      const planePoint = new THREE.Vector3();
      e.ray.intersectPlane(plane, planePoint);
      const localMousePoint = planePoint.clone();
      if (groupRef.current) {
        localMousePoint.applyMatrix4(new THREE.Matrix4().copy(groupRef.current.matrixWorld).invert());
      }
      const hovered = nearestNodeTo(localMousePoint, 0.34, t, stage);
      if (hovered !== -1 && hovered !== hoveredNode.current) {
        hoveredNode.current = hovered;
        energy[hovered] = Math.min(1, energy[hovered] + 0.65);
        const connected = neighbors.get(hovered) ?? [];
        for (const nb of connected) energy[nb] = Math.min(1, energy[nb] + 0.38);
        triggerPulse(hovered, 1);
        playSphereHover();

        // Region-to-region firing: hovering a lobe sends a faint signal
        // toward the region it feeds (research → builds → systems → …)
        const hId = nodes[hovered].id;
        const relatedId = RELATED_REGIONS[hId];
        if (relatedId) {
          const relatedIdx = navIdxById.get(relatedId);
          if (relatedIdx !== undefined) fireSignal(hovered, relatedIdx);
        }
      } else if (hovered === -1) {
        hoveredNode.current = null;
      }
    }

    // Fast mouse movement → stronger signal propagation
    const speed = Math.hypot(_cursorVelocity.x, _cursorVelocity.y);
    if (speed > 16 && now - lastVelocityPulse.current > 90 && grabbedNode.current === null) {
      lastVelocityPulse.current = now;
      const src = hoveredNode.current ?? Math.floor(Math.random() * nodes.length);
      triggerPulse(src, 2);
    }
  };

  const onPointerUp = () => {
    pointerDown.current = false;
    grabbedNode.current = null;
    setGrabbedIdx(null);
  };

  // -------------------------------------------------------------------------
  // Frame loop — simulation, scroll stages, cursor reactivity
  // -------------------------------------------------------------------------

  useFrame((state, delta) => {
    const p = getScrollProgress();
    const t = state.clock.elapsedTime;
    stateClockTime.current = t;
    const stage = computeStage(p);

    // Fake training run — advances the HUD and drives the network's behaviour
    const training = getTrainingStateRaw();
    if (training.phase === "training") {
      advanceTraining(delta);
    }

    // Which lobe is being hovered? The landmark itself, or any node inside a
    // landmark's region — so the whole lobe lights up as the cursor wanders.
    const hoveredIdx = hoveredNode.current;
    let hoveredLobeIdx: number | null = null;
    if (hoveredIdx !== null) {
      if (landmarkRegions.has(hoveredIdx)) {
        hoveredLobeIdx = hoveredIdx;
      } else {
        for (const [navIdx, flags] of landmarkRegions) {
          if (flags[hoveredIdx]) {
            hoveredLobeIdx = navIdx;
            break;
          }
        }
      }
    }
    const hoveredRegion =
      hoveredLobeIdx !== null ? (landmarkRegions.get(hoveredLobeIdx) ?? null) : null;

    // Which section is the visitor currently reading? That lobe lights up.
    let activeSection = -1;
    let activeSectionK = 0;
    for (let s = 0; s < SECTION_RANGES.length; s++) {
      const [start, end] = SECTION_RANGES[s];
      const vis =
        smoothstep(start - 0.02, start + 0.04, p) *
        (1 - smoothstep(end - 0.04, end + 0.02, p));
      if (vis > activeSectionK) {
        activeSectionK = vis;
        activeSection = s;
      }
    }

    if (!reduce && groupRef.current && !pointerDown.current && grabbedNode.current === null && !_camZoom.active) {
      // Gentle floating and idle rotation
      groupRef.current.rotation.y = t * 0.035;
      groupRef.current.position.y = Math.sin(t * 0.3) * 0.04;
    }

    // Breathing scale — tightens as the network converges on its output
    if (!reduce && groupRef.current) {
      const breathe = 1 + stage.converge * 0.06 * Math.sin(t * 2.4);
      groupRef.current.scale.setScalar(groupScale * breathe);
    }

    // Spring physics damping: snap non-grabbed nodes back to baseline
    nodes.forEach((n, idx) => {
      if (grabbedNode.current !== idx && nodeOffsets.current[idx]) {
        const offset = nodeOffsets.current[idx];
        if (offset.lengthSq() > 0.0001) {
          offset.lerp(new THREE.Vector3(0, 0, 0), 0.12); // spring damping snap-back
        }
      }
    });

    // Project the cursor onto the camera plane, then into group-local space
    if (_cursorActive) {
      raycaster.setFromCamera(_cursor, camera);
      raycaster.ray.intersectPlane(plane, _cursorWorld);
      if (groupRef.current) {
        localMouse.copy(_cursorWorld).applyMatrix4(
          new THREE.Matrix4().copy(groupRef.current.matrixWorld).invert(),
        );
      }
    }

    // Click-to-dive: camera pushes into the clicked lobe before the section loads
    if (_camZoom.active && !reduce) {
      const zp = Math.min(1, (performance.now() - _camZoom.startTime) / _camZoom.durationMs);
      const ease = 1 - Math.pow(1 - zp, 3);
      camera.position.lerpVectors(_camZoom.from, _camZoom.to, ease);
      camera.lookAt(_camZoom.point);
      if (zp >= 1 && !_camZoom.fired) {
        _camZoom.fired = true;
        if (_camZoom.href) scrollToId(_camZoom.href);
      }
      if (zp >= 1 && performance.now() - _camZoom.startTime > _camZoom.durationMs + 1700) {
        _camZoom.active = false; // CameraRig eases back home
      }
    }

    // 1. LINES — dissolve/saturate by stage
    const lineMat = lineRef.current?.material as THREE.LineBasicMaterial;
    if (lineMat) {
      lineMat.opacity = stage.lineOpacity;
    }

    // 2. DISPERSE & WARP NODES + cursor proximity activation
    const tempNodeCoords: THREE.Vector3[] = [];

    nodes.forEach((n, i) => {
      // Decay activation energy
      if (!reduce) energy[i] *= 0.955;

      const pos = computeNodePos(i, t, stage);

      // Mouse → neural activity: neurons near the cursor glow and pulse
      if (_cursorActive && !reduce) {
        const dx = pos.x - localMouse.x;
        const dy = pos.y - localMouse.y;
        const dz = pos.z - localMouse.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const proximity = Math.max(0, 1 - d / 1.7);
        if (proximity > 0) {
          energy[i] = Math.min(1, energy[i] + proximity * 0.12 * (0.5 + stage.activity));
        }
      }

      // Skills stage — whole clusters pulse in sync
      if (!reduce && stage.clusterK > 0) {
        const wave = Math.max(0, Math.sin(t * 2.1 + clusterPhase[i]));
        energy[i] = Math.min(1, energy[i] + stage.clusterK * wave * 0.06);
      }

      // Current section's lobe lights up (activity tied to real state)
      if (!reduce && activeSection >= 0 && sectionRegions[activeSection][i]) {
        energy[i] = Math.min(1, energy[i] + activeSectionK * 0.1);
      }

      // Hovered lobe stays lit (gentle ramp so it blooms rather than snaps)
      if (!reduce && hoveredRegion && hoveredRegion[i]) {
        energy[i] = Math.min(1, energy[i] + 0.06);
      }

      // Ambient idle activation (dormant hero → live network)
      if (!reduce && Math.random() < stage.activity * 0.02) {
        energy[i] = Math.min(1, energy[i] + 0.25);
      }

      // Add grabbed offsets to determine final warped position
      if (nodeOffsets.current[i]) {
        pos.add(nodeOffsets.current[i]);
      }

      tempNodeCoords.push(pos);

      displacedPositions[i * 3] = pos.x;
      displacedPositions[i * 3 + 1] = pos.y;
      displacedPositions[i * 3 + 2] = pos.z;
    });

    // Write displaced node positions to points buffer attribute
    const posAttr = pointsRef.current?.geometry.attributes.position as THREE.BufferAttribute;
    if (posAttr) {
      posAttr.copyArray(displacedPositions);
      posAttr.needsUpdate = true;
    }

    // 3. COLOURS — active neurons brighten toward white (warm gold when hovered)
    if (!reduce) {
      const colorAttr = (pointsRef.current?.geometry.attributes.color as THREE.BufferAttribute) ?? null;
      if (colorAttr) {
        const tmp = new THREE.Color();
        const hovered = hoveredIdx;
        const hoveredRegionFlags = hoveredRegion;
        for (let i = 0; i < nodes.length; i++) {
          const e = energy[i];
          if (e > 0.02) {
            tmp.setRGB(baseColors[i * 3], baseColors[i * 3 + 1], baseColors[i * 3 + 2]);
            tmp.lerp(WHITE, Math.min(1, e));
            if (i === hovered) tmp.lerp(WARM, 0.45);
            else if (hoveredRegionFlags && hoveredRegionFlags[i]) tmp.lerp(WARM, 0.3);
            workingColors[i * 3] = tmp.r;
            workingColors[i * 3 + 1] = tmp.g;
            workingColors[i * 3 + 2] = tmp.b;
          } else {
            workingColors[i * 3] = baseColors[i * 3];
            workingColors[i * 3 + 1] = baseColors[i * 3 + 1];
            workingColors[i * 3 + 2] = baseColors[i * 3 + 2];
          }
        }
        colorAttr.copyArray(workingColors.subarray(0, nodes.length * 3));
        colorAttr.needsUpdate = true;
      }
    }

    // Align grabbed node indicator sphere with active mouse warp coordinates
    if (grabbedIdx !== null && grabbedMeshRef.current) {
      const coord = tempNodeCoords[grabbedIdx];
      grabbedMeshRef.current.position.copy(coord);
      grabbedMeshRef.current.visible = true;
    } else if (grabbedMeshRef.current) {
      grabbedMeshRef.current.visible = false;
    }

    // 4. GLOW LAYER — bright points at every energised neuron
    let glowCount = 0;
    if (!reduce) {
      for (let i = 0; i < nodes.length && glowCount < MAX_GLOWS; i++) {
        if (energy[i] > 0.5) {
          const c = tempNodeCoords[i];
          glowPositions[glowCount * 3] = c.x;
          glowPositions[glowCount * 3 + 1] = c.y;
          glowPositions[glowCount * 3 + 2] = c.z;
          glowCount++;
        }
      }
    }
    for (let i = glowCount; i < MAX_GLOWS; i++) {
      glowPositions[i * 3] = 9999;
      glowPositions[i * 3 + 1] = 9999;
      glowPositions[i * 3 + 2] = 9999;
    }
    const glowAttr = glowRef.current?.geometry.attributes.position as THREE.BufferAttribute;
    if (glowAttr) {
      glowAttr.needsUpdate = true;
    }

    // 5. Update connection lattice segments to match warped node coordinates
    edges.forEach(([a, b], i) => {
      const coordA = tempNodeCoords[a];
      const coordB = tempNodeCoords[b];

      activeEdgePositions[i * 6] = coordA.x;
      activeEdgePositions[i * 6 + 1] = coordA.y;
      activeEdgePositions[i * 6 + 2] = coordA.z;

      activeEdgePositions[i * 6 + 3] = coordB.x;
      activeEdgePositions[i * 6 + 4] = coordB.y;
      activeEdgePositions[i * 6 + 5] = coordB.z;
    });

    const linePosAttr = lineRef.current?.geometry.attributes.position as THREE.BufferAttribute;
    if (linePosAttr) {
      linePosAttr.copyArray(activeEdgePositions);
      linePosAttr.needsUpdate = true;
    }

    // 6. POINT CLOUD OPACITY by stage
    const pointsMat = pointsRef.current?.material as THREE.PointsMaterial;
    if (pointsMat) {
      pointsMat.opacity = stage.pointOpacity;
    }

    // 6b. Lobe landmark label — hovered nav node projected to screen space
    const landmark = hoveredIdx !== null ? nodes[hoveredIdx] : undefined;
    if (hoveredIdx !== null && landmark?.label && groupRef.current) {
      computeNodePosInto(hoveredIdx, t, stage, _labelVec);
      if (nodeOffsets.current[hoveredIdx]) _labelVec.add(nodeOffsets.current[hoveredIdx]);
      _labelVec.applyMatrix4(groupRef.current.matrixWorld);
      _labelVec.project(camera);
      if (_labelVec.z < 1 && _canvasRectKnown) {
        setLobeLabel(
          landmark.label,
          _canvasRect.left + (_labelVec.x * 0.5 + 0.5) * _canvasRect.width,
          _canvasRect.top + (-_labelVec.y * 0.5 + 0.5) * _canvasRect.height,
          landmark.app ? "click to open" : null,
        );
        // Persist for the top-bar breadcrumb (kept until another landmark is
        // hovered or the user dismisses it).
        setLastHoveredLandmark(landmark.id, landmark.label);
      } else {
        setLobeLabel(null);
      }
    } else {
      setLobeLabel(null);
    }

    if (reduce) return;

    // 7. Ambient signal spawning — rate follows the scroll stage
    if (booted && Math.random() < stage.signalRate) {
      triggerPulse(Math.floor(Math.random() * nodes.length));
    }

    // 7b. The active section's lobe fires periodically — the network "reads along"
    if (activeSection >= 0 && activeSectionK > 0.1 && Math.random() < activeSectionK * 0.06) {
      const navIdx = sectionNavIdx[activeSection];
      if (navIdx >= 0) triggerPulse(navIdx);
    }

    // 7c. TRAINING MODE — the network visibly "thinks": heavy sparking,
    //     signal floods and flickering synapses, then a celebratory convergence.
    if (training.phase === "training" && !reduce) {
      // Stress decays fully to 0 so the network visibly settles before convergence
      const stress = 1 - training.epoch / training.totalEpochs;
      if (Math.random() < 0.3 * stress) {
        energy[Math.floor(Math.random() * nodes.length)] = 1;
      }
      if (booted && Math.random() < 0.35 * stress) {
        triggerPulse(Math.floor(Math.random() * nodes.length));
      }
      if (lineMat) lineMat.opacity = Math.min(0.5, lineMat.opacity + Math.sin(t * 26) * 0.05);
    }
    if (training.phase === "converged" && trainingPhase.current === "training" && !reduce) {
      // MODEL CONVERGED — a flood of signals into the output neuron + full flash
      for (let k = 0; k < 24; k++) {
        fireSignal(Math.floor(Math.random() * nodes.length), contactIdx);
      }
      for (let i = 0; i < nodes.length; i++) energy[i] = 1;
    }
    trainingPhase.current = training.phase;

    // 8. Update active signals pathing
    const signals = activeSignals.current;
    for (let i = signals.length - 1; i >= 0; i--) {
      const s = signals[i];
      s.progress += delta * s.speed;

      if (s.progress >= 1.0) {
        // Continue along the graph unless the network is converging on its output
        if (Math.random() < 0.4 && stage.converge < 0.85) {
          const nextNode = s.endNode;
          let targetIdx: number;
          if (stage.converge > 0.3) {
            // Contact stage — signals flood into the single output neuron
            targetIdx = contactIdx;
          } else {
            const nextEdges = neighbors.get(nextNode) ?? [];
            if (nextEdges.length > 0) {
              const edge = nextEdges[Math.floor(Math.random() * nextEdges.length)];
              targetIdx = edge;
            } else {
              signals.splice(i, 1);
              continue;
            }
          }
          if (targetIdx !== s.startNode && signals.length < MAX_SIGNALS) {
            signals.push({
              startNode: nextNode,
              endNode: targetIdx,
              startPos: new THREE.Vector3(...nodes[nextNode].pos),
              endPos: new THREE.Vector3(...nodes[targetIdx].pos),
              progress: 0,
              speed: 2.0 + Math.random() * 2.5,
            });
          }
        }
        signals.splice(i, 1);
      }
    }

    // 9. Update signals position coordinates
    const sigPosAttr = signalRef.current?.geometry.attributes.position as THREE.BufferAttribute;
    const sigMat = signalRef.current?.material as THREE.PointsMaterial;
    if (sigMat) {
      sigMat.opacity = Math.max(0, 0.9 - stage.converge * 0.45);
    }

    if (sigPosAttr) {
      const contactVec = contactIdx >= 0 ? nodes[contactIdx].pos : [0, 0, 0];
      for (let i = 0; i < MAX_SIGNALS; i++) {
        if (i < signals.length) {
          const s = signals[i];
          const curr = new THREE.Vector3().lerpVectors(s.startPos, s.endPos, s.progress);
          // Contact stage — signals also converge toward the output
          if (stage.converge > 0) {
            curr.x += (contactVec[0] - curr.x) * stage.converge * s.progress;
            curr.y += (contactVec[1] - curr.y) * stage.converge * s.progress;
            curr.z += (contactVec[2] - curr.z) * stage.converge * s.progress;
          }
          sigPosAttr.setXYZ(i, curr.x * stage.disp, curr.y * stage.disp, curr.z * stage.disp);
        } else {
          sigPosAttr.setXYZ(i, 9999, 9999, 9999);
        }
      }
      sigPosAttr.needsUpdate = true;
    }
  });

  const initialSignalPos = useMemo(() => {
    const arr = new Float32Array(MAX_SIGNALS * 3);
    for (let i = 0; i < MAX_SIGNALS * 3; i++) arr[i] = 9999;
    return arr;
  }, []);

  return (
    <>
      <CameraRig booted={booted} reduce={!!reduce} />

      {/* Screen-sized invisible plane facing the camera to capture all pointer events */}
      <mesh
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerEnter={() => {
          _cursorActive = true;
        }}
        onPointerLeave={() => {
          _cursorActive = false;
          hoveredNode.current = null;
          _cursorVelocity.set(0, 0);
        }}
        position={[0, 0, 0]}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={groupRef} scale={groupScale} rotation={rotation}>
        {/* Connection Synapses (Lines warp dynamically to match nodes) */}
        <lineSegments ref={lineRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[new Float32Array(edges.length * 6), 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#00c8ff" transparent opacity={0.15} />
        </lineSegments>

        {/* Firing Synapse Signal Particles */}
        {!reduce && (
          <points ref={signalRef}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[initialSignalPos, 3]} />
            </bufferGeometry>
            <pointsMaterial
              color="#ffffff"
              size={0.065}
              sizeAttenuation
              transparent
              opacity={0.9}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </points>
        )}

        {/* Glow layer — bright points rendered only at energised neurons */}
        {!reduce && (
          <points ref={glowRef}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[glowPositions, 3]} />
            </bufferGeometry>
            <pointsMaterial
              color="#ffffff"
              size={0.09}
              sizeAttenuation
              transparent
              opacity={0.8}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </points>
        )}

        {/* Grabbed Node Highlight Indicator */}
        <mesh ref={grabbedMeshRef} visible={false}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial
            color="#ffaa00"
            emissive="#ffaa00"
            emissiveIntensity={3.5}
            roughness={0.1}
          />
        </mesh>

        {/* All Brain Nodes (Dense point cloud that warps dynamically to match nodes) */}
        <points ref={pointsRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[new Float32Array(nodes.length * 3), 3]} />
            <bufferAttribute attach="attributes-color" args={[baseColors, 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={0.045}
            sizeAttenuation
            vertexColors
            transparent
            opacity={0.8}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>
    </>
  );
}

/** Eases camera into focus once booted */
function CameraRig({ booted, reduce }: { booted: boolean; reduce: boolean }) {
  const camera = useThree((s) => s.camera);
  const startAt = useRef<number | null>(null);
  const from = useRef(new THREE.Vector3(0, 1.4, 9.5));
  const to = useRef(new THREE.Vector3(0, 0, 6.2));

  useEffect(() => {
    if (reduce) camera.position.copy(to.current);
  }, [reduce, camera]);

  useFrame((state) => {
    if (reduce) return;
    if (_camZoom.active) return; // a click-dive is driving the camera
    if (!booted) {
      camera.position.copy(from.current);
      startAt.current = null;
      return;
    }
    if (startAt.current === null) startAt.current = state.clock.elapsedTime;
    const p = Math.min(1, (state.clock.elapsedTime - startAt.current) / 1.6);
    const ease = 1 - Math.pow(1 - p, 3); // easeOutCubic
    if (p < 1) {
      camera.position.lerpVectors(from.current, to.current, ease);
    } else {
      // Settled — ease back home if a click-dive left the camera elsewhere
      camera.position.lerp(to.current, 0.045);
    }
    camera.lookAt(0, 0, 0);
  });

  return null;
}
