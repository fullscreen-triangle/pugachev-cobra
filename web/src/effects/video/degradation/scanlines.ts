import type { VideoEffect } from '../types';

export const scanlines: VideoEffect = {
  id: 'degradation.scanlines',
  namespace: 'degradation',
  name: 'Scanlines',
  description: 'Overlays horizontal CRT-style scanlines with optional curvature distortion.',
  power: 0.40,
  supports: ['temporal.vhs', 'degradation.grain'],
  parameters: [
    { name: 'lineCount',  type: 'int',   default: 480, range: [60, 1080] },
    { name: 'intensity',  type: 'float', default: 0.3, range: [0, 1] },
    { name: 'curvature',  type: 'float', default: 0.0, range: [0, 0.5] },
  ],
  shader: /* glsl */`
    precision mediump float;
    uniform sampler2D uTexture;
    uniform float uLineCount;
    uniform float uIntensity;
    uniform float uCurvature;
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv;
      if (uCurvature > 0.0) {
        vec2 centered = uv * 2.0 - 1.0;
        vec2 offset = centered.yx * centered.yx * uCurvature;
        uv = (centered + centered * offset) * 0.5 + 0.5;
      }
      vec4 c = texture2D(uTexture, clamp(uv, 0.0, 1.0));
      float line = mod(floor(uv.y * uLineCount), 2.0);
      float mask = 1.0 - line * uIntensity;
      gl_FragColor = vec4(c.rgb * mask, c.a);
    }
  `,
  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const lineCount = Math.max(1, (params?.lineCount as number) ?? 480);
    const intensity = (params?.intensity as number) ?? 0.3;
    const w = frame.width;
    const h = frame.height;
    const d = frame.data;
    const linesPerPx = lineCount / h;
    for (let y = 0; y < h; y++) {
      const lineIdx = Math.floor(y * linesPerPx);
      if (lineIdx % 2 === 1) {
        const fade = 1 - intensity;
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          d[i]     = Math.max(0, Math.min(255, d[i]     * fade));
          d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * fade));
          d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * fade));
        }
      }
    }
    return frame;
  },
};
