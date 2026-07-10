/**
 * prepass.ts
 *
 * Run detection offline (Node / Bun / Remotion CLI) before rendering.
 * Produces a manifest JSON that the Remotion composition reads at render time,
 * avoiding per-frame model inference during the hot render loop.
 *
 * Usage (Node + tsx):
 *   npx tsx src/detector/prepass.ts --input footage/product.mp4 --out manifest.json --fps 30 --sample 15
 *
 * The output manifest.json maps frame numbers to FrameManifest objects.
 */

import { createCanvas, loadImage } from "canvas"; // npm i canvas
import { writeFileSync } from "fs";
import { SmartphoneDetector } from "./SmartphoneDetector.js";
import type { FrameManifest } from "../types/index.js";

export interface PrepassOptions {
  /** Path to an image file (for still product shots) */
  imagePath?: string;
  /**
   * Array of [frameNumber, imageDataUrl] tuples extracted from video
   * (e.g. via ffmpeg-static frame export).
   */
  frames?: Array<{ frameNumber: number; dataUrl: string }>;
  /** Output path for the manifest JSON */
  outPath: string;
  threshold?: number;
  onProgress?: (done: number, total: number) => void;
}

export interface ManifestRecord {
  [frameNumber: number]: FrameManifest;
}

export async function runPrepass(opts: PrepassOptions): Promise<ManifestRecord> {
  const detector = new SmartphoneDetector({ threshold: opts.threshold ?? 0.35 });

  await detector.load();

  const record: ManifestRecord = {};

  if (opts.imagePath) {
    // ── Still image ─────────────────────────────────────────────────────────
    const img = await loadImage(opts.imagePath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img as unknown as CanvasImageSource, 0, 0);

    const manifest = await detector.detectFrame(
      canvas as unknown as HTMLCanvasElement,
      img.width,
      img.height,
      0
    );
    record[0] = manifest;
    opts.onProgress?.(1, 1);
  } else if (opts.frames) {
    // ── Frame sequence ───────────────────────────────────────────────────────
    const total = opts.frames.length;

    for (let i = 0; i < total; i++) {
      const { frameNumber, dataUrl } = opts.frames[i];
      const img = await loadImage(dataUrl);
      const canvas = createCanvas(img.width, img.height);
      canvas.getContext("2d").drawImage(img as unknown as CanvasImageSource, 0, 0);

      const manifest = await detector.detectFrame(
        canvas as unknown as HTMLCanvasElement,
        img.width,
        img.height,
        null
      );
      record[frameNumber] = manifest;
      opts.onProgress?.(i + 1, total);
    }
  }

  writeFileSync(opts.outPath, JSON.stringify(record, null, 2));
  console.log(`Manifest written to ${opts.outPath}`);
  return record;
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith("prepass.ts") || process.argv[1]?.endsWith("prepass.js")) {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const imagePath = get("--input");
  const outPath   = get("--out") ?? "manifest.json";
  const threshold = parseFloat(get("--threshold") ?? "0.35");

  if (!imagePath) {
    console.error("Usage: prepass.ts --input <image> --out <manifest.json>");
    process.exit(1);
  }

  runPrepass({
    imagePath,
    outPath,
    threshold,
    onProgress: (done, total) => process.stdout.write(`\r${done}/${total} frames`),
  })
    .then(() => console.log("\nDone."))
    .catch((e) => { console.error(e); process.exit(1); });
}
