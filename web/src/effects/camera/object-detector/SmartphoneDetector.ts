import type {
  DetectedRegion,
  DetectorOptions,
  FrameManifest,
} from "../types/index.js";
import { derivePhoneParts, type RawBox } from "../utils/geometry.js";

// ─── Transformers.js dynamic import ──────────────────────────────────────────
// Kept as a dynamic import so this module is tree-shakeable in Remotion builds
// that don't use the detector at render time.

type HFPipeline = (
  input: string | HTMLImageElement | HTMLCanvasElement,
  options: { threshold: number; percentage: boolean }
) => Promise<Array<{ label: string; score: number; box: RawBox }>>;

// ─── SmartphoneDetector ───────────────────────────────────────────────────────

export class SmartphoneDetector {
  private pipeline: HFPipeline | null = null;
  private readonly opts: Required<DetectorOptions>;

  constructor(opts: DetectorOptions = {}) {
    this.opts = {
      threshold: opts.threshold ?? 0.35,
      model:     opts.model     ?? "yolov10s",
      dtype:     opts.dtype     ?? "q4",
      onProgress: opts.onProgress ?? (() => {}),
    };
  }

  // ── Lazy model load ─────────────────────────────────────────────────────────

  async load(): Promise<void> {
    if (this.pipeline) return;

    const { pipeline, env } = await import(
      // @ts-expect-error — no types bundled with CDN build
      "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.0/dist/transformers.min.js"
    );

    // Disable local model cache (Remotion Lambda / CI environments)
    env.allowLocalModels = false;

    this.pipeline = await pipeline(
      "object-detection",
      `onnx-community/${this.opts.model}`,
      {
        dtype: this.opts.dtype,
        progress_callback: (p: { status: string; loaded?: number; total?: number }) => {
          if (p.status === "progress" && p.total && p.loaded !== undefined) {
            this.opts.onProgress(p.loaded / p.total);
          }
        },
      }
    ) as HFPipeline;
  }

  // ── Single-frame detection ──────────────────────────────────────────────────

  /**
   * Detect all smartphones in a frame and return a typed manifest.
   *
   * @param source  URL string, HTMLImageElement, or HTMLCanvasElement
   * @param frameW  Source frame width in pixels
   * @param frameH  Source frame height in pixels
   * @param timestampMs  Optional clip position for temporal manifests
   */
  async detectFrame(
    source: string | HTMLImageElement | HTMLCanvasElement,
    frameW: number,
    frameH: number,
    timestampMs: number | null = null
  ): Promise<FrameManifest> {
    await this.load();

    const raw = await this.pipeline!(source, {
      threshold: this.opts.threshold,
      percentage: false, // return pixel coords
    });

    const phones = raw.filter((r) => r.label === "cell phone");

    const regions: DetectedRegion[] = [];
    let id = 0;

    for (const phone of phones) {
      // ── Phone body ────────────────────────────────────────────────────────
      const bw = phone.box.xmax - phone.box.xmin;
      const bh = phone.box.ymax - phone.box.ymin;

      regions.push({
        id: id++,
        label: "phone_body",
        confidence: parseFloat(phone.score.toFixed(3)),
        derived: false,
        shape: "rect",
        bbox: {
          x: Math.round(phone.box.xmin),
          y: Math.round(phone.box.ymin),
          w: Math.round(bw),
          h: Math.round(bh),
        },
        bbox_norm: {
          x: parseFloat((phone.box.xmin / frameW).toFixed(4)),
          y: parseFloat((phone.box.ymin / frameH).toFixed(4)),
          w: parseFloat((bw / frameW).toFixed(4)),
          h: parseFloat((bh / frameH).toFixed(4)),
        },
        behaviour_hint: "acts_like(device_body)",
      });

      // ── Derived sub-regions ───────────────────────────────────────────────
      const parts = derivePhoneParts(phone.box, frameW, frameH, id);
      id += parts.length;
      regions.push(...parts);
    }

    return {
      frame: { width: frameW, height: frameH },
      timestamp_ms: timestampMs,
      regions,
    };
  }

  // ── Convenience: detect from a URL ─────────────────────────────────────────

  async detectUrl(url: string): Promise<FrameManifest> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        try {
          resolve(await this.detectFrame(img, img.naturalWidth, img.naturalHeight));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  // ── Remotion integration: detect from useCurrentFrame canvas ───────────────

  /**
   * Pass the canvas element Remotion renders into at a given frame.
   * Returns a manifest anchored to that frame's timestamp.
   */
  async detectCanvas(
    canvas: HTMLCanvasElement,
    timestampMs: number
  ): Promise<FrameManifest> {
    return this.detectFrame(
      canvas,
      canvas.width,
      canvas.height,
      timestampMs
    );
  }
}
