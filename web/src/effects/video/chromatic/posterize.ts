import type { VideoEffect } from '../types';

export const posterize: VideoEffect = {
  id: 'chromatic.posterize',
  namespace: 'chromatic',
  name: 'Posterize',
  description: 'Reduces tonal range by quantising each channel to a fixed number of levels.',
  power: 0.50,
  supports: ['chromatic.invert', 'material.screen'],
  parameters: [
    { name: 'levels', type: 'int', default: 4, range: [2, 32] },
  ],
  shader: /* glsl */`
    precision mediump float;
    uniform sampler2D uTexture;
    uniform float uLevels;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(uTexture, vUv);
      float step = 1.0 / (uLevels - 1.0);
      vec3 p = floor(c.rgb / step + 0.5) * step;
      gl_FragColor = vec4(p, c.a);
    }
  `,
  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const levels = Math.max(2, (params?.levels as number) ?? 4);
    const step = 255 / (levels - 1);
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i]     = Math.max(0, Math.min(255, Math.round(d[i]     / step) * step));
      d[i + 1] = Math.max(0, Math.min(255, Math.round(d[i + 1] / step) * step));
      d[i + 2] = Math.max(0, Math.min(255, Math.round(d[i + 2] / step) * step));
    }
    return frame;
  },
};
