import type { VideoEffect } from '../types';

export const vhsTape: VideoEffect = {
  id: 'temporal.vhs',
  namespace: 'temporal',
  name: 'VHS Tape',
  description: 'Simulates VHS tape degradation: tracking error, chroma bleed, and tape-age luma noise.',
  power: 0.65,
  supports: ['degradation.grain', 'degradation.scanlines', 'chromatic.bw'],
  parameters: [
    { name: 'trackingError', type: 'float', default: 0.02, range: [0, 0.2] },
    { name: 'chromaBleed',   type: 'float', default: 0.3,  range: [0, 1] },
    { name: 'tapeAge',       type: 'float', default: 0.4,  range: [0, 1] },
  ],
  shader: /* glsl */`
    precision mediump float;
    uniform sampler2D uTexture;
    uniform float uTrackingError;
    uniform float uChromaBleed;
    uniform float uTapeAge;
    uniform float uTime;
    varying vec2 vUv;
    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(127.1, 311.7))) * 43758.5453);
    }
    void main() {
      float rowNoise = rand(vec2(vUv.y * 100.0, uTime)) * 2.0 - 1.0;
      float shift = rowNoise * uTrackingError;
      vec2 uv = vec2(fract(vUv.x + shift), vUv.y);
      vec4 c = texture2D(uTexture, uv);
      float bleedOffset = uChromaBleed * 0.02;
      vec4 bleedR = texture2D(uTexture, vec2(uv.x + bleedOffset, uv.y));
      vec4 bleedB = texture2D(uTexture, vec2(uv.x - bleedOffset, uv.y));
      c.r = mix(c.r, bleedR.r, uChromaBleed * 0.5);
      c.b = mix(c.b, bleedB.b, uChromaBleed * 0.5);
      float ageLuma = rand(vUv + uTime) * uTapeAge * 0.1;
      c.rgb += ageLuma;
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
    }
  `,
  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const trackingError = (params?.trackingError as number) ?? 0.02;
    const chromaBleed   = (params?.chromaBleed   as number) ?? 0.3;
    const tapeAge       = (params?.tapeAge       as number) ?? 0.4;
    const w = frame.width;
    const h = frame.height;
    const d = frame.data;
    const src = new Uint8ClampedArray(d);

    const seed = Date.now() % 10000;

    for (let y = 0; y < h; y++) {
      const rowRand = Math.sin(y * 127.1 + seed * 311.7) * 43758.5453;
      const rowNoise = (rowRand - Math.floor(rowRand)) * 2 - 1;
      const shiftPx  = Math.round(rowNoise * trackingError * w);
      const bleedPx  = Math.round(chromaBleed * 0.02 * w);

      for (let x = 0; x < w; x++) {
        const sx  = Math.max(0, Math.min(w - 1, x + shiftPx));
        const si  = (y * w + sx) * 4;
        const di  = (y * w + x) * 4;

        const bleedRx = Math.max(0, Math.min(w - 1, sx + bleedPx));
        const bleedBx = Math.max(0, Math.min(w - 1, sx - bleedPx));
        const siBR = (y * w + bleedRx) * 4;
        const siBB = (y * w + bleedBx) * 4;

        const ageLuma = (Math.random() * tapeAge * 0.1) * 255;

        d[di]     = Math.max(0, Math.min(255, src[si] * (1 - chromaBleed * 0.5) + src[siBR] * chromaBleed * 0.5 + ageLuma));
        d[di + 1] = Math.max(0, Math.min(255, src[si + 1] + ageLuma));
        d[di + 2] = Math.max(0, Math.min(255, src[si + 2] * (1 - chromaBleed * 0.5) + src[siBB + 2] * chromaBleed * 0.5 + ageLuma));
        d[di + 3] = src[si + 3];
      }
    }
    return frame;
  },
};
