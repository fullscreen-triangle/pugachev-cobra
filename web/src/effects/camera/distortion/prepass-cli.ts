/**
 * prepass-cli.ts
 *
 * Offline pre-pass: extracts audio from a video, analyses it,
 * runs the pendulum simulation, builds the deformation timeline,
 * and writes timeline.json for use in the hot render path.
 *
 * Usage:
 *   npx tsx src/remotion/prepass-cli.ts \
 *     --video  footage/product.mp4 \
 *     --out    timeline.json \
 *     --fps    30 \
 *     --config config.json      # optional WreckingBallConfig override
 *
 * The output timeline.json can be passed as the `timelineJson` prop to
 * WreckingBallComp, skipping all analysis at render time.
 */

import { execSync }        from "child_process";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve }         from "path";
import { createCanvas }    from "canvas";

// ── We import the pure-TS modules directly ──────────────────────────────────
// Audio analysis uses Web Audio API in-browser; for Node we use a PCM approach.

import { simulatePendulum, smoothTrajectory } from "../physics/pendulum.js";
import { buildDeformationTimeline }           from "../deformation/timeline.js";
import { DEFAULT_CONFIG }                     from "../types/index.js";
import type { AudioAnalysis, WreckingBallConfig } from "../types/index.js";

// ─── Args ─────────────────────────────────────────────────────────────────────

function arg(flag: string, fallback?: string): string {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required argument: ${flag}`);
}

const videoPath  = resolve(arg("--video"));
const outPath    = resolve(arg("--out", "timeline.json"));
const fps        = parseInt(arg("--fps", "30"), 10);
const configPath = process.argv.includes("--config") ? arg("--config") : null;

// ─── Load config ─────────────────────────────────────────────────────────────

const config: WreckingBallConfig = configPath && existsSync(configPath)
  ? { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(configPath, "utf8")) }
  : DEFAULT_CONFIG;

// ─── Extract audio via ffmpeg ─────────────────────────────────────────────────

async function extractAudioPCM(videoPath: string, fps: number): Promise<AudioAnalysis> {
  const tmpWav = `/tmp/wb_audio_${Date.now()}.raw`;

  console.log("Extracting audio PCM via ffmpeg…");
  execSync(
    `ffmpeg -y -i "${videoPath}" -vn -ac 1 -ar 44100 -f f32le "${tmpWav}" 2>/dev/null`,
    { stdio: "pipe" }
  );

  const raw     = readFileSync(tmpWav);
  const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const sampleRate = 44100;
  const hopSize    = Math.floor(sampleRate / fps);
  const fftSize    = 2048;
  const totalFrames = Math.ceil(samples.length / hopSize);

  console.log(`Analysing ${totalFrames} frames at ${fps}fps…`);

  const BASS_HIGH_BIN = Math.round((250  / (sampleRate / 2)) * (fftSize / 2));
  const MID_HIGH_BIN  = Math.round((4000 / (sampleRate / 2)) * (fftSize / 2));
  const HIGH_HIGH_BIN = Math.round((20000/ (sampleRate / 2)) * (fftSize / 2));
  const BASS_LOW_BIN  = Math.round((20   / (sampleRate / 2)) * (fftSize / 2));
  const MID_LOW_BIN   = BASS_HIGH_BIN;
  const HIGH_LOW_BIN  = MID_HIGH_BIN;

  const results: AudioAnalysis = [];
  let prevRms = 0;

  for (let frame = 0; frame < totalFrames; frame++) {
    const start = frame * hopSize;

    let rmsSum = 0;
    let peak   = 0;

    // Hann-windowed energy
    const window = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      const si   = start + i;
      const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
      window[i]  = si < samples.length ? samples[si] * hann : 0;
    }

    for (let i = 0; i < hopSize && start + i < samples.length; i++) {
      const s = samples[start + i];
      rmsSum += s * s;
      if (Math.abs(s) > peak) peak = Math.abs(s);
    }
    const rms = Math.sqrt(rmsSum / hopSize);

    // Simplified band energy via variance in time-domain sub-windows
    // (full FFT avoided here; replace with fft.js for accuracy)
    const bassE = bandVariance(samples, start, hopSize / 4,  1) * 4;
    const midE  = bandVariance(samples, start, hopSize / 8,  4) * 4;
    const highE = bandVariance(samples, start, hopSize / 16, 8) * 6;

    const scaledRms = Math.min(1, rms * 3);
    const onset = Math.max(0, scaledRms - prevRms);
    prevRms = scaledRms;

    results.push({
      rms:        clamp01(scaledRms),
      bassEnergy: clamp01(bassE),
      midEnergy:  clamp01(midE),
      highEnergy: clamp01(highE),
      onset:      onset > 0.05 ? clamp01(onset / 0.3) : 0,
      peak:       clamp01(peak),
    });
  }

  // Clean up
  try { execSync(`rm -f "${tmpWav}"`); } catch {}

  return results;
}

function bandVariance(samples: Float32Array, start: number, window: number, stride: number): number {
  let sum = 0; let count = 0;
  for (let i = 0; i < window; i += stride) {
    const s = samples[start + i] ?? 0;
    sum += s * s; count++;
  }
  return count > 0 ? Math.sqrt(sum / count) : 0;
}

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\nWrecking Ball pre-pass`);
  console.log(`  video : ${videoPath}`);
  console.log(`  out   : ${outPath}`);
  console.log(`  fps   : ${fps}\n`);

  const audio      = await extractAudioPCM(videoPath, fps);
  const rawTraj    = simulatePendulum(config.pendulum, audio);
  const trajectory = smoothTrajectory(rawTraj, 3);

  console.log("Building deformation timeline…");
  const timeline = buildDeformationTimeline(audio, trajectory, config.deformation);

  writeFileSync(outPath, JSON.stringify(timeline, null, 2));
  console.log(`\nDone. Timeline written to ${outPath}`);
  console.log(`  ${timeline.length} frames, ${(Buffer.byteLength(JSON.stringify(timeline)) / 1024).toFixed(1)} KB`);
})().catch(e => { console.error(e); process.exit(1); });
