import type {
  TTDetectionTimeline, SpeedFrame, SpeedTimeline,
} from "../types/index.js";

// ─── Options ──────────────────────────────────────────────────────────────────

export interface SpeedEstimatorOptions {
  /**
   * Smoothing window in frames — larger = smoother but more lag.
   * Default 8.
   */
  smoothWindow?: number;
  /**
   * Minimum pixel displacement per frame to register as movement.
   * Filters out detection jitter on a stationary subject.
   * Default 0.003 (normalised).
   */
  jitterThreshold?: number;
  /**
   * If the subject is not detected in a frame, hold the last known speed
   * for this many frames before falling to zero.
   * Default 6.
   */
  holdFrames?: number;
}

// ─── estimateSpeed ────────────────────────────────────────────────────────────

/**
 * Derive a per-frame relative speed (0–100) from the detection timeline.
 *
 * Strategy:
 *   1. Compute centroid displacement between consecutive frames (raw optical proxy)
 *   2. Apply jitter filter — ignore sub-threshold micro-movements
 *   3. Smooth with a causal moving average (no future lookahead)
 *   4. Normalise to 0–100 against the global maximum (full clip calibration)
 *
 * Fixed camera assumption: background is static, so all centroid movement
 * is the subject. If the bbox disappears (subject out of frame or missed
 * detection), the last known speed is held for `holdFrames` then decays.
 */
export function estimateSpeed(
  timeline: TTDetectionTimeline,
  fps:      number,
  opts:     SpeedEstimatorOptions = {},
): SpeedTimeline {
  const smoothWindow     = opts.smoothWindow     ?? 8;
  const jitterThreshold  = opts.jitterThreshold  ?? 0.003;
  const holdFrames       = opts.holdFrames        ?? 6;

  // ── Pass 1: raw pixel velocity ─────────────────────────────────────────────
  const rawSpeeds: number[] = [];
  const rawVelocities: Array<{ x: number; y: number }> = [];
  let prevCentroid: { x: number; y: number } | null = null;
  let holdCount = 0;

  for (const det of timeline) {
    const c = det.combinedCentroid;

    if (!c) {
      // Subject not detected
      holdCount++;
      const heldSpeed = rawSpeeds.length > 0 ? rawSpeeds[rawSpeeds.length - 1] : 0;
      rawSpeeds.push(holdCount <= holdFrames ? heldSpeed * 0.9 : 0);
      rawVelocities.push({ x: 0, y: 0 });
      continue;
    }

    holdCount = 0;

    if (!prevCentroid) {
      rawSpeeds.push(0);
      rawVelocities.push({ x: 0, y: 0 });
      prevCentroid = c;
      continue;
    }

    const dx = c.x - prevCentroid.x;
    const dy = c.y - prevCentroid.y;
    const mag = Math.sqrt(dx * dx + dy * dy);

    // Jitter filter
    if (mag < jitterThreshold) {
      rawSpeeds.push(rawSpeeds[rawSpeeds.length - 1] ?? 0);
      rawVelocities.push({ x: 0, y: 0 });
    } else {
      rawSpeeds.push(mag);
      rawVelocities.push({ x: dx, y: dy });
    }

    prevCentroid = c;
  }

  // ── Pass 2: causal smoothing (moving average over past window) ─────────────
  const smoothed = rawSpeeds.map((_, i) => {
    const lo  = Math.max(0, i - smoothWindow + 1);
    const win = rawSpeeds.slice(lo, i + 1);
    return win.reduce((a, b) => a + b, 0) / win.length;
  });

  // ── Pass 3: calibrate to 0–100 ─────────────────────────────────────────────
  const maxSmoothed = Math.max(...smoothed, 1e-9);

  return timeline.map((det, i) => {
    const vel       = rawVelocities[i] ?? { x: 0, y: 0 };
    const raw       = rawSpeeds[i]     ?? 0;
    const smooth    = smoothed[i]      ?? 0;
    const relative  = (smooth / maxSmoothed) * 100;
    const direction = vel.x >= 0 ? 1 : -1;

    return {
      frame:         det.frame,
      pixelVelocity: vel,
      pixelSpeed:    raw,
      relativeSpeed: Math.round(relative * 10) / 10,
      smoothSpeed:   Math.round(relative),
      direction,
    };
  });
}

// ─── Peak speed moments ────────────────────────────────────────────────────────

/**
 * Return the N frames with the highest speed — useful for effect triggers.
 */
export function peakSpeedFrames(
  speedTimeline: SpeedTimeline,
  topN:          number = 3,
): SpeedFrame[] {
  return [...speedTimeline]
    .sort((a, b) => b.smoothSpeed - a.smoothSpeed)
    .slice(0, topN);
}
