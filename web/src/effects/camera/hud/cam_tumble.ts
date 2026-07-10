import type { TumbleConfig, TumbleFrame, TumbleTimeline } from "../types/index.js";
import type { AudioAnalysis } from "../../wrecking-ball/src/types/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hash(n: number): number {
  let x = Math.sin(n) * 43758.5453123;
  return x - Math.floor(x);
}

// Band-limited noise: sum of sines at different frequencies
function perlinLike(t: number, freq: number, seed: number): number {
  return (
    Math.sin(t * freq * 1.00 + seed * 1.3) * 0.50 +
    Math.sin(t * freq * 2.37 + seed * 2.7) * 0.25 +
    Math.sin(t * freq * 5.11 + seed * 0.9) * 0.15 +
    Math.sin(t * freq * 9.83 + seed * 4.1) * 0.10
  );
}

// ─── simulateTumble ───────────────────────────────────────────────────────────

/**
 * Simulate a camera throw + shake for every frame.
 *
 * Two layers:
 *   1. Throw arc: ballistic trajectory with drag (Euler integration)
 *   2. Shake: band-limited noise in XY + rotation
 *
 * Audio onsets inject impulses into both velocity and angular velocity.
 *
 * @param cfg         Tumble configuration
 * @param frameCount  Total number of frames to simulate
 * @param fps         Frames per second
 * @param audio       Optional AudioAnalysis — if supplied, onsets drive impulses
 */
export function simulateTumble(
  cfg:        TumbleConfig,
  frameCount: number,
  fps:        number,
  audio?:     AudioAnalysis
): TumbleTimeline {
  const twoPI    = Math.PI * 2;
  const dt       = 1 / fps;

  // Throw state
  let vx  = cfg.throwVelocity.x;
  let vy  = cfg.throwVelocity.y;
  let px  = 0;
  let py  = 0;
  let angVel  = cfg.initialSpin;
  let rotation = 0;

  const timeline: TumbleTimeline = [];

  for (let frame = 0; frame < frameCount; frame++) {
    const t  = frame / fps;
    const af = audio?.[Math.min(frame, audio.length - 1)];

    // ── Audio impulses ────────────────────────────────────────────────────
    if (af && af.onset > 0.3) {
      // Onset kicks velocity in a random direction + adds spin
      const kickAngle = hash(frame * 7.3) * twoPI;
      const kickMag   = af.onset * cfg.audioImpulseScale;
      vx    += Math.cos(kickAngle) * kickMag;
      vy    += Math.sin(kickAngle) * kickMag;
      angVel += (hash(frame * 3.1) - 0.5) * 2 * af.onset * cfg.audioSpinScale;
    }

    // Also modulate shake amplitude with RMS
    const rmsBoost = af ? 1 + af.rms * 1.5 : 1;

    // ── Throw arc (Euler) ─────────────────────────────────────────────────
    vy    += cfg.gravity;
    vx    *= (1 - cfg.drag);
    vy    *= (1 - cfg.drag);
    px    += vx;
    py    += vy;

    // ── Angular motion ────────────────────────────────────────────────────
    angVel    *= (1 - cfg.angularDrag);
    rotation  += angVel;

    // ── Shake layer (independent noise in X, Y, rot) ──────────────────────
    const shakeX   = perlinLike(t, cfg.shakeFrequency, 0.0) * cfg.shakeAmplitude * rmsBoost;
    const shakeY   = perlinLike(t, cfg.shakeFrequency, 5.7) * cfg.shakeAmplitude * rmsBoost;
    const shakeRot = perlinLike(t, cfg.shakeFrequency * 0.7, 11.3) * cfg.rotShakeAmp * rmsBoost;

    // ── Speed for motion blur ─────────────────────────────────────────────
    const speed = Math.min(1, Math.sqrt(vx*vx + vy*vy) / 0.02 + Math.abs(angVel) / 5);

    // ── Scale: slight zoom on fast movement (handheld breathing) ──────────
    const scale = 1 + speed * 0.015;

    timeline.push({
      translate: { x: px + shakeX, y: py + shakeY },
      rotation:  rotation + shakeRot,
      scale,
      speed,
    });
  }

  return timeline;
}

// ─── Preset throw profiles ────────────────────────────────────────────────────

/** Camera thrown upward, tumbles, falls */
export const THROW_UP: Partial<TumbleConfig> = {
  throwVelocity: { x: 0.003, y: -0.018 },
  initialSpin:   3.5,
  gravity:       0.001,
  drag:          0.008,
};

/** Camera dropped — falls straight down with wobble */
export const DROP: Partial<TumbleConfig> = {
  throwVelocity: { x: 0.001, y: 0.002 },
  initialSpin:   0.8,
  gravity:       0.0015,
  drag:          0.005,
};

/** Handheld walking shake — no throw, just organic movement */
export const HANDHELD: Partial<TumbleConfig> = {
  throwVelocity: { x: 0, y: 0 },
  initialSpin:   0,
  gravity:       0,
  drag:          0.15,
  angularDrag:   0.15,
  shakeAmplitude: 0.004,
  shakeFrequency: 4,
  rotShakeAmp:   0.6,
};

/** Earthquake — violent multi-axis shake, no throw */
export const EARTHQUAKE: Partial<TumbleConfig> = {
  throwVelocity: { x: 0, y: 0 },
  initialSpin:   0,
  gravity:       0,
  drag:          0.02,
  angularDrag:   0.02,
  shakeAmplitude: 0.018,
  shakeFrequency: 14,
  rotShakeAmp:   3.5,
  audioImpulseScale: 0.025,
  audioSpinScale:    6.0,
};
