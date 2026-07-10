// ─── Region labels ────────────────────────────────────────────────────────────

export type PhoneRegionLabel =
  | "phone_body"
  | "screen"
  | "front_camera"
  | "rear_camera_cluster";

export type RegionShape = "rect" | "circle";

// ─── Bounding box representations ─────────────────────────────────────────────

/** Pixel-space bounding box */
export interface BBoxPixel {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Normalised [0–1] bounding box, ready for Remotion interpolate() */
export interface BBoxNorm {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ─── Individual detected region ───────────────────────────────────────────────

export interface DetectedRegion {
  /** Stable index within this frame's manifest */
  id: number;
  label: PhoneRegionLabel;
  /** 0–1 confidence. Derived regions carry a fixed heuristic score. */
  confidence: number;
  /** true → inferred from body geometry; false → model output */
  derived: boolean;
  shape: RegionShape;
  bbox: BBoxPixel;
  bbox_norm: BBoxNorm;
  /** Optional MEE behaviour hint for downstream pipeline */
  behaviour_hint?: string;
  /** Human-readable note (e.g. "rear — only visible face-down") */
  note?: string;
}

// ─── Per-frame manifest ───────────────────────────────────────────────────────

export interface FrameManifest {
  /** Source frame dimensions in pixels */
  frame: { width: number; height: number };
  /** Frame position in the clip (null for stills) */
  timestamp_ms: number | null;
  /** All detected regions, phone bodies first then derived parts */
  regions: DetectedRegion[];
}

// ─── Detector options ─────────────────────────────────────────────────────────

export interface DetectorOptions {
  /** Detection confidence threshold 0–1. Default 0.35 */
  threshold?: number;
  /** YOLOv10 variant to use. Default "yolov10s" (best speed/accuracy tradeoff) */
  model?: "yolov10n" | "yolov10s" | "yolov10m" | "yolov10x";
  /** Quantisation dtype passed to Transformers.js. Default "q4" */
  dtype?: "fp32" | "fp16" | "q8" | "q4";
  /** Called with 0–1 progress during model download */
  onProgress?: (progress: number) => void;
}

// ─── Geometry constants ───────────────────────────────────────────────────────

/** Portrait-mode inset ratios for sub-region derivation */
export interface PhoneGeometry {
  screen: { insetX: number; insetTop: number; insetBottom: number };
  frontCamera: { centerX: number; centerY: number; radiusRatio: number };
  rearCluster: { x: number; y: number; w: number; h: number };
}
