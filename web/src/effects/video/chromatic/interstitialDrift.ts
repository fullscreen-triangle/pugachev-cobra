import type { VideoEffect } from '../types';

// ---- InterstitialDrift --------------------------------------------------
//
// A colour effect that encodes content for a receiver that does not exist:
// a display pipeline sitting between sRGB/BT.709 (Windows default) and
// Display P3 (Apple colour-managed). Neither pipeline renders it correctly;
// neither renders it badly. It reads as subtly, intentionally off everywhere.
//
// Three coupled transforms, all parameterised by `drift` in [0, 1]:
//
// 1. GAMUT PUSH — nudges green/cyan toward the P3 primary boundary.
//    At drift=1 the greens are encoded at ~P3 saturation but tagged for
//    nothing in particular, so sRGB clips them and P3 over-delivers.
//
// 2. HIGHLIGHT ROLL-OFF — applies a log curve between gamma 2.2 and PQ.
//    The shoulder behaviour differs between pipelines; shadows open up on
//    one and close on the other.
//
// 3. WHITE POINT DRIFT — shifts the neutral axis from D65 (~6504K) toward
//    ~6000K. Apple colorsync corrects back toward D65 (content reads cool);
//    Windows typically passes through unchanged (content reads warm).
//    The same frame cannot look the same on both.
//
// The `drift` parameter is the signature dial:
//   0.0  — neutral, no effect
//   0.3  — subtle; reads as "careful grading"
//   0.6  — noticeable; the characteristic look
//   1.0  — maximum displacement; clearly intentional
//
// Named "interstitial" because the content occupies the interstitial space
// between two colour management philosophies — the gap in the decoder graph.

// ---- Colour science constants ------------------------------------------

// P3 primaries in xy chromaticity vs BT.709:
//   BT.709 green: (0.300, 0.600)
//   P3 green:     (0.265, 0.690)
// The P3 green has a higher y (more pure green). We simulate encoding
// toward P3-adjacent values by boosting the G channel relative to R,
// then pulling the B channel slightly to compensate luminance.
// This is a perceptual approximation, not a matrix transform — we don't
// have linear light here (ImageData is gamma-encoded), which is exactly
// the ambiguity both pipelines handle differently.

// White point shift D65 -> 6000K in approximate RGB terms:
// Reducing blue very slightly, warming red very slightly.
const WP_R_GAIN  =  0.012; // +1.2% red at drift=1
const WP_B_GAIN  = -0.025; // -2.5% blue at drift=1

// Gamut push: green expansion, blue pull
const GP_G_GAIN  =  0.045; // +4.5% green at drift=1
const GP_B_GAIN  = -0.018; // -1.8% blue at drift=1 (luminance compensation)
const GP_R_GAIN  = -0.008; // -0.8% red at drift=1 (cyan push)

// Highlight roll-off: the curve is a blend between gamma 2.2 decode
// and a PQ-adjacent log shape. We work in [0,1] normalised space.
// At drift=0: identity. At drift=1: maximum inter-pipeline ambiguity.
function rollOff(normalised: number, drift: number): number {
  if (normalised <= 0) return 0;
  if (normalised >= 1) return 1;
  // Log-ish shoulder starting at ~0.7 normalised
  const knee = 0.70;
  if (normalised < knee) return normalised;
  const above = (normalised - knee) / (1 - knee); // 0..1 in shoulder
  // PQ-adjacent compression: sqrt approximation
  const compressed = Math.sqrt(above);
  // Blend between identity and compressed by drift
  const shoulder = knee + (1 - knee) * (above * (1 - drift) + compressed * drift);
  return shoulder;
}

// ---- CPU transform (ImageData path) ------------------------------------

export const interstitialDrift: VideoEffect = {
  id: 'chromatic.interstitialDrift',
  namespace: 'chromatic',
  name: 'Interstitial Drift',
  description:
    'Encodes content for a colour pipeline that does not exist — ' +
    'between sRGB and Display P3. Neither Apple nor Windows renders it correctly; ' +
    'neither renders it badly. The signature look of the zero-decoder-shift tool.',
  power: 0.55,
  supports: [],
  parameters: [
    {
      name: 'drift',
      type: 'float',
      default: 0.6,
      range: [0, 1],
    },
  ],

  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const drift = Math.max(0, Math.min(1, (params?.drift as number) ?? 0.6));
    if (drift === 0) return frame;

    const d = frame.data;
    const len = d.length;

    for (let i = 0; i < len; i += 4) {
      // Linearise from gamma 2.2 (approximate)
      let r = d[i]     / 255;
      let g = d[i + 1] / 255;
      let b = d[i + 2] / 255;

      // 1. WHITE POINT DRIFT (D65 -> ~6000K shift)
      r = Math.max(0, Math.min(1, r + WP_R_GAIN * drift));
      b = Math.max(0, Math.min(1, b + WP_B_GAIN * drift));

      // 2. GAMUT PUSH (toward P3-adjacent green/cyan)
      const rNew = Math.max(0, Math.min(1, r + GP_R_GAIN * drift));
      const gNew = Math.max(0, Math.min(1, g + GP_G_GAIN * drift));
      const bNew = Math.max(0, Math.min(1, b + GP_B_GAIN * drift));
      r = rNew; g = gNew; b = bNew;

      // 3. HIGHLIGHT ROLL-OFF (log shoulder, inter-pipeline ambiguity)
      r = rollOff(r, drift);
      g = rollOff(g, drift);
      b = rollOff(b, drift);

      d[i]     = Math.round(r * 255);
      d[i + 1] = Math.round(g * 255);
      d[i + 2] = Math.round(b * 255);
      // d[i+3] alpha unchanged
    }

    return frame;
  },

  // GLSL shader path (used when VideoEffectLayer has GPU access)
  shader: /* glsl */`
    precision mediump float;
    uniform sampler2D uTexture;
    uniform float uDrift;
    varying vec2 vUv;

    float rollOff(float v) {
      float knee = 0.70;
      if (v < knee) return v;
      float above = (v - knee) / (1.0 - knee);
      float compressed = sqrt(above);
      float shoulder = knee + (1.0 - knee) * mix(above, compressed, uDrift);
      return shoulder;
    }

    void main() {
      vec4 c = texture2D(uTexture, vUv);
      float r = c.r;
      float g = c.g;
      float b = c.b;

      // 1. White point drift
      r = clamp(r + ${WP_R_GAIN.toFixed(4)} * uDrift, 0.0, 1.0);
      b = clamp(b + ${WP_B_GAIN.toFixed(4)} * uDrift, 0.0, 1.0);

      // 2. Gamut push
      r = clamp(r + ${GP_R_GAIN.toFixed(4)} * uDrift, 0.0, 1.0);
      g = clamp(g + ${GP_G_GAIN.toFixed(4)} * uDrift, 0.0, 1.0);
      b = clamp(b + ${GP_B_GAIN.toFixed(4)} * uDrift, 0.0, 1.0);

      // 3. Highlight roll-off
      r = rollOff(r);
      g = rollOff(g);
      b = rollOff(b);

      gl_FragColor = vec4(r, g, b, c.a);
    }
  `,
};
