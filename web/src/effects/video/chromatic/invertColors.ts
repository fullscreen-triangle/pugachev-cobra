import type { VideoEffect } from '../types';

export const invertColors: VideoEffect = {
  id: 'chromatic.invert',
  namespace: 'chromatic',
  name: 'Invert Colors',
  description: 'Inverts all RGB channel values.',
  power: 0.55,
  supports: ['chromatic.posterize', 'degradation.glitch'],
  parameters: [
    { name: 'intensity', type: 'float', default: 1.0, range: [0, 1] },
  ],
  shader: /* glsl */`
    precision mediump float;
    uniform sampler2D uTexture;
    uniform float uIntensity;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(uTexture, vUv);
      vec3 inv = 1.0 - c.rgb;
      gl_FragColor = vec4(mix(c.rgb, inv, uIntensity), c.a);
    }
  `,
  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const intensity = (params?.intensity as number) ?? 1.0;
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i]     = Math.max(0, Math.min(255, d[i]     + (255 - d[i]     - d[i])     * intensity));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + (255 - d[i + 1] - d[i + 1]) * intensity));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + (255 - d[i + 2] - d[i + 2]) * intensity));
    }
    return frame;
  },
};
