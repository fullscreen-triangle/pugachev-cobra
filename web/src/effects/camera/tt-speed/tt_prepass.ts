/**
 * prepass.ts — offline analysis for TTAdComp
 *
 * Usage:
 *   npx tsx src/remotion/prepass.ts \
 *     --video  footage/tt.mp4  \
 *     --out    tt-data.json    \
 *     --fps    30              \
 *     --sample 2               \
 *     --detach 45
 *
 * Writes a TTPrecomputedData JSON file consumable as the
 * `precomputedData` prop on TTAdComp — no model inference at render time.
 */

import { execSync }     from "child_process";
import { writeFileSync, readFileSync } from "fs";
import { resolve }      from "path";
import { createCanvas, loadImage } from "canvas";

import { estimateSpeed }         from "../speed/SpeedEstimator.js";
import { simulateShadowPhysics } from "../shadow/ShadowSystem.js";
import { DEFAULT_SHADOW }        from "../types/index.js";
import type { TTDetectionTimeline, TTFrameDetection, ShadowConfig } from "../types/index.js";

function arg(flag: string, fallback?: string): string {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing: ${flag}`);
}

const videoPath   = resolve(arg("--video"));
const outPath     = resolve(arg("--out", "tt-data.json"));
const fps         = parseInt(arg("--fps",    "30"), 10);
const sampleEvery = parseInt(arg("--sample", "2"),  10);
const detachFrame = parseInt(arg("--detach", "30"), 10);

// ─── Extract frames via ffmpeg ────────────────────────────────────────────────

async function extractFrames(videoPath: string, fps: number, every: number): Promise<
  Array<{ frame: number; canvas: any }>
> {
  const tmpDir  = `/tmp/tt_frames_${Date.now()}`;
  execSync(`mkdir -p ${tmpDir}`);

  console.log("Extracting frames via ffmpeg…");
  execSync(
    `ffmpeg -y -i "${videoPath}" -vf "select=not(mod(n\\,${every}))" -vsync vfr "${tmpDir}/f%06d.png" 2>/dev/null`,
    { stdio: "pipe" }
  );

  const { readdirSync } = await import("fs");
  const files = readdirSync(tmpDir).filter(f => f.endsWith(".png")).sort();
  console.log(`  ${files.length} frames extracted`);

  const frames: Array<{ frame: number; canvas: any }> = [];
  for (let i = 0; i < files.length; i++) {
    const img    = await loadImage(`${tmpDir}/${files[i]}`);
    const canvas = createCanvas(img.width, img.height);
    canvas.getContext("2d").drawImage(img as any, 0, 0);
    frames.push({ frame: i * every, canvas });
    if (i % 30 === 0) process.stdout.write(`\r  loading frames ${i}/${files.length}`);
  }

  execSync(`rm -rf ${tmpDir}`);
  return frames;
}

// ─── Run YOLO detection on each frame (Node via ONNX Runtime) ────────────────
// For Node environments, use @huggingface/transformers with ort backend

async function detectFrames(
  frames: Array<{ frame: number; canvas: any }>,
  fps:    number,
): Promise<TTDetectionTimeline> {
  // Dynamic import to avoid loading in browser context
  const { pipeline, env } = await import(
    "@huggingface/transformers" as any
  );
  env.allowLocalModels = false;

  const detector = await pipeline("object-detection", "onnx-community/yolov10s", { dtype: "q4" });
  const TARGET = new Set(["person", "motorcycle"]);

  const timeline: TTDetectionTimeline = [];

  for (let i = 0; i < frames.length; i++) {
    const { frame, canvas } = frames[i];
    const W = canvas.width, H = canvas.height;

    const raw: any[] = await detector(canvas.toDataURL(), { threshold: 0.3, percentage: false });
    const relevant   = raw.filter((r: any) => TARGET.has(r.label));

    const regions = relevant.map((r: any, idx: number) => {
      const bw = r.box.xmax - r.box.xmin;
      const bh = r.box.ymax - r.box.ymin;
      return {
        id: idx,
        label: r.label === "motorcycle" ? "bike" : "rider" as any,
        confidence: parseFloat(r.score.toFixed(3)),
        bbox:      { x: Math.round(r.box.xmin), y: Math.round(r.box.ymin), w: Math.round(bw), h: Math.round(bh) },
        bbox_norm: { x: r.box.xmin/W, y: r.box.ymin/H, w: bw/W, h: bh/H },
        centroid:  { x: (r.box.xmin + bw/2)/W, y: (r.box.ymin + bh/2)/H },
      };
    });

    const cb = regions.length > 0
      ? {
          x: Math.min(...regions.map((r: any) => r.bbox.x)),
          y: Math.min(...regions.map((r: any) => r.bbox.y)),
          w: Math.max(...regions.map((r: any) => r.bbox.x + r.bbox.w)) - Math.min(...regions.map((r: any) => r.bbox.x)),
          h: Math.max(...regions.map((r: any) => r.bbox.y + r.bbox.h)) - Math.min(...regions.map((r: any) => r.bbox.y)),
        }
      : null;

    timeline.push({
      frame,
      timestamp_ms: (frame / fps) * 1000,
      regions,
      combinedBbox: cb,
      combinedCentroid: cb ? { x: (cb.x + cb.w/2)/W, y: (cb.y + cb.h/2)/H } : null,
    });

    process.stdout.write(`\r  detecting ${i+1}/${frames.length}  `);
  }

  return timeline;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\nTT pre-pass`);
  console.log(`  video:  ${videoPath}`);
  console.log(`  out:    ${outPath}`);
  console.log(`  fps:    ${fps}, sample every ${sampleEvery}\n`);

  const frames     = await extractFrames(videoPath, fps, sampleEvery);
  const detections = await detectFrames(frames, fps);

  const totalFrames = detections[detections.length - 1]?.frame + 1 ?? 0;
  const speeds      = estimateSpeed(detections, fps, { smoothWindow: 10 });
  const shadowCfg: ShadowConfig = { ...DEFAULT_SHADOW, detachFrame };
  const shadows     = simulateShadowPhysics(detections, shadowCfg, totalFrames);

  const output = { detections, speeds, shadows };
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\n\nDone. Written to ${outPath}`);
  console.log(`  ${detections.length} detection frames`);
  console.log(`  ${speeds.length} speed frames`);
  console.log(`  ${shadows.length} shadow frames`);
})().catch(e => { console.error(e); process.exit(1); });
