import type {
  BBoxPixel,
  DetectedRegion,
  PhoneRegionLabel,
} from "../types/index.js";

// ─── Geometry constants ───────────────────────────────────────────────────────
// Tuned for modern bezel-minimised phones in controlled product shots.
// Adjust these if your handset catalogue has different proportions.

const PORTRAIT = {
  screen: {
    insetXRatio: 0.055,   // side inset as fraction of body width
    insetTopRatio: 0.075, // top inset as fraction of body height
    insetBotRatio: 0.050, // bottom inset
  },
  frontCamera: {
    centerXRatio: 0.50,   // centre of punch-hole relative to body width
    centerYRatio: 0.052,  // distance from body top as fraction of body height
    radiusRatio:  0.028,  // radius as fraction of body width
  },
  rearCluster: {
    xRatio: 0.05,  // left edge relative to body xmin
    yRatio: 0.04,  // top edge relative to body ymin
    wRatio: 0.38,  // width as fraction of body width
    hRatio: 0.18,  // height as fraction of body height
  },
} as const;

const LANDSCAPE = {
  screen: {
    insetXRatio: 0.08,
    insetTopRatio: 0.05,
    insetBotRatio: 0.05,
  },
  frontCamera: {
    // Pill/notch on the right-hand short edge in landscape
    centerXRatio: 0.965,
    centerYRatio: 0.50,
    radiusRatio:  0.06, // fraction of body height in landscape
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm4(v: number, total: number) {
  return parseFloat((v / total).toFixed(4));
}

function makeBboxNorm(
  x: number,
  y: number,
  w: number,
  h: number,
  frameW: number,
  frameH: number
) {
  return {
    x: norm4(x, frameW),
    y: norm4(y, frameH),
    w: norm4(w, frameW),
    h: norm4(h, frameH),
  };
}

function roundBbox(x: number, y: number, w: number, h: number): BBoxPixel {
  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
  };
}

// ─── Derivation ───────────────────────────────────────────────────────────────

export interface RawBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

/**
 * Given a detected phone body bbox, derive screen, front-camera and
 * rear-camera-cluster regions using fixed geometry ratios.
 *
 * All coordinates are in the original frame's pixel space.
 */
export function derivePhoneParts(
  body: RawBox,
  frameW: number,
  frameH: number,
  startId: number
): DetectedRegion[] {
  const bw = body.xmax - body.xmin;
  const bh = body.ymax - body.ymin;
  const isPortrait = bh >= bw;
  const regions: DetectedRegion[] = [];
  let id = startId;

  if (isPortrait) {
    const g = PORTRAIT;

    // ── Screen ──────────────────────────────────────────────────────────────
    const sx = body.xmin + bw * g.screen.insetXRatio;
    const sy = body.ymin + bh * g.screen.insetTopRatio;
    const sw = bw * (1 - 2 * g.screen.insetXRatio);
    const sh = bh * (1 - g.screen.insetTopRatio - g.screen.insetBotRatio);

    regions.push({
      id: id++,
      label: "screen",
      confidence: 0.92,
      derived: true,
      shape: "rect",
      bbox: roundBbox(sx, sy, sw, sh),
      bbox_norm: makeBboxNorm(sx, sy, sw, sh, frameW, frameH),
      behaviour_hint: "acts_like(screen)",
    });

    // ── Front camera (punch-hole) ────────────────────────────────────────────
    const fcx = body.xmin + bw * g.frontCamera.centerXRatio;
    const fcy = body.ymin + bh * g.frontCamera.centerYRatio;
    const fcr = bw * g.frontCamera.radiusRatio;

    regions.push({
      id: id++,
      label: "front_camera",
      confidence: 0.85,
      derived: true,
      shape: "circle",
      bbox: roundBbox(fcx - fcr, fcy - fcr, fcr * 2, fcr * 2),
      bbox_norm: makeBboxNorm(fcx - fcr, fcy - fcr, fcr * 2, fcr * 2, frameW, frameH),
      behaviour_hint: "acts_like(lens)",
    });

    // ── Rear camera cluster (only visible face-down) ─────────────────────────
    const rcx = body.xmin + bw * g.rearCluster.xRatio;
    const rcy = body.ymin + bh * g.rearCluster.yRatio;
    const rcw = bw * g.rearCluster.wRatio;
    const rch = bh * g.rearCluster.hRatio;

    regions.push({
      id: id++,
      label: "rear_camera_cluster",
      confidence: 0.80,
      derived: true,
      shape: "rect",
      bbox: roundBbox(rcx, rcy, rcw, rch),
      bbox_norm: makeBboxNorm(rcx, rcy, rcw, rch, frameW, frameH),
      behaviour_hint: "acts_like(lens)",
      note: "rear cluster — estimated; only fully visible when phone is face-down",
    });
  } else {
    // Landscape orientation
    const g = LANDSCAPE;

    // ── Screen ──────────────────────────────────────────────────────────────
    const sx = body.xmin + bw * g.screen.insetXRatio;
    const sy = body.ymin + bh * g.screen.insetTopRatio;
    const sw = bw * (1 - 2 * g.screen.insetXRatio);
    const sh = bh * (1 - g.screen.insetTopRatio - g.screen.insetBotRatio);

    regions.push({
      id: id++,
      label: "screen",
      confidence: 0.90,
      derived: true,
      shape: "rect",
      bbox: roundBbox(sx, sy, sw, sh),
      bbox_norm: makeBboxNorm(sx, sy, sw, sh, frameW, frameH),
      behaviour_hint: "acts_like(screen)",
    });

    // ── Front camera (pill on short edge in landscape) ───────────────────────
    const fcx = body.xmin + bw * g.frontCamera.centerXRatio;
    const fcy = body.ymin + bh * g.frontCamera.centerYRatio;
    const fcr = bh * g.frontCamera.radiusRatio;

    regions.push({
      id: id++,
      label: "front_camera",
      confidence: 0.78,
      derived: true,
      shape: "circle",
      bbox: roundBbox(fcx - fcr, fcy - fcr, fcr * 2, fcr * 2),
      bbox_norm: makeBboxNorm(fcx - fcr, fcy - fcr, fcr * 2, fcr * 2, frameW, frameH),
      behaviour_hint: "acts_like(lens)",
    });
  }

  return regions;
}
