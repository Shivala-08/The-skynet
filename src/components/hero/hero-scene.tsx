"use client";

import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import * as THREE from "three";
import { getScrollProgress } from "@/lib/scroll-progress";
import { playSphereClick, playTorusClick, playIcoClick, playHoverSound } from "@/lib/sounds";

// ---------------------------------------------------------------------------
// Shared mouse state — lifted to Scene so all objects read the same cursor.
// ---------------------------------------------------------------------------

const _mouse = new THREE.Vector2(0, 0);
let _isHovering = false;
let _hoveredObject: "sphere" | "torus" | "ico" | null = null;
let _isDragging = false;
const _dragStart = new THREE.Vector2(0, 0);
const _dragDelta = new THREE.Vector2(0, 0);
let _cursorGlow = 0;
let _screenX = 0;
let _screenY = 0;
let _prevHoveredObject: "sphere" | "torus" | "ico" | null = null;

function useMouseHandlers() {
  const onPointerMove = useCallback((e: { clientX: number; clientY: number; target: EventTarget }) => {
    const rect = (e.target as HTMLElement)?.getBoundingClientRect?.();
    if (!rect) return;
    _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    _screenX = e.clientX;
    _screenY = e.clientY;
    if (_isDragging) {
      _dragDelta.x = _mouse.x - _dragStart.x;
      _dragDelta.y = _mouse.y - _dragStart.y;
    }
    _cursorGlow = Math.min(1, _cursorGlow + 0.05);
  }, []);

  const onPointerDown = useCallback((e: { clientX: number; clientY: number; target: EventTarget }) => {
    const rect = (e.target as HTMLElement)?.getBoundingClientRect?.();
    if (!rect) return;
    _isDragging = true;
    _dragStart.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    _dragDelta.set(0, 0);
  }, []);

  const onPointerUp = useCallback(() => {
    _isDragging = false;
    _dragDelta.set(0, 0);
  }, []);

  const onPointerEnter = useCallback(() => { _isHovering = true; }, []);
  const onPointerLeave = useCallback(() => {
    _isHovering = false;
    _hoveredObject = null;
    _mouse.set(0, 0);
    _isDragging = false;
    _dragDelta.set(0, 0);
    _cursorGlow = 0;
  }, []);

  return { onPointerMove, onPointerEnter, onPointerLeave, onPointerDown, onPointerUp };
}

// ---------------------------------------------------------------------------
// Easing helpers
// ---------------------------------------------------------------------------

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function fadeIn(p: number, start: number, end: number): number {
  return smoothstep(start, end, p);
}

function fadeOut(p: number, start: number, end: number): number {
  return 1 - smoothstep(start, end, p);
}

// ---------------------------------------------------------------------------
// Scroll fade ranges — objects crossfade in sequence
//
//   p:  0    0.1   0.2   0.3   0.4   0.5   0.6   0.7   0.8   0.9   1.0
//   S:  ████  ████  ████  ░░░░
//   T:        ░░░░  ████  ████  ████  ░░░░
//   I:                          ░░░░  ████  ████  ████  ░░░░
// ---------------------------------------------------------------------------

const SPHERE_FADE_START = 0.10;
const SPHERE_FADE_END = 0.25;

const TORUS_IN_START = 0.12;
const TORUS_IN_END = 0.28;
const TORUS_OUT_START = 0.40;
const TORUS_OUT_END = 0.55;

const ICO_IN_START = 0.42;
const ICO_IN_END = 0.58;
const ICO_OUT_START = 0.72;
const ICO_OUT_END = 0.88;

// ---------------------------------------------------------------------------
// Cursor glow — a soft ring that follows the mouse to show interactivity.
// ---------------------------------------------------------------------------

function CursorGlow() {
  const ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef(0);

  useFrame((state) => {
    if (!ref.current) return;
    _cursorGlow *= 0.95;
    if (_cursorGlow < 0.01) _cursorGlow = 0;
    glowRef.current += (_cursorGlow - glowRef.current) * 0.1;
    const t = state.clock.elapsedTime;
    ref.current.position.set(_mouse.x * 3, _mouse.y * 2, 0.3);
    ref.current.scale.setScalar(0.15 + glowRef.current * 0.1 + Math.sin(t * 2) * 0.02);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = glowRef.current * 0.4;
  });

  return (
    <mesh ref={ref}>
      <ringGeometry args={[0.8, 1, 32]} />
      <meshBasicMaterial color="#4d8dff" transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Data Sphere — organic noise-deformed sphere with drag-rotate + click burst.
// ---------------------------------------------------------------------------

const PARTICLE_COUNT = 300;
const SPHERE_SEGMENTS = 64;

function noise3D(x: number, y: number, z: number, t: number): number {
  return (
    Math.sin(x * 1.8 + t * 0.6) * 0.35 +
    Math.sin(y * 2.4 + t * 0.45) * 0.25 +
    Math.sin(z * 2.0 + t * 0.8) * 0.3 +
    Math.sin((x + y) * 1.2 + t * 0.3) * 0.15 +
    Math.sin((y + z) * 1.6 + t * 0.55) * 0.12
  );
}

// Click burst particles for the sphere
const BURST_COUNT = 40;
const _burstPositions = new Float32Array(BURST_COUNT * 3);
const _burstVelocities = Array.from({ length: BURST_COUNT }, () => new THREE.Vector3());
const _burstAges = new Float32Array(BURST_COUNT).fill(999);
let _burstActive = false;

function ClickBurst() {
  const ref = useRef<THREE.Points>(null);

  useFrame((_, delta) => {
    if (!ref.current || !_burstActive) return;
    const posAttr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    let anyAlive = false;
    for (let i = 0; i < BURST_COUNT; i++) {
      _burstAges[i] += delta;
      if (_burstAges[i] < 1.5) {
        anyAlive = true;
        _burstPositions[i * 3] += _burstVelocities[i].x * delta;
        _burstPositions[i * 3 + 1] += _burstVelocities[i].y * delta;
        _burstPositions[i * 3 + 2] += _burstVelocities[i].z * delta;
        _burstVelocities[i].multiplyScalar(0.96);
      }
    }
    posAttr.needsUpdate = true;
    if (!anyAlive) _burstActive = false;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[_burstPositions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#8ab0ff"
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.8}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function triggerBurst() {
  _burstActive = true;
  for (let i = 0; i < BURST_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const angleV = Math.random() * Math.PI - Math.PI / 2;
    const speed = 1.5 + Math.random() * 3;
    _burstPositions[i * 3] = 0;
    _burstPositions[i * 3 + 1] = 0;
    _burstPositions[i * 3 + 2] = 0;
    _burstVelocities[i].set(
      Math.cos(angle) * speed * Math.cos(angleV),
      Math.sin(angleV) * speed,
      Math.sin(angle) * speed * Math.cos(angleV),
    );
    _burstAges[i] = 0;
  }
}

function DataSphere() {
  const meshRef = useRef<THREE.Mesh>(null);
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const wireRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef(0);
  const hoverRef = useRef(0);
  const dragRotRef = useRef({ x: 0, y: 0 });
  const { onPointerMove, onPointerEnter, onPointerLeave, onPointerDown, onPointerUp } = useMouseHandlers();

  const original = useMemo(() => {
    const geo = new THREE.SphereGeometry(1.6, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
    const pos = geo.attributes.position;
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      arr[i * 3] = pos.getX(i);
      arr[i * 3 + 1] = pos.getY(i);
      arr[i * 3 + 2] = pos.getZ(i);
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!geoRef.current || !meshRef.current) return;
    const t = state.clock.elapsedTime;
    const p = getScrollProgress();
    const pos = geoRef.current.attributes.position;

    // Pulse decay
    pulseRef.current *= 0.9;
    if (pulseRef.current < 0.01) pulseRef.current = 0;

    // Hover interpolation
    const targetHover = _hoveredObject === "sphere" ? 1 : 0;
    hoverRef.current += (targetHover - hoverRef.current) * 0.1;

    // Drag rotation
    if (_isDragging && _hoveredObject === "sphere") {
      dragRotRef.current.x += _dragDelta.y * 0.5;
      dragRotRef.current.y += _dragDelta.x * 0.5;
      _dragDelta.multiplyScalar(0.8);
    }
    dragRotRef.current.x *= 0.95;
    dragRotRef.current.y *= 0.95;

    for (let i = 0; i < pos.count; i++) {
      const ox = original[i * 3];
      const oy = original[i * 3 + 1];
      const oz = original[i * 3 + 2];
      const n = noise3D(ox, oy, oz, t);
      const len = Math.sqrt(ox * ox + oy * oy + oz * oz);
      const nx = ox / len;
      const ny = oy / len;
      const cursorDot = nx * _mouse.x * 2 + ny * _mouse.y * 2;
      const cursorForce = Math.max(0, cursorDot) * 0.5;
      const pulseForce = pulseRef.current * (1.5 + Math.sin(len * 10 - t * 15) * 0.7);
      const displacement = 1 + n * 0.2 + cursorForce + pulseForce;
      pos.setXYZ(i, ox * displacement, oy * displacement, oz * displacement);
    }
    pos.needsUpdate = true;
    geoRef.current.computeVertexNormals();

    // Rotation: time + drag
    meshRef.current.rotation.y = t * 0.08 + dragRotRef.current.y;
    meshRef.current.rotation.x = Math.sin(t * 0.05) * 0.1 + dragRotRef.current.x;

    if (wireRef.current) {
      wireRef.current.rotation.copy(meshRef.current.rotation);
    }

    // Scroll fade — sphere fades from 0.10→0.25, fully gone by 0.25
    const scrollAlpha = fadeOut(p, SPHERE_FADE_START, SPHERE_FADE_END);
    // Scale down slightly as it fades
    const scrollScale = THREE.MathUtils.lerp(0.7, 1, scrollAlpha);
    meshRef.current.scale.setScalar(scrollScale * (1 + pulseRef.current * 0.12));

    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.85 * scrollAlpha;
    mat.emissiveIntensity = 0.35 + hoverRef.current * 0.85;

    if (wireRef.current) {
      const wMat = wireRef.current.material as THREE.MeshBasicMaterial;
      wMat.opacity = (0.06 + hoverRef.current * 0.15) * scrollAlpha;
    }
  });

  const onClick = useCallback(() => {
    pulseRef.current = 1;
    playSphereClick();
    triggerBurst();
  }, []);

  const onPointerMoveSphere = useCallback((e: { clientX: number; clientY: number; target: EventTarget }) => {
    _hoveredObject = "sphere";
    onPointerMove(e);
  }, [onPointerMove]);

  return (
    <group>
      <mesh
        ref={meshRef}
        onPointerMove={onPointerMoveSphere}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClick={onClick}
      >
        <sphereGeometry ref={geoRef} args={[1.6, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />
        <meshStandardMaterial
          color="#4d8dff"
          emissive="#4d8dff"
          emissiveIntensity={0.35}
          roughness={0.3}
          metalness={0.3}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh ref={wireRef} scale={1.003}>
        <sphereGeometry args={[1.6, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />
        <meshBasicMaterial color="#8ab0ff" wireframe transparent opacity={0.06} />
      </mesh>
      <ClickBurst />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Floating particles — scatter from sphere, reform around torus on scroll.
//
// Timeline:
//   p < 0.10  → Fibonacci sphere around (0, 0, 0) — hero particles
//   p 0.10→0.25 → scatter outward — sphere dissolve
//   p 0.25→0.40 → drift toward torus — reforming
//   p > 0.40  → Fibonacci torus ring around (1.4, -0.7, -0.5)
// ---------------------------------------------------------------------------

// Pre-compute per-particle data for all dissolve phases
const _particleScatter = new Float32Array(PARTICLE_COUNT * 3);       // scatter from sphere
const _particleTorusTarget = new Float32Array(PARTICLE_COUNT * 3);   // torus ring
const _particleTorusScatter = new Float32Array(PARTICLE_COUNT * 3);  // scatter from torus
const _particleIcoTarget = new Float32Array(PARTICLE_COUNT * 3);     // ico ring
const _particleIcoScatter = new Float32Array(PARTICLE_COUNT * 3);    // scatter from ico (final dissolve)
const _particleSphereOrigin = new Float32Array(PARTICLE_COUNT * 3);

(() => {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  let seed = 137;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Sphere origin (Fibonacci sphere, r=3.5)
    const st = i / PARTICLE_COUNT;
    const phi = Math.acos(1 - 2 * st);
    const theta = goldenAngle * i;
    const r = 3.5;
    _particleSphereOrigin[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    _particleSphereOrigin[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    _particleSphereOrigin[i * 3 + 2] = r * Math.cos(phi);

    // Scatter direction — outward from center + random jitter
    const nx = _particleSphereOrigin[i * 3];
    const ny = _particleSphereOrigin[i * 3 + 1];
    const nz = _particleSphereOrigin[i * 3 + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    _particleScatter[i * 3]     = (nx / len) * (3 + rand() * 4) + (rand() - 0.5) * 2;
    _particleScatter[i * 3 + 1] = (ny / len) * (3 + rand() * 4) + (rand() - 0.5) * 2;
    _particleScatter[i * 3 + 2] = (nz / len) * (3 + rand() * 4) + (rand() - 0.5) * 2;

    // Torus target — fibonacci ring around torus (1.4, -0.7, -0.5)
    const torusR = 1.2 + rand() * 0.6;
    const torusPhi = Math.acos(1 - 2 * (i / PARTICLE_COUNT));
    const torusTheta = goldenAngle * i + rand() * 0.5;
    _particleTorusTarget[i * 3]     = 1.4 + torusR * Math.sin(torusPhi) * Math.cos(torusTheta);
    _particleTorusTarget[i * 3 + 1] = -0.7 + torusR * Math.sin(torusPhi) * Math.sin(torusTheta);
    _particleTorusTarget[i * 3 + 2] = -0.5 + torusR * Math.cos(torusPhi);

    // Torus scatter — outward from torus center + random jitter
    const tx = _particleTorusTarget[i * 3] - 1.4;
    const ty = _particleTorusTarget[i * 3 + 1] - (-0.7);
    const tz = _particleTorusTarget[i * 3 + 2] - (-0.5);
    const tlen = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
    _particleTorusScatter[i * 3]     = (tx / tlen) * (2.5 + rand() * 3) + (rand() - 0.5) * 1.5;
    _particleTorusScatter[i * 3 + 1] = (ty / tlen) * (2.5 + rand() * 3) + (rand() - 0.5) * 1.5;
    _particleTorusScatter[i * 3 + 2] = (tz / tlen) * (2.5 + rand() * 3) + (rand() - 0.5) * 1.5;

    // Ico target — fibonacci ring around ico (-1.2, 0.6, -0.3)
    const icoR = 1.0 + rand() * 0.5;
    const icoPhi = Math.acos(1 - 2 * (i / PARTICLE_COUNT));
    const icoTheta = goldenAngle * i + rand() * 0.4;
    _particleIcoTarget[i * 3]     = -1.2 + icoR * Math.sin(icoPhi) * Math.cos(icoTheta);
    _particleIcoTarget[i * 3 + 1] = 0.6 + icoR * Math.sin(icoPhi) * Math.sin(icoTheta);
    _particleIcoTarget[i * 3 + 2] = -0.3 + icoR * Math.cos(icoPhi);

    // Ico scatter — outward from ico center + random jitter (final dissolve)
    const ix2 = _particleIcoTarget[i * 3] - (-1.2);
    const iy = _particleIcoTarget[i * 3 + 1] - 0.6;
    const iz = _particleIcoTarget[i * 3 + 2] - (-0.3);
    const ilen = Math.sqrt(ix2 * ix2 + iy * iy + iz * iz) || 1;
    _particleIcoScatter[i * 3]     = (ix2 / ilen) * (2 + rand() * 2.5) + (rand() - 0.5) * 1.5;
    _particleIcoScatter[i * 3 + 1] = (iy / ilen) * (2 + rand() * 2.5) + (rand() - 0.5) * 1.5;
    _particleIcoScatter[i * 3 + 2] = (iz / ilen) * (2 + rand() * 2.5) + (rand() - 0.5) * 1.5;
  }
})();

function Particles() {
  const ref = useRef<THREE.Points>(null);
  const colorRef = useRef(new THREE.Color("#8ab0ff"));

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const p = getScrollProgress();
    ref.current.rotation.y = t * 0.02;

    const posAttr = ref.current.geometry.attributes.position as THREE.BufferAttribute;

    // Phase 1: p < 0.10  → sphere origin (hero)
    // Phase 2: p 0.10→0.25 → scatter from sphere
    // Phase 3: p 0.25→0.40 → reform at torus
    // Phase 4: p 0.40→0.55 → scatter from torus
    // Phase 5: p 0.55→0.70 → reform at ico
    // Phase 6: p 0.70→0.72 → ico ring
    // Phase 7: p 0.72→0.88 → scatter from ico + fade out

    const scatter1 = smoothstep(0.10, 0.25, p);  // sphere scatter
    const reform1 = smoothstep(0.25, 0.40, p);   // torus reform
    const scatter2 = smoothstep(0.40, 0.55, p);  // torus scatter
    const reform2 = smoothstep(0.55, 0.70, p);   // ico reform
    const scatter3 = smoothstep(0.72, 0.88, p);  // ico scatter (final dissolve)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;

      if (p < 0.10) {
        // Phase 1: sphere origin — gentle float
        const ox = _particleSphereOrigin[ix];
        const oy = _particleSphereOrigin[ix + 1];
        const oz = _particleSphereOrigin[ix + 2];
        const fx = Math.sin(t * 0.3 + i * 0.5) * 0.15;
        const fy = Math.cos(t * 0.25 + i * 0.3) * 0.1;
        posAttr.setX(i, ox + fx);
        posAttr.setY(i, oy + fy);
        posAttr.setZ(i, oz + Math.sin(t * 0.2 + i * 0.7) * 0.08);

      } else if (p < 0.25) {
        // Phase 2: scatter from sphere
        const ox = _particleSphereOrigin[ix];
        const oy = _particleSphereOrigin[ix + 1];
        const oz = _particleSphereOrigin[ix + 2];
        const sx = _particleScatter[ix];
        const sy = _particleScatter[ix + 1];
        const sz = _particleScatter[ix + 2];
        const sp = scatter1 * scatter1;
        posAttr.setX(i, ox + sx * sp);
        posAttr.setY(i, oy + sy * sp);
        posAttr.setZ(i, oz + sz * sp);

      } else if (p < 0.40) {
        // Phase 3: reform at torus
        const sx = _particleSphereOrigin[ix] + _particleScatter[ix];
        const sy = _particleSphereOrigin[ix + 1] + _particleScatter[ix + 1];
        const sz = _particleSphereOrigin[ix + 2] + _particleScatter[ix + 2];
        const tx = _particleTorusTarget[ix];
        const ty = _particleTorusTarget[ix + 1];
        const tz = _particleTorusTarget[ix + 2];
        const rp = reform1 * (3 - 2 * reform1);
        posAttr.setX(i, sx + (tx - sx) * rp);
        posAttr.setY(i, sy + (ty - sy) * rp);
        posAttr.setZ(i, sz + (tz - sz) * rp);

      } else if (p < 0.55) {
        // Phase 4: scatter from torus
        const tx = _particleTorusTarget[ix];
        const ty = _particleTorusTarget[ix + 1];
        const tz = _particleTorusTarget[ix + 2];
        const tsx = _particleTorusScatter[ix];
        const tsy = _particleTorusScatter[ix + 1];
        const tsz = _particleTorusScatter[ix + 2];
        const sp2 = (scatter2 - scatter1) / (1 - scatter1 + 0.001);
        const sp = Math.min(1, Math.max(0, sp2)) * Math.min(1, Math.max(0, sp2));
        posAttr.setX(i, tx + tsx * sp);
        posAttr.setY(i, ty + tsy * sp);
        posAttr.setZ(i, tz + tsz * sp);

      } else if (p < 0.70) {
        // Phase 5: reform at ico
        const scatteredX = _particleTorusTarget[ix] + _particleTorusScatter[ix];
        const scatteredY = _particleTorusTarget[ix + 1] + _particleTorusScatter[ix + 1];
        const scatteredZ = _particleTorusTarget[ix + 2] + _particleTorusScatter[ix + 2];
        const ix2 = _particleIcoTarget[ix];
        const iy = _particleIcoTarget[ix + 1];
        const iz = _particleIcoTarget[ix + 2];
        const rp = reform2 * (3 - 2 * reform2);
        posAttr.setX(i, scatteredX + (ix2 - scatteredX) * rp);
        posAttr.setY(i, scatteredY + (iy - scatteredY) * rp);
        posAttr.setZ(i, scatteredZ + (iz - scatteredZ) * rp);

      } else if (p < 0.72) {
        // Phase 6: ico ring — gentle float
        const ix2 = _particleIcoTarget[ix];
        const iy = _particleIcoTarget[ix + 1];
        const iz = _particleIcoTarget[ix + 2];
        const fx = Math.sin(t * 0.32 + i * 0.45) * 0.1;
        const fy = Math.cos(t * 0.26 + i * 0.55) * 0.07;
        posAttr.setX(i, ix2 + fx);
        posAttr.setY(i, iy + fy);
        posAttr.setZ(i, iz + Math.sin(t * 0.2 + i * 0.8) * 0.05);

      } else {
        // Phase 7: scatter from ico + fade out (final dissolve)
        const ix2 = _particleIcoTarget[ix];
        const iy = _particleIcoTarget[ix + 1];
        const iz = _particleIcoTarget[ix + 2];
        const isx = _particleIcoScatter[ix];
        const isy = _particleIcoScatter[ix + 1];
        const isz = _particleIcoScatter[ix + 2];
        const sp3 = scatter3 * scatter3;
        posAttr.setX(i, ix2 + isx * sp3);
        posAttr.setY(i, iy + isy * sp3);
        posAttr.setZ(i, iz + isz * sp3);
      }
    }
    posAttr.needsUpdate = true;

    // Cursor repulsion — always active
    if (_isHovering) {
      const mouse3 = new THREE.Vector3(_mouse.x * 4, _mouse.y * 3, 0);
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const dx = posAttr.getX(i) - mouse3.x;
        const dy = posAttr.getY(i) - mouse3.y;
        const dz = posAttr.getZ(i) - mouse3.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 3 && dist > 0.01) {
          const force = (1 - dist / 3) * 0.2;
          posAttr.setX(i, posAttr.getX(i) + (dx / dist) * force);
          posAttr.setY(i, posAttr.getY(i) + (dy / dist) * force);
          posAttr.setZ(i, posAttr.getZ(i) + (dz / dist) * force * 0.5);
        }
      }
      posAttr.needsUpdate = true;
    }

    // Color: blue → white (scatter) → blue (reform), fades out during final scatter
    const blend1 = scatter1 * (1 - reform1);
    const blend2 = scatter2 * (1 - reform2);
    const blend3 = scatter3;
    const colorBlend = Math.max(blend1, blend2, blend3);
    colorRef.current.setRGB(
      THREE.MathUtils.lerp(0.54, 1, colorBlend),
      THREE.MathUtils.lerp(0.69, 1, colorBlend),
      1,
    );
    const mat = ref.current.material as THREE.PointsMaterial;
    mat.color.copy(colorRef.current);
    mat.size = THREE.MathUtils.lerp(0.05, 0.08, colorBlend);
    // Fade out during final dissolve
    const fadeOut = 1 - scatter3;
    mat.opacity = THREE.MathUtils.lerp(0.7, 0.9, colorBlend) * fadeOut;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[_particleSphereOrigin, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#8ab0ff" size={0.05} sizeAttenuation transparent opacity={0.7} depthWrite={false} />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Cursor trail — spark particles following mouse movement.
// ---------------------------------------------------------------------------

const TRAIL_COUNT = 40;
const TRAIL_LIFETIME = 1.0;

const _trailPositions = new Float32Array(TRAIL_COUNT * 3);
const _trailVelocities = Array.from({ length: TRAIL_COUNT }, () => new THREE.Vector3(0, 0, 0));
const _trailAges = Float32Array.from({ length: TRAIL_COUNT }, () => TRAIL_LIFETIME);
let _trailMouseX = 0;
let _trailMouseY = 0;
let _trailAlive = false;

function CursorTrail() {
  const ref = useRef<THREE.Points>(null);
  const [, setTick] = useState(0);

  useFrame((_, delta) => {
    if (!ref.current || !_trailAlive) return;
    const posAttr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < TRAIL_COUNT; i++) {
      _trailAges[i] += delta;
      if (_trailAges[i] >= TRAIL_LIFETIME) {
        const scatter = 0.5 + Math.random() * 1.2;
        const angle = Math.random() * Math.PI * 2;
        const angleV = Math.random() * Math.PI - Math.PI / 2;
        _trailPositions[i * 3] = _trailMouseX * 3;
        _trailPositions[i * 3 + 1] = _trailMouseY * 2;
        _trailPositions[i * 3 + 2] = 0;
        _trailVelocities[i].set(
          Math.cos(angle) * scatter * Math.cos(angleV),
          Math.sin(angleV) * scatter,
          Math.sin(angle) * scatter * Math.cos(angleV),
        );
        _trailAges[i] = 0;
      } else {
        _trailPositions[i * 3] += _trailVelocities[i].x * delta;
        _trailPositions[i * 3 + 1] += _trailVelocities[i].y * delta - delta * 0.4;
        _trailPositions[i * 3 + 2] += _trailVelocities[i].z * delta;
        _trailVelocities[i].multiplyScalar(0.97);
      }
    }
    posAttr.needsUpdate = true;
  });

  const onPointerMove = (e: { clientX: number; clientY: number; target: EventTarget }) => {
    const rect = (e.target as HTMLElement)?.getBoundingClientRect?.();
    if (!rect) return;
    _trailMouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _trailMouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    if (!_trailAlive) {
      _trailAlive = true;
      setTick((t) => t + 1);
    }
  };

  return (
    <group onPointerMove={onPointerMove}>
      <points ref={ref}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[_trailPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff"
          size={0.04}
          sizeAttenuation
          transparent
          opacity={0.8}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Connection particles — floating energy between objects.
// ---------------------------------------------------------------------------

const CONNECTION_COUNT = 60;

const _connectionPositions = (() => {
  const pos = new Float32Array(CONNECTION_COUNT * 3);
  let seed = 42;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const anchors = [[0, 0, 0], [1.4, -0.7, -0.5], [-1.2, 0.6, -0.3]] as const;
  for (let i = 0; i < CONNECTION_COUNT; i++) {
    const t = rand();
    const a = Math.floor(rand() * 3);
    const b = (a + 1) % 3;
    pos[i * 3]     = anchors[a][0] + (anchors[b][0] - anchors[a][0]) * t + (rand() - 0.5) * 0.5;
    pos[i * 3 + 1] = anchors[a][1] + (anchors[b][1] - anchors[a][1]) * t + (rand() - 0.5) * 0.5;
    pos[i * 3 + 2] = anchors[a][2] + (anchors[b][2] - anchors[a][2]) * t + (rand() - 0.5) * 1;
  }
  return pos;
})();

function ConnectionParticles() {
  const ref = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const posAttr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < CONNECTION_COUNT; i++) {
      posAttr.setX(i, posAttr.getX(i) + Math.sin(t * 0.3 + i) * 0.002);
      posAttr.setY(i, posAttr.getY(i) + Math.cos(t * 0.4 + i * 0.7) * 0.002);
      posAttr.setZ(i, posAttr.getZ(i) + Math.sin(t * 0.2 + i * 1.3) * 0.001);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[_connectionPositions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#4d8dff"
        size={0.025}
        sizeAttenuation
        transparent
        opacity={0.3}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// ScrollTorus — fades in at 0.12→0.28, fades out at 0.40→0.55
// ---------------------------------------------------------------------------

const TORUS_POSITION = new THREE.Vector3(1.4, -0.7, -0.5);

function ScrollTorus() {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);
  const glowRingRef = useRef<THREE.Mesh>(null);
  const proximityRef = useRef(0);
  const clickSpinRef = useRef(0);
  const hoverRef = useRef(0);
  const { onPointerMove, onPointerEnter, onPointerLeave, onPointerDown, onPointerUp } = useMouseHandlers();

  useFrame((state) => {
    if (!meshRef.current) return;
    const p = getScrollProgress();
    const t = state.clock.elapsedTime;

    // Crossfade: fade in then fade out
    const inAlpha = fadeIn(p, TORUS_IN_START, TORUS_IN_END);
    const outAlpha = fadeOut(p, TORUS_OUT_START, TORUS_OUT_END);
    const alpha = Math.min(inAlpha, outAlpha);
    const scale = THREE.MathUtils.lerp(0.3, 1.3, alpha);

    clickSpinRef.current *= 0.96;

    // Floating orbit
    const floatX = Math.sin(t * 0.4) * 0.15;
    const floatY = Math.cos(t * 0.3) * 0.1;

    // Cursor proximity
    const dx = _mouse.x * 3 - TORUS_POSITION.x;
    const dy = _mouse.y * 2 - TORUS_POSITION.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const targetProximity = _isHovering ? Math.max(0, 1 - dist * 1.2) : 0;
    proximityRef.current += (targetProximity - proximityRef.current) * 0.12;

    const targetHover = _hoveredObject === "torus" ? 1 : 0;
    hoverRef.current += (targetHover - hoverRef.current) * 0.1;

    // Rotation
    const spinBoost = clickSpinRef.current;
    const dragRotY = _isDragging && _hoveredObject === "torus" ? _dragDelta.x * 2 : 0;
    meshRef.current.rotation.x = p * Math.PI * 0.8 + t * 0.08 + spinBoost * 0.5;
    meshRef.current.rotation.y = p * Math.PI * 0.4 + t * 0.12 + spinBoost + dragRotY;
    meshRef.current.rotation.z = Math.sin(t * 0.08) * 0.2;
    meshRef.current.scale.setScalar(scale);
    meshRef.current.position.set(TORUS_POSITION.x + floatX, TORUS_POSITION.y + floatY, TORUS_POSITION.z);

    // Opacity: alpha * (base + proximity + hover)
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = alpha * (0.4 + proximityRef.current * 0.35 + hoverRef.current * 0.2);
    mat.emissiveIntensity = 0.3 + proximityRef.current * 0.7 + hoverRef.current * 0.5;

    if (wireRef.current) {
      wireRef.current.rotation.copy(meshRef.current.rotation);
      wireRef.current.scale.copy(meshRef.current.scale);
      wireRef.current.position.copy(meshRef.current.position);
      const wMat = wireRef.current.material as THREE.MeshBasicMaterial;
      wMat.opacity = alpha * (0.15 + proximityRef.current * 0.2 + hoverRef.current * 0.15);
    }

    if (glowRingRef.current) {
      glowRingRef.current.rotation.copy(meshRef.current.rotation);
      glowRingRef.current.position.copy(meshRef.current.position);
      glowRingRef.current.scale.setScalar(scale * 1.15);
      const gMat = glowRingRef.current.material as THREE.MeshBasicMaterial;
      gMat.opacity = alpha * (proximityRef.current * 0.3 + hoverRef.current * 0.2);
    }
  });

  const onClick = useCallback(() => {
    clickSpinRef.current = 2.5;
    playTorusClick();
  }, []);

  const onPointerMoveTorus = useCallback((e: { clientX: number; clientY: number; target: EventTarget }) => {
    _hoveredObject = "torus";
    onPointerMove(e);
  }, [onPointerMove]);

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[TORUS_POSITION.x, TORUS_POSITION.y, TORUS_POSITION.z]}
        onPointerMove={onPointerMoveTorus}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClick={onClick}
      >
        <torusGeometry args={[1, 0.35, 24, 64]} />
        <meshStandardMaterial
          color="#4d8dff"
          emissive="#4d8dff"
          emissiveIntensity={0.3}
          roughness={0.4}
          metalness={0.2}
          transparent
          opacity={0}
        />
      </mesh>
      <mesh ref={wireRef} position={[TORUS_POSITION.x, TORUS_POSITION.y, TORUS_POSITION.z]}>
        <torusGeometry args={[1, 0.36, 24, 64]} />
        <meshBasicMaterial color="#8ab0ff" wireframe transparent opacity={0} />
      </mesh>
      <mesh ref={glowRingRef} position={[TORUS_POSITION.x, TORUS_POSITION.y, TORUS_POSITION.z]}>
        <torusGeometry args={[1.1, 0.05, 16, 64]} />
        <meshBasicMaterial color="#4d8dff" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// ScrollIcosahedron — fades in at 0.42→0.58, fades out at 0.72→0.88
// ---------------------------------------------------------------------------

const ICO_POSITION = new THREE.Vector3(-1.2, 0.6, -0.3);

function ScrollIcosahedron() {
  const meshRef = useRef<THREE.Mesh>(null);
  const solidRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const proximityRef = useRef(0);
  const clickSpinRef = useRef(0);
  const hoverRef = useRef(0);
  const { onPointerMove, onPointerEnter, onPointerLeave, onPointerDown, onPointerUp } = useMouseHandlers();

  useFrame((state) => {
    if (!meshRef.current) return;
    const p = getScrollProgress();
    const t = state.clock.elapsedTime;

    // Crossfade: fade in then fade out
    const inAlpha = fadeIn(p, ICO_IN_START, ICO_IN_END);
    const outAlpha = fadeOut(p, ICO_OUT_START, ICO_OUT_END);
    const alpha = Math.min(inAlpha, outAlpha);
    const scale = THREE.MathUtils.lerp(0.2, 1.1, alpha);

    clickSpinRef.current *= 0.95;

    // Cursor proximity
    const dx = _mouse.x * 3 - ICO_POSITION.x;
    const dy = _mouse.y * 2 - ICO_POSITION.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const targetProximity = _isHovering ? Math.max(0, 1 - dist * 1.5) : 0;
    proximityRef.current += (targetProximity - proximityRef.current) * 0.12;

    const targetHover = _hoveredObject === "ico" ? 1 : 0;
    hoverRef.current += (targetHover - hoverRef.current) * 0.1;

    // Rotation with floating
    const spinBoost = clickSpinRef.current;
    const floatX = Math.sin(t * 0.35) * 0.1;
    const floatY = Math.cos(t * 0.25) * 0.08;
    meshRef.current.rotation.x = t * 0.05 + spinBoost * 0.3;
    meshRef.current.rotation.y = t * 0.08 + p * Math.PI * 0.5 + spinBoost;
    meshRef.current.rotation.z = Math.sin(t * 0.06) * 0.25 + spinBoost * 0.4;
    meshRef.current.scale.setScalar(scale);
    meshRef.current.position.set(ICO_POSITION.x + floatX, ICO_POSITION.y + floatY, ICO_POSITION.z);

    // Wireframe opacity
    const wMat = meshRef.current.material as THREE.MeshBasicMaterial;
    wMat.opacity = alpha * (0.25 + proximityRef.current * 0.25 + hoverRef.current * 0.2);

    if (solidRef.current) {
      solidRef.current.rotation.copy(meshRef.current.rotation);
      solidRef.current.scale.copy(meshRef.current.scale);
      solidRef.current.position.copy(meshRef.current.position);
      const sMat = solidRef.current.material as THREE.MeshStandardMaterial;
      sMat.opacity = alpha * (0.12 + proximityRef.current * 0.2 + hoverRef.current * 0.15);
      sMat.emissiveIntensity = 0.2 + proximityRef.current * 0.8 + hoverRef.current * 0.5;
    }

    if (glowRef.current) {
      glowRef.current.rotation.copy(meshRef.current.rotation);
      glowRef.current.position.copy(meshRef.current.position);
      glowRef.current.scale.setScalar(scale * 1.2);
      const gMat = glowRef.current.material as THREE.MeshBasicMaterial;
      gMat.opacity = alpha * (proximityRef.current * 0.25 + hoverRef.current * 0.2);
    }
  });

  const onClick = useCallback(() => {
    clickSpinRef.current = 3.5;
    playIcoClick();
  }, []);

  const onPointerMoveIco = useCallback((e: { clientX: number; clientY: number; target: EventTarget }) => {
    _hoveredObject = "ico";
    onPointerMove(e);
  }, [onPointerMove]);

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[ICO_POSITION.x, ICO_POSITION.y, ICO_POSITION.z]}
        onPointerMove={onPointerMoveIco}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClick={onClick}
      >
        <icosahedronGeometry args={[0.9, 0]} />
        <meshBasicMaterial color="#8ab0ff" wireframe transparent opacity={0} />
      </mesh>
      <mesh ref={solidRef} position={[ICO_POSITION.x, ICO_POSITION.y, ICO_POSITION.z]}>
        <icosahedronGeometry args={[0.88, 0]} />
        <meshStandardMaterial
          color="#4d8dff"
          emissive="#4d8dff"
          emissiveIntensity={0.2}
          roughness={0.3}
          metalness={0.15}
          transparent
          opacity={0}
        />
      </mesh>
      <mesh ref={glowRef} position={[ICO_POSITION.x, ICO_POSITION.y, ICO_POSITION.z]}>
        <icosahedronGeometry args={[1.0, 0]} />
        <meshBasicMaterial color="#4d8dff" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Scroll-driven camera — orbits through keyframes focusing on each object.
//
// Keyframes:
//   p=0.00 → (0, 0, 5.5)      center, distant — full sphere view
//   p=0.20 → (1.8, -0.4, 4.0)  right — approaching torus
//   p=0.45 → (0.5, 0, 3.5)     center — transition zone
//   p=0.60 → (-1.5, 0.5, 3.2)  left — approaching icosahedron
//   p=0.85 → (-0.5, 0.3, 4.0)  left-center — settled on ico
//   p=1.00 → (0, 0.2, 5.0)     center — pull back for contact section
// ---------------------------------------------------------------------------

interface CamKeyframe {
  p: number;
  pos: [number, number, number];
  lookAt: [number, number, number];
}

const CAM_KEYFRAMES: CamKeyframe[] = [
  { p: 0.00, pos: [0, 0, 5.5],       lookAt: [0, 0, 0] },
  { p: 0.20, pos: [1.8, -0.4, 4.0],  lookAt: [1.0, -0.3, 0] },
  { p: 0.45, pos: [0.5, 0, 3.5],     lookAt: [0, 0, 0] },
  { p: 0.60, pos: [-1.5, 0.5, 3.2],  lookAt: [-0.8, 0.4, 0] },
  { p: 0.85, pos: [-0.5, 0.3, 4.0],  lookAt: [-0.8, 0.4, 0] },
  { p: 1.00, pos: [0, 0.2, 5.0],     lookAt: [0, 0, 0] },
];

function lerpKeyframes(keyframes: CamKeyframe[], progress: number): { pos: THREE.Vector3; lookAt: THREE.Vector3 } {
  // Find the two keyframes we're between
  let i = 0;
  for (let j = 0; j < keyframes.length - 1; j++) {
    if (progress >= keyframes[j].p && progress <= keyframes[j + 1].p) {
      i = j;
      break;
    }
  }
  if (progress >= keyframes[keyframes.length - 1].p) {
    i = keyframes.length - 2;
  }

  const k0 = keyframes[i];
  const k1 = keyframes[i + 1];
  const t = smoothstep(k0.p, k1.p, progress);

  return {
    pos: new THREE.Vector3(
      THREE.MathUtils.lerp(k0.pos[0], k1.pos[0], t),
      THREE.MathUtils.lerp(k0.pos[1], k1.pos[1], t),
      THREE.MathUtils.lerp(k0.pos[2], k1.pos[2], t),
    ),
    lookAt: new THREE.Vector3(
      THREE.MathUtils.lerp(k0.lookAt[0], k1.lookAt[0], t),
      THREE.MathUtils.lerp(k0.lookAt[1], k1.lookAt[1], t),
      THREE.MathUtils.lerp(k0.lookAt[2], k1.lookAt[2], t),
    ),
  };
}

function CameraController() {
  const camera = useThree((s) => s.camera);
  const lookTarget = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    const p = getScrollProgress();
    const { pos, lookAt } = lerpKeyframes(CAM_KEYFRAMES, p);

    // Smooth the lookAt target
    lookTarget.current.lerp(lookAt, 0.08);

    camera.position.copy(pos);
    camera.lookAt(lookTarget.current);
  });

  return null;
}

// ---------------------------------------------------------------------------
// Scene composition — bloom + vignette + chromatic aberration
// ---------------------------------------------------------------------------

const CHROMATIC_OFFSET = new THREE.Vector2(0.0012, 0.0012);

function Scene() {
  return (
    <>
      <CameraController />
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1.5} color="#4d8dff" />
      <pointLight position={[-5, -3, 4]} intensity={0.8} color="#8ab0ff" />
      <pointLight position={[0, -5, 3]} intensity={0.4} color="#ffffff" />
      <DataSphere />
      <ScrollTorus />
      <ScrollIcosahedron />
      <Particles />
      <ConnectionParticles />
      <CursorTrail />
      <CursorGlow />
      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.9} intensity={0.8} mipmapBlur />
        <ChromaticAberration offset={CHROMATIC_OFFSET} />
        <Vignette offset={0.3} darkness={0.7} />
      </EffectComposer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Hover tooltip — DOM overlay that follows the cursor when hovering 3D objects.
// ---------------------------------------------------------------------------

const TOOLTIP_LABELS: Record<string, { name: string; role: string }> = {
  sphere: { name: "AI Core", role: "Neural intelligence hub" },
  torus: { name: "DeployForge", role: "CI/CD pipeline engine" },
  ico: { name: "Synapse", role: "RAG retrieval system" },
};

function HoverTooltip() {
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState("");
  const [role, setRole] = useState("");
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const rafRef = useRef(0);

  // Poll _hoveredObject via rAF (outside R3F Canvas)
  useEffect(() => {
    const tick = () => {
      const obj = _hoveredObject;
      if (obj && obj !== _prevHoveredObject) {
        const info = TOOLTIP_LABELS[obj];
        if (info) {
          setLabel(info.name);
          setRole(info.role);
          setVisible(true);
        }
      } else if (!obj && _prevHoveredObject) {
        setVisible(false);
      }
      // Play hover sound when object changes
      if (obj && obj !== _prevHoveredObject) {
        playHoverSound(obj);
      }
      _prevHoveredObject = obj;
      setX(_screenX);
      setY(_screenY);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed z-50 flex items-center gap-2.5 rounded-lg border border-accent/30 bg-surface/90 px-3 py-2 shadow-lg backdrop-blur-md"
      style={{
        left: x + 16,
        top: y - 12,
        transform: "translateY(-100%)",
        opacity: visible ? 1 : 0,
        transition: "opacity 150ms ease-out",
      }}
    >
      <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(77,141,255,0.6)]" />
      <div className="flex flex-col">
        <span className="font-mono text-xs font-medium text-ink">{label}</span>
        <span className="font-mono text-[10px] text-ink-dim">{role}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HeroScene — Canvas + tooltip overlay
// ---------------------------------------------------------------------------

export function HeroScene() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 5.5], fov: 45 }}
        style={{ background: "transparent" }}
      >
        <Scene />
      </Canvas>
      <HoverTooltip />
    </div>
  );
}
