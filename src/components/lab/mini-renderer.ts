// ---------------------------------------------------------------------------
// MiniRenderer — a hand-rolled WebGL renderer for the brain backdrop.
//
// Replaces three.js + R3F for exactly the primitives the scene draws:
//   - points with per-vertex colors, size attenuation, additive blending
//   - line segments with a flat color + opacity
//   - shaded meshes (position + normal) with per-instance model matrices
// The global color grade (black/white/electric-blue) is baked directly into
// each fragment shader instead of the three.js onBeforeCompile injection.
//
// The brain uses instance 0 of the points/lines/meshes arrays (the legacy
// updatePoints/drawPoints/... API); the hero layer allocates further
// instances for its particles, wireframes and solids, each drawn with its
// own model matrix.
// ---------------------------------------------------------------------------

import { Mat4, Vec3 } from "@/lib/mini-math";

export type RendererOptions = {
  canvas: HTMLCanvasElement;
  dpr: number;
};

const GRADE_FN = /* glsl */ `
vec3 gradeColor(vec3 c) {
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float warm = clamp(c.r - c.b, 0.0, 1.0);
  c = mix(c, vec3(lum), warm * 0.45);
  c = c * c * (3.0 - 2.0 * c);
  return max(c, vec3(0.0));
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("mini-renderer: createShader failed");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    throw new Error(`mini-renderer: shader compile failed: ${log}\n---\n${src}`);
  }
  return shader;
}

function link(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("mini-renderer: createProgram failed");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`mini-renderer: link failed: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

type AttrLocation = { aPosition: number; aColor?: number; aNormal?: number };
type Uniforms = {
  uMVP: WebGLUniformLocation | null;
  uModel?: WebGLUniformLocation | null;
  uOpacity?: WebGLUniformLocation | null;
  uColor?: WebGLUniformLocation | null;
  uSize?: WebGLUniformLocation | null;
  uPixelRatio?: WebGLUniformLocation | null;
  uLightDir?: WebGLUniformLocation | null;
  uEmissive?: WebGLUniformLocation | null;
  uViewPos?: WebGLUniformLocation | null;
  uRimColor?: WebGLUniformLocation | null;
  uRimPower?: WebGLUniformLocation | null;
  uRimStrength?: WebGLUniformLocation | null;
  uResolution?: WebGLUniformLocation | null;
  uTime?: WebGLUniformLocation | null;
  uStrength?: WebGLUniformLocation | null;
};

function getAttrs(gl: WebGLRenderingContext, prog: WebGLProgram, names: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of names) out[n] = gl.getAttribLocation(prog, n);
  return out;
}

function getUniforms(gl: WebGLRenderingContext, prog: WebGLProgram, names: string[]): Record<string, WebGLUniformLocation | null> {
  const out: Record<string, WebGLUniformLocation | null> = {};
  for (const n of names) out[n] = gl.getUniformLocation(prog, n);
  return out;
}

// ---------------------------------------------------------------------------
// Shaders — the grade lands last in every fragment shader.
// ---------------------------------------------------------------------------

// Atmosphere constants shared by all fragment shaders.
const FOG_NEAR = "12.0";
const FOG_FAR = "26.0";
const FOG_COLOR = "vec3(0.012, 0.02, 0.05)"; // deep space blue-black

const POINT_VS = /* glsl */ `
attribute vec3 position;
attribute vec3 color;
uniform mat4 uMVP;
uniform float uSize;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vDepth;
void main() {
  vColor = color;
  vec4 mv = uMVP * vec4(position, 1.0);
  vDepth = -mv.w;
  gl_PointSize = uSize * uPixelRatio * (300.0 / -mv.w);
  gl_Position = mv;
}
`;

const POINT_FS = /* glsl */ `
precision mediump float;
varying vec3 vColor;
varying float vDepth;
uniform vec3 uColor;
uniform float uOpacity;
${GRADE_FN}
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = dot(c, c);
  if (d > 0.25) discard;
  float a = smoothstep(0.25, 0.0, d);
  vec3 col = gradeColor(vColor * uColor);
  float fog = smoothstep(${FOG_NEAR}, ${FOG_FAR}, vDepth);
  col = mix(col, ${FOG_COLOR}, fog);
  gl_FragColor = vec4(col, uOpacity * a);
}
`;

const LINE_VS = /* glsl */ `
attribute vec3 position;
uniform mat4 uMVP;
varying float vDepth;
void main() {
  vec4 mv = uMVP * vec4(position, 1.0);
  vDepth = -mv.w;
  gl_Position = mv;
}
`;

const LINE_FS = /* glsl */ `
precision mediump float;
varying float vDepth;
uniform vec3 uColor;
uniform float uOpacity;
${GRADE_FN}
void main() {
  vec3 col = gradeColor(uColor);
  float fog = smoothstep(${FOG_NEAR}, ${FOG_FAR}, vDepth);
  col = mix(col, ${FOG_COLOR}, fog);
  gl_FragColor = vec4(col, uOpacity);
}
`;

const MESH_VS = /* glsl */ `
attribute vec3 position;
attribute vec3 normal;
uniform mat4 uMVP;
uniform mat4 uModel;
varying vec3 vNormal;
varying vec3 vPos;
void main() {
  vNormal = mat3(uModel) * normal;
  vec4 world = uModel * vec4(position, 1.0);
  vPos = world.xyz;
  gl_Position = uMVP * vec4(position, 1.0);
}
`;

const MESH_FS = /* glsl */ `
precision mediump float;
varying vec3 vNormal;
varying vec3 vPos;
uniform vec3 uColor;
uniform vec3 uLightDir;
uniform vec3 uViewPos;
uniform vec3 uRimColor;
uniform float uRimPower;
uniform float uRimStrength;
uniform float uEmissive;
uniform float uOpacity;
${GRADE_FN}
void main() {
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, normalize(uLightDir)), 0.0);
  vec3 c = uColor * (0.35 + diff * 0.75) + uColor * uEmissive;
  // Fresnel rim — electric-blue edge glow (the cinematic payoff)
  vec3 viewDir = normalize(uViewPos - vPos);
  float rim = pow(1.0 - abs(dot(n, viewDir)), uRimPower);
  c += uRimColor * rim * uRimStrength;
  // Depth fog
  float fog = smoothstep(${FOG_NEAR}, ${FOG_FAR}, length(vPos - uViewPos));
  c = mix(c, ${FOG_COLOR}, fog);
  gl_FragColor = vec4(gradeColor(c), uOpacity);
}
`;

// ---------------------------------------------------------------------------
// Background — a fullscreen quad painting a deep nebula + starfield.
// Procedural (no textures): drifting blue blobs, hash-based stars, vignette.
// ---------------------------------------------------------------------------

const BG_VS = /* glsl */ `
attribute vec2 aQuad;
varying vec2 vUv;
void main() {
  vUv = aQuad * 0.5 + 0.5;
  gl_Position = vec4(aQuad, 0.0, 1.0);
}
`;

const BG_FS = /* glsl */ `
precision mediump float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = vUv;
  vec2 asp = vec2(uResolution.x / uResolution.y, 1.0);
  vec3 col = vec3(0.006, 0.010, 0.024); // near-black blue base

  // Drifting nebula blobs
  vec2 c1 = vec2(0.5 + sin(uTime * 0.05) * 0.18, 0.42 + cos(uTime * 0.04) * 0.12);
  vec2 c2 = vec2(0.2 + cos(uTime * 0.03 + 1.7) * 0.12, 0.68 + sin(uTime * 0.045) * 0.14);
  vec2 c3 = vec2(0.82 + sin(uTime * 0.035 + 3.2) * 0.13, 0.28 + cos(uTime * 0.05 + 0.6) * 0.11);
  float d1 = length((uv - c1) * asp); col += vec3(0.09, 0.20, 0.55) * exp(-d1 * d1 * 4.5) * 0.34;
  float d2 = length((uv - c2) * asp); col += vec3(0.05, 0.11, 0.36) * exp(-d2 * d2 * 7.0) * 0.22;
  float d3 = length((uv - c3) * asp); col += vec3(0.14, 0.28, 0.60) * exp(-d3 * d3 * 6.0) * 0.16;

  // Starfield (hash grid, twinkle)
  vec2 g = uv * vec2(uResolution.x / 64.0, uResolution.y / 64.0);
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash(id);
  if (h > 0.982) {
    vec2 off = vec2(hash(id + 7.0), hash(id + 13.0)) - 0.5;
    float d = length(f - off * 0.4);
    float tw = 0.55 + 0.45 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
    float s = smoothstep(0.16, 0.0, d) * tw * (0.35 + h * 0.9);
    col += vec3(0.7, 0.85, 1.0) * s;
  }

  // Bake a soft vignette into the backdrop
  float vig = smoothstep(1.3, 0.35, length((uv - 0.5) * asp * 1.1));
  col *= mix(0.55, 1.0, vig);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Vignette overlay — a fullscreen quad drawn last, darkening the frame edges.
// ---------------------------------------------------------------------------

const VIG_FS = /* glsl */ `
precision mediump float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uStrength;
void main() {
  vec2 asp = vec2(uResolution.x / uResolution.y, 1.0);
  float d = length((vUv - 0.5) * asp * 1.15);
  float v = smoothstep(0.55, 1.05, d);
  gl_FragColor = vec4(0.0, 0.0, 0.0, v * uStrength);
}
`;

// ---------------------------------------------------------------------------

type PointsInst = { buffer: WebGLBuffer; count: number };
type LinesInst = { buffer: WebGLBuffer; count: number };
type MeshInst = { posBuf: WebGLBuffer; norBuf: WebGLBuffer; idxBuf: WebGLBuffer | null; count: number };

export class MiniRenderer {
  private gl: WebGLRenderingContext;
  private canvas: HTMLCanvasElement;

  private pProg: WebGLProgram;
  private pAttrs: AttrLocation;
  private pUni: Uniforms;
  private lProg: WebGLProgram;
  private lAttrs: AttrLocation;
  private lUni: Uniforms;
  private mProg: WebGLProgram;
  private mAttrs: AttrLocation;
  private mUni: Uniforms;
  private bgProg: WebGLProgram;
  private bgAttrs: Record<string, number>;
  private bgUni: Uniforms;
  private vigProg: WebGLProgram;
  private vigAttrs: Record<string, number>;
  private vigUni: Uniforms;
  private quadBuffer: WebGLBuffer;

  private pointsInsts: PointsInst[] = [];
  private linesInsts: LinesInst[] = [];
  private meshes: MeshInst[] = [];

  /** Perspective projection × view, recomputed each frame in begin(). */
  private vp = new Mat4();
  /** Group model matrix (from begin). Instance draws compose uMVP = vp × model. */
  private model = new Mat4();
  private modelInv = new Mat4();
  private lightDir = new Vec3(0.2, 0.8, 0.6).normalize();
  private cameraPos = new Vec3();

  constructor(opts: RendererOptions) {
    this.canvas = opts.canvas;
    const gl = opts.canvas.getContext("webgl", {
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      premultipliedAlpha: true,
    });
    if (!gl) throw new Error("mini-renderer: WebGL unavailable");
    this.gl = gl;
    gl.enable(gl.BLEND);

    this.pProg = link(gl, POINT_VS, POINT_FS);
    this.pAttrs = getAttrs(gl, this.pProg, ["position", "color"]) as AttrLocation;
    this.pUni = getUniforms(gl, this.pProg, ["uMVP", "uSize", "uPixelRatio", "uColor", "uOpacity"]) as Uniforms;

    this.lProg = link(gl, LINE_VS, LINE_FS);
    this.lAttrs = getAttrs(gl, this.lProg, ["position"]) as AttrLocation;
    this.lUni = getUniforms(gl, this.lProg, ["uMVP", "uColor", "uOpacity"]) as Uniforms;

    this.mProg = link(gl, MESH_VS, MESH_FS);
    this.mAttrs = getAttrs(gl, this.mProg, ["position", "normal"]) as AttrLocation;
    this.mUni = getUniforms(gl, this.mProg, ["uMVP", "uModel", "uColor", "uLightDir", "uViewPos", "uRimColor", "uRimPower", "uRimStrength", "uEmissive", "uOpacity"]) as Uniforms;

    // Background (nebula + stars) and vignette overlay — fullscreen quads.
    this.bgProg = link(gl, BG_VS, BG_FS);
    this.bgAttrs = getAttrs(gl, this.bgProg, ["aQuad"]);
    this.bgUni = getUniforms(gl, this.bgProg, ["uResolution", "uTime"]) as Uniforms;
    this.vigProg = link(gl, BG_VS, VIG_FS);
    this.vigAttrs = getAttrs(gl, this.vigProg, ["aQuad"]);
    this.vigUni = getUniforms(gl, this.vigProg, ["uResolution", "uStrength"]) as Uniforms;
    this.quadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  }

  setSize(width: number, height: number): void {
    this.canvas.width = Math.max(1, Math.round(width));
    this.canvas.height = Math.max(1, Math.round(height));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  // -- instance allocation ------------------------------------------------

  /** Allocates a new points buffer. `componentCount` is 6 (xyzrgb) or 3 (xyz). */
  addPointsInstance(): number {
    const id = this.pointsInsts.length;
    this.pointsInsts.push({ buffer: this.gl.createBuffer()!, count: 0 });
    return id;
  }

  /** Allocates a new line-segment buffer. */
  addLinesInstance(): number {
    const id = this.linesInsts.length;
    this.linesInsts.push({ buffer: this.gl.createBuffer()!, count: 0 });
    return id;
  }

  /** Allocates a mesh from indexed triangle geometry. Returns its instance id. */
  addMeshInstance(positions: Float32Array, normals: Float32Array, indices: Uint16Array): number {
    const gl = this.gl;
    const id = this.meshes.length;
    const posBuf = gl.createBuffer()!;
    const norBuf = gl.createBuffer()!;
    const idxBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, norBuf);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    this.meshes.push({ posBuf, norBuf, idxBuf, count: indices.length });
    return id;
  }

  // -- buffer uploads ------------------------------------------------------

  /** Uploads an interleaved [x,y,z,r,g,b] point cloud (legacy brain API). */
  updatePoints(data: Float32Array): void {
    this.updatePointsInstance(0, data, 6);
  }

  /** Uploads raw [x,y,z] positions (points with a single color) (legacy brain API). */
  updatePointsPositions(data: Float32Array): void {
    this.updatePointsInstance(0, data, 3);
  }

  /** Uploads line segment vertices [x,y,z × 2 per segment] (legacy brain API). */
  updateLines(data: Float32Array): void {
    this.updateLinesInstance(0, data);
  }

  updatePointsInstance(id: number, data: Float32Array, componentCount: number): void {
    const gl = this.gl;
    const inst = this.pointsInsts[id];
    if (!inst) return;
    inst.count = data.length / componentCount;
    gl.bindBuffer(gl.ARRAY_BUFFER, inst.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  }

  updateLinesInstance(id: number, data: Float32Array): void {
    const gl = this.gl;
    const inst = this.linesInsts[id];
    if (!inst) return;
    inst.count = data.length / 3;
    gl.bindBuffer(gl.ARRAY_BUFFER, inst.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  }

  /** Re-uploads a mesh's position buffer (for per-frame deformation). */
  updateMeshPositions(id: number, positions: Float32Array): void {
    const gl = this.gl;
    const inst = this.meshes[id];
    if (!inst) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, inst.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
  }

  /** Builds a unit sphere (radius 1, origin 0) as mesh instance 0 (legacy brain API). */
  buildSphere(segments = 16): void {
    const positions: number[] = [];
    const normals: number[] = [];
    const rings = segments;
    for (let i = 0; i <= rings; i++) {
      const phi = (i / rings) * Math.PI;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      for (let j = 0; j <= rings; j++) {
        const theta = (j / rings) * Math.PI * 2;
        const x = sinPhi * Math.cos(theta);
        const y = cosPhi;
        const z = sinPhi * Math.sin(theta);
        positions.push(x, y, z);
        normals.push(x, y, z);
      }
    }
    const indices: number[] = [];
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < rings; j++) {
        const a = i * (rings + 1) + j;
        const b = a + rings + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    // Ensure mesh 0 is the brain's sphere (allocated on first call)
    if (this.meshes.length === 0) {
      this.addMeshInstance(
        new Float32Array(positions),
        new Float32Array(normals),
        new Uint16Array(indices),
      );
    } else {
      const gl = this.gl;
      const inst = this.meshes[0];
      inst.count = indices.length;
      gl.bindBuffer(gl.ARRAY_BUFFER, inst.posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, inst.norBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, inst.idxBuf!);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    }
  }

  // -- draw ------------------------------------------------------------------

  clear(): void {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
  }

  /**
   * Sets the scene transform. `model` is the group's matrix (rotation × scale
   * × translation); `camera` position + lookAt target drive the view.
   * Instance draws compose uMVP = vp × instanceModel, so a group model can be
   * re-begun with an identity matrix to render absolute-world-space layers.
   */
  begin(cameraPos: Vec3, lookAt: Vec3, model: Mat4): void {
    const gl = this.gl;
    this.cameraPos.copy(cameraPos);
    const view = new Mat4().lookAt(cameraPos, lookAt);
    this.vp.multiplyMatrices(new Mat4().perspective(45, this.canvas.width / this.canvas.height, 0.1, 100), view);
    this.model.copy(model);
    gl.disable(gl.DEPTH_TEST);
  }

  drawPoints(attr: "xyz" | "xyzrgb", size: number, opacity: number, additive = false): void {
    this.drawPointsInstance(0, attr, size, opacity, additive, this.model);
  }

  drawPointsInstance(id: number, attr: "xyz" | "xyzrgb", size: number, opacity: number, additive: boolean, model: Mat4, color: [number, number, number] = [1, 1, 1]): void {
    const gl = this.gl;
    const inst = this.pointsInsts[id];
    if (!inst || inst.count === 0) return;
    gl.useProgram(this.pProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, inst.buffer);
    const stride = attr === "xyzrgb" ? 24 : 12;
    gl.enableVertexAttribArray(this.pAttrs.aPosition);
    gl.vertexAttribPointer(this.pAttrs.aPosition, 3, gl.FLOAT, false, stride, 0);
    if (attr === "xyzrgb") {
      gl.enableVertexAttribArray(this.pAttrs.aColor!);
      gl.vertexAttribPointer(this.pAttrs.aColor!, 3, gl.FLOAT, false, stride, 12);
    } else {
      gl.disableVertexAttribArray(this.pAttrs.aColor!);
      gl.vertexAttrib3f(this.pAttrs.aColor!, 1, 1, 1);
    }
    const mvp = this.composeMVP(model);
    gl.uniformMatrix4fv(this.pUni.uMVP, false, mvp.e);
    gl.uniform1f(this.pUni.uSize!, size);
    gl.uniform1f(this.pUni.uPixelRatio!, Math.min(2, this.canvas.width / (this.canvas.clientWidth || 1)));
    gl.uniform3f(this.pUni.uColor!, color[0], color[1], color[2]);
    gl.uniform1f(this.pUni.uOpacity!, opacity);
    gl.blendFunc(additive ? gl.SRC_ALPHA : gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.POINTS, 0, inst.count);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  drawLines(color: [number, number, number], opacity: number): void {
    this.drawLinesInstance(0, color, opacity, this.model);
  }

  drawLinesInstance(id: number, color: [number, number, number], opacity: number, model: Mat4): void {
    const gl = this.gl;
    const inst = this.linesInsts[id];
    if (!inst || inst.count === 0) return;
    gl.useProgram(this.lProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, inst.buffer);
    gl.enableVertexAttribArray(this.lAttrs.aPosition);
    gl.vertexAttribPointer(this.lAttrs.aPosition, 3, gl.FLOAT, false, 0, 0);
    const mvp = this.composeMVP(model);
    gl.uniformMatrix4fv(this.lUni.uMVP, false, mvp.e);
    gl.uniform3f(this.lUni.uColor!, color[0], color[1], color[2]);
    gl.uniform1f(this.lUni.uOpacity!, opacity);
    gl.drawArrays(gl.LINES, 0, inst.count);
  }

  drawSphere(x: number, y: number, z: number, radius: number, color: [number, number, number], emissive: number): void {
    const m = new Mat4();
    m.e[0] = radius; m.e[5] = radius; m.e[10] = radius;
    m.e[12] = x; m.e[13] = y; m.e[14] = z;
    this.drawMeshInstance(0, m, color, emissive, 1);
  }

  /**
   * Draws a shaded mesh with a full model matrix (T × R × S) and opacity.
   * `rim` adds a fresnel edge glow: [color, power, strength].
   */
  drawMeshInstance(
    id: number,
    model: Mat4,
    color: [number, number, number],
    emissive: number,
    opacity: number,
    rim?: { color: [number, number, number]; power: number; strength: number },
  ): void {
    const gl = this.gl;
    const inst = this.meshes[id];
    if (!inst || inst.count === 0 || !inst.idxBuf) return;
    gl.useProgram(this.mProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, inst.posBuf);
    gl.enableVertexAttribArray(this.mAttrs.aPosition);
    gl.vertexAttribPointer(this.mAttrs.aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, inst.norBuf);
    gl.enableVertexAttribArray(this.mAttrs.aNormal!);
    gl.vertexAttribPointer(this.mAttrs.aNormal!, 3, gl.FLOAT, false, 0, 0);

    const uModel = new Mat4().multiplyMatrices(this.model, model);
    const mvp = new Mat4().multiplyMatrices(this.vp, uModel);
    gl.uniformMatrix4fv(this.mUni.uModel!, false, uModel.e);
    gl.uniformMatrix4fv(this.mUni.uMVP!, false, mvp.e);
    gl.uniform3f(this.mUni.uColor!, color[0], color[1], color[2]);
    gl.uniform3f(this.mUni.uLightDir!, this.lightDir.x, this.lightDir.y, this.lightDir.z);
    gl.uniform3f(this.mUni.uViewPos!, this.cameraPos.x, this.cameraPos.y, this.cameraPos.z);
    if (rim) {
      gl.uniform3f(this.mUni.uRimColor!, rim.color[0], rim.color[1], rim.color[2]);
      gl.uniform1f(this.mUni.uRimPower!, rim.power);
      gl.uniform1f(this.mUni.uRimStrength!, rim.strength);
    } else {
      gl.uniform1f(this.mUni.uRimPower!, 3.0);
      gl.uniform1f(this.mUni.uRimStrength!, 0.0);
    }
    gl.uniform1f(this.mUni.uEmissive!, emissive);
    gl.uniform1f(this.mUni.uOpacity!, opacity);
    gl.enable(gl.DEPTH_TEST);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, inst.idxBuf);
    gl.drawElements(gl.TRIANGLES, inst.count, gl.UNSIGNED_SHORT, 0);
    gl.disable(gl.DEPTH_TEST);
  }

  /**
   * Paints the procedural nebula + starfield background (fullscreen quad).
   * Call once per frame, after clear() and before begin().
   */
  drawBackground(time: number): void {
    const gl = this.gl;
    gl.useProgram(this.bgProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.bgAttrs.aQuad);
    gl.vertexAttribPointer(this.bgAttrs.aQuad, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(this.bgUni.uResolution!, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.bgUni.uTime!, time);
    gl.disable(gl.DEPTH_TEST);
    // Never write depth — the quad sits at z=0 and would occlude every mesh
    gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.depthMask(true);
  }

  /** Draws a radial vignette overlay (fullscreen quad). Call last, after begin(). */
  drawVignette(strength = 0.35): void {
    const gl = this.gl;
    gl.useProgram(this.vigProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.vigAttrs.aQuad);
    gl.vertexAttribPointer(this.vigAttrs.aQuad, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(this.vigUni.uResolution!, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.vigUni.uStrength!, strength);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.depthMask(true);
  }

  private composeMVP(model: Mat4): Mat4 {
    const out = new Mat4();
    out.multiplyMatrices(this.vp, model);
    return out;
  }

  /** Projects a world-space point into NDC using the current view-projection. */
  projectToNdc(world: Vec3, model: Mat4): Vec3 {
    const mvp = new Mat4().multiplyMatrices(this.vp, model);
    return world.clone().applyMat4(mvp);
  }

  // -- picking ---------------------------------------------------------------

  /**
   * Casts a ray from the camera through NDC into the group-local z=0 plane.
   * Returns the hit point in group-local coordinates (matches the original
   * raycaster.setFromCamera + intersectPlane(z=0) behaviour), or null when the
   * ray is parallel to the plane.
   */
  rayToPlane(ndcX: number, ndcY: number, planeZ: number): Vec3 | null {
    const invVP = this.vp.clone().invert();
    const nearNdc = new Vec3(ndcX, ndcY, -1).unproject(invVP);
    const farNdc = new Vec3(ndcX, ndcY, 1).unproject(invVP);
    const dir = farNdc.clone().sub(nearNdc);

    const t = (planeZ - nearNdc.z) / dir.z;
    if (!Number.isFinite(t)) return null;
    const hit = nearNdc.clone().addScaledVector(dir, t);
    return hit.applyMat4(this.modelInv.copy(this.model).invert());
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  dispose(): void {
    const gl = this.gl;
    for (const inst of this.pointsInsts) gl.deleteBuffer(inst.buffer);
    for (const inst of this.linesInsts) gl.deleteBuffer(inst.buffer);
    for (const inst of this.meshes) {
      gl.deleteBuffer(inst.posBuf);
      gl.deleteBuffer(inst.norBuf);
      if (inst.idxBuf) gl.deleteBuffer(inst.idxBuf);
    }
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteProgram(this.pProg);
    gl.deleteProgram(this.lProg);
    gl.deleteProgram(this.mProg);
    gl.deleteProgram(this.bgProg);
    gl.deleteProgram(this.vigProg);
  }
}
