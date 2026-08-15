// ---------------------------------------------------------------------------
// Minimal 3D math for the custom WebGL renderer.
//
// Only what the brain scene actually needs: perspective projection, lookAt
// view matrix, matrix multiply + invert, and vec3 ops (the scene's simulation
// math is written against THREE.Vector3 / THREE.Matrix4 — this mirrors that
// tiny surface so the port reads 1:1 against the original).
// ---------------------------------------------------------------------------

export class Vec3 {
  x: number;
  y: number;
  z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x: number, y: number, z: number): Vec3 {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(v: Vec3): Vec3 {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }

  add(v: Vec3): Vec3 {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  sub(v: Vec3): Vec3 {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  addScaledVector(v: Vec3, s: number): Vec3 {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }

  multiplyScalar(s: number): Vec3 {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  length(): number {
    return Math.sqrt(this.lengthSq());
  }

  distanceTo(v: Vec3): number {
    return Math.sqrt(this.distanceToSquared(v));
  }

  distanceToSquared(v: Vec3): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }

  normalize(): Vec3 {
    const len = this.length();
    if (len > 0) {
      this.x /= len;
      this.y /= len;
      this.z /= len;
    }
    return this;
  }

  lerp(v: Vec3, alpha: number): Vec3 {
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }

  lerpVectors(a: Vec3, b: Vec3, alpha: number): Vec3 {
    this.x = a.x + (b.x - a.x) * alpha;
    this.y = a.y + (b.y - a.y) * alpha;
    this.z = a.z + (b.z - a.z) * alpha;
    return this;
  }

  /** Transforms this point by a 4x4 matrix (w = 1). */
  applyMat4(m: Mat4): Vec3 {
    const x = this.x;
    const y = this.y;
    const z = this.z;
    const e = m.e;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  }

  /** Transforms this direction by a 4x4 matrix (w = 0). */
  applyMat4Dir(m: Mat4): Vec3 {
    const x = this.x;
    const y = this.y;
    const z = this.z;
    const e = m.e;
    this.x = e[0] * x + e[4] * y + e[8] * z;
    this.y = e[1] * x + e[5] * y + e[9] * z;
    this.z = e[2] * x + e[6] * y + e[10] * z;
    return this;
  }

  /** Projects into NDC using the given view-projection matrix. */
  project(mvp: Mat4): Vec3 {
    return this.applyMat4(mvp);
  }

  /** Projects a NDC point back into a world point at the camera plane z=0. */
  unproject(mvpInverse: Mat4): Vec3 {
    return this.applyMat4(mvpInverse);
  }

  dot(v: Vec3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v: Vec3): Vec3 {
    const x = this.y * v.z - this.z * v.y;
    const y = this.z * v.x - this.x * v.z;
    const z = this.x * v.y - this.y * v.x;
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}

export class Mat4 {
  /** Column-major 16 floats, matching WebGL / three.js layout. */
  e: Float32Array;

  constructor() {
    this.e = new Float32Array(16);
    this.identity();
  }

  identity(): Mat4 {
    const e = this.e;
    e.fill(0);
    e[0] = e[5] = e[10] = e[15] = 1;
    return this;
  }

  copy(m: Mat4): Mat4 {
    this.e.set(m.e);
    return this;
  }

  clone(): Mat4 {
    return new Mat4().copy(this);
  }

  multiplyMatrices(a: Mat4, b: Mat4): Mat4 {
    const ae = a.e;
    const be = b.e;
    const e = this.e;
    for (let c = 0; c < 4; c++) {
      const c0 = c * 4;
      for (let r = 0; r < 4; r++) {
        e[c0 + r] =
          ae[r] * be[c0] + ae[r + 4] * be[c0 + 1] + ae[r + 8] * be[c0 + 2] + ae[r + 12] * be[c0 + 3];
      }
    }
    return this;
  }

  /** this = a * b (a applied first, matching three.js semantics). */
  compose(a: Mat4, b: Mat4): Mat4 {
    return this.multiplyMatrices(a, b);
  }

  perspective(fovYDeg: number, aspect: number, near: number, far: number): Mat4 {
    const e = this.e;
    const f = 1 / Math.tan((fovYDeg * Math.PI) / 360);
    e.fill(0);
    e[0] = f / aspect;
    e[5] = f;
    e[10] = (far + near) / (near - far);
    e[11] = -1;
    e[14] = (2 * far * near) / (near - far);
    return this;
  }

  /** View matrix: camera at eye, looking at target, up = (0,1,0). */
  lookAt(eye: Vec3, target: Vec3, up = new Vec3(0, 1, 0)): Mat4 {
    const z = eye.clone().sub(target).normalize();
    const x = up.clone().cross(z).normalize();
    const y = z.clone().cross(x);

    const e = this.e;
    e[0] = x.x;
    e[1] = y.x;
    e[2] = z.x;
    e[3] = 0;
    e[4] = x.y;
    e[5] = y.y;
    e[6] = z.y;
    e[7] = 0;
    e[8] = x.z;
    e[9] = y.z;
    e[10] = z.z;
    e[11] = 0;
    e[12] = -x.dot(eye);
    e[13] = -y.dot(eye);
    e[14] = -z.dot(eye);
    e[15] = 1;
    return this;
  }

  /**
   * Inverse via Gauss-Jordan on a copy. The matrix is stored column-major
   * (element at row `r`, column `c` lives at `e[c*4+r]`), so the augmented
   * elimination indexes by column first.
   */
  invert(): Mat4 {
    const m = this.e;
    // Augmented [A | I]: 8 columns of 4 elements, column-major per matrix.
    const inv = new Float32Array(32);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        inv[c * 4 + r] = m[c * 4 + r];
      }
      inv[(4 + c) * 4 + c] = 1;
    }

    for (let col = 0; col < 4; col++) {
      // Find pivot row (largest |value| in this column)
      let pivot = col;
      for (let row = col + 1; row < 4; row++) {
        if (Math.abs(inv[col * 4 + row]) > Math.abs(inv[col * 4 + pivot])) pivot = row;
      }
      if (Math.abs(inv[col * 4 + pivot]) < 1e-12) {
        // Singular — bail to identity (shouldn't happen with a real transform)
        return this.identity();
      }
      if (pivot !== col) {
        // Swap rows across all 8 augmented columns
        for (let c = 0; c < 8; c++) {
          const tmp = inv[c * 4 + col];
          inv[c * 4 + col] = inv[c * 4 + pivot];
          inv[c * 4 + pivot] = tmp;
        }
      }
      // Normalize the pivot row
      const d = inv[col * 4 + col];
      for (let c = 0; c < 8; c++) inv[c * 4 + col] /= d;
      // Eliminate this column from all other rows
      for (let row = 0; row < 4; row++) {
        if (row === col) continue;
        const f = inv[col * 4 + row];
        if (f === 0) continue;
        for (let c = 0; c < 8; c++) inv[c * 4 + row] -= f * inv[c * 4 + col];
      }
    }

    // Extract the right half (columns 4..7) into this matrix
    const e = this.e;
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        e[c * 4 + r] = inv[(4 + c) * 4 + r];
      }
    }
    return this;
  }

  /** Extracts the position (translation) column. */
  getPosition(): Vec3 {
    return new Vec3(this.e[12], this.e[13], this.e[14]);
  }
}
