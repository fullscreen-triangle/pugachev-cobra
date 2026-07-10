import type { ShadowConfig, ShadowPhysicsFrame } from "../types/index.js";

const VERT = /* glsl */ `#version 300 es
precision highp float;
in  vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Composite the shadow over the frame.
// The shadow texture is sampled at a displaced UV (the physics offset),
// then blended onto the source frame using the chosen blend mode.

const FRAG = /* glsl */ `#version 300 es
precision highp float;
in  vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_source;      // Original video frame
uniform sampler2D u_shadowMask;  // Shadow region extracted from detach frame
uniform vec2      u_maskOrigin;  // Normalised position of shadow mask top-left
uniform vec2      u_maskSize;    // Normalised size of shadow mask
uniform vec2      u_offset;      // Physics offset (normalised screen units)
uniform float     u_opacity;
uniform float     u_scale;
uniform int       u_blendMode;   // 0=normal 1=multiply 2=overlay
uniform vec3      u_tint;        // rgb tint (1,1,1 = no tint)
uniform int       u_hasTint;

vec4 src = texture(u_source, v_uv);

// Map current pixel to shadow mask UV
// The shadow is rendered at maskOrigin + offset, scaled about its centre
vec4 sampleShadow(vec2 uv) {
  vec2 centre    = u_maskOrigin + u_maskSize * 0.5 + u_offset;
  vec2 fromCentre = (uv - centre) / (u_maskSize * u_scale);
  vec2 maskUV    = fromCentre + 0.5;
  if (maskUV.x < 0.0 || maskUV.x > 1.0 || maskUV.y < 0.0 || maskUV.y > 1.0)
    return vec4(0.0);
  return texture(u_shadowMask, maskUV);
}

void main() {
  vec4 shadow = sampleShadow(v_uv);
  float alpha = shadow.r * u_opacity;  // mask stored in red channel

  if (alpha < 0.01) { fragColor = src; return; }

  // Apply tint
  vec3 shadowCol = u_hasTint == 1
    ? shadow.rgb * u_tint
    : shadow.rgb;

  // Blend modes
  vec3 blended;
  if (u_blendMode == 1) {
    // Multiply — natural shadow look
    blended = src.rgb * mix(vec3(1.0), shadowCol, alpha);
  } else if (u_blendMode == 2) {
    // Overlay
    vec3 ov = mix(2.0*src.rgb*shadowCol, 1.0-2.0*(1.0-src.rgb)*(1.0-shadowCol), step(0.5, src.rgb));
    blended = mix(src.rgb, ov, alpha);
  } else {
    // Normal
    blended = mix(src.rgb, shadowCol, alpha);
  }

  fragColor = vec4(blended, 1.0);
}
`;

const MODE: Record<string, number> = { normal: 0, multiply: 1, overlay: 2 };

export class ShadowCompositor {
  private gl:         WebGL2RenderingContext;
  private prog:       WebGLProgram;
  private vao:        WebGLVertexArrayObject;
  private sourceTex:  WebGLTexture;
  private shadowTex:  WebGLTexture;
  private locs:       Record<string, WebGLUniformLocation | null> = {};

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl        = gl;
    this.prog      = this.compile(VERT, FRAG);
    this.vao       = this.quad();
    this.sourceTex = this.tex();
    this.shadowTex = this.tex();
    this.cacheLocs([
      "u_source","u_shadowMask","u_maskOrigin","u_maskSize",
      "u_offset","u_opacity","u_scale","u_blendMode","u_tint","u_hasTint",
    ]);
  }

  /**
   * Upload the frozen shadow frame (captured at detach moment).
   * Call once at the detach frame, then reuse every subsequent frame.
   */
  uploadShadowFrame(shadowCanvas: HTMLCanvasElement): void {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, shadowCanvas);
  }

  render(
    source:     HTMLVideoElement | HTMLCanvasElement,
    physFrame:  ShadowPhysicsFrame,
    cfg:        ShadowConfig,
    frameW:     number,
    frameH:     number,
  ): void {
    const { gl } = this;
    if (!physFrame.maskBbox || physFrame.opacity < 0.01) {
      // Nothing to composite — blit source directly
      return;
    }

    gl.useProgram(this.prog);
    gl.viewport(0, 0, frameW, frameH);

    // Upload source
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.u1i("u_source", 0);
    this.u1i("u_shadowMask", 1);

    // Shadow mask geometry (normalised)
    const b = physFrame.maskBbox;
    this.u2f("u_maskOrigin", b.x / frameW, b.y / frameH);
    this.u2f("u_maskSize",   b.w / frameW, b.h / frameH);

    // Physics state
    this.u2f("u_offset",  physFrame.offset.x, physFrame.offset.y);
    this.u1f("u_opacity", physFrame.opacity);
    this.u1f("u_scale",   physFrame.scale);

    // Blend mode
    this.u1i("u_blendMode", MODE[cfg.blendMode] ?? 0);

    // Tint
    if (cfg.tint) {
      gl.uniform3f(this.locs["u_tint"]!, ...cfg.tint);
      this.u1i("u_hasTint", 1);
    } else {
      this.u1i("u_hasTint", 0);
    }

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  dispose() {
    const { gl } = this;
    gl.deleteProgram(this.prog);
    [this.sourceTex, this.shadowTex].forEach(t => gl.deleteTexture(t));
  }

  private cacheLocs(ns: string[]) {
    ns.forEach(n => { this.locs[n] = this.gl.getUniformLocation(this.prog, n); });
  }
  private u1f(n: string, v: number) { const l = this.locs[n]; if (l) this.gl.uniform1f(l, v); }
  private u1i(n: string, v: number) { const l = this.locs[n]; if (l) this.gl.uniform1i(l, v); }
  private u2f(n: string, x: number, y: number) { const l = this.locs[n]; if (l) this.gl.uniform2f(l, x, y); }

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
