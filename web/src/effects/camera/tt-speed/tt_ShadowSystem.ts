import type {
  TTDetectionTimeline, ShadowConfig, ShadowPhysicsFrame,
  ShadowTimeline, DEFAULT_SHADOW,
} from "../types/index.js";

// ─── Shadow extraction ────────────────────────────────────────────────────────
//
// Shadow detection strategy (fixed camera, no depth):
//   1. Isolate a search region BELOW the combined bike+rider bbox
//      (shadows fall downward on a road surface)
//   2. In that region, classify pixels as shadow if:
//        - Low luminance (dark)
//        - Low saturation (desaturated — shadows are neutral grey/blue)
//        - Spatially connected to the region beneath the bike bbox
//   3. Output: a pixel mask (Uint8ClampedArray) + tight bbox around the shadow

export interface ShadowMask {
  /** Mask data — 1 byte per pixel, 255 = shadow, 0 = not shadow */
  data:   Uint8ClampedArray;
  width:  number;
  height: number;
  /** Tight bbox of the shadow region in full-frame pixel coords */
  bbox:   { x: number; y: number; w: number; h: number } | null;
}

export interface ShadowExtractorOptions {
  /**
   * How far below the bike bbox to search for the shadow,
   * as a fraction of the bbox height. Default 0.8.
   */
  searchHeightRatio?: number;
  /**
   * How much wider than the bike bbox the search region extends on each side.
   * Default 0.3 (30% of bbox width each side).
   */
  searchWidthPad?: number;
  /** Luminance threshold 0–1 — pixels darker than this are candidates. Default 0.45 */
  lumThreshold?: number;
  /** Saturation threshold 0–1 — pixels less saturated than this are candidates. Default 0.25 */
  satThreshold?: number;
  /** Minimum shadow region area in pixels — filters noise. Default 200 */
  minArea?: number;
}

/**
 * Extract the shadow region from a single video frame.
 *
 * @param ctx    Canvas 2D context containing the current frame
 * @param bike   Combined bbox of rider+bike in pixel coords
 * @param frameW Full frame width
 * @param frameH Full frame height
 */
export function extractShadow(
  ctx:   CanvasRenderingContext2D,
  bike:  { x: number; y: number; w: number; h: number },
  frameW: number,
  frameH: number,
  opts:   ShadowExtractorOptions = {},
): ShadowMask {
  const searchH     = opts.searchHeightRatio ?? 0.8;
  const searchWPad  = opts.searchWidthPad    ?? 0.3;
  const lumThresh   = opts.lumThreshold      ?? 0.45;
  const satThresh   = opts.satThreshold      ?? 0.25;
  const minArea     = opts.minArea           ?? 200;

  // ── Define search region ──────────────────────────────────────────────────
  const pad      = bike.w * searchWPad;
  const rx       = Math.max(0, Math.floor(bike.x - pad));
  const ry       = Math.floor(bike.y + bike.h * 0.75); // start 75% down the bike
  const rw       = Math.min(frameW - rx, Math.ceil(bike.w + pad * 2));
  const rh       = Math.min(frameH - ry, Math.ceil(bike.h * searchH));

  if (rw <= 0 || rh <= 0) {
    return { data: new Uint8ClampedArray(0), width: 0, height: 0, bbox: null };
  }

  const imgData = ctx.getImageData(rx, ry, rw, rh);
  const px      = imgData.data;
  const mask    = new Uint8ClampedArray(rw * rh);

  let minMX = rw, maxMX = 0, minMY = rh, maxMY = 0;
  let count = 0;

  for (let i = 0; i < rw * rh; i++) {
    const r = px[i * 4]     / 255;
    const g = px[i * 4 + 1] / 255;
    const b = px[i * 4 + 2] / 255;

    // Luminance (perceptual)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // Saturation (HSL)
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;

    if (lum < lumThresh && sat < satThresh) {
      mask[i] = 255;
      const mx = i % rw;
      const my = Math.floor(i / rw);
      if (mx < minMX) minMX = mx;
      if (mx > maxMX) maxMX = mx;
      if (my < minMY) minMY = my;
      if (my > maxMY) maxMY = my;
      count++;
    }
  }

  // Filter out noise
  if (count < minArea) {
    return { data: mask, width: rw, height: rh, bbox: null };
  }

  // Tight bbox in full-frame coords
  const bbox = {
    x: rx + minMX,
    y: ry + minMY,
    w: maxMX - minMX,
    h: maxMY - minMY,
  };

  return { data: mask, width: rw, height: rh, bbox };
}

// ─── Shadow physics simulator ─────────────────────────────────────────────────

/**
 * Simulate the physics of a detached shadow over time.
 *
 * Before detachFrame: shadow is "attached" — rendered in place (offset = 0,0)
 * After detachFrame:  shadow separates and follows ballistic trajectory
 *
 * The shadow's render position at frame F is:
 *   originalShadowPosition + physicsFrame.offset
 */
export function simulateShadowPhysics(
  detectionTimeline: TTDetectionTimeline,
  cfg:               ShadowConfig,
  totalFrames:       number,
): ShadowTimeline {
  const timeline: ShadowTimeline = [];

  let vx      = cfg.detachVelocity.x;
  let vy      = cfg.detachVelocity.y;
  let ox      = 0;
  let oy      = 0;
  let opacity = cfg.initialOpacity;
  let scale   = 1.0;

  for (let f = 0; f < totalFrames; f++) {
    const det = detectionTimeline[Math.min(f, detectionTimeline.length - 1)];

    if (f < cfg.detachFrame) {
      // Shadow tracks the rider — no offset, full opacity
      timeline.push({
        offset:   { x: 0, y: 0 },
        opacity:  cfg.initialOpacity,
        scale:    1.0,
        maskBbox: det.combinedBbox ?? null,
      });
      continue;
    }

    if (f === cfg.detachFrame) {
      // Snapshot the shadow's bbox at detach moment
      const detachBbox = det.combinedBbox ?? null;
      timeline.push({
        offset:   { x: 0, y: 0 },
        opacity,
        scale,
        maskBbox: detachBbox,
      });
      continue;
    }

    // Physics integration (Euler)
    vy      += cfg.gravity;
    vx      *= (1 - cfg.drag);
    vy      *= (1 - cfg.drag);
    ox      += vx;
    oy      += vy;
    opacity  = Math.max(0, opacity - cfg.opacityDecay);
    scale   *= cfg.scaleDecay;

    // Use the detach frame's bbox as the frozen mask position
    const detachDet = detectionTimeline[Math.min(cfg.detachFrame, detectionTimeline.length - 1)];

    timeline.push({
      offset:   { x: ox, y: oy },
      opacity,
      scale,
      maskBbox: detachDet.combinedBbox ?? null,
    });
  }

  return timeline;
}
