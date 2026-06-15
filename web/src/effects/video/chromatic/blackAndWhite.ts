import type { VideoEffect } from '../types';

export const blackAndWhite: VideoEffect = {
  id: 'chromatic.bw',
  namespace: 'chromatic',
  name: 'Black & White',
  description: 'Converts to greyscale using Rec.709 luminosity coefficients.',
  power: 0.70,
  supports: ['temporal.vhs', 'degradation.grain', 'material.paper'],
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
      float lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
      vec3 grey = vec3(lum);
      gl_FragColor = vec4(mix(c.rgb, grey, uIntensity), c.a);
    }
  `,
  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const intensity = (params?.intensity as number) ?? 1.0;
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      d[i]     = Math.max(0, Math.min(255, d[i]     + (lum - d[i])     * intensity));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + (lum - d[i + 1]) * intensity));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + (lum - d[i + 2]) * intensity));
    }
    return frame;
  },
};
