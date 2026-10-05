// Renders the scene into a low-res framebuffer, then blits it to the canvas at the
// largest integer scale (nearest filtering, letterboxed). See docs/02-rendering.md.
import { createContext, createNearestTexture, createProgram } from './gl';
import { Batcher } from './batcher';

const BLIT_VS = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const BLIT_FS = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
in vec2 v_uv;
out vec4 o;
void main() { o = vec4(texture(u_tex, v_uv).rgb, 1.0); }`;

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  readonly batcher: Batcher;
  scale = 1;
  private fbo: WebGLFramebuffer;
  private fboTex: WebGLTexture;
  private blitProg: WebGLProgram;
  private blitVao: WebGLVertexArrayObject;

  constructor(private canvas: HTMLCanvasElement, atlas: HTMLCanvasElement, readonly viewW: number, readonly viewH: number) {
    const gl = (this.gl = createContext(canvas));

    const atlasTex = createNearestTexture(gl);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);

    this.fboTex = createNearestTexture(gl);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, viewW, viewH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    this.fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.batcher = new Batcher(gl, atlasTex, viewW, viewH);
    this.blitProg = createProgram(gl, BLIT_VS, BLIT_FS);
    this.blitVao = gl.createVertexArray()!;
    this.observeSize();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  /** Exact on-screen size in device pixels, reported by the browser (avoids rounding drift at fractional dpr/zoom). */
  private devW = 0;
  private devH = 0;

  private observeSize(): void {
    try {
      const ro = new ResizeObserver((entries) => {
        const box = entries[0].devicePixelContentBoxSize?.[0];
        if (box) { this.devW = box.inlineSize; this.devH = box.blockSize; }
      });
      ro.observe(this.canvas, { box: 'device-pixel-content-box' });
    } catch { /* unsupported: fall back to clientWidth * dpr */ }
  }

  /** Match the canvas backing store to its on-screen size, 1 canvas pixel = 1 device pixel. */
  private fitCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = this.devW || Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = this.devH || Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  begin(): void {
    const gl = this.gl;
    this.batcher.resetStats();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.viewW, this.viewH);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  end(): void {
    const gl = this.gl;
    this.batcher.flush();
    this.fitCanvas();
    const cw = this.canvas.width, ch = this.canvas.height;
    this.scale = Math.max(1, Math.floor(Math.min(cw / this.viewW, ch / this.viewH)));
    const w = this.viewW * this.scale, h = this.viewH * this.scale;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(Math.floor((cw - w) / 2), Math.floor((ch - h) / 2), w, h);
    gl.disable(gl.BLEND);
    gl.useProgram(this.blitProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
    gl.bindVertexArray(this.blitVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
  }
}
