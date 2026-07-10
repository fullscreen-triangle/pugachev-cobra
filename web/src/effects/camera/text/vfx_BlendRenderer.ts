import type { BlendConfig, BlendMode } from "../types/index.js";

// ─── Vertex shader ────────────────────────────────────────────────────────────

const VERT = /* glsl */ `#version 300 es
precision highp float;
in  vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// ─── Fragment shader ──────────────────────────────────────────────────────────

const FRAG = /* glsl */ `#version 300 es
precision highp float;
in  vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_a;          // Video A
uniform sampler2D u_b;          // Video B
uniform float     u_mix;        // 0 = full A, 1 = full B
uniform int       u_mode;       // BlendMode enum
uniform int       u_lumaKey;    // 0/1
uniform int       u_chromaKey;  // 0/1
uniform vec3      u_chromaColor;
uniform float     u_chromaTol;
uniform int       u_wipe;       // 0/1
uniform float     u_wipeAngle; // radians
uniform float     u_wipeSoft;

// ── Blend mode implementations ────────────────────────────────────────────────

vec3 blendNormal(vec3 a, vec3 b, float t)      { return mix(a, b, t); }
vec3 blendMultiply(vec3 a, vec3 b, float t)    { return mix(a, a*b, t); }
vec3 blendScreen(vec3 a, vec3 b, float t)      { return mix(a, 1.0-(1.0-a)*(1.0-b), t); }
vec3 blendAdd(vec3 a, vec3 b, float t)         { return mix(a, clamp(a+b, 0.0, 1.0), t); }
vec3 blendSubtract(vec3 a, vec3 b, float t)    { return mix(a, clamp(a-b, 0.0, 1.0), t); }
vec3 blendDifference(vec3 a, vec3 b, float t)  { return mix(a, abs(a-b), t); }
vec3 blendExclusion(vec3 a, vec3 b, float t)   { return mix(a, a+b-2.0*a*b, t); }
vec3 blendDarken(vec3 a, vec3 b, float t)      { return mix(a, min(a,b), t); }
vec3 blendLighten(vec3 a, vec3 b, float t)     { return mix(a, max(a,b), t); }

vec3 blendOverlay(vec3 a, vec3 b, float t) {
  vec3 r = mix(2.0*a*b, 1.0-2.0*(1.0-a)*(1.0-b), step(0.5, a));
  return mix(a, r, t);
}
vec3 blendHardLight(vec3 a, vec3 b, float t) {
  vec3 r = mix(2.0*a*b, 1.0-2.0*(1.0-a)*(1.0-b), step(0.5, b));
  return mix(a, r, t);
}
vec3 blendSoftLight(vec3 a, vec3 b, float t) {
  vec3 r = mix(
    a - (1.0-2.0*b)*a*(1.0-a),
    a + (2.0*b-1.0)*(sqrt(a)-a),
    step(0.5, b)
  );
  return mix(a, r, t);
}
vec3 blendColorDodge(vec3 a, vec3 b, float t) {
  vec3 r = clamp(a / max(1.0-b, 0.001), 0.0, 1.0);
  return mix(a, r, t);
}
vec3 blendColorBurn(vec3 a, vec3 b, float t) {
  vec3 r = 1.0 - clamp((1.0-a) / max(b, 0.001), 0.0, 1.0);
  return mix(a, r, t);
}

// Luminosity: luma of A, chrominance of B (in YCbCr space)
vec3 luma2rgb(float y, vec2 cbcr) {
  return clamp(vec3(
    y + 1.402*cbcr.y,
    y - 0.344*cbcr.x - 0.714*cbcr.y,
    y + 1.772*cbcr.x
  ), 0.0, 1.0);
}
vec3 blendLuminosity(vec3 a, vec3 b, float t) {
  float lumA = dot(a, vec3(0.299, 0.587, 0.114));
  float lumB = dot(b, vec3(0.299, 0.587, 0.114));
  // Keep luma of A, chroma of B
  vec2 cbcrB = vec2(
    -0.169*b.r - 0.331*b.g + 0.500*b.b,
     0.500*b.r - 0.419*b.g - 0.081*b.b
  );
  vec3 r = luma2rgb(lumA, cbcrB);
  return mix(a, r, t);
}

// ── Main ──────────────────────────────────────────────────────────────────────

void main() {
  vec4 ca = texture(u_a, v_uv);
  vec4 cb = texture(u_b, v_uv);

  // Wipe: replace uniform mix with a gradient across the frame
  float t = u_mix;
  if (u_wipe == 1) {
    vec2  dir   = vec2(cos(u_wipeAngle), sin(u_wipeAngle));
    float proj  = dot(v_uv - 0.5, dir) + 0.5;
    t = smoothstep(t - u_wipeSoft * 0.5, t + u_wipeSoft * 0.5, proj);
  }

  // Luma key: use luminance of A to set mix
  if (u_lumaKey == 1) {
    float lum = dot(ca.rgb, vec3(0.299, 0.587, 0.114));
    t = lum * u_mix; // mix modulates the key strength
  }

  // Chroma key on A: transparent where A matches the key colour
  float chromaAlpha = 1.0;
  if (u_chromaKey == 1) {
    float dist = distance(ca.rgb, u_chromaColor);
    chromaAlpha = smoothstep(u_chromaTol - 0.05, u_chromaTol + 0.05, dist);
    t = mix(1.0, t, chromaAlpha); // where A is keyed out, show full B
  }

  // Apply blend mode
  vec3 blended;
  if      (u_mode ==  0) blended = blendNormal(ca.rgb, cb.rgb, t);
  else if (u_mode ==  1) blended = blendMultiply(ca.rgb, cb.rgb, t);
  else if (u_mode ==  2) blended = blendScreen(ca.rgb, cb.rgb, t);
  else if (u_mode ==  3) blended = blendOverlay(ca.rgb, cb.rgb, t);
  else if (u_mode ==  4) blended = blendHardLight(ca.rgb, cb.rgb, t);
  else if (u_mode ==  5) blended = blendSoftLight(ca.rgb, cb.rgb, t);
  else if (u_mode ==  6) blended = blendDifference(ca.rgb, cb.rgb, t);
  else if (u_mode ==  7) blended = blendExclusion(ca.rgb, cb.rgb, t);
  else if (u_mode ==  8) blended = blendAdd(ca.rgb, cb.rgb, t);
  else if (u_mode ==  9) blended = blendSubtract(ca.rgb, cb.rgb, t);
  else if (u_mode == 10) blended = blendDarken(ca.rgb, cb.rgb, t);
  else if (u_mode == 11) blended = blendLighten(ca.rgb, cb.rgb, t);
  else if (u_mode == 12) blended = blendColorDodge(ca.rgb, cb.rgb, t);
  else if (u_mode == 13) blended = blendColorBurn(ca.rgb, cb.rgb, t);
  else                   blended = blendLuminosity(ca.rgb, cb.rgb, t);

  fragColor = vec4(blended, 1.0);
}
`;

// ─── Blend mode enum mapping ──────────────────────────────────────────────────

const MODE_INDEX: Record<BlendMode, number> = {
  normal: 0, multiply: 1, screen: 2, overlay: 3, hard_light: 4,
  soft_light: 5, difference: 6, exclusion: 7, add: 8, subtract: 9,
  darken: 10, lighten: 11, color_dodge: 12, color_burn: 13, luminosity: 14,
};

// ─── BlendRenderer ────────────────────────────────────────────────────────────

export class BlendRenderer {
  private gl:      WebGL2RenderingContext;
  private prog:    WebGLProgram;
  private vao:     WebGLVertexArrayObject;
  private texA:    WebGLTexture;
  private texB:    WebGLTexture;
  private locs:    Record<string, WebGLUniformLocation | null> = {};

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl   = gl;
    this.prog = this.compile(VERT, FRAG);
    this.vao  = this.quad();
    this.texA = this.tex();
    this.texB = this.tex();
    this.cacheLocs([
      "u_a","u_b","u_mix","u_mode","u_lumaKey","u_chromaKey",
      "u_chromaColor","u_chromaTol","u_wipe","u_wipeAngle","u_wipeSoft",
    ]);
  }

  render(
    srcA: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
    srcB: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
    cfg:  BlendConfig
  ): void {
    const { gl } = this;
    gl.useProgram(this.prog);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    this.upload(gl.TEXTURE0, this.texA, srcA);
    this.upload(gl.TEXTURE1, this.texB, srcB);
    this.u1i("u_a", 0);
    this.u1i("u_b", 1);
    this.u1f("u_mix",  cfg.mix);
    this.u1i("u_mode", MODE_INDEX[cfg.mode] ?? 0);
    this.u1i("u_lumaKey",  cfg.lumaKey  ? 1 : 0);
    this.u1i("u_chromaKey",cfg.chromaKey ? 1 : 0);
    if (cfg.chromaKey) {
      gl.uniform3f(this.locs["u_chromaColor"]!, ...cfg.chromaKey);
      this.u1f("u_chromaTol", cfg.chromaTolerance ?? 0.35);
    }
    this.u1i("u_wipe", cfg.wipe ? 1 : 0);
    if (cfg.wipe) {
      this.u1f("u_wipeAngle", (cfg.wipe.angle * Math.PI) / 180);
      this.u1f("u_wipeSoft",  cfg.wipe.softness);
    }

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  dispose() {
    const { gl } = this;
    gl.deleteProgram(this.prog);
    [this.texA, this.texB].forEach(t => gl.deleteTexture(t));
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private upload(unit: number, t: WebGLTexture, src: HTMLVideoElement | HTMLCanvasElement | ImageBitmap) {
    const { gl } = this;
    gl.activeTexture(unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }

  private cacheLocs(names: string[]) {
    names.forEach(n => { this.locs[n] = this.gl.getUniformLocation(this.prog, n); });
  }

  private u1f(n: string, v: number)  { const l = this.locs[n]; if (l) this.gl.uniform1f(l, v); }
  private u1i(n: string, v: number)  { const l = this.locs[n]; if (l) this.gl.uniform1i(l, v); }

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
    const verts = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
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
