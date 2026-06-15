import type { VideoEffect } from '../types';

export const halftoneScreen: VideoEffect = {
  id: 'material.screen',
  namespace: 'material',
  name: 'Halftone Screen',
  description: 'Simulates CMYK halftone dot printing with per-channel angle offsets.',
  power: 0.55,
  supports: ['chromatic.posterize', 'material.paper'],
  parameters: [
    { name: 'dotSize',   type: 'float', default: 6.0,  range: [1, 32] },
    { name: 'angle',     type: 'float', default: 45.0, range: [0, 90] },
    { name: 'sharpness', type: 'float', default: 0.8,  range: [0, 1] },
  ],
  shader: /* glsl */`
    precision mediump float;
    uniform sampler2D uTexture;
    uniform float uDotSize;
    uniform float uAngle;
    uniform float uSharpness;
    varying vec2 vUv;

    float halftone(vec2 uv, float angle, float density) {
      float rad = radians(angle);
      mat2 rot = mat2(cos(rad), -sin(rad), sin(rad), cos(rad));
      vec2 rotUv = rot * uv * density;
      vec2 cell = fract(rotUv) - 0.5;
      return length(cell);
    }

    void main() {
      vec4 c = texture2D(uTexture, vUv);
      float density = 1.0 / uDotSize * 100.0;

      float dotC = halftone(vUv, uAngle,        density);
      float dotM = halftone(vUv, uAngle + 15.0, density);
      float dotY = halftone(vUv, uAngle + 30.0, density);
      float dotK = halftone(vUv, uAngle + 45.0, density);

      float cyan    = 1.0 - c.r;
      float magenta = 1.0 - c.g;
      float yellow  = 1.0 - c.b;
      float key     = min(min(cyan, magenta), yellow);

      float tc = step(dotC,  cyan    * uSharpness * 0.5);
      float tm = step(dotM,  magenta * uSharpness * 0.5);
      float ty = step(dotY,  yellow  * uSharpness * 0.5);
      float tk = step(dotK,  key     * uSharpness * 0.5);

      vec3 rgb = vec3(
        1.0 - tc - tk,
        1.0 - tm - tk,
        1.0 - ty - tk
      );
      gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), c.a);
    }
  `,
  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const dotSize   = Math.max(1, (params?.dotSize   as number) ?? 6.0);
    const angle     = ((params?.angle     as number) ?? 45.0) * Math.PI / 180;
    const sharpness = (params?.sharpness as number) ?? 0.8;
    const w = frame.width;
    const h = frame.height;
    const d = frame.data;
    const density = 1 / dotSize;

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const angC = angle;
    const angM = angle + 15 * Math.PI / 180;
    const angY = angle + 30 * Math.PI / 180;
    const angK = angle + 45 * Math.PI / 180;

    function dotVal(nx: number, ny: number, a: number): number {
      const ca = Math.cos(a), sa = Math.sin(a);
      const rx = ca * nx * density * 100 - sa * ny * density * 100;
      const ry = sa * nx * density * 100 + ca * ny * density * 100;
      const fx = (rx % 1 + 1) % 1 - 0.5;
      const fy = (ry % 1 + 1) % 1 - 0.5;
      return Math.sqrt(fx * fx + fy * fy);
    }

    for (let y = 0; y < h; y++) {
      const ny = y / h;
      for (let x = 0; x < w; x++) {
        const nx = x / w;
        const i = (y * w + x) * 4;
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        const cyan    = 1 - r;
        const magenta = 1 - g;
        const yellow  = 1 - b;
        const key     = Math.min(cyan, magenta, yellow);
        const tc = dotVal(nx, ny, angC) < cyan    * sharpness * 0.5 ? 1 : 0;
        const tm = dotVal(nx, ny, angM) < magenta * sharpness * 0.5 ? 1 : 0;
        const ty = dotVal(nx, ny, angY) < yellow  * sharpness * 0.5 ? 1 : 0;
        const tk = dotVal(nx, ny, angK) < key     * sharpness * 0.5 ? 1 : 0;
        d[i]     = Math.max(0, Math.min(255, (1 - tc - tk) * 255));
        d[i + 1] = Math.max(0, Math.min(255, (1 - tm - tk) * 255));
        d[i + 2] = Math.max(0, Math.min(255, (1 - ty - tk) * 255));
      }
    }
    return frame;
  },
};
