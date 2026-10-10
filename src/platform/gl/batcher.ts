// Instanced sprite batcher: one draw call per flush, 44 bytes per sprite.
import { createProgram } from './gl';

export interface Frame {
  u0: number; v0: number; u1: number; v1: number;
  w: number; h: number;
  /** Rows to sink it below the ground line it is anchored to: its feet stand above the cell's bottom edge (grounded enemies). */
  drop?: number;
}

const VS = `#version 300 es
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_rect;   // x, y, w, h in view pixels
layout(location=2) in vec4 a_uv;     // u0, v0, u1, v1
layout(location=3) in vec4 a_tint;
layout(location=4) in float a_flash;
layout(location=5) in float a_rot;   // radians, about the sprite centre
uniform vec2 u_view;
out vec2 v_uv;
out vec4 v_tint;
out float v_flash;
void main() {
  vec2 h = a_rect.zw * 0.5;
  vec2 q = (a_corner - 0.5) * a_rect.zw;
  float c = cos(a_rot), s = sin(a_rot);
  vec2 p = a_rect.xy + h + vec2(q.x * c - q.y * s, q.x * s + q.y * c);
  gl_Position = vec4(p.x / u_view.x * 2.0 - 1.0, 1.0 - p.y / u_view.y * 2.0, 0.0, 1.0);
  v_uv = mix(a_uv.xy, a_uv.zw, a_corner);
  v_tint = a_tint;
  v_flash = a_flash;
}`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
in vec2 v_uv;
in vec4 v_tint;
in float v_flash;
out vec4 o;
void main() {
  vec4 c = texture(u_tex, v_uv);
  if (c.a < 0.01) discard;
  c *= v_tint;
  c.rgb = v_flash < 0.0 ? v_tint.rgb : mix(c.rgb, vec3(1.0), v_flash); // flash -1: a flat silhouette in the tint colour
  o = c;
}`;

const FLOATS = 11;
const MAX_SPRITES = 16384;

export class Batcher {
  private data = new Float32Array(MAX_SPRITES * FLOATS);
  private u32 = new Uint32Array(this.data.buffer);
  private n = 0;
  private prog: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private buf: WebGLBuffer;
  private viewLoc: WebGLUniformLocation;
  drawCalls = 0;
  sprites = 0;
  /** Totals for the previous completed frame (the HUD draws before the final flush). */
  lastDrawCalls = 0;
  lastSprites = 0;

  constructor(private gl: WebGL2RenderingContext, private tex: WebGLTexture, private viewW: number, private viewH: number) {
    this.prog = createProgram(gl, VS, FS);
    this.viewLoc = gl.getUniformLocation(this.prog, 'u_view')!;
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);

    const corners = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const stride = FLOATS * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, stride, 32);
    gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 36);
    gl.vertexAttribDivisor(4, 1);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, stride, 40);
    gl.vertexAttribDivisor(5, 1);
    gl.bindVertexArray(null);
  }

  resetStats(): void {
    this.lastDrawCalls = this.drawCalls;
    this.lastSprites = this.sprites;
    this.drawCalls = 0;
    this.sprites = 0;
  }

  /** Draw a frame with its top-left at integer view pixel (x, y). tint is 0xAABBGGRR. */
  draw(f: Frame, x: number, y: number, flip = false, tint = 0xffffffff, flash = 0, rot = 0): void {
    if (this.n === MAX_SPRITES) this.flush();
    const o = this.n * FLOATS;
    const d = this.data;
    d[o] = Math.round(x);
    d[o + 1] = Math.round(y);
    d[o + 2] = f.w;
    d[o + 3] = f.h;
    d[o + 4] = flip ? f.u1 : f.u0;
    d[o + 5] = f.v0;
    d[o + 6] = flip ? f.u0 : f.u1;
    d[o + 7] = f.v1;
    this.u32[o + 8] = tint;
    d[o + 9] = flash;
    d[o + 10] = rot;
    this.n++;
  }

  /** Draw a frame stretched to w x h (used for solid rects via the 1x1 white pixel). */
  drawScaled(f: Frame, x: number, y: number, w: number, h: number, tint = 0xffffffff, flip = false, flash = 0, rot = 0): void {
    if (this.n === MAX_SPRITES) this.flush();
    const o = this.n * FLOATS;
    const d = this.data;
    d[o] = Math.round(x);
    d[o + 1] = Math.round(y);
    d[o + 2] = w;
    d[o + 3] = h;
    d[o + 4] = flip ? f.u1 : f.u0;
    d[o + 5] = f.v0;
    d[o + 6] = flip ? f.u0 : f.u1;
    d[o + 7] = f.v1;
    this.u32[o + 8] = tint;
    d[o + 9] = flash;
    d[o + 10] = rot;
    this.n++;
  }

  /**
   * Clip everything drawn until clearClip() to the view-space rectangle [x0,x1) x [y0,y1).
   * Used to make enemies rise over the horizon or from behind a foreground ridge: the sprite is simply
   * cut off at the line. Flushes the pending batch first, so clip passes should be kept few.
   */
  setClip(x0: number, y0: number, x1: number, y1: number): void {
    this.flush();
    const gl = this.gl;
    gl.enable(gl.SCISSOR_TEST);
    // framebuffer coordinates start at the bottom-left; view coordinates start at the top-left
    gl.scissor(Math.max(0, x0), Math.max(0, this.viewH - y1), Math.max(0, x1 - x0), Math.max(0, y1 - y0));
  }

  clearClip(): void {
    this.flush();
    this.gl.disable(this.gl.SCISSOR_TEST);
  }

  flush(): void {
    if (this.n === 0) return;
    const gl = this.gl;
    gl.useProgram(this.prog);
    gl.uniform2f(this.viewLoc, this.viewW, this.viewH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.n * FLOATS);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n);
    gl.bindVertexArray(null);
    this.drawCalls++;
    this.sprites += this.n;
    this.n = 0;
  }
}

/** Pack RGBA (0-255) into the 0xAABBGGRR layout the batcher expects. */
export function rgba(r: number, g: number, b: number, a = 255): number {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/** 0xRRGGBB -> batcher color with optional alpha (0-1). */
export function hex(rgb: number, alpha = 1): number {
  return rgba((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, Math.round(alpha * 255));
}
