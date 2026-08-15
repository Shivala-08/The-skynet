// ---------------------------------------------------------------------------
// HeroShapes — the classic hero scene (data sphere → torus → icosahedron)
// ported from three.js onto MiniRenderer.
//
// This is the recovered hero-scene.tsx logic (sphere noise deformation,
// scroll crossfade windows, 300 morphing particles, connection particles,
// cursor trail + glow ring, hover tooltips, click sounds) rewritten against
// the MiniRenderer instance API. Everything renders in the same world space
// as the brain — drawn after the brain pass so the shapes layer on top — and
// the old scroll camera keyframes become a gentle parallax translation so the
// layer drifts without moving the brain's own camera.
//
// Interaction contract (consumed by BrainLab):
//   - pointerDown(ndc) returns true when a shape was clicked (brain skips)
//   - pointerMove feeds hover, cursor trail/glow and repulsion
//   - isHovering() lets the brain suppress its lobe label under a shape
// ---------------------------------------------------------------------------

import { MiniRenderer } from "./mini-renderer";
import { Mat4, Vec3 } from "@/lib/mini-math";
import { showHeroTooltip, hideHeroTooltip } from "@/lib/hero-tooltip";
import { playSphereClick, playTorusClick, playIcoClick, playHoverSound } from "@/lib/sounds";

// ---------------------------------------------------------------------------
// Geometry builders — positions/normals/indices + triangle-edge wireframes.
// ---------------------------------------------------------------------------

function sphereGeo(radius: number, wSeg: number, hSeg: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= hSeg; i++) {
    const phi = (i / hSeg) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    for (let j = 0; j <= wSeg; j++) {
      const theta = (j / wSeg) * Math.PI * 2;
      const x = sinPhi * Math.cos(theta);
      const y = cosPhi;
      const z = sinPhi * Math.sin(theta);
      positions.push(x * radius, y * radius, z * radius);
      normals.push(x, y, z);
    }
  }
  for (let i = 0; i < hSeg; i++) {
    for (let j = 0; j < wSeg; j++) {
      const a = i * (wSeg + 1) + j;
      const b = a + wSeg + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { positions, normals, indices };
}

function torusGeo(radius: number, tube: number, radialSeg: number, tubularSeg: number) {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= radialSeg; i++) {
    const u = (i / radialSeg) * Math.PI * 2;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    for (let j = 0; j <= tubularSeg; j++) {
      const v = (j / tubularSeg) * Math.PI * 2;
      const cv = Math.cos(v);
      const sv = Math.sin(v);
      const nx = cv * cu;
      const ny = cv * su;
      const nz = sv;
      positions.push((radius + tube * cv) * cu, (radius + tube * cv) * su, tube * sv);
      normals.push(nx, ny, nz);
    }
  }
  for (let i = 0; i < radialSeg; i++) {
    for (let j = 0; j < tubularSeg; j++) {
      const a = i * (tubularSeg + 1) + j;
      const b = a + tubularSeg + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { positions, normals, indices };
}

function icosahedronGeo(radius: number) {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const positions: number[] = [];
  const normals: number[] = [];
  for (const [x, y, z] of verts) {
    const len = Math.sqrt(x * x + y * y + z * z);
    positions.push((x / len) * radius, (y / len) * radius, (z / len) * radius);
    normals.push(x / len, y / len, z / len);
  }
  const indices = faces.flat();
  return { positions, normals, indices };
}

/** Builds a line-loop circle (for glow rings + cursor ring). */
function circleLoop(radius: number, segments: number): Float32Array {
  const out = new Float32Array(segments * 6);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 1) / segments) * Math.PI * 2;
    out[i * 6] = Math.cos(a) * radius;
    out[i * 6 + 1] = Math.sin(a) * radius;
    out[i * 6 + 2] = 0;
    out[i * 6 + 3] = Math.cos(b) * radius;
    out[i * 6 + 4] = Math.sin(b) * radius;
    out[i * 6 + 5] = 0;
  }
  return out;
}

/** Deduped triangle-edge wireframe as interleaved [x,y,z × 2 per line]. */
function wireframe(positions: number[], indices: number[]): Float32Array {
  const seen = new Set<number>();
  const out: number[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];
    for (const [u, v] of [[a, b], [b, c], [c, a]] as const) {
      const key = u < v ? u * 65536 + v : v * 65536 + u;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(positions[u * 3], positions[u * 3 + 1], positions[u * 3 + 2]);
      out.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    }
  }
  return new Float32Array(out);
}

function toF32(arr: number[]): Float32Array {
  return new Float32Array(arr);
}

function toU16(arr: number[]): Uint16Array {
  return new Uint16Array(arr);
}

// ---------------------------------------------------------------------------
// Scroll fade windows (identical to the original).
// ---------------------------------------------------------------------------

const SPHERE_FADE_START = 0.1;
const SPHERE_FADE_END = 0.25;
const TORUS_IN_START = 0.12;
const TORUS_IN_END = 0.28;
const TORUS_OUT_START = 0.4;
const TORUS_OUT_END = 0.55;
const ICO_IN_START = 0.42;
const ICO_IN_END = 0.58;
const ICO_OUT_START = 0.72;
const ICO_OUT_END = 0.88;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
function fadeIn(p: number, start: number, end: number): number {
  return smoothstep(start, end, p);
}
function fadeOut(p: number, start: number, end: number): number {
  return 1 - smoothstep(start, end, p);
}

// ---------------------------------------------------------------------------
// Constants (matching the original scene layout).
// ---------------------------------------------------------------------------

const PARTICLE_COUNT = 300;
const CONNECTION_COUNT = 60;
const TRAIL_COUNT = 40;
const BURST_COUNT = 40;
const TRAIL_LIFETIME = 1.0;

const SPHERE_RADIUS = 1.6;
const SPHERE_SEGMENTS = 28;
const SPHERE_HEIGHT = 20;
const SPHERE_WIRE_SEGMENTS = 18;
const SPHERE_WIRE_HEIGHT = 12;

const TORUS_POS = new Vec3(1.4, -0.7, -0.5);
const TORUS_RADIUS = 1.0;
const TORUS_TUBE = 0.35;
const TORUS_SOLID = [16, 28];
const TORUS_WIRE = [14, 24];

const ICO_POS = new Vec3(-1.2, 0.6, -0.3);
const ICO_RADIUS = 0.9;

const TOOLTIPS: Record<string, { name: string; role: string }> = {
  sphere: { name: "AI Core", role: "Neural intelligence hub" },
  torus: { name: "DeployForge", role: "CI/CD pipeline engine" },
  ico: { name: "Synapse", role: "RAG retrieval system" },
};

const BLUE: [number, number, number] = [0.302, 0.553, 1];
const LIGHT_BLUE: [number, number, number] = [0.541, 0.69, 1];

// Old scroll camera keyframes → parallax translation for the hero layer.
const CAM_KEYFRAMES: { p: number; pos: [number, number, number] }[] = [
  { p: 0.0, pos: [0, 0, 5.5] },
  { p: 0.2, pos: [1.8, -0.4, 4.0] },
  { p: 0.45, pos: [0.5, 0, 3.5] },
  { p: 0.6, pos: [-1.5, 0.5, 3.2] },
  { p: 0.85, pos: [-0.5, 0.3, 4.0] },
  { p: 1.0, pos: [0, 0.2, 5.0] },
];
const PARALLAX = 0.35;

function cameraParallax(p: number): Vec3 {
  let i = 0;
  for (let j = 0; j < CAM_KEYFRAMES.length - 1; j++) {
    if (p >= CAM_KEYFRAMES[j].p && p <= CAM_KEYFRAMES[j + 1].p) {
      i = j;
      break;
    }
  }
  if (p >= CAM_KEYFRAMES[CAM_KEYFRAMES.length - 1].p) i = CAM_KEYFRAMES.length - 2;
  const k0 = CAM_KEYFRAMES[i];
  const k1 = CAM_KEYFRAMES[i + 1];
  const t = smoothstep(k0.p, k1.p, p);
  const rest = CAM_KEYFRAMES[0].pos;
  const off = new Vec3(
    (k0.pos[0] + (k1.pos[0] - k0.pos[0]) * t - rest[0]) * PARALLAX,
    (k0.pos[1] + (k1.pos[1] - k0.pos[1]) * t - rest[1]) * PARALLAX,
    (k0.pos[2] + (k1.pos[2] - k0.pos[2]) * t - rest[2]) * PARALLAX * 0.4,
  );
  return off;
}

// ---------------------------------------------------------------------------
// Particle morph tables (port of the original precomputed formations).
// ---------------------------------------------------------------------------

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
function makeRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const particleSphereOrigin = new Float32Array(PARTICLE_COUNT * 3);
const particleScatter = new Float32Array(PARTICLE_COUNT * 3);
const particleTorusTarget = new Float32Array(PARTICLE_COUNT * 3);
const particleTorusScatter = new Float32Array(PARTICLE_COUNT * 3);
const particleIcoTarget = new Float32Array(PARTICLE_COUNT * 3);
const particleIcoScatter = new Float32Array(PARTICLE_COUNT * 3);

(() => {
  const rand = makeRand(137);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const st = i / PARTICLE_COUNT;
    const phi = Math.acos(1 - 2 * st);
    const theta = GOLDEN * i;
    const r = 3.5;
    particleSphereOrigin[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    particleSphereOrigin[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    particleSphereOrigin[i * 3 + 2] = r * Math.cos(phi);

    const nx = particleSphereOrigin[i * 3];
    const ny = particleSphereOrigin[i * 3 + 1];
    const nz = particleSphereOrigin[i * 3 + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    particleScatter[i * 3] = (nx / len) * (3 + rand() * 4) + (rand() - 0.5) * 2;
    particleScatter[i * 3 + 1] = (ny / len) * (3 + rand() * 4) + (rand() - 0.5) * 2;
    particleScatter[i * 3 + 2] = (nz / len) * (3 + rand() * 4) + (rand() - 0.5) * 2;

    const tr = 1.2 + rand() * 0.6;
    const tPhi = Math.acos(1 - 2 * (i / PARTICLE_COUNT));
    const tTheta = GOLDEN * i + rand() * 0.5;
    particleTorusTarget[i * 3] = TORUS_POS.x + tr * Math.sin(tPhi) * Math.cos(tTheta);
    particleTorusTarget[i * 3 + 1] = TORUS_POS.y + tr * Math.sin(tPhi) * Math.sin(tTheta);
    particleTorusTarget[i * 3 + 2] = TORUS_POS.z + tr * Math.cos(tPhi);

    const tx = particleTorusTarget[i * 3] - TORUS_POS.x;
    const ty = particleTorusTarget[i * 3 + 1] - TORUS_POS.y;
    const tz = particleTorusTarget[i * 3 + 2] - TORUS_POS.z;
    const tlen = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
    particleTorusScatter[i * 3] = (tx / tlen) * (2.5 + rand() * 3) + (rand() - 0.5) * 1.5;
    particleTorusScatter[i * 3 + 1] = (ty / tlen) * (2.5 + rand() * 3) + (rand() - 0.5) * 1.5;
    particleTorusScatter[i * 3 + 2] = (tz / tlen) * (2.5 + rand() * 3) + (rand() - 0.5) * 1.5;

    const ir = 1.0 + rand() * 0.5;
    const iPhi = Math.acos(1 - 2 * (i / PARTICLE_COUNT));
    const iTheta = GOLDEN * i + rand() * 0.4;
    particleIcoTarget[i * 3] = ICO_POS.x + ir * Math.sin(iPhi) * Math.cos(iTheta);
    particleIcoTarget[i * 3 + 1] = ICO_POS.y + ir * Math.sin(iPhi) * Math.sin(iTheta);
    particleIcoTarget[i * 3 + 2] = ICO_POS.z + ir * Math.cos(iPhi);

    const ix = particleIcoTarget[i * 3] - ICO_POS.x;
    const iy = particleIcoTarget[i * 3 + 1] - ICO_POS.y;
    const iz = particleIcoTarget[i * 3 + 2] - ICO_POS.z;
    const ilen = Math.sqrt(ix * ix + iy * iy + iz * iz) || 1;
    particleIcoScatter[i * 3] = (ix / ilen) * (2 + rand() * 2.5) + (rand() - 0.5) * 1.5;
    particleIcoScatter[i * 3 + 1] = (iy / ilen) * (2 + rand() * 2.5) + (rand() - 0.5) * 1.5;
    particleIcoScatter[i * 3 + 2] = (iz / ilen) * (2 + rand() * 2.5) + (rand() - 0.5) * 1.5;
  }
})();

const connectionPositions = (() => {
  const pos = new Float32Array(CONNECTION_COUNT * 3);
  const rand = makeRand(42);
  const anchors: [number, number, number][] = [[0, 0, 0], [TORUS_POS.x, TORUS_POS.y, TORUS_POS.z], [ICO_POS.x, ICO_POS.y, ICO_POS.z]];
  for (let i = 0; i < CONNECTION_COUNT; i++) {
    const t = rand();
    const a = Math.floor(rand() * 3);
    const b = (a + 1) % 3;
    pos[i * 3] = anchors[a][0] + (anchors[b][0] - anchors[a][0]) * t + (rand() - 0.5) * 0.5;
    pos[i * 3 + 1] = anchors[a][1] + (anchors[b][1] - anchors[a][1]) * t + (rand() - 0.5) * 0.5;
    pos[i * 3 + 2] = anchors[a][2] + (anchors[b][2] - anchors[a][2]) * t + (rand() - 0.5) * 1;
  }
  return pos;
})();

// Burst + trail scratch buffers.
const burstPositions = new Float32Array(BURST_COUNT * 3);
const burstVelocities = Array.from({ length: BURST_COUNT }, () => new Vec3());
const burstAges = new Float32Array(BURST_COUNT).fill(999);
const trailPositions = new Float32Array(TRAIL_COUNT * 3);
const trailVelocities = Array.from({ length: TRAIL_COUNT }, () => new Vec3());
const trailAges = Float32Array.from({ length: TRAIL_COUNT }, () => TRAIL_LIFETIME);

// ---------------------------------------------------------------------------
// Model-matrix helpers (T·Rx·Ry·Rz·S composed from primitives).
// ---------------------------------------------------------------------------

function makeScale(sx: number, sy: number, sz: number): Mat4 {
  const m = new Mat4();
  m.e[0] = sx;
  m.e[5] = sy;
  m.e[10] = sz;
  return m;
}

function makeRotX(a: number): Mat4 {
  const m = new Mat4();
  const c = Math.cos(a);
  const s = Math.sin(a);
  m.e[5] = c; m.e[6] = s;
  m.e[9] = -s; m.e[10] = c;
  return m;
}

function makeRotY(a: number): Mat4 {
  const m = new Mat4();
  const c = Math.cos(a);
  const s = Math.sin(a);
  m.e[0] = c; m.e[2] = -s;
  m.e[8] = s; m.e[10] = c;
  return m;
}

function makeRotZ(a: number): Mat4 {
  const m = new Mat4();
  const c = Math.cos(a);
  const s = Math.sin(a);
  m.e[0] = c; m.e[1] = s;
  m.e[4] = -s; m.e[5] = c;
  return m;
}

function makeTranslate(x: number, y: number, z: number): Mat4 {
  const m = new Mat4();
  m.e[12] = x;
  m.e[13] = y;
  m.e[14] = z;
  return m;
}

/** M = T × Rx × Ry × Rz × S. */
function composeModel(out: Mat4, pos: Vec3, rotX: number, rotY: number, rotZ: number, sx: number, sy: number, sz: number): Mat4 {
  const tmp = new Mat4();
  out.identity();
  out.multiplyMatrices(makeRotY(rotY), makeRotX(rotX));
  tmp.multiplyMatrices(out, makeRotZ(rotZ));
  out.multiplyMatrices(tmp, makeScale(sx, sy, sz));
  tmp.multiplyMatrices(makeTranslate(pos.x, pos.y, pos.z), out);
  out.copy(tmp);
  return out;
}

// ---------------------------------------------------------------------------
// HeroShapes layer.
// ---------------------------------------------------------------------------

type ShapeKind = "sphere" | "torus" | "ico";

export class HeroShapes {
  private renderer: MiniRenderer;

  // instances
  private particles: number;
  private connections: number;
  private trail: number;
  private burst: number;
  private sphereWire: number;
  private torusWire: number;
  private torusRing: number;
  private icoWire: number;
  private cursorRing: number;
  private sphereMesh: number;
  private torusMesh: number;
  private icoMesh: number;

  // sphere deformation scratch
  private sphereOrig: Float32Array = new Float32Array(0);
  private sphereDisp: Float32Array = new Float32Array(0);

  // per-frame buffers
  private particleData = new Float32Array(PARTICLE_COUNT * 6);
  private connectionData = new Float32Array(CONNECTION_COUNT * 3);
  private trailData = new Float32Array(TRAIL_COUNT * 3);
  private burstData = new Float32Array(BURST_COUNT * 3);

  // interaction state
  private cursorNdc = new Vec3();
  private cursorWorld = new Vec3();
  private cursorActive = false;
  private screenX = 0;
  private screenY = 0;
  private hovered: ShapeKind | null = null;
  private dragging = false;
  private dragStart = new Vec3();
  private dragDelta = new Vec3();
  private sphereDragRot = { x: 0, y: 0 };
  private trailAlive = false;
  private trailMouse = new Vec3();
  private cursorGlow = 0;
  private layerOffset = new Vec3();

  // per-shape animation refs
  private pulse = 0;
  private particleBlend = 0;
  private particleOpacity = 1;
  private sphereHover = 0;
  private torusHover = 0;
  private icoHover = 0;
  private torusSpin = 0;
  private icoSpin = 0;
  private torusProx = 0;
  private icoProx = 0;
  private burstActive = false;
  private burstCount = 0;

  constructor(renderer: MiniRenderer) {
    this.renderer = renderer;

    // Points instances
    this.particles = renderer.addPointsInstance();
    this.connections = renderer.addPointsInstance();
    this.trail = renderer.addPointsInstance();
    this.burst = renderer.addPointsInstance();

    // Line instances
    this.sphereWire = renderer.addLinesInstance();
    this.torusWire = renderer.addLinesInstance();
    this.torusRing = renderer.addLinesInstance();
    this.icoWire = renderer.addLinesInstance();
    this.cursorRing = renderer.addLinesInstance();

    // Sphere geometry (solid deforms per frame, wire stays static)
    const sphere = sphereGeo(SPHERE_RADIUS, SPHERE_SEGMENTS, SPHERE_HEIGHT);
    this.sphereOrig = toF32(sphere.positions);
    this.sphereDisp = new Float32Array(sphere.positions.length);
    this.sphereMesh = renderer.addMeshInstance(
      toF32(sphere.positions),
      toF32(sphere.normals),
      toU16(sphere.indices),
    );
    const sphereWireGeo = sphereGeo(SPHERE_RADIUS, SPHERE_WIRE_SEGMENTS, SPHERE_WIRE_HEIGHT);
    renderer.updateLinesInstance(this.sphereWire, wireframe(sphereWireGeo.positions, sphereWireGeo.indices));

    // Torus solid + wireframe + glow ring
    const torus = torusGeo(TORUS_RADIUS, TORUS_TUBE, TORUS_SOLID[0], TORUS_SOLID[1]);
    this.torusMesh = renderer.addMeshInstance(toF32(torus.positions), toF32(torus.normals), toU16(torus.indices));
    const torusWireGeo = torusGeo(TORUS_RADIUS, TORUS_TUBE, TORUS_WIRE[0], TORUS_WIRE[1]);
    renderer.updateLinesInstance(this.torusWire, wireframe(torusWireGeo.positions, torusWireGeo.indices));
    renderer.updateLinesInstance(this.torusRing, circleLoop(TORUS_RADIUS * 1.1, 64));

    // Icosahedron wireframe + solid
    const ico = icosahedronGeo(ICO_RADIUS);
    this.icoMesh = renderer.addMeshInstance(toF32(ico.positions), toF32(ico.normals), toU16(ico.indices));
    renderer.updateLinesInstance(this.icoWire, wireframe(ico.positions, ico.indices));

    // Cursor glow ring
    renderer.updateLinesInstance(this.cursorRing, circleLoop(0.85, 40));

    // Seed buffers
    renderer.updatePointsInstance(this.particles, this.particleData, 6);
    renderer.updatePointsInstance(this.connections, this.connectionData, 3);
    renderer.updatePointsInstance(this.trail, this.trailData, 3);
    renderer.updatePointsInstance(this.burst, this.burstData, 3);
  }

  // ---- interaction hooks (called by BrainLab) --------------------------

  pointerDown(ndcX: number, ndcY: number, canvasW: number, canvasH: number): boolean {
    this.cursorNdc.set(ndcX, ndcY, 0);
    this.cursorActive = true;
    const kind = this.pick(ndcX, ndcY, canvasW, canvasH);
    if (!kind) return false;
    if (kind === "sphere") {
      this.dragging = true;
      this.dragStart.set(ndcX, ndcY, 0);
      this.dragDelta.set(0, 0, 0);
      this.pulse = 1;
      this.triggerBurst();
      playSphereClick();
    } else if (kind === "torus") {
      this.torusSpin = 2.5;
      playTorusClick();
    } else {
      this.icoSpin = 3.5;
      playIcoClick();
    }
    return true;
  }

  pointerMove(ndcX: number, ndcY: number, screenX: number, screenY: number): void {
    this.cursorNdc.set(ndcX, ndcY, 0);
    this.screenX = screenX;
    this.screenY = screenY;
    this.cursorActive = true;
    this.trailMouse.set(ndcX, ndcY, 0);
    this.cursorGlow = Math.min(1, this.cursorGlow + 0.05);
    if (!this.trailAlive) {
      this.trailAlive = true;
      for (let i = 0; i < TRAIL_COUNT; i++) trailAges[i] = TRAIL_LIFETIME;
    }
    if (this.dragging) {
      this.dragDelta.x = ndcX - this.dragStart.x;
      this.dragDelta.y = ndcY - this.dragStart.y;
      this.sphereDragRot.y += this.dragDelta.x * 0.9;
      this.sphereDragRot.x += this.dragDelta.y * 0.9;
      this.dragStart.set(ndcX, ndcY, 0);
    }
  }

  pointerUp(): void {
    this.dragging = false;
    this.dragDelta.set(0, 0, 0);
  }

  pointerLeave(): void {
    this.cursorActive = false;
    this.hovered = null;
    this.cursorGlow = 0;
    this.trailAlive = false;
    hideHeroTooltip();
  }

  isHovering(): boolean {
    return this.hovered !== null;
  }

  dispose(): void {
    // Buffers are owned by the renderer; the brain disposes it. Nothing to do.
  }

  // ---- per-frame render --------------------------------------------------

  frame(opts: {
    t: number;
    delta: number;
    p: number;
    reduce: boolean;
    canvasW: number;
    canvasH: number;
    cameraPos: Vec3;
    cameraLookAt: Vec3;
  }): void {
    const { t, delta, p, reduce, canvasW, canvasH, cameraPos, cameraLookAt } = opts;
    const renderer = this.renderer;

    // Layer parallax from the old scroll camera keyframes.
    const offset = reduce ? new Vec3() : cameraParallax(p);
    this.layerOffset.copy(offset);
    const layerModel = makeTranslate(offset.x, offset.y, offset.z);

    // Re-begin with the layer's own model (parallax translation only → the
    // shapes draw in the same world space as the brain, on top).
    renderer.begin(cameraPos, cameraLookAt, layerModel);

    // Cursor world point (on the z=0 plane) for repulsion + glow/trail.
    if (this.cursorActive && !reduce) {
      const wp = renderer.rayToPlane(this.cursorNdc.x, this.cursorNdc.y, 0);
      if (wp) this.cursorWorld.copy(wp);
    }

    // -- scroll alphas ------------------------------------------------------
    const sphereAlpha = fadeOut(p, SPHERE_FADE_START, SPHERE_FADE_END);
    const torusAlpha = Math.min(fadeIn(p, TORUS_IN_START, TORUS_IN_END), fadeOut(p, TORUS_OUT_START, TORUS_OUT_END));
    const icoAlpha = Math.min(fadeIn(p, ICO_IN_START, ICO_IN_END), fadeOut(p, ICO_OUT_START, ICO_OUT_END));

    // Hover + proximity (skip while a shape is fully faded out)
    const hoverKind = !reduce ? this.pick(this.cursorNdc.x, this.cursorNdc.y, canvasW, canvasH) : null;
    if (hoverKind !== this.hovered) {
      const prev = this.hovered;
      this.hovered = hoverKind;
      if (hoverKind) {
        const info = TOOLTIPS[hoverKind];
        showHeroTooltip(info.name, info.role, this.screenX, this.screenY);
        if (prev !== hoverKind) playHoverSound(hoverKind);
      } else {
        hideHeroTooltip();
      }
    } else if (hoverKind && this.cursorActive) {
      const info = TOOLTIPS[hoverKind];
      showHeroTooltip(info.name, info.role, this.screenX, this.screenY);
    }

    const sphereHoverTarget = this.hovered === "sphere" ? 1 : 0;
    const torusHoverTarget = this.hovered === "torus" ? 1 : 0;
    const icoHoverTarget = this.hovered === "ico" ? 1 : 0;
    this.sphereHover += (sphereHoverTarget - this.sphereHover) * 0.1;
    this.torusHover += (torusHoverTarget - this.torusHover) * 0.1;
    this.icoHover += (icoHoverTarget - this.icoHover) * 0.1;

    // Torus / ico cursor proximity (world-space distance to cursor ray point)
    if (this.cursorActive && !reduce) {
      const td = this.cursorWorld.distanceTo(TORUS_POS);
      const id2 = this.cursorWorld.distanceTo(ICO_POS);
      const tTarget = Math.max(0, 1 - td * 0.35);
      const iTarget = Math.max(0, 1 - id2 * 0.45);
      this.torusProx += (tTarget - this.torusProx) * 0.12;
      this.icoProx += (iTarget - this.icoProx) * 0.12;
    } else if (reduce) {
      this.torusProx = 0;
      this.icoProx = 0;
    }

    // Pulse decay
    this.pulse *= 0.9;
    if (this.pulse < 0.01) this.pulse = 0;
    this.torusSpin *= 0.96;
    this.icoSpin *= 0.95;
    this.cursorGlow *= 0.95;
    if (this.cursorGlow < 0.01) this.cursorGlow = 0;

    // -------------------------------------------------------------------
    // Buffers
    // -------------------------------------------------------------------

    // 1. Morphing particles (port of the original 7-phase state machine)
    this.updateParticles(t, p, reduce);

    // 2. Connection particles drift
    const conn = this.connectionData;
    for (let i = 0; i < CONNECTION_COUNT; i++) {
      const ix = i * 3;
      conn[ix] = connectionPositions[ix] + Math.sin(t * 0.3 + i) * 0.002;
      conn[ix + 1] = connectionPositions[ix + 1] + Math.cos(t * 0.4 + i * 0.7) * 0.002;
      conn[ix + 2] = connectionPositions[ix + 2] + Math.sin(t * 0.2 + i * 1.3) * 0.001;
    }
    if (reduce) for (let i = 0; i < CONNECTION_COUNT * 3; i++) conn[i] = connectionPositions[i];

    // 3. Burst particles
    if (this.burstActive) {
      let anyAlive = false;
      for (let i = 0; i < BURST_COUNT; i++) {
        burstAges[i] += delta;
        if (burstAges[i] < 1.5) {
          anyAlive = true;
          burstPositions[i * 3] += burstVelocities[i].x * delta;
          burstPositions[i * 3 + 1] += burstVelocities[i].y * delta;
          burstPositions[i * 3 + 2] += burstVelocities[i].z * delta;
          burstVelocities[i].multiplyScalar(0.96);
        }
      }
      this.burstActive = anyAlive;
    }
    this.burstData.set(burstPositions);

    // 4. Cursor trail
    if (this.trailAlive && !reduce) {
      for (let i = 0; i < TRAIL_COUNT; i++) {
        trailAges[i] += delta;
        if (trailAges[i] >= TRAIL_LIFETIME) {
          const scatter = 0.5 + Math.random() * 1.2;
          const angle = Math.random() * Math.PI * 2;
          const angleV = Math.random() * Math.PI - Math.PI / 2;
          const wx = this.trailMouse.x * 4.5;
          const wy = this.trailMouse.y * 2.5;
          trailPositions[i * 3] = wx;
          trailPositions[i * 3 + 1] = wy;
          trailPositions[i * 3 + 2] = 0;
          trailVelocities[i].set(
            Math.cos(angle) * scatter * Math.cos(angleV),
            Math.sin(angleV) * scatter,
            Math.sin(angle) * scatter * Math.cos(angleV),
          );
          trailAges[i] = 0;
        } else {
          trailPositions[i * 3] += trailVelocities[i].x * delta;
          trailPositions[i * 3 + 1] += trailVelocities[i].y * delta - delta * 0.4;
          trailPositions[i * 3 + 2] += trailVelocities[i].z * delta;
          trailVelocities[i].multiplyScalar(0.97);
        }
      }
    }
    this.trailData.set(trailPositions);

    // 5. Sphere deformation
    if (!reduce) {
      const orig = this.sphereOrig;
      const disp = this.sphereDisp;
      for (let i = 0; i < orig.length; i += 3) {
        const ox = orig[i];
        const oy = orig[i + 1];
        const oz = orig[i + 2];
        const n = noise3D(ox, oy, oz, t);
        const len = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
        const nx = ox / len;
        const ny = oy / len;
        const cursorDot = nx * this.cursorNdc.x * 2 + ny * this.cursorNdc.y * 2;
        const cursorForce = this.cursorActive ? Math.max(0, cursorDot) * 0.5 : 0;
        const pulseForce = this.pulse * (1.5 + Math.sin(len * 10 - t * 15) * 0.7);
        const displacement = 1 + n * 0.2 + cursorForce + pulseForce;
        disp[i] = ox * displacement;
        disp[i + 1] = oy * displacement;
        disp[i + 2] = oz * displacement;
      }
      renderer.updateMeshPositions(this.sphereMesh, disp);
    }

    // -------------------------------------------------------------------
    // Draw
    // -------------------------------------------------------------------

    // -- connections (dim, additive) --
    renderer.updatePointsInstance(this.connections, this.connectionData, 3);
    renderer.drawPointsInstance(this.connections, "xyz", 0.025, 0.3 * Math.max(sphereAlpha, torusAlpha, icoAlpha), true, layerModel, BLUE);

    // -- morphing particles --
    renderer.updatePointsInstance(this.particles, this.particleData, 6);
    renderer.drawPointsInstance(this.particles, "xyzrgb", 0.05 + this.particleBlend * 0.03, 0.7 * (0.4 + this.particleOpacity * 0.6), true, layerModel);

    // -- burst --
    if (this.burstActive) {
      renderer.updatePointsInstance(this.burst, this.burstData, 3);
      renderer.drawPointsInstance(this.burst, "xyz", 0.06, 0.8, true, layerModel, LIGHT_BLUE);
    }

    // -- sphere (solid + wireframe) --
    const sphereScale = Math.max(0.0001, (1 - sphereAlpha) * 0.3 + sphereAlpha);
    const sphereModel = new Mat4();
    composeModel(sphereModel, new Vec3(0, 0, 0), this.sphereDragRot.x, t * 0.08 + this.sphereDragRot.y, 0, sphereScale, sphereScale, sphereScale);
    const sEmissive = 0.35 + this.sphereHover * 0.85 + this.pulse * 1.5;
    const sOpacity = 0.85 * sphereAlpha;
    if (sphereAlpha > 0.005) {
      renderer.drawMeshInstance(this.sphereMesh, sphereModel, BLUE, sEmissive, sOpacity, {
        color: LIGHT_BLUE,
        power: 2.2 + this.sphereHover * 1.5,
        strength: 0.5 + this.sphereHover * 0.6 + this.pulse * 0.8,
      });
      // Lines compose the parallax layer model in (meshes do it internally).
      const sphereWireModel = this.layerCompose(sphereModel);
      renderer.drawLinesInstance(this.sphereWire, LIGHT_BLUE, (0.06 + this.sphereHover * 0.15) * sphereAlpha, sphereWireModel);
    }

    // -- torus (solid + wire + glow ring) --
    if (torusAlpha > 0.005) {
      const tScale = Math.max(0.0001, 0.3 + torusAlpha);
      const floatX = Math.sin(t * 0.4) * 0.15;
      const floatY = Math.cos(t * 0.3) * 0.1;
      const tPos = new Vec3(TORUS_POS.x + floatX, TORUS_POS.y + floatY, TORUS_POS.z);
      const torusModel = new Mat4();
      composeModel(
        torusModel,
        tPos,
        p * Math.PI * 0.8 + t * 0.08 + this.torusSpin * 0.5,
        p * Math.PI * 0.4 + t * 0.12 + this.torusSpin,
        0,
        tScale, tScale, tScale,
      );
      const tEmissive = 0.3 + this.torusProx * 0.7 + this.torusHover * 0.5;
      const tOpacity = torusAlpha * (0.4 + this.torusProx * 0.35 + this.torusHover * 0.2);
      renderer.drawMeshInstance(this.torusMesh, torusModel, BLUE, tEmissive, tOpacity, {
        color: LIGHT_BLUE,
        power: 2.0 + this.torusProx * 1.5,
        strength: 0.45 + this.torusProx * 0.7 + this.torusHover * 0.5,
      });
      renderer.drawLinesInstance(this.torusWire, LIGHT_BLUE, torusAlpha * (0.15 + this.torusProx * 0.2 + this.torusHover * 0.15), this.layerCompose(torusModel));
      const ringModel = new Mat4();
      composeModel(ringModel, tPos, 0, 0, 0, tScale * 1.15, tScale * 1.15, tScale * 1.15);
      renderer.drawLinesInstance(this.torusRing, BLUE, torusAlpha * (this.torusProx * 0.3 + this.torusHover * 0.2), this.layerCompose(ringModel));
    }

    // -- icosahedron (wire + solid + glow) --
    if (icoAlpha > 0.005) {
      const iScale = Math.max(0.0001, 0.2 + icoAlpha);
      const iPos = new Vec3(ICO_POS.x + Math.sin(t * 0.35) * 0.1, ICO_POS.y + Math.cos(t * 0.25) * 0.08, ICO_POS.z);
      const icoModel = new Mat4();
      composeModel(
        icoModel,
        iPos,
        t * 0.05 + this.icoSpin * 0.3,
        t * 0.08 + p * Math.PI * 0.5 + this.icoSpin,
        Math.sin(t * 0.06) * 0.25 + this.icoSpin * 0.4,
        iScale, iScale, iScale,
      );
      const iOpacity = icoAlpha * (0.25 + this.icoProx * 0.25 + this.icoHover * 0.2);
      renderer.drawLinesInstance(this.icoWire, LIGHT_BLUE, iOpacity, this.layerCompose(icoModel));
      const iSolid = new Mat4();
      composeModel(iSolid, iPos, t * 0.05 + this.icoSpin * 0.3, t * 0.08 + p * Math.PI * 0.5 + this.icoSpin, Math.sin(t * 0.06) * 0.25 + this.icoSpin * 0.4, iScale * 0.98, iScale * 0.98, iScale * 0.98);
      renderer.drawMeshInstance(this.icoMesh, iSolid, BLUE, 0.2 + this.icoProx * 0.8 + this.icoHover * 0.5, icoAlpha * (0.12 + this.icoProx * 0.2 + this.icoHover * 0.15), {
        color: LIGHT_BLUE,
        power: 2.2 + this.icoProx * 1.6,
        strength: 0.5 + this.icoProx * 0.8 + this.icoHover * 0.5,
      });
      const iGlow = new Mat4();
      composeModel(iGlow, iPos, t * 0.05 + this.icoSpin * 0.3, t * 0.08 + p * Math.PI * 0.5 + this.icoSpin, Math.sin(t * 0.06) * 0.25 + this.icoSpin * 0.4, iScale * 1.2, iScale * 1.2, iScale * 1.2);
      renderer.drawLinesInstance(this.icoWire, BLUE, icoAlpha * (this.icoProx * 0.25 + this.icoHover * 0.2), this.layerCompose(iGlow));
    }

    // -- cursor trail + glow ring (topmost, only when cursor active) --
    if (this.cursorActive && !reduce) {
      renderer.updatePointsInstance(this.trail, this.trailData, 3);
      renderer.drawPointsInstance(this.trail, "xyz", 0.04, 0.8, true, layerModel, [1, 1, 1]);
      const gScale = 0.12 + this.cursorGlow * 0.09 + Math.sin(t * 2) * 0.015;
      const gModel = new Mat4();
      composeModel(gModel, new Vec3(this.cursorWorld.x, this.cursorWorld.y, 0.3), 0, 0, 0, gScale, gScale, gScale);
      renderer.drawLinesInstance(this.cursorRing, BLUE, this.cursorGlow * 0.4, this.layerCompose(gModel));
    }

    // Restore the brain's group model so BrainLab's rayToPlane picking stays
    // group-local between frames (BrainLab re-begins each frame anyway, but
    // pointer handlers run between frames and rely on the current model).
  }

  // -------------------------------------------------------------------

  private updateParticles(t: number, p: number, reduce: boolean): void {
    const data = this.particleData;
    const scatter1 = smoothstep(0.1, 0.25, p);
    const reform1 = smoothstep(0.25, 0.4, p);
    const scatter2 = smoothstep(0.4, 0.55, p);
    const reform2 = smoothstep(0.55, 0.7, p);
    const scatter3 = smoothstep(0.72, 0.88, p);
    // Global color/size blend for the draw (opacity is per-draw, not per-vertex)
    this.particleBlend = Math.max(scatter1 * (1 - reform1), scatter2 * (1 - reform2), scatter3);
    this.particleOpacity = Math.max(0, 1 - scatter3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      let x = particleSphereOrigin[ix];
      let y = particleSphereOrigin[ix + 1];
      let z = particleSphereOrigin[ix + 2];

      if (p < 0.1) {
        if (!reduce) {
          x += Math.sin(t * 0.3 + i * 0.5) * 0.15;
          y += Math.cos(t * 0.25 + i * 0.3) * 0.1;
          z += Math.sin(t * 0.2 + i * 0.7) * 0.08;
        }
      } else if (p < 0.25) {
        const sp = scatter1 * scatter1;
        x += particleScatter[ix] * sp;
        y += particleScatter[ix + 1] * sp;
        z += particleScatter[ix + 2] * sp;
      } else if (p < 0.4) {
        const rp = reform1 * (3 - 2 * reform1);
        const sx = particleSphereOrigin[ix] + particleScatter[ix];
        const sy = particleSphereOrigin[ix + 1] + particleScatter[ix + 1];
        const sz = particleSphereOrigin[ix + 2] + particleScatter[ix + 2];
        x = sx + (particleTorusTarget[ix] - sx) * rp;
        y = sy + (particleTorusTarget[ix + 1] - sy) * rp;
        z = sz + (particleTorusTarget[ix + 2] - sz) * rp;
      } else if (p < 0.55) {
        const sp2 = Math.min(1, Math.max(0, (scatter2 - scatter1) / (1 - scatter1 + 0.001)));
        const sp = sp2 * sp2;
        x = particleTorusTarget[ix] + particleTorusScatter[ix] * sp;
        y = particleTorusTarget[ix + 1] + particleTorusScatter[ix + 1] * sp;
        z = particleTorusTarget[ix + 2] + particleTorusScatter[ix + 2] * sp;
      } else if (p < 0.7) {
        const rp = reform2 * (3 - 2 * reform2);
        const sx = particleTorusTarget[ix] + particleTorusScatter[ix];
        const sy = particleTorusTarget[ix + 1] + particleTorusScatter[ix + 1];
        const sz = particleTorusTarget[ix + 2] + particleTorusScatter[ix + 2];
        x = sx + (particleIcoTarget[ix] - sx) * rp;
        y = sy + (particleIcoTarget[ix + 1] - sy) * rp;
        z = sz + (particleIcoTarget[ix + 2] - sz) * rp;
      } else if (p < 0.72) {
        if (!reduce) {
          x = particleIcoTarget[ix] + Math.sin(t * 0.32 + i * 0.45) * 0.1;
          y = particleIcoTarget[ix + 1] + Math.cos(t * 0.26 + i * 0.55) * 0.07;
          z = particleIcoTarget[ix + 2] + Math.sin(t * 0.2 + i * 0.8) * 0.05;
        } else {
          x = particleIcoTarget[ix];
          y = particleIcoTarget[ix + 1];
          z = particleIcoTarget[ix + 2];
        }
      } else {
        const sp3 = scatter3 * scatter3;
        x = particleIcoTarget[ix] + particleIcoScatter[ix] * sp3;
        y = particleIcoTarget[ix + 1] + particleIcoScatter[ix + 1] * sp3;
        z = particleIcoTarget[ix + 2] + particleIcoScatter[ix + 2] * sp3;
      }

      // Cursor repulsion
      if (this.cursorActive && !reduce) {
        const mx = this.cursorNdc.x * 4.5;
        const my = this.cursorNdc.y * 2.5;
        const dx = x - mx;
        const dy = y - my;
        const dz = z - 0;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 3 && dist > 0.01) {
          const force = (1 - dist / 3) * 0.2;
          x += (dx / dist) * force;
          y += (dy / dist) * force;
          z += (dz / dist) * force * 0.5;
        }
      }

      data[ix] = x;
      data[ix + 1] = y;
      data[ix + 2] = z;

      // Color: blue → white as particles scatter/reform (global blend)
      const blend = this.particleBlend;
      data[ix + 3] = 0.541 + (1 - 0.541) * blend;
      data[ix + 4] = 0.69 + (1 - 0.69) * blend;
      data[ix + 5] = 1;
    }
  }

  /** Composes the current parallax layer model with a shape model. */
  private layerCompose(model: Mat4): Mat4 {
    const o = this.layerOffset;
    const out = new Mat4();
    out.multiplyMatrices(makeTranslate(o.x, o.y, o.z), model);
    return out;
  }

  private triggerBurst(): void {
    this.burstActive = true;
    for (let i = 0; i < BURST_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const angleV = Math.random() * Math.PI - Math.PI / 2;
      const speed = 1.5 + Math.random() * 3;
      burstPositions[i * 3] = 0;
      burstPositions[i * 3 + 1] = 0;
      burstPositions[i * 3 + 2] = 0;
      burstVelocities[i].set(
        Math.cos(angle) * speed * Math.cos(angleV),
        Math.sin(angleV) * speed,
        Math.sin(angle) * speed * Math.cos(angleV),
      );
      burstAges[i] = 0;
    }
  }

  /** Screen-space pick of a shape under the cursor (px distance to center). */
  private pick(ndcX: number, ndcY: number, canvasW: number, canvasH: number): ShapeKind | null {
    if (!this.cursorActive || canvasW === 0 || canvasH === 0) return null;
    // Approximate the layer's world at the cursor via the current VP (the
    // layer draws with an identity group, so world ≈ NDC unproject at z=0).
    // Project each shape center into NDC and compare in pixel space.
    const renderer = this.renderer;
    const candidates: { kind: ShapeKind; world: Vec3; radius: number }[] = [
      { kind: "sphere", world: new Vec3(0, 0, 0), radius: SPHERE_RADIUS * 0.9 },
      { kind: "torus", world: TORUS_POS, radius: (TORUS_RADIUS + TORUS_TUBE) * 0.8 },
      { kind: "ico", world: ICO_POS, radius: ICO_RADIUS * 1.1 },
    ];
    const o = this.layerOffset;
    for (const c of candidates) {
      const wx = c.world.x + o.x;
      const wy = c.world.y + o.y;
      const wz = c.world.z + o.z;
      const m = makeTranslate(wx, wy, wz);
      const ndc = renderer.projectToNdc(c.world, m);
      if (ndc.z < -1 || ndc.z > 1) continue;
      const px = (ndc.x * 0.5 + 0.5) * canvasW;
      const py = (-ndc.y * 0.5 + 0.5) * canvasH;
      const edge = renderer.projectToNdc(new Vec3(wx + c.radius, wy, wz), m);
      const edgePx = (edge.x * 0.5 + 0.5) * canvasW;
      const hitRadius = Math.max(24, Math.abs(edgePx - px));
      const dpx = Math.hypot((ndcX * 0.5 + 0.5) * canvasW - px, (-ndcY * 0.5 + 0.5) * canvasH - py);
      if (dpx < hitRadius) return c.kind;
    }
    return null;
  }
}

// ---------------------------------------------------------------------------

function noise3D(x: number, y: number, z: number, t: number): number {
  return (
    Math.sin(x * 1.8 + t * 0.6) * 0.35 +
    Math.sin(y * 2.4 + t * 0.45) * 0.25 +
    Math.sin(z * 2.0 + t * 0.8) * 0.3 +
    Math.sin((x + y) * 1.2 + t * 0.3) * 0.15 +
    Math.sin((y + z) * 1.6 + t * 0.55) * 0.12
  );
}
