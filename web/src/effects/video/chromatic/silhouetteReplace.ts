import type { VideoEffect } from '../types';

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export const silhouetteReplace: VideoEffect = {
  id: 'chromatic.silhouette',
  namespace: 'chromatic',
  name: 'Silhouette Replace',
  description: 'Replaces dark regions below a luminosity threshold with a solid colour.',
  power: 0.65,
  supports: ['chromatic.invert', 'material.paper'],
  parameters: [
    { name: 'threshold',    type: 'float', default: 0.3,        range: [0, 1] },
    { name: 'color',        type: 'color', default: '#000000' },
    { name: 'edgeSoftness', type: 'float', default: 0.05,       range: [0, 0.5] },
    { name: 'detectMethod', type: 'enum',  default: 'luminance', values: ['luminance', 'value'] },
  ],
  shader: /* glsl */`
    precision mediump float;
    uniform sampler2D uTexture;
    uniform float uThreshold;
    uniform vec3 uColor;
    uniform float uEdgeSoftness;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(uTexture, vUv);
      float lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
      float mask = smoothstep(uThreshold - uEdgeSoftness, uThreshold + uEdgeSoftness, lum);
      vec3 col = mix(uColor / 255.0, c.rgb, mask);
      gl_FragColor = vec4(col, c.a);
    }
  `,
  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const threshold    = (params?.threshold    as number) ?? 0.3;
    const colorHex     = (params?.color        as string) ?? '#000000';
    const edgeSoftness = (params?.edgeSoftness as number) ?? 0.05;
    const detectMethod = (params?.detectMethod as string) ?? 'luminance';
    const [cr, cg, cb] = hexToRgb(colorHex);
    const d = frame.data;
    const lo = threshold - edgeSoftness;
    const hi = threshold + edgeSoftness;
    for (let i = 0; i < d.length; i += 4) {
      let metric: number;
      if (detectMethod === 'value') {
        metric = Math.max(d[i], d[i + 1], d[i + 2]) / 255;
      } else {
        metric = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      }
      const range = hi - lo;
      const mask  = range <= 0 ? (metric >= threshold ? 1 : 0) : Math.max(0, Math.min(1, (metric - lo) / range));
      d[i]     = Math.max(0, Math.min(255, cr + (d[i]     - cr) * mask));
      d[i + 1] = Math.max(0, Math.min(255, cg + (d[i + 1] - cg) * mask));
      d[i + 2] = Math.max(0, Math.min(255, cb + (d[i + 2] - cb) * mask));
    }
    return frame;
  },
};
