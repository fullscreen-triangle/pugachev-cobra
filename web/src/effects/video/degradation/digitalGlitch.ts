import type { VideoEffect } from '../types';

export const digitalGlitch: VideoEffect = {
  id: 'degradation.glitch',
  namespace: 'degradation',
  name: 'Digital Glitch',
  description: 'Applies block-level pixel displacement and channel splitting to simulate digital artefacts.',
  power: 0.60,
  supports: ['chromatic.invert', 'chromatic.posterize'],
  parameters: [
    { name: 'intensity',  type: 'float', default: 0.3, range: [0, 1] },
    { name: 'blockSize',  type: 'int',   default: 16,  range: [4, 128] },
    { name: 'frequency',  type: 'float', default: 0.1, range: [0, 1] },
  ],
  shader: /* glsl */`
    precision mediump float;
    uniform sampler2D uTexture;
    uniform float uIntensity;
    uniform float uBlockSize;
    uniform float uFrequency;
    uniform float uTime;
    varying vec2 vUv;
    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(127.1, 311.7))) * 43758.5453);
    }
    void main() {
      vec2 block = floor(vUv / uBlockSize * 100.0);
      float trigger = rand(block + floor(uTime * uFrequency * 60.0));
      vec2 uv = vUv;
      if (trigger < uIntensity) {
        float shift = (rand(block) * 2.0 - 1.0) * uIntensity * 0.05;
        uv.x = fract(uv.x + shift);
      }
      vec4 c = texture2D(uTexture, uv);
      float cShift = uIntensity * 0.01;
      float r = texture2D(uTexture, vec2(uv.x + cShift, uv.y)).r;
      float b = texture2D(uTexture, vec2(uv.x - cShift, uv.y)).b;
      gl_FragColor = vec4(r, c.g, b, c.a);
    }
  `,
  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const intensity  = (params?.intensity  as number) ?? 0.3;
    const blockSize  = Math.max(4, (params?.blockSize as number) ?? 16);
    const frequency  = (params?.frequency  as number) ?? 0.1;
    const w = frame.width;
    const h = frame.height;
    const d = frame.data;
    const src = new Uint8ClampedArray(d);
    const cShiftPx = Math.round(intensity * 0.01 * w);

    for (let y = 0; y < h; y++) {
      const blockY = Math.floor(y / blockSize);
      for (let x = 0; x < w; x++) {
        const blockX = Math.floor(x / blockSize);
        const seed   = Math.sin(blockX * 127.1 + blockY * 311.7) * 43758.5453;
        const trigger = seed - Math.floor(seed);
        let sx = x;
        if (trigger < intensity) {
          const shiftSeed = Math.sin(blockX * 91.3 + blockY * 757.9) * 43758.5453;
          const shiftFrac = (shiftSeed - Math.floor(shiftSeed)) * 2 - 1;
          sx = Math.max(0, Math.min(w - 1, Math.round(x + shiftFrac * intensity * 0.05 * w)));
        }
        const si  = (y * w + sx) * 4;
        const siR = (y * w + Math.min(w - 1, sx + cShiftPx)) * 4;
        const siB = (y * w + Math.max(0, sx - cShiftPx)) * 4;
        const di  = (y * w + x) * 4;
        d[di]     = Math.max(0, Math.min(255, src[siR]));
        d[di + 1] = Math.max(0, Math.min(255, src[si + 1]));
        d[di + 2] = Math.max(0, Math.min(255, src[siB + 2]));
        d[di + 3] = src[si + 3];
      }
    }
    return frame;
  },
};
