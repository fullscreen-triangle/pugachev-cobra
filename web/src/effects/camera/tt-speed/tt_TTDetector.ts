import type {
  TTRegion, TTFrameDetection, TTDetectionTimeline, TTLabel,
} from "../types/index.js";

// COCO classes we care about
const TARGET_LABELS = new Set(["person", "motorcycle"]);

// ─── TTDetector ───────────────────────────────────────────────────────────────

export class TTDetector {
  private pipeline: any = null;
  private threshold: number;
  private onProgress?: (p: number) => void;

  constructor(opts: { threshold?: number; onProgress?: (p: number) => void } = {}) {
    this.threshold  = opts.threshold  ?? 0.35;
    this.onProgress = opts.onProgress;
  }

  async load(): Promise<void> {
    if (this.pipeline) return;
    const { pipeline, env } = await import(
      "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0/dist/transformers.min.js"
    );
    env.allowLocalModels = false;
    this.pipeline = await pipeline("object-detection", "onnx-community/yolov10s", {
      dtype: "q4",
      progress_callback: (p: any) => {
        if (p.status === "progress" && p.total)
          this.onProgress?.(p.loaded / p.total);
      },
    });
  }

  // ── Single frame ────────────────────────────────────────────────────────────

  async detectFrame(
    source:  HTMLVideoElement | HTMLCanvasElement | string,
    frameN:  number,
    fps:     number,
    frameW:  number,
    frameH:  number,
  ): Promise<TTFrameDetection> {
    await this.load();

    const raw: any[] = await this.pipeline(source, {
      threshold:  this.threshold,
      percentage: false,
    });

    const relevant = raw.filter(r => TARGET_LABELS.has(r.label));
    const regions: TTRegion[] = relevant.map((r, i) => {
      const bw = r.box.xmax - r.box.xmin;
      const bh = r.box.ymax - r.box.ymin;
      return {
        id:         i,
        label:      r.label === "motorcycle" ? "bike" : "rider" as TTLabel,
        confidence: parseFloat(r.score.toFixed(3)),
        bbox:       { x: Math.round(r.box.xmin), y: Math.round(r.box.ymin), w: Math.round(bw), h: Math.round(bh) },
        bbox_norm:  {
          x: r.box.xmin / frameW, y: r.box.ymin / frameH,
          w: bw / frameW,         h: bh / frameH,
        },
        centroid: {
          x: (r.box.xmin + bw / 2) / frameW,
          y: (r.box.ymin + bh / 2) / frameH,
        },
      };
    });

    // Merge all detected regions into one combined bbox
    const combinedBbox = regions.length > 0 ? mergeBboxes(regions.map(r => r.bbox)) : null;
    const combinedCentroid = combinedBbox
      ? { x: (combinedBbox.x + combinedBbox.w / 2) / frameW,
          y: (combinedBbox.y + combinedBbox.h / 2) / frameH }
      : null;

    return {
      frame:            frameN,
      timestamp_ms:     (frameN / fps) * 1000,
      regions,
      combinedBbox,
      combinedCentroid,
    };
  }

  // ── Full clip pre-pass ──────────────────────────────────────────────────────

  /**
   * Detect every Nth frame from a video element.
   * Returns a full timeline ready for speed estimation and shadow extraction.
   */
  async detectClip(
    video:        HTMLVideoElement,
    fps:          number,
    sampleEvery:  number = 1,
    onFrame?:     (frame: number, total: number) => void,
  ): Promise<TTDetectionTimeline> {
    await this.load();

    const duration    = video.duration;
    const totalFrames = Math.ceil(duration * fps);
    const canvas      = document.createElement("canvas");
    canvas.width      = video.videoWidth;
    canvas.height     = video.videoHeight;
    const ctx         = canvas.getContext("2d")!;
    const timeline: TTDetectionTimeline = [];

    for (let f = 0; f < totalFrames; f += sampleEvery) {
      video.currentTime = f / fps;
      await seeked(video);
      ctx.drawImage(video, 0, 0);
      const det = await this.detectFrame(
        canvas, f, fps, canvas.width, canvas.height
      );
      timeline.push(det);
      onFrame?.(f, totalFrames);
    }

    // If sampleEvery > 1, interpolate missing frames
    return sampleEvery > 1 ? interpolateTimeline(timeline, totalFrames, sampleEvery) : timeline;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mergeBboxes(
  bboxes: Array<{ x: number; y: number; w: number; h: number }>
): { x: number; y: number; w: number; h: number } {
  const minX = Math.min(...bboxes.map(b => b.x));
  const minY = Math.min(...bboxes.map(b => b.y));
  const maxX = Math.max(...bboxes.map(b => b.x + b.w));
  const maxY = Math.max(...bboxes.map(b => b.y + b.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function seeked(video: HTMLVideoElement): Promise<void> {
  return new Promise(resolve => {
    const done = () => { video.removeEventListener("seeked", done); resolve(); };
    video.addEventListener("seeked", done);
  });
}

function interpolateTimeline(
  sampled: TTDetectionTimeline,
  totalFrames: number,
  step: number,
): TTDetectionTimeline {
  const out: TTDetectionTimeline = [];
  for (let f = 0; f < totalFrames; f++) {
    const lo = Math.floor(f / step);
    const hi = Math.min(lo + 1, sampled.length - 1);
    const t  = (f % step) / step;
    const a  = sampled[lo];
    const b  = sampled[hi];

    // Interpolate combined centroid
    const cA = a.combinedCentroid;
    const cB = b.combinedCentroid;
    const centroid = cA && cB
      ? { x: lerp(cA.x, cB.x, t), y: lerp(cA.y, cB.y, t) }
      : cA ?? cB ?? null;

    // Interpolate combined bbox
    const bA = a.combinedBbox;
    const bB = b.combinedBbox;
    const bbox = bA && bB
      ? { x: lerp(bA.x, bB.x, t), y: lerp(bA.y, bB.y, t),
          w: lerp(bA.w, bB.w, t), h: lerp(bA.h, bB.h, t) }
      : bA ?? bB ?? null;

    out.push({ ...a, frame: f, timestamp_ms: a.timestamp_ms, combinedBbox: bbox, combinedCentroid: centroid });
  }
  return out;
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
