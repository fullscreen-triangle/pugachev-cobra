import type {
  DeformationConfig,
  DeformationFrame,
  RippleRing,
} from "../types/index.js";

// ─── GLSL Sources ─────────────────────────────────────────────────────────────

const VERT_SRC = /* glsl */ `#version 300 es
precision highp float;

in  vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv        = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Maximum number of concurrent ripple rings passed as uniforms.
// Increase if you need more simultaneous rings (each costs a uniform slot).
const MAX_RINGS = 8;

const FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

in  vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_source;       // Source video frame
uniform vec2  u_resolution;       // Frame resolution in pixels
uniform vec2  u_ballPos;          // Ball position, normalised [0,1]
uniform vec2  u_smearDir;         // Direction of travel, unit vector
uniform float u_intensity;        // Global intensity scalar [0,1]
uniform float u_speed;            // Ball speed [0,1]

// Layer config
uniform float u_bulgeRadius;
uniform float u_bulgeMaxDisp;
uniform float u_bulgeFalloff;

uniform float u_smearLength;
uniform float u_smearSoftness;

uniform float u_rippleThickness;

// Weights
uniform float u_wBulge;
uniform float u_wSmear;
uniform float u_wRipple;

// Ripple rings (struct-of-arrays layout for GLSL compat)
uniform int   u_ringCount;
uniform vec2  u_ringOrigins[${MAX_RINGS}];
uniform float u_ringRadii[${MAX_RINGS}];
uniform float u_ringAmplitudes[${MAX_RINGS}];

// ── Radial bulge ──────────────────────────────────────────────────────────────
vec2 bulgeDelta(vec2 uv) {
  vec2  d    = uv - u_ballPos;
  // Account for aspect ratio so circles don't stretch
  float asp  = u_resolution.x / u_resolution.y;
  d.x *= asp;
  float dist = length(d);

  if (dist >= u_bulgeRadius) return vec2(0.0);

  float t        = 1.0 - dist / u_bulgeRadius;
  float strength = pow(t, u_bulgeFalloff) * u_intensity * u_bulgeMaxDisp;
  return normalize(d) / asp * strength;
}

// ── Directional smear ─────────────────────────────────────────────────────────
vec2 smearDelta(vec2 uv) {
  vec2  d          = uv - u_ballPos;
  float asp        = u_resolution.x / u_resolution.y;
  vec2  dAsp       = vec2(d.x * asp, d.y);
  float projOnDir  = dot(dAsp, u_smearDir);

  // Only behind the ball (negative projection onto direction of travel)
  if (projOnDir < -u_smearLength || projOnDir > 0.0) return vec2(0.0);

  vec2  perp     = dAsp - projOnDir * u_smearDir;
  float perpDist = length(perp);
  float latR     = u_bulgeRadius * 0.5;
  float lateralT = 1.0 - perpDist / latR;

  if (lateralT <= 0.0) return vec2(0.0);

  float longT    = (projOnDir + u_smearLength) / u_smearLength;
  float soft     = pow(max(0.0, lateralT), 1.0 / max(u_smearSoftness, 0.01));
  float strength = soft * longT * u_speed * u_intensity * u_smearLength;

  return vec2(u_smearDir.x / asp, u_smearDir.y) * strength;
}

// ── Wave ripple ───────────────────────────────────────────────────────────────
vec2 rippleDelta(vec2 uv) {
  vec2 total = vec2(0.0);

  for (int i = 0; i < ${MAX_RINGS}; i++) {
    if (i >= u_ringCount) break;

    vec2  d      = uv - u_ringOrigins[i];
    float asp    = u_resolution.x / u_resolution.y;
    d.x         *= asp;
    float dist   = length(d);
    float delta  = abs(dist - u_ringRadii[i]);
    float half_t = u_rippleThickness * 0.5;

    if (delta > half_t || dist < 1e-5) continue;

    float t       = 1.0 - delta / half_t;
    float profile = t * t * (3.0 - 2.0 * t);  // smoothstep
    float strength = profile * u_ringAmplitudes[i];

    total += normalize(d) / asp * strength;
  }

  return total;
}

// ── Main ──────────────────────────────────────────────────────────────────────
void main() {
  vec2 bulge  = bulgeDelta(v_uv)  * u_wBulge;
  vec2 smear  = smearDelta(v_uv)  * u_wSmear;
  vec2 ripple = rippleDelta(v_uv) * u_wRipple;

  // Compose displacements (they act on different channels so additive is correct)
  vec2 totalDisp = bulge + smear + ripple;

  // Sample source at displaced UV
  vec2 sampleUV = clamp(v_uv - totalDisp, vec2(0.0), vec2(1.0));
  fragColor = texture(u_source, sampleUV);
}
`;

// ─── WebGLRenderer ────────────────────────────────────────────────────────────

export class WebGLRenderer {
  private gl:      WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao:     WebGLVertexArrayObject;
  private tex:     WebGLTexture;
  private config:  DeformationConfig;

  // Cached uniform locations
  private locs: Record<string, WebGLUniformLocation | null> = {};

  constructor(canvas: HTMLCanvasElement, config: DeformationConfig) {
    const gl = canvas.getContext("webgl2");
    if (!gl) throw new Error("WebGL2 not available");

    this.gl     = gl;
    this.config = config;
    this.program = this.compileProgram(VERT_SRC, FRAG_SRC);
    this.vao     = this.buildFullscreenQuad();
    this.tex     = this.createTexture();

    this.cacheUniformLocations();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Render one deformed frame.
   *
   * @param source   The source HTMLVideoElement or ImageBitmap
   * @param frame    Deformation parameters for this frame
   */
  renderFrame(
    source: HTMLVideoElement | ImageBitmap | HTMLCanvasElement,
    frame:  DeformationFrame
  ): void {
    const { gl, program, config } = this;

    gl.useProgram(program);

    // Upload source texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.setUniform1i("u_source", 0);

    // Resolution
    this.setUniform2f("u_resolution", gl.canvas.width, gl.canvas.height);

    // Ball position & motion
    this.setUniform2f("u_ballPos",   frame.ballPosition.x, frame.ballPosition.y);
    this.setUniform2f("u_smearDir",  frame.smearDirection.x, frame.smearDirection.y);
    this.setUniform1f("u_intensity", frame.intensity);
    this.setUniform1f("u_speed",     frame.speed);

    // Bulge config
    this.setUniform1f("u_bulgeRadius",  config.radialBulge.radius);
    this.setUniform1f("u_bulgeMaxDisp", config.radialBulge.maxDisplacement);
    this.setUniform1f("u_bulgeFalloff", config.radialBulge.falloff);

    // Smear config
    this.setUniform1f("u_smearLength",   config.directionalSmear.smearLength);
    this.setUniform1f("u_smearSoftness", config.directionalSmear.softness);

    // Ripple config
    this.setUniform1f("u_rippleThickness", config.waveRipple.thickness);

    // Layer weights (normalised)
    const tw = config.layerWeights;
    const wSum = tw.bulge + tw.smear + tw.ripple;
    this.setUniform1f("u_wBulge",  tw.bulge  / wSum);
    this.setUniform1f("u_wSmear",  tw.smear  / wSum);
    this.setUniform1f("u_wRipple", tw.ripple / wSum);

    // Ripple rings
    const rings = frame.rippleRings.slice(0, MAX_RINGS);
    this.setUniform1i("u_ringCount", rings.length);
    this.uploadRings(rings);

    // Draw
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const { gl } = this;
    gl.deleteProgram(this.program);
    gl.deleteTexture(this.tex);
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private uploadRings(rings: RippleRing[]): void {
    const { gl, locs } = this;

    const origins    = new Float32Array(MAX_RINGS * 2);
    const radii      = new Float32Array(MAX_RINGS);
    const amplitudes = new Float32Array(MAX_RINGS);

    rings.forEach((r, i) => {
      origins[i * 2]     = r.origin.x;
      origins[i * 2 + 1] = r.origin.y;
      radii[i]           = r.radius;
      amplitudes[i]      = r.amplitude;
    });

    const oLoc = gl.getUniformLocation(this.program, "u_ringOrigins");
    const rLoc = gl.getUniformLocation(this.program, "u_ringRadii");
    const aLoc = gl.getUniformLocation(this.program, "u_ringAmplitudes");

    if (oLoc) gl.uniform2fv(oLoc, origins);
    if (rLoc) gl.uniform1fv(rLoc, radii);
    if (aLoc) gl.uniform1fv(aLoc, amplitudes);
  }

  private cacheUniformLocations(): void {
    const { gl, program } = this;
    const names = [
      "u_source","u_resolution","u_ballPos","u_smearDir","u_intensity","u_speed",
      "u_bulgeRadius","u_bulgeMaxDisp","u_bulgeFalloff",
      "u_smearLength","u_smearSoftness","u_rippleThickness",
      "u_wBulge","u_wSmear","u_wRipple","u_ringCount",
    ];
    names.forEach(n => { this.locs[n] = gl.getUniformLocation(program, n); });
  }

  private setUniform1f(name: string, v: number): void {
    const loc = this.locs[name] ?? this.gl.getUniformLocation(this.program, name);
    if (loc) this.gl.uniform1f(loc, v);
  }

  private setUniform1i(name: string, v: number): void {
    const loc = this.locs[name] ?? this.gl.getUniformLocation(this.program, name);
    if (loc) this.gl.uniform1i(loc, v);
  }

  private setUniform2f(name: string, x: number, y: number): void {
    const loc = this.locs[name] ?? this.gl.getUniformLocation(this.program, name);
    if (loc) this.gl.uniform2f(loc, x, y);
  }

  private compileProgram(vert: string, frag: string): WebGLProgram {
    const { gl } = this;
    const vs = this.compileShader(gl.VERTEX_SHADER,   vert);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, frag);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Shader link error: ${gl.getProgramInfoLog(prog)}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  private compileShader(type: number, src: string): WebGLShader {
    const { gl } = this;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`);
    }
    return shader;
  }

  private buildFullscreenQuad(): WebGLVertexArrayObject {
    const { gl, program } = this;
    // Two triangles covering clip space [-1,1]²
    const verts = new Float32Array([
      -1, -1,   1, -1,  -1,  1,
      -1,  1,   1, -1,   1,  1,
    ]);
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  private createTexture(): WebGLTexture {
    const { gl } = this;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }
}

const MAX_RINGS = 8;
