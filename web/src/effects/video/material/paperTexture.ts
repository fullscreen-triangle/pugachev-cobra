import type { VideoEffect } from '../types';

function pseudoRandom(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export const paperTexture: VideoEffect = {
  id: 'material.paper',
  namespace: 'material',
  name: 'Paper Texture',
  description: 'Adds a rough paper grain texture to the frame.',
  power: 0.40,
  supports: ['chromatic.bw', 'chromatic.duotone', 'degradation.grain'],
  parameters: [
    { name: 'grainSize', type: 'float', default: 2.0, range: [0.5, 10] },
    { name: 'roughness', type: 'float', default: 0.15, range: [0, 1] },
  ],
  shader: /* glsl */`
    precision mediump float;
    uniform sampler2D uTexture;
    uniform float uGrainSize;
    uniform float uRoughness;
    varying vec2 vUv;
    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(127.1, 311.7))) * 43758.5453);
    }
    void main() {
      vec4 c = texture2D(uTexture, vUv);
      vec2 cell = floor(vUv * (1.0 / uGrainSize * 100.0));
      float noise = rand(cell) * 2.0 - 1.0;
      vec3 paper = c.rgb + noise * uRoughness;
      gl_FragColor = vec4(clamp(paper, 0.0, 1.0), c.a);
    }
  `,
  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const grainSize = (params?.grainSize as number) ?? 2.0;
    const roughness = (params?.roughness as number) ?? 0.15;
    const w = frame.width;
    const h = frame.height;
    const d = frame.data;
    const cellW = Math.max(1, Math.round(grainSize));
    const scale = roughness * 255;
    for (let y = 0; y < h; y++) {
      const cy = Math.floor(y / cellW);
      for (let x = 0; x < w; x++) {
        const cx    = Math.floor(x / cellW);
        const noise = (pseudoRandom(cx, cy) * 2 - 1) * scale;
        const i     = (y * w + x) * 4;
        d[i]     = Math.max(0, Math.min(255, d[i]     + noise));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + noise));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + noise));
      }
    }
    return frame;
  },
};
