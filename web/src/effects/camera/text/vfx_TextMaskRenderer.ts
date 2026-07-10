import type { TextMaskConfig } from "../types/index.js";

// ─── Vertex ───────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `#version 300 es
precision highp float;
in  vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// ─── Fragment ─────────────────────────────────────────────────────────────────
// u_mask: red channel = text mask (1 inside text, 0 outside)
// u_video: the main video
// u_bg: background (video, image, or nothing)
// u_mode: 0 = video_in_text, 1 = hole_in_video

const FRAG = /* glsl */ `#version 300 es
precision highp float;
in  vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_video;    // Main video
uniform sampler2D u_mask;     // Text mask (R channel = coverage)
uniform sampler2D u_bg;       // Background video/image (may be unused)
uniform vec4      u_bgColor;  // Background solid colour
uniform int       u_mode;     // 0=video_in_text, 1=hole_in_video
uniform int       u_hasBgTex; // 0/1 — whether u_bg has a texture

void main() {
  vec4  video  = texture(u_video, v_uv);
  float mask   = texture(u_mask,  v_uv).r;  // 1 = inside text

  vec4 bg = (u_hasBgTex == 1)
    ? texture(u_bg, v_uv)
    : u_bgColor;

  vec4 result;
  if (u_mode == 0) {
    // video_in_text: show video inside letters, bg outside
    result = mix(bg, video, mask);
  } else {
    // hole_in_video: show full video, cut out letters to bg
    result = mix(video, bg, mask);
  }

  fragColor = result;
}
`;

// ─── TextMaskRenderer ─────────────────────────────────────────────────────────

export class TextMaskRenderer {
  private gl:        WebGL2RenderingContext;
  private prog:      WebGLProgram;
  private vao:       WebGLVertexArrayObject;
  private videoTex:  WebGLTexture;
  private maskTex:   WebGLTexture;
  private bgTex:     WebGLTexture;
  private maskCanvas: HTMLCanvasElement;
  private maskCtx:    CanvasRenderingContext2D;
  private locs:       Record<string, WebGLUniformLocation | null> = {};

  // Cache last text config to avoid re-rasterising every frame
  private lastMaskKey = "";

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl      = gl;
    this.prog    = this.compile(VERT, FRAG);
    this.vao     = this.quad();
    this.videoTex = this.tex();
    this.maskTex  = this.tex();
    this.bgTex    = this.tex();

    // Off-screen canvas for text rasterisation
    this.maskCanvas = document.createElement("canvas");
    this.maskCanvas.width  = canvas.width;
    this.maskCanvas.height = canvas.height;
    this.maskCtx = this.maskCanvas.getContext("2d", { willReadFrequently: true })!;

    this.cacheLocs(["u_video","u_mask","u_bg","u_bgColor","u_mode","u_hasBgTex"]);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  render(
    video:   HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
    cfg:     TextMaskConfig,
    bgVideo?: HTMLVideoElement | HTMLCanvasElement | ImageBitmap | null,
  ): void {
    const { gl } = this;
    const W = gl.canvas.width;
    const H = gl.canvas.height;

    // Rasterise text mask — only when text/style config changes
    const maskKey = JSON.stringify({
      text: cfg.text, fontFamily: cfg.fontFamily, fontSize: cfg.fontSize,
      fontWeight: cfg.fontWeight, letterSpacing: cfg.letterSpacing,
      baselineY: cfg.baselineY, align: cfg.align, feather: cfg.feather,
      strokeOnly: cfg.strokeOnly, strokeWidth: cfg.strokeWidth,
    });
    if (maskKey !== this.lastMaskKey) {
      this.rasteriseMask(cfg, W, H);
      this.lastMaskKey = maskKey;
    }

    gl.useProgram(this.prog);
    gl.viewport(0, 0, W, H);

    // Upload video
    this.upload(gl.TEXTURE0, this.videoTex, video);
    this.u1i("u_video", 0);

    // Upload mask
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.maskCanvas);
    this.u1i("u_mask", 1);

    // Background
    const hasBgTex = !!(bgVideo && cfg.background.type !== "color" && cfg.background.type !== "transparent");
    this.u1i("u_hasBgTex", hasBgTex ? 1 : 0);

    if (hasBgTex && bgVideo) {
      this.upload(gl.TEXTURE2, this.bgTex, bgVideo);
      this.u1i("u_bg", 2);
    } else if (cfg.background.type === "color") {
      const c = hexToRgba(cfg.background.value);
      gl.uniform4f(this.locs["u_bgColor"]!, c[0], c[1], c[2], c[3]);
    } else {
      // transparent
      gl.uniform4f(this.locs["u_bgColor"]!, 0, 0, 0, 0);
    }

    this.u1i("u_mode", cfg.mode === "hole_in_video" ? 1 : 0);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  dispose() {
    const { gl } = this;
    gl.deleteProgram(this.prog);
    [this.videoTex, this.maskTex, this.bgTex].forEach(t => gl.deleteTexture(t));
  }

  // ── Text mask rasterisation ─────────────────────────────────────────────────
  // We render the text into a Canvas 2D element, then upload it as a texture.
  // This gives us full browser text rendering quality — proper kerning, ligatures,
  // system font rendering — without implementing it in GLSL.

  private rasteriseMask(cfg: TextMaskConfig, W: number, H: number): void {
    const ctx   = this.maskCtx;
    const fSize = H * cfg.fontSize;

    ctx.clearRect(0, 0, W, H);

    // Build font string
    const font = `${cfg.fontWeight} ${fSize}px ${cfg.fontFamily}`;
    ctx.font    = font;

    // Letter spacing via canvas letterSpacing (where supported) or manual
    if ("letterSpacing" in ctx) {
      (ctx as any).letterSpacing = `${cfg.letterSpacing * fSize}px`;
    }

    ctx.textAlign    = cfg.align;
    ctx.textBaseline = "alphabetic";

    // Compute X position from alignment
    const x = cfg.align === "center" ? W / 2
             : cfg.align === "right"  ? W - 16
             :                          16;
    const y = H * cfg.baselineY;

    // Feather: draw with blur for soft edges
    if (cfg.feather > 0) {
      ctx.shadowBlur  = cfg.feather * 2;
      ctx.shadowColor = "white";
    }

    ctx.fillStyle   = "white";
    ctx.strokeStyle = "white";
    ctx.lineWidth   = cfg.strokeWidth;

    if (cfg.strokeOnly) {
      ctx.strokeText(cfg.text, x, y);
    } else {
      ctx.fillText(cfg.text, x, y);
    }

    ctx.shadowBlur = 0;
  }

  // ── GL helpers ──────────────────────────────────────────────────────────────

  private upload(unit: number, t: WebGLTexture, src: HTMLVideoElement | HTMLCanvasElement | ImageBitmap) {
    const { gl } = this;
    gl.activeTexture(unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }

  private cacheLocs(names: string[]) {
    names.forEach(n => { this.locs[n] = this.gl.getUniformLocation(this.prog, n); });
  }

  private u1i(n: string, v: number) { const l = this.locs[n]; if (l) this.gl.uniform1i(l, v); }

  private compile(v: string, f: string): WebGLProgram {
    const { gl } = this;
    const vs = this.sh(gl.VERTEX_SHADER, v);
    const fs = this.sh(gl.FRAGMENT_SHADER, f);
    const p  = gl.createProgram()!;
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)!);
    gl.deleteShader(vs); gl.deleteShader(fs);
    return p;
  }

  private sh(type: number, src: string): WebGLShader {
    const { gl } = this;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)!);
    return s;
  }

  private quad(): WebGLVertexArrayObject {
    const { gl, prog } = this;
    const v = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  private tex(): WebGLTexture {
    const { gl } = this;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function hexToRgba(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b, 1];
}
