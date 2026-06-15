import type { VideoEffect } from '../types';

export const fabricWeave: VideoEffect = {
  id: 'material.fabric',
  namespace: 'material',
  name: 'Fabric Weave',
  description: 'Overlays a woven fabric texture pattern onto the frame.',
  power: 0.45,
  supports: ['material.paper', 'degradation.grain'],
  parameters: [
    { name: 'threadDensity', type: 'int',   default: 8,    range: [2, 64] },
    { name: 'weavePattern',  type: 'enum',  default: 'plain', values: ['plain', 'twill', 'satin'] },
    { name: 'displacement',  type: 'float', default: 0.04, range: [0, 0.2] },
  ],
  shader: /* glsl */`
    precision mediump float;
    uniform sampler2D uTexture;
    uniform float uThreadDensity;
    uniform float uDisplacement;
    varying vec2 vUv;
    void main() {
      vec2 cell = fract(vUv * uThreadDensity);
      float warp = step(0.5, cell.x);
      float weft = step(0.5, cell.y);
      float over = mod(floor(vUv.x * uThreadDensity) + floor(vUv.y * uThreadDensity), 2.0);
      float pattern = over > 0.5 ? warp : weft;
      vec2 offset = vec2(pattern * uDisplacement, 0.0);
      vec4 c = texture2D(uTexture, vUv + offset);
      float shade = 0.88 + 0.12 * pattern;
      gl_FragColor = vec4(c.rgb * shade, c.a);
    }
  `,
  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const threadDensity = (params?.threadDensity as number) ?? 8;
    const displacement  = (params?.displacement  as number) ?? 0.04;
    const w = frame.width;
    const h = frame.height;
    const d = frame.data;
    const dispPx = Math.round(displacement * w);
    const src = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cellX = Math.floor(x / w * threadDensity);
        const cellY = Math.floor(y / h * threadDensity);
        const over  = (cellX + cellY) % 2;
        const fracX = (x / w * threadDensity) % 1;
        const fracY = (y / h * threadDensity) % 1;
        const warp  = fracX >= 0.5 ? 1 : 0;
        const weft  = fracY >= 0.5 ? 1 : 0;
        const pattern = over === 1 ? warp : weft;
        const shade   = 0.88 + 0.12 * pattern;
        const sx    = Math.max(0, Math.min(w - 1, x + pattern * dispPx));
        const si    = (y * w + sx) * 4;
        const di    = (y * w + x) * 4;
        d[di]     = Math.max(0, Math.min(255, src[si]     * shade));
        d[di + 1] = Math.max(0, Math.min(255, src[si + 1] * shade));
        d[di + 2] = Math.max(0, Math.min(255, src[si + 2] * shade));
        d[di + 3] = src[si + 3];
      }
    }
    return frame;
  },
};
