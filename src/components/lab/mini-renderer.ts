// ---------------------------------------------------------------------------
// MiniRenderer — a hand-rolled WebGL renderer for the brain backdrop.
//
// Replaces three.js + R3F for exactly the primitives the scene draws:
//   - points with per-vertex colors, size attenuation, additive blending
//   - line segments with a flat color + opacity
//   - a single shaded sphere (the grabbed-node indicator)
// The global color grade (black/white/electric-blue) is baked directly into
// each fragment shader instead of the three.js onBeforeCompile injection.
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

const POINT_VS = /* glsl */ `
attribute vec3 position;
attribute vec3 color;
uniform mat4 uMVP;
uniform float uSize;
uniform float uPixelRatio;
varying vec3 vColor;
void main() {
  vColor = color;
  vec4 mv = uMVP * vec4(position, 1.0);
  gl_PointSize = uSize * uPixelRatio * (300.0 / -mv.w);
  gl_Position = mv;
}
`;

const POINT_FS = /* glsl */ `
precision mediump float;
varying vec3 vColor;
uniform float uOpacity;
${GRADE_FN}
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = dot(c, c);
  if (d > 0.25) discard;
  float a = smoothstep(0.25, 0.0, d);
  gl_FragColor = vec4(gradeColor(vColor), uOpacity * a);
}
`;

const LINE_VS = /* glsl */ `
attribute vec3 position;
uniform mat4 uMVP;
void main() {
  gl_Position = uMVP * vec4(position, 1.0);
}
`;

const LINE_FS = /* glsl */ `
precision mediump float;
uniform vec3 uColor;
uniform float uOpacity;
${GRADE_FN}
void main() {
  gl_FragColor = vec4(gradeColor(uColor), uOpacity);
}
`;

const SPHERE_VS = /* glsl */ `
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

const SPHERE_FS = /* glsl */ `
precision mediump float;
varying vec3 vNormal;
varying vec3 vPos;
uniform vec3 uColor;
uniform vec3 uLightDir;
uniform float uEmissive;
${GRADE_FN}
void main() {
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, normalize(uLightDir)), 0.0);
  vec3 c = uColor * (0.35 + diff * 0.75) + uColor * uEmissive;
  gl_FragColor = vec4(gradeColor(c), 1.0);
}
`;

// ---------------------------------------------------------------------------

export class MiniRenderer {
  private gl: WebGLRenderingContext;
  private canvas: HTMLCanvasElement;
  private points: { prog: WebGLProgram; attrs: AttrLocation; uni: Uniforms; buffer: WebGLBuffer; count: number };
  private lines: { prog: WebGLProgram; attrs: AttrLocation; uni: Uniforms; buffer: WebGLBuffer; count: number };
  private sphere: { prog: WebGLProgram; attrs: AttrLocation; uni: Uniforms; posBuf: WebGLBuffer; norBuf: WebGLBuffer; count: number };

  /** Perspective projection × view × model, recomputed each frame. */
  private vp = new Mat4();
  private model = new Mat4();
  private modelInv = new Mat4();
  private mvp = new Mat4();
  private lightDir = new Vec3(0.2, 0.8, 0.6).normalize();

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

    // Points program
    const pProg = link(gl, POINT_VS, POINT_FS);
    const pAttrs = getAttrs(gl, pProg, ["position", "color"]);
    const pUni = getUniforms(gl, pProg, ["uMVP", "uSize", "uPixelRatio", "uOpacity"]) as Uniforms;
    this.points = { prog: pProg, attrs: pAttrs as AttrLocation, uni: pUni, buffer: gl.createBuffer()!, count: 0 };

    // Lines program
    const lProg = link(gl, LINE_VS, LINE_FS);
    const lAttrs = getAttrs(gl, lProg, ["position"]);
    const lUni = getUniforms(gl, lProg, ["uMVP", "uColor", "uOpacity"]) as Uniforms;
    this.lines = { prog: lProg, attrs: lAttrs as AttrLocation, uni: lUni, buffer: gl.createBuffer()!, count: 0 };

    // Sphere program
    const sProg = link(gl, SPHERE_VS, SPHERE_FS);
    const sAttrs = getAttrs(gl, sProg, ["position", "normal"]);
    const sUni = getUniforms(gl, sProg, ["uMVP", "uModel", "uColor", "uLightDir", "uEmissive"]) as Uniforms;
    this.sphere = { prog: sProg, attrs: sAttrs as AttrLocation, uni: sUni, posBuf: gl.createBuffer()!, norBuf: gl.createBuffer()!, count: 0 };
  }

  setSize(width: number, height: number): void {
    this.canvas.width = Math.max(1, Math.round(width));
    this.canvas.height = Math.max(1, Math.round(height));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  // -- buffer uploads --------------------------------------------------------

  /** Uploads an interleaved [x,y,z,r,g,b] point cloud. */
  updatePoints(data: Float32Array): void {
    const gl = this.gl;
    const p = this.points;
    p.count = data.length / 6;
    gl.bindBuffer(gl.ARRAY_BUFFER, p.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  }

  /** Uploads raw [x,y,z] positions (points with a single color). */
  updatePointsPositions(data: Float32Array): void {
    const gl = this.gl;
    const p = this.points;
    p.count = data.length / 3;
    gl.bindBuffer(gl.ARRAY_BUFFER, p.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  }

  /** Uploads line segment vertices [x,y,z × 2 per segment]. */
  updateLines(data: Float32Array): void {
    const gl = this.gl;
    const l = this.lines;
    l.count = data.length / 3;
    gl.bindBuffer(gl.ARRAY_BUFFER, l.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  }

  /** Builds a unit sphere (radius 1, origin 0). Call once after construction. */
  buildSphere(segments = 16): void {
    const gl = this.gl;
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
    this.sphere.count = indices.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sphere.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sphere.norBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    this.sphereIndex = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sphereIndex);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  }

  private sphereIndex: WebGLBuffer | null = null;

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
   */
  begin(cameraPos: Vec3, lookAt: Vec3, model: Mat4): void {
    const gl = this.gl;
    // view = lookAt(cam), projection = perspective(45)
    const view = new Mat4().lookAt(cameraPos, lookAt);
    this.vp.multiplyMatrices(new Mat4().perspective(45, this.canvas.width / this.canvas.height, 0.1, 100), view);
    this.model.copy(model);
    this.mvp.multiplyMatrices(this.vp, model);
    gl.disable(gl.DEPTH_TEST);
  }

  drawPoints(attr: "xyz" | "xyzrgb", size: number, opacity: number, additive = false): void {
    const gl = this.gl;
    const p = this.points;
    if (p.count === 0) return;
    gl.useProgram(p.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, p.buffer);
    const stride = attr === "xyzrgb" ? 24 : 12;
    gl.enableVertexAttribArray(p.attrs.aPosition);
    gl.vertexAttribPointer(p.attrs.aPosition, 3, gl.FLOAT, false, stride, 0);
    if (attr === "xyzrgb") {
      gl.enableVertexAttribArray(p.attrs.aColor!);
      gl.vertexAttribPointer(p.attrs.aColor!, 3, gl.FLOAT, false, stride, 12);
    } else {
      gl.disableVertexAttribArray(p.attrs.aColor!);
      gl.vertexAttrib3f(p.attrs.aColor!, 1, 1, 1);
    }
    gl.uniformMatrix4fv(p.uni.uMVP, false, this.mvp.e);
    gl.uniform1f(p.uni.uSize!, size);
    gl.uniform1f(p.uni.uPixelRatio!, Math.min(2, this.canvas.width / (this.canvas.clientWidth || 1)));
    gl.uniform1f(p.uni.uOpacity!, opacity);
    gl.blendFunc(additive ? gl.SRC_ALPHA : gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.POINTS, 0, p.count);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  drawLines(color: [number, number, number], opacity: number): void {
    const gl = this.gl;
    const l = this.lines;
    if (l.count === 0) return;
    gl.useProgram(l.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, l.buffer);
    gl.enableVertexAttribArray(l.attrs.aPosition);
    gl.vertexAttribPointer(l.attrs.aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(l.uni.uMVP, false, this.mvp.e);
    gl.uniform3f(l.uni.uColor!, color[0], color[1], color[2]);
    gl.uniform1f(l.uni.uOpacity!, opacity);
    gl.drawArrays(gl.LINES, 0, l.count);
  }

  drawSphere(x: number, y: number, z: number, radius: number, color: [number, number, number], emissive: number): void {
    const gl = this.gl;
    const s = this.sphere;
    if (s.count === 0 || !this.sphereIndex) return;
    gl.useProgram(s.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, s.posBuf);
    gl.enableVertexAttribArray(s.attrs.aPosition);
    gl.vertexAttribPointer(s.attrs.aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, s.norBuf);
    gl.enableVertexAttribArray(s.attrs.aNormal!);
    gl.vertexAttribPointer(s.attrs.aNormal!, 3, gl.FLOAT, false, 0, 0);

    // Model matrix: translate × scale (uniform)
    const m = new Mat4();
    m.e[0] = radius; m.e[5] = radius; m.e[10] = radius;
    m.e[12] = x; m.e[13] = y; m.e[14] = z;
    gl.uniformMatrix4fv(s.uni.uModel!, false, m.e);
    gl.uniformMatrix4fv(s.uni.uMVP!, false, this.mvp.multiplyMatrices(this.vp, m).e);
    gl.uniform3f(s.uni.uColor!, color[0], color[1], color[2]);
    gl.uniform3f(s.uni.uLightDir!, this.lightDir.x, this.lightDir.y, this.lightDir.z);
    gl.uniform1f(s.uni.uEmissive!, emissive);
    gl.enable(gl.DEPTH_TEST);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sphereIndex);
    gl.drawElements(gl.TRIANGLES, s.count, gl.UNSIGNED_SHORT, 0);
    gl.disable(gl.DEPTH_TEST);
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
    // Two NDC points on the near/far plane, unprojected to world
    const nearNdc = new Vec3(ndcX, ndcY, -1).unproject(invVP);
    const farNdc = new Vec3(ndcX, ndcY, 1).unproject(invVP);
    const dir = farNdc.clone().sub(nearNdc);

    // Ray-plane intersection in world space, then into group-local space
    const t = (planeZ - nearNdc.z) / dir.z;
    if (!Number.isFinite(t)) return null;
    const hit = nearNdc.clone().addScaledVector(dir, t);
    // Group-local: inverse model applied
    return hit.applyMat4(this.modelInv.copy(this.model).invert());
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  dispose(): void {
    const gl = this.gl;
    const del = (b: WebGLBuffer | null) => b && gl.deleteBuffer(b);
    del(this.points.buffer);
    del(this.lines.buffer);
    del(this.sphere.posBuf);
    del(this.sphere.norBuf);
    del(this.sphereIndex);
    gl.deleteProgram(this.points.prog);
    gl.deleteProgram(this.lines.prog);
    gl.deleteProgram(this.sphere.prog);
  }
}
