import type { VideoEffect } from '../types';

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export const duotone: VideoEffect = {
  id: 'chromatic.duotone',
  namespace: 'chromatic',
  name: 'Duotone',
  description: 'Maps luminosity to a two-colour gradient between shadow and highlight colours.',
  power: 0.60,
  supports: ['chromatic.bw', 'material.paper'],
  parameters: [
    { name: 'shadowColor',    type: 'color',  default: '#1a1a2e' },
    { name: 'highlightColor', type: 'color',  default: '#e94560' },
    { name: 'midpoint',       type: 'float',  default: 0.5, range: [0, 1] },
  ],
  shader: /* glsl */`
    precision mediump float;
    uniform sampler2D uTexture;
    uniform vec3 uShadow;
    uniform vec3 uHighlight;
    uniform float uMidpoint;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(uTexture, vUv);
      float lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
      float t = lum / uMidpoint;
      vec3 col = mix(uShadow / 255.0, uHighlight / 255.0, clamp(t, 0.0, 1.0));
      gl_FragColor = vec4(col, c.a);
    }
  `,
  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const shadowHex    = (params?.shadowColor    as string) ?? '#1a1a2e';
    const highlightHex = (params?.highlightColor as string) ?? '#e94560';
    const midpoint     = (params?.midpoint       as number) ?? 0.5;
    const shadow    = hexToRgb(shadowHex);
    const highlight = hexToRgb(highlightHex);
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      const t = Math.max(0, Math.min(1, lum / Math.max(midpoint, 0.001)));
      d[i]     = Math.max(0, Math.min(255, shadow[0] + (highlight[0] - shadow[0]) * t));
      d[i + 1] = Math.max(0, Math.min(255, shadow[1] + (highlight[1] - shadow[1]) * t));
      d[i + 2] = Math.max(0, Math.min(255, shadow[2] + (highlight[2] - shadow[2]) * t));
    }
    return frame;
  },
};
