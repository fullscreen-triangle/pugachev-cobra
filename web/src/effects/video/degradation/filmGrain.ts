import type { VideoEffect } from '../types';

export const filmGrain: VideoEffect = {
  id: 'degradation.grain',
  namespace: 'degradation',
  name: 'Film Grain',
  description: 'Adds analogue film grain noise to the frame.',
  power: 0.35,
  supports: ['chromatic.bw', 'material.paper', 'temporal.vhs'],
  parameters: [
    { name: 'intensity', type: 'float', default: 0.15, range: [0, 1] },
    { name: 'size',      type: 'float', default: 1.0,  range: [0.5, 8] },
    { name: 'colored',   type: 'bool',  default: false },
  ],
  shader: /* glsl */`
    precision mediump float;
    uniform sampler2D uTexture;
    uniform float uIntensity;
    uniform float uSize;
    uniform float uColored;
    uniform float uTime;
    varying vec2 vUv;
    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(127.1, 311.7))) * 43758.5453);
    }
    void main() {
      vec2 cell = floor(vUv / uSize * 100.0);
      vec4 c = texture2D(uTexture, vUv);
      float noise = rand(cell + uTime) * 2.0 - 1.0;
      vec3 grain;
      if (uColored > 0.5) {
        grain = vec3(
          rand(cell + vec2(uTime, 0.0)) * 2.0 - 1.0,
          rand(cell + vec2(0.0, uTime)) * 2.0 - 1.0,
          rand(cell + uTime + 0.5) * 2.0 - 1.0
        );
      } else {
        grain = vec3(noise);
      }
      gl_FragColor = vec4(clamp(c.rgb + grain * uIntensity, 0.0, 1.0), c.a);
    }
  `,
  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const intensity = (params?.intensity as number)  ?? 0.15;
    const size      = Math.max(0.5, (params?.size as number) ?? 1.0);
    const colored   = !!(params?.colored);
    const w = frame.width;
    const h = frame.height;
    const d = frame.data;
    const cellW = Math.max(1, Math.round(size));
    const scale = intensity * 255;
    for (let y = 0; y < h; y++) {
      const cy = Math.floor(y / cellW);
      for (let x = 0; x < w; x++) {
        const cx = Math.floor(x / cellW);
        const i  = (y * w + x) * 4;
        if (colored) {
          d[i]     = Math.max(0, Math.min(255, d[i]     + (Math.random() * 2 - 1) * scale));
          d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + (Math.random() * 2 - 1) * scale));
          d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + (Math.random() * 2 - 1) * scale));
        } else {
          const n = Math.sin(cx * 127.1 + cy * 311.7) * 43758.5453;
          const noise = ((n - Math.floor(n)) * 2 - 1) * scale;
          d[i]     = Math.max(0, Math.min(255, d[i]     + noise));
          d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + noise));
          d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + noise));
        }
      }
    }
    return frame;
  },
};
