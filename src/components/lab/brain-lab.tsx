"use client";

// ---------------------------------------------------------------------------
// BrainLab — the 3D neural backdrop rendered by MiniRenderer (no three.js).
//
// This is a faithful port of network-scene.tsx: the simulation logic (scroll
// stages, activation energy, synaptic signals, training mode, hover lobes,
// drag-to-rotate, click-dive) is preserved 1:1. What changed is the render
// layer — the R3F <Canvas>/<points>/<lineSegments>/<mesh> JSX is replaced by
// imperative MiniRenderer draw calls inside a single rAF loop.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { MiniRenderer } from "./mini-renderer";
import { Mat4, Vec3 } from "@/lib/mini-math";
import { generateBrainNodes, generateBrainEdges, BRAIN_NODE_LIMIT } from "./network";
import { playSphereClick, playSphereHover } from "@/lib/sounds";
import { getScrollProgress } from "@/lib/scroll-progress";
import { scrollToId } from "@/lib/scroll";
import type { FloatingAppId } from "@/lib/data";
import { advanceTraining, getTrainingStateRaw, type TrainingPhase } from "@/lib/training";
import { setLobeLabel, setLastHoveredLandmark } from "@/lib/lobe-label";

type BrainLabProps = {
  booted: boolean;
  onOpenApp?: (app: FloatingAppId) => void;
};

interface Signal {
  startNode: number;
  endNode: number;
  startPos: Vec3;
  endPos: Vec3;
  progress: number;
  speed: number;
}

const MAX_SIGNALS = 250;
const MAX_GLOWS = 350;
const WHITE = new Vec3(1, 1, 1);
const WARM = new Vec3(0.749, 0.91, 1); // #bfe8ff

const BRAIN_NODE_CAPACITY = BRAIN_NODE_LIMIT + 64;
const energy = new Float32Array(BRAIN_NODE_CAPACITY);
const workingColors = new Float32Array(BRAIN_NODE_LIMIT * 3);
const glowPositions = new Float32Array(MAX_GLOWS * 3).fill(9999);

let _seed = 1337;
function prng(): number {
  _seed = (_seed * 16807) % 2147483647;
  return (_seed - 1) / 2147483646;
}

const BASE_PALETTES: [number, number, number][] = [
  [0.302, 0.553, 1], // #4d8dff
  [0.435, 0.647, 1], // #6fa5ff
  [0.541, 0.69, 1], // #8ab0ff
  [0.663, 0.847, 1], // #a9d8ff
  [0.878, 0.953, 1], // #e0f3ff
];

const _cursor = new Vec3(); // NDC x,y (z unused)
const _cursorWorld = new Vec3();
const _cursorVelocity = new Vec3();
let _cursorActive = false;
let _lastScreenX = 0;
let _lastScreenY = 0;

const _labelVec = new Vec3();
const _canvasRect = { left: 0, top: 0, width: 0, height: 0 };
let _canvasRectKnown = false;

const _camZoom = {
  active: false,
  fired: false,
  href: null as string | null,
  startTime: 0,
  durationMs: 1100,
  from: new Vec3(),
  to: new Vec3(),
  point: new Vec3(),
};

// ---------------------------------------------------------------------------
// Scroll stages — identical thresholds to the original scene.
// ---------------------------------------------------------------------------

type Stage = {
  activity: number;
  disp: number;
  converge: number;
  clusterK: number;
  lineOpacity: number;
  pointOpacity: number;
  signalRate: number;
};

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function computeStage(p: number): Stage {
  const activate = smoothstep(0.05, 0.3, p);
  const activity = activate * (1 - smoothstep(0.92, 1, p) * 0.35);
  const spread = smoothstep(0.08, 0.35, p) * (1 - smoothstep(0.72, 0.88, p));
  const disp = 1.0 + spread * 2.4;
  const converge = smoothstep(0.86, 1.0, p);
  const clusterK = smoothstep(0.28, 0.45, p) * (1 - smoothstep(0.55, 0.7, p));
  const dense = smoothstep(0.45, 0.65, p);
  const lineFade = 1 - smoothstep(0.86, 0.97, p);
  const lineOpacity = Math.max(0, 0.15 * (1 + dense * 1.2)) * lineFade;
  const pointOpacity = 0.8 * (0.75 + activity * 0.25) * (1 - converge * 0.55);
  const signalRate = 0.015 + activity * 0.2 + dense * 0.08;
  return { activity, disp, converge, clusterK, lineOpacity, pointOpacity, signalRate };
}

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
const REGION_RADIUS = 0.8;

// ---------------------------------------------------------------------------

export function BrainLab({ booted, onOpenApp }: BrainLabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateClockTime = useRef(0);
  const reduceRef = useRef(false);
  reduceRef.current =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: MiniRenderer;
    try {
      renderer = new MiniRenderer({ canvas, dpr: 1 });
    } catch {
      return; // WebGL unavailable — the DOM fallback carries the page
    }

    const reduce = reduceRef.current;
    const nodes = generateBrainNodes();
    const edges = generateBrainEdges(nodes);

    // ---- derived structures (same as the original) ----
    const neighbors = new Map<number, number[]>();
    for (const [a, b] of edges) {
      if (!neighbors.has(a)) neighbors.set(a, []);
      if (!neighbors.has(b)) neighbors.set(b, []);
      neighbors.get(a)!.push(b);
      neighbors.get(b)!.push(a);
    }
    const contactIdx = (() => {
      const i = nodes.findIndex((n) => n.id === "contact");
      return i === -1 ? 0 : i;
    })();
    const navIdxById = new Map<string, number>();
    nodes.forEach((n, i) => {
      if (!n.id.startsWith("node-")) navIdxById.set(n.id, i);
    });
    const sectionNavIdx = SECTION_IDS.map((id) => navIdxById.get(id) ?? -1);
    const landmarkRegions = new Map<number, boolean[]>();
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
      landmarkRegions.set(navIdx, flags);
    }
    const sectionRegions = sectionNavIdx.map((navIdx) =>
      navIdx >= 0 ? (landmarkRegions.get(navIdx) ?? []) : new Array<boolean>(nodes.length).fill(false),
    );
    const clusterPhase = new Float32Array(nodes.length);
    nodes.forEach((n, i) => {
      clusterPhase[i] = Math.abs(n.pos[0]) * 13.7 + n.pos[1] * 7.3 + n.pos[2] * 3.1;
    });
    const baseColors = new Float32Array(nodes.length * 3);
    for (let i = 0; i < nodes.length; i++) {
      const r = prng();
      const c =
        r < 0.45
          ? BASE_PALETTES[0]
          : r < 0.72
            ? BASE_PALETTES[1]
            : r < 0.88
              ? BASE_PALETTES[2]
              : r < 0.96
                ? BASE_PALETTES[3]
                : BASE_PALETTES[4];
      baseColors[i * 3] = c[0];
      baseColors[i * 3 + 1] = c[1];
      baseColors[i * 3 + 2] = c[2];
    }

    const nodeOffsets: Vec3[] = nodes.map(() => new Vec3());
    energy.fill(0);
    const activeSignals: Signal[] = [];

    // ---- buffer state ----
    // Points interleaved [x,y,z,r,g,b]
    const nodeData = new Float32Array(nodes.length * 6);
    for (let i = 0; i < nodes.length; i++) nodeData[i * 6 + 3] = baseColors[i * 3];
    for (let i = 0; i < nodes.length; i++) {
      nodeData[i * 6 + 4] = baseColors[i * 3 + 1];
      nodeData[i * 6 + 5] = baseColors[i * 3 + 2];
    }
    const lineData = new Float32Array(edges.length * 6);
    const signalPositions = new Float32Array(MAX_SIGNALS * 3).fill(9999);
    renderer.updatePoints(nodeData);
    renderer.updateLines(lineData);
    renderer.updatePointsPositions(signalPositions);
    renderer.buildSphere(12);

    // ---- interaction state ----
    let rotationX = 0;
    let rotationY = 0;
    let pointerDown = false;
    let pointerStart = { x: 0, y: 0 };
    let rotationStart = { x: 0, y: 0 };
    let grabbedNode: number | null = null;
    let grabbedDepth = 0;
    let hoveredNode: number | null = null;
    let lastHoverCheck = 0;
    let lastVelocityPulse = 0;
    let trainingPhase: TrainingPhase = "idle";

    // ---- camera rig state ----
    const camFrom = new Vec3(1.8, 1.9, 12.5);
    const camTo = new Vec3(0, 0, 6.2);
    const camMid = new Vec3(0.5, 2.6, 9);
    let camStartAt: number | null = null;
    const cameraPos = new Vec3();
    const cameraLookAt = new Vec3(0, 0, 0);

    // ---- group transform ----
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const groupScale = Math.min(2.5, Math.max(1.3, aspect * 1.85));
    const groupMatrix = new Mat4();

    const refreshRect = () => {
      const rect = canvas.getBoundingClientRect();
      _canvasRect.left = rect.left;
      _canvasRect.top = rect.top;
      _canvasRect.width = rect.width;
      _canvasRect.height = rect.height;
      _canvasRectKnown = true;
    };
    refreshRect();
    window.addEventListener("resize", refreshRect);
    const ro = new ResizeObserver(refreshRect);
    ro.observe(canvas);

    // ---- helpers ----
    const computeNodePosInto = (idx: number, t: number, stage: Stage, out: Vec3): void => {
      const n = nodes[idx];
      const driftAmp = stage.activity;
      const driftX = Math.sin(t * 0.4 + idx * 0.1) * 0.25 * driftAmp;
      const driftY = Math.cos(t * 0.3 + idx * 0.2) * 0.25 * driftAmp;
      const driftZ = Math.sin(t * 0.2 + idx * 0.3) * 0.25 * driftAmp;
      const training = getTrainingStateRaw();
      const jitterAmp =
        !reduce && training.phase === "training"
          ? (1 - training.epoch / training.totalEpochs) * 0.32
          : 0;
      const baseX = n.pos[0] * stage.disp + driftX + Math.sin(t * 7.3 + idx * 1.7) * jitterAmp;
      const baseY = n.pos[1] * stage.disp + driftY + Math.sin(t * 8.1 + idx * 2.3) * jitterAmp;
      const baseZ = n.pos[2] * stage.disp + driftZ + Math.sin(t * 6.7 + idx * 0.9) * jitterAmp;
      if (stage.converge > 0 && contactIdx >= 0) {
        const c = nodes[contactIdx].pos;
        const k = stage.converge;
        const targetX = c[0] + n.pos[0] * 0.05 + Math.sin(idx * 1.7) * 0.02;
        const targetY = c[1] + n.pos[1] * 0.05 + Math.cos(idx * 2.3) * 0.02;
        const targetZ = c[2] + n.pos[2] * 0.05;
        out.set(baseX + (targetX - baseX) * k, baseY + (targetY - baseY) * k, baseZ + (targetZ - baseZ) * k);
        return;
      }
      out.set(baseX, baseY, baseZ);
    };
    const computeNodePos = (idx: number, t: number, stage: Stage): Vec3 => {
      const out = new Vec3();
      computeNodePosInto(idx, t, stage, out);
      return out;
    };

    const triggerPulse = (nodeIdx: number, strength = 1) => {
      if (reduce) return;
      const connected = neighbors.get(nodeIdx) ?? [];
      for (let w = 0; w < strength; w++) {
        for (const targetIdx of connected) {
          if (activeSignals.length >= MAX_SIGNALS) return;
          activeSignals.push({
            startNode: nodeIdx,
            endNode: targetIdx,
            startPos: new Vec3(...nodes[nodeIdx].pos),
            endPos: new Vec3(...nodes[targetIdx].pos),
            progress: 0,
            speed: 2.2 + Math.random() * 2.8,
          });
        }
      }
    };
    const fireSignal = (fromIdx: number, toIdx: number) => {
      if (reduce) return;
      if (activeSignals.length >= MAX_SIGNALS) return;
      activeSignals.push({
        startNode: fromIdx,
        endNode: toIdx,
        startPos: new Vec3(...nodes[fromIdx].pos),
        endPos: new Vec3(...nodes[toIdx].pos),
        progress: 0,
        speed: 2.4 + Math.random() * 0.8,
      });
    };
    const startZoom = (nodeIdx: number, href: string) => {
      if (reduce) return;
      const t = stateClockTime.current;
      const stage = computeStage(getScrollProgress());
      const local = computeNodePos(nodeIdx, t, stage);
      if (nodeOffsets[nodeIdx]) local.add(nodeOffsets[nodeIdx]);
      const world = local.clone();
      // group transform is rotation+scale+translation; the original applied
      // matrixWorld — approximate with scale only (rotation stays idle-0 here)
      world.x *= groupScale;
      world.y *= groupScale;
      world.z *= groupScale;
      const dir = world.clone().normalize();
      _camZoom.from.copy(cameraPos);
      _camZoom.to.copy(world).addScaledVector(dir, 2.4);
      _camZoom.point.copy(world);
      _camZoom.href = href.replace(/^#/, "");
      _camZoom.fired = false;
      _camZoom.active = true;
      _camZoom.startTime = performance.now();
    };

    const nearestNodeTo = (point: Vec3, radius: number, t: number, stage: Stage): number => {
      let best = -1;
      let bestDistSq = radius * radius;
      const scratch = new Vec3();
      for (let i = 0; i < nodes.length; i++) {
        computeNodePosInto(i, t, stage, scratch);
        const d = scratch.distanceToSquared(point);
        if (d < bestDistSq) {
          bestDistSq = d;
          best = i;
        }
      }
      return best;
    };

    const ndcFromEvent = (e: PointerEvent): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -(((e.clientY - rect.top) / rect.height) * 2 - 1),
      };
    };

    // ---- pointer handlers (ported from the original) ----
    const onPointerDown = (e: PointerEvent) => {
      const ndc = ndcFromEvent(e);
      _cursor.set(ndc.x, ndc.y, 0);
      const dx = e.clientX - _lastScreenX;
      const dy = e.clientY - _lastScreenY;
      _lastScreenX = e.clientX;
      _lastScreenY = e.clientY;
      _cursorVelocity.x += (dx - _cursorVelocity.x) * 0.4;
      _cursorVelocity.y += (dy - _cursorVelocity.y) * 0.4;
      _cursorActive = true;

      const planePoint = renderer.rayToPlane(ndc.x, ndc.y, 0);
      if (!planePoint) return;
      const localMousePoint = planePoint.clone();
      const t = stateClockTime.current;
      const stage = computeStage(getScrollProgress());
      const closestIdx = nearestNodeTo(localMousePoint, 0.62, t, stage);

      if (closestIdx !== -1) {
        const node = nodes[closestIdx];
        if (node.href || node.app) {
          energy[closestIdx] = 1;
          const connected = neighbors.get(closestIdx) ?? [];
          for (const nb of connected) energy[nb] = Math.min(1, energy[nb] + 0.6);
          triggerPulse(closestIdx, 2);
          playSphereClick();
          if (node.href) {
            if (reduce) scrollToId(node.href.replace(/^#/, ""));
            else startZoom(closestIdx, node.href);
          } else if (node.app && onOpenApp) {
            onOpenApp(node.app);
          }
          return;
        }
        grabbedNode = closestIdx;
        canvas.setPointerCapture(e.pointerId);
        const localPos = computeNodePos(closestIdx, t, stage);
        if (nodeOffsets[closestIdx]) localPos.add(nodeOffsets[closestIdx]);
        const worldPos = localPos.clone();
        worldPos.x *= groupScale;
        worldPos.y *= groupScale;
        worldPos.z *= groupScale;
        grabbedDepth = worldPos.distanceTo(cameraPos);
        energy[closestIdx] = 1;
        const connected = neighbors.get(closestIdx) ?? [];
        for (const nb of connected) energy[nb] = Math.min(1, energy[nb] + 0.6);
        playSphereClick();
        triggerPulse(closestIdx, 2);
      } else {
        grabbedNode = null;
        pointerDown = true;
        pointerStart = { x: e.clientX, y: e.clientY };
        rotationStart = { x: rotationY, y: rotationX };
        canvas.setPointerCapture(e.pointerId);
        playSphereClick();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const ndc = ndcFromEvent(e);
      _cursor.set(ndc.x, ndc.y, 0);
      const dx = e.clientX - _lastScreenX;
      const dy = e.clientY - _lastScreenY;
      _lastScreenX = e.clientX;
      _lastScreenY = e.clientY;
      _cursorVelocity.x += (dx - _cursorVelocity.x) * 0.4;
      _cursorVelocity.y += (dy - _cursorVelocity.y) * 0.4;
      _cursorActive = true;

      const t = stateClockTime.current;
      const stage = computeStage(getScrollProgress());

      if (grabbedNode !== null) {
        const idx = grabbedNode;
        const worldTarget = new Vec3();
        // Ray through NDC at the recorded depth — reconstruct via plane math
        const ndcX = _cursor.x;
        const ndcY = _cursor.y;
        const pt = renderer.rayToPlane(ndcX, ndcY, 0);
        if (pt) {
          const base = computeNodePos(idx, t, stage);
          if (nodeOffsets[idx]) nodeOffsets[idx].copy(pt).sub(base);
        }
        if (Math.random() < 0.18) triggerPulse(idx);
      } else if (pointerDown && !_camZoom.active) {
        const dxx = (e.clientX - pointerStart.x) * 0.005;
        const dyy = (e.clientY - pointerStart.y) * 0.005;
        rotationY = rotationStart.x + dxx;
        rotationX = rotationStart.y + dyy;
      }

      const now = performance.now();
      if (grabbedNode === null && now - lastHoverCheck > 60) {
        lastHoverCheck = now;
        const planePoint = renderer.rayToPlane(_cursor.x, _cursor.y, 0);
        if (planePoint) {
          const hovered = nearestNodeTo(planePoint, 0.34, t, stage);
          if (hovered !== -1 && hovered !== hoveredNode) {
            hoveredNode = hovered;
            energy[hovered] = Math.min(1, energy[hovered] + 0.65);
            const connected = neighbors.get(hovered) ?? [];
            for (const nb of connected) energy[nb] = Math.min(1, energy[nb] + 0.38);
            triggerPulse(hovered, 1);
            playSphereHover();
            const hId = nodes[hovered].id;
            const relatedId = RELATED_REGIONS[hId];
            if (relatedId) {
              const relatedIdx = navIdxById.get(relatedId);
              if (relatedIdx !== undefined) fireSignal(hovered, relatedIdx);
            }
          } else if (hovered === -1) {
            hoveredNode = null;
          }
        }
      }
      const speed = Math.hypot(_cursorVelocity.x, _cursorVelocity.y);
      if (speed > 16 && now - lastVelocityPulse > 90 && grabbedNode === null) {
        lastVelocityPulse = now;
        const src = hoveredNode ?? Math.floor(Math.random() * nodes.length);
        triggerPulse(src, 2);
      }
    };

    const onPointerUp = () => {
      pointerDown = false;
      grabbedNode = null;
    };

    const onPointerLeave = () => {
      _cursorActive = false;
      hoveredNode = null;
      _cursorVelocity.set(0, 0, 0);
    };

    // ---- frame loop ----
    let raf = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const delta = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      elapsed += delta;
      const t = elapsed;
      stateClockTime.current = t;
      const p = getScrollProgress();
      const stage = computeStage(p);

      const training = getTrainingStateRaw();
      if (training.phase === "training") advanceTraining(delta);

      // Hovered lobe
      let hoveredLobeIdx: number | null = null;
      if (hoveredNode !== null) {
        if (landmarkRegions.has(hoveredNode)) hoveredLobeIdx = hoveredNode;
        else {
          for (const [navIdx, flags] of landmarkRegions) {
            if (flags[hoveredNode]) {
              hoveredLobeIdx = navIdx;
              break;
            }
          }
        }
      }
      const hoveredRegion = hoveredLobeIdx !== null ? (landmarkRegions.get(hoveredLobeIdx) ?? null) : null;

      let activeSection = -1;
      let activeSectionK = 0;
      for (let s = 0; s < SECTION_RANGES.length; s++) {
        const [start, end] = SECTION_RANGES[s];
        const vis =
          smoothstep(start - 0.02, start + 0.04, p) * (1 - smoothstep(end - 0.04, end + 0.02, p));
        if (vis > activeSectionK) {
          activeSectionK = vis;
          activeSection = s;
        }
      }

      // Group transform: rotationY around Y axis + breathing scale
      let idleRotY = 0;
      let groupScaleCurrent = groupScale;
      if (!reduce && !pointerDown && grabbedNode === null && !_camZoom.active) {
        idleRotY = t * 0.035;
      }
      if (!reduce) {
        const breathe = 1 + stage.converge * 0.06 * Math.sin(t * 2.4);
        groupScaleCurrent = groupScale * breathe;
      }
      // Compose model = T · R(y) · S  (matching original group rotation/scale)
      groupMatrix.identity();
      const c = Math.cos(rotationY + idleRotY);
      const s = Math.sin(rotationY + idleRotY);
      groupMatrix.e[0] = c * groupScaleCurrent;
      groupMatrix.e[2] = s * groupScaleCurrent;
      groupMatrix.e[5] = groupScaleCurrent;
      groupMatrix.e[8] = -s * groupScaleCurrent;
      groupMatrix.e[10] = c * groupScaleCurrent;

      // Camera
      if (_camZoom.active && !reduce) {
        const zp = Math.min(1, (now - _camZoom.startTime) / _camZoom.durationMs);
        const ease = 1 - Math.pow(1 - zp, 3);
        cameraPos.lerpVectors(_camZoom.from, _camZoom.to, ease);
        cameraLookAt.copy(_camZoom.point);
        if (zp >= 1 && !_camZoom.fired) {
          _camZoom.fired = true;
          if (_camZoom.href) scrollToId(_camZoom.href);
        }
        if (zp >= 1 && now - _camZoom.startTime > _camZoom.durationMs + 1700) {
          _camZoom.active = false;
        }
      } else if (!reduce && !booted) {
        cameraPos.copy(camFrom);
        camStartAt = null;
      } else if (!reduce) {
        if (camStartAt === null) camStartAt = elapsed;
        const fp = Math.min(1, (elapsed - camStartAt) / 1.9);
        const ease = 1 - Math.pow(1 - fp, 3);
        if (fp < 1) {
          const q = ease;
          const a = (1 - q) * (1 - q);
          const b = 2 * (1 - q) * q;
          const cc = q * q;
          cameraPos.set(
            a * camFrom.x + b * camMid.x + cc * camTo.x,
            a * camFrom.y + b * camMid.y + cc * camTo.y,
            a * camFrom.z + b * camMid.z + cc * camTo.z,
          );
        } else {
          cameraPos.lerp(camTo, 0.045);
        }
        cameraLookAt.set(0, 0, 0);
      } else {
        cameraPos.copy(camTo);
        cameraLookAt.set(0, 0, 0);
      }

      // Spring damping for grabbed nodes
      nodes.forEach((n, idx) => {
        if (grabbedNode !== idx && nodeOffsets[idx]) {
          const offset = nodeOffsets[idx];
          if (offset.lengthSq() > 0.0001) {
            offset.lerp(new Vec3(0, 0, 0), 0.12);
          }
        }
      });

      // Cursor world projection
      if (_cursorActive) {
        const wp = renderer.rayToPlane(_cursor.x, _cursor.y, 0);
        if (wp) _cursorWorld.copy(wp);
      }

      // Node positions + energy
      const tempNodeCoords: Vec3[] = [];
      for (let i = 0; i < nodes.length; i++) {
        if (!reduce) energy[i] *= 0.955;
        const pos = computeNodePos(i, t, stage);
        if (_cursorActive && !reduce) {
          const d = pos.distanceTo(_cursorWorld);
          const proximity = Math.max(0, 1 - d / 1.7);
          if (proximity > 0) energy[i] = Math.min(1, energy[i] + proximity * 0.12 * (0.5 + stage.activity));
        }
        if (!reduce && stage.clusterK > 0) {
          const wave = Math.max(0, Math.sin(t * 2.1 + clusterPhase[i]));
          energy[i] = Math.min(1, energy[i] + stage.clusterK * wave * 0.06);
        }
        if (!reduce && activeSection >= 0 && sectionRegions[activeSection][i]) {
          energy[i] = Math.min(1, energy[i] + activeSectionK * 0.1);
        }
        if (!reduce && hoveredRegion && hoveredRegion[i]) {
          energy[i] = Math.min(1, energy[i] + 0.06);
        }
        if (!reduce && Math.random() < stage.activity * 0.02) {
          energy[i] = Math.min(1, energy[i] + 0.25);
        }
        if (nodeOffsets[i]) pos.add(nodeOffsets[i]);
        tempNodeCoords.push(pos);
        nodeData[i * 6] = pos.x;
        nodeData[i * 6 + 1] = pos.y;
        nodeData[i * 6 + 2] = pos.z;
      }

      // Colors
      if (!reduce) {
        const tmp = new Vec3();
        for (let i = 0; i < nodes.length; i++) {
          const e = energy[i];
          if (e > 0.02) {
            tmp.set(baseColors[i * 3], baseColors[i * 3 + 1], baseColors[i * 3 + 2]);
            tmp.lerp(WHITE, Math.min(1, e));
            if (i === hoveredNode) tmp.lerp(WARM, 0.45);
            else if (hoveredRegion && hoveredRegion[i]) tmp.lerp(WARM, 0.3);
            workingColors[i * 3] = tmp.x;
            workingColors[i * 3 + 1] = tmp.y;
            workingColors[i * 3 + 2] = tmp.z;
          } else {
            workingColors[i * 3] = baseColors[i * 3];
            workingColors[i * 3 + 1] = baseColors[i * 3 + 1];
            workingColors[i * 3 + 2] = baseColors[i * 3 + 2];
          }
        }
        for (let i = 0; i < nodes.length; i++) {
          nodeData[i * 6 + 3] = workingColors[i * 3];
          nodeData[i * 6 + 4] = workingColors[i * 3 + 1];
          nodeData[i * 6 + 5] = workingColors[i * 3 + 2];
        }
      }

      // Lines
      for (let i = 0; i < edges.length; i++) {
        const [a, b] = edges[i];
        const ca = tempNodeCoords[a];
        const cb = tempNodeCoords[b];
        lineData[i * 6] = ca.x;
        lineData[i * 6 + 1] = ca.y;
        lineData[i * 6 + 2] = ca.z;
        lineData[i * 6 + 3] = cb.x;
        lineData[i * 6 + 4] = cb.y;
        lineData[i * 6 + 5] = cb.z;
      }

      // Glows
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

      // Signals
      if (!reduce && booted && Math.random() < stage.signalRate) {
        triggerPulse(Math.floor(Math.random() * nodes.length));
      }
      if (activeSection >= 0 && activeSectionK > 0.1 && Math.random() < activeSectionK * 0.06) {
        const navIdx = sectionNavIdx[activeSection];
        if (navIdx >= 0) triggerPulse(navIdx);
      }
      if (training.phase === "training" && !reduce) {
        const stress = 1 - training.epoch / training.totalEpochs;
        if (Math.random() < 0.3 * stress) energy[Math.floor(Math.random() * nodes.length)] = 1;
        if (booted && Math.random() < 0.35 * stress) triggerPulse(Math.floor(Math.random() * nodes.length));
      }
      if (training.phase === "converged" && trainingPhase === "training" && !reduce) {
        for (let k = 0; k < 24; k++) fireSignal(Math.floor(Math.random() * nodes.length), contactIdx);
        for (let i = 0; i < nodes.length; i++) energy[i] = 1;
      }
      trainingPhase = training.phase;

      for (let i = activeSignals.length - 1; i >= 0; i--) {
        const s = activeSignals[i];
        s.progress += delta * s.speed;
        if (s.progress >= 1.0) {
          if (Math.random() < 0.4 && stage.converge < 0.85) {
            const nextNode = s.endNode;
            let targetIdx: number;
            if (stage.converge > 0.3) {
              targetIdx = contactIdx;
            } else {
              const nextEdges = neighbors.get(nextNode) ?? [];
              if (nextEdges.length > 0) targetIdx = nextEdges[Math.floor(Math.random() * nextEdges.length)];
              else {
                activeSignals.splice(i, 1);
                continue;
              }
            }
            if (targetIdx !== s.startNode && activeSignals.length < MAX_SIGNALS) {
              activeSignals.push({
                startNode: nextNode,
                endNode: targetIdx,
                startPos: new Vec3(...nodes[nextNode].pos),
                endPos: new Vec3(...nodes[targetIdx].pos),
                progress: 0,
                speed: 2.0 + Math.random() * 2.5,
              });
            }
          }
          activeSignals.splice(i, 1);
        }
      }

      const contactVec = contactIdx >= 0 ? nodes[contactIdx].pos : [0, 0, 0];
      for (let i = 0; i < MAX_SIGNALS; i++) {
        if (i < activeSignals.length) {
          const s = activeSignals[i];
          const curr = new Vec3().lerpVectors(s.startPos, s.endPos, s.progress);
          if (stage.converge > 0) {
            curr.x += (contactVec[0] - curr.x) * stage.converge * s.progress;
            curr.y += (contactVec[1] - curr.y) * stage.converge * s.progress;
            curr.z += (contactVec[2] - curr.z) * stage.converge * s.progress;
          }
          signalPositions[i * 3] = curr.x * stage.disp;
          signalPositions[i * 3 + 1] = curr.y * stage.disp;
          signalPositions[i * 3 + 2] = curr.z * stage.disp;
        } else {
          signalPositions[i * 3] = 9999;
          signalPositions[i * 3 + 1] = 9999;
          signalPositions[i * 3 + 2] = 9999;
        }
      }

      // ---- render ----
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      renderer.clear();
      renderer.begin(cameraPos, cameraLookAt, groupMatrix);

      renderer.updatePoints(nodeData);
      renderer.updateLines(lineData);

      renderer.drawLines([0.302, 0.553, 1], stage.lineOpacity);
      renderer.drawPoints("xyzrgb", 0.045, stage.pointOpacity, true); // nodes

      if (!reduce) {
        // glows — upload then draw immediately (shared buffer)
        renderer.updatePointsPositions(glowPositions);
        renderer.drawPoints("xyz", 0.09, 0.8, true);
        // signals
        renderer.updatePointsPositions(signalPositions);
        renderer.drawPoints("xyz", 0.065, Math.max(0, 0.9 - stage.converge * 0.45), true);
      }

      // grabbed sphere
      if (grabbedNode !== null) {
        const c = tempNodeCoords[grabbedNode];
        renderer.drawSphere(c.x, c.y, c.z, 0.08, [0.498, 0.831, 1], 3.5);
      }

      // Lobe label projection
      const landmark = hoveredNode !== null ? nodes[hoveredNode] : undefined;
      if (hoveredNode !== null && landmark?.label) {
        computeNodePosInto(hoveredNode, t, stage, _labelVec);
        if (nodeOffsets[hoveredNode]) _labelVec.add(nodeOffsets[hoveredNode]);
        // model transform (scale + rotY)
        const lx = _labelVec.x;
        const ly = _labelVec.y;
        const lz = _labelVec.z;
        const ccc = Math.cos(rotationY + idleRotY);
        const sss = Math.sin(rotationY + idleRotY);
        _labelVec.set(
          (ccc * lx + sss * lz) * groupScaleCurrent,
          ly * groupScaleCurrent,
          (-sss * lx + ccc * lz) * groupScaleCurrent,
        );
        // project with VP
        const view = new Mat4().lookAt(cameraPos, cameraLookAt);
        const vp = new Mat4().multiplyMatrices(new Mat4().perspective(45, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.1, 100), view);
        _labelVec.project(vp);
        if (_labelVec.z < 1 && _labelVec.z > -1 && _canvasRectKnown) {
          setLobeLabel(
            landmark.label,
            _canvasRect.left + (_labelVec.x * 0.5 + 0.5) * _canvasRect.width,
            _canvasRect.top + (-_labelVec.y * 0.5 + 0.5) * _canvasRect.height,
            landmark.app ? "click to open" : null,
          );
          setLastHoveredLandmark(landmark.id, landmark.label);
        } else {
          setLobeLabel(null);
        }
      } else {
        setLobeLabel(null);
      }
    };
    raf = requestAnimationFrame(frame);

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", refreshRect);
      ro.disconnect();
      renderer.dispose();
    };
  }, [booted, onOpenApp]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
      style={{ touchAction: "none" }}
    />
  );
}
