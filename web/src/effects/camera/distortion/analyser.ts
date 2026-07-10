import type { AudioFrame, AudioAnalysis } from "../types/index.js";

// ─── Band definitions (Hz) ────────────────────────────────────────────────────

const BASS_LOW  =   20;
const BASS_HIGH =  250;
const MID_LOW   =  250;
const MID_HIGH  = 4000;
const HIGH_LOW  = 4000;
const HIGH_HIGH = 20000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hzToFFTBin(hz: number, sampleRate: number, fftSize: number): number {
  return Math.round((hz / (sampleRate / 2)) * (fftSize / 2));
}

function bandEnergy(
  magnitudes: Float32Array,
  lowBin: number,
  highBin: number
): number {
  let sum = 0;
  const count = highBin - lowBin;
  for (let i = lowBin; i < highBin; i++) {
    // magnitudes are in dBFS (-Infinity to 0); convert to linear
    const linear = Math.pow(10, magnitudes[i] / 20);
    sum += linear * linear;
  }
  return count > 0 ? Math.sqrt(sum / count) : 0;
}

// ─── Main analyser ────────────────────────────────────────────────────────────

export interface AnalyserOptions {
  /**
   * FFT size. Larger = better frequency resolution, worse time resolution.
   * Must be a power of 2. Default 2048.
   */
  fftSize?: number;
  /**
   * Hop size in samples between analysis frames.
   * Determines how many AudioFrames are generated.
   * Default: sampleRate / fps (one frame per video frame at target fps).
   */
  hopSize?: number;
  /** Target video fps for hop size calculation. Default 30. */
  fps?: number;
  /**
   * Onset detection sensitivity 0–1. Higher = more onsets detected.
   * Default 0.5.
   */
  onsetSensitivity?: number;
}

/**
 * Analyses an AudioBuffer and returns a per-video-frame AudioAnalysis.
 *
 * Must run in a browser environment (Web Audio API).
 * For Node/pre-pass: use analyseOffline() below.
 */
export async function analyseAudioBuffer(
  buffer: AudioBuffer,
  opts: AnalyserOptions = {}
): Promise<AudioAnalysis> {
  const fps     = opts.fps     ?? 30;
  const fftSize = opts.fftSize ?? 2048;
  const hopSize = opts.hopSize ?? Math.floor(buffer.sampleRate / fps);
  const sensitivity = opts.onsetSensitivity ?? 0.5;

  const sampleRate  = buffer.sampleRate;
  const channelData = buffer.getChannelData(0); // mono analysis
  const totalFrames = Math.ceil(channelData.length / hopSize);

  // Bin ranges for each band
  const bassLowBin  = hzToFFTBin(BASS_LOW,  sampleRate, fftSize);
  const bassHighBin = hzToFFTBin(BASS_HIGH, sampleRate, fftSize);
  const midLowBin   = hzToFFTBin(MID_LOW,   sampleRate, fftSize);
  const midHighBin  = hzToFFTBin(MID_HIGH,  sampleRate, fftSize);
  const highLowBin  = hzToFFTBin(HIGH_LOW,  sampleRate, fftSize);
  const highHighBin = hzToFFTBin(HIGH_HIGH,  sampleRate, fftSize);

  // Offline FFT via OfflineAudioContext
  const offlineCtx = new OfflineAudioContext(
    1,
    channelData.length,
    sampleRate
  );

  const results: AudioAnalysis = [];

  // We use a manual FFT window approach to avoid OfflineAudioContext scheduling
  // complexity — compute each hop directly on the PCM data.

  for (let frame = 0; frame < totalFrames; frame++) {
    const start  = frame * hopSize;
    const window = new Float32Array(fftSize);

    // Copy samples into window with Hann windowing
    for (let i = 0; i < fftSize; i++) {
      const sampleIdx = start + i;
      const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
      window[i] = sampleIdx < channelData.length ? channelData[sampleIdx] * hann : 0;
    }

    // RMS of raw window (before hann for accurate amplitude)
    let rmsSum = 0;
    let peak   = 0;
    for (let i = 0; i < hopSize && start + i < channelData.length; i++) {
      const s = channelData[start + i];
      rmsSum += s * s;
      if (Math.abs(s) > peak) peak = Math.abs(s);
    }
    const rms = Math.sqrt(rmsSum / hopSize);

    // FFT via a simple DFT for the frequency bands
    // (For production, replace with a proper FFT library like fft.js)
    const magnitudes = computeMagnitudeSpectrum(window, fftSize);

    const bassEnrgy = bandEnergy(magnitudes, bassLowBin, bassHighBin);
    const midEnrgy  = bandEnergy(magnitudes, midLowBin,  midHighBin);
    const highEnrgy = bandEnergy(magnitudes, highLowBin, highHighBin);

    results.push({
      rms:        clamp01(rms * 3),        // scale up — typical RMS is low
      bassEnergy: clamp01(bassEnrgy * 4),
      midEnergy:  clamp01(midEnrgy  * 4),
      highEnergy: clamp01(highEnrgy * 6),
      onset:      0,  // filled in below
      peak:       clamp01(peak),
    });
  }

  // ── Onset detection ─────────────────────────────────────────────────────────
  // Spectral flux: onset strength = positive differences in RMS between frames

  const threshold = (1 - sensitivity) * 0.15 + 0.02;
  let prevRms = 0;

  for (let i = 0; i < results.length; i++) {
    const flux = Math.max(0, results[i].rms - prevRms);
    results[i].onset = flux > threshold ? clamp01(flux / 0.3) : 0;
    prevRms = results[i].rms;
  }

  return results;
}

/**
 * Load an audio file URL and return an AudioAnalysis.
 */
export async function analyseAudioUrl(
  url: string,
  opts: AnalyserOptions = {}
): Promise<AudioAnalysis> {
  const ctx  = new AudioContext();
  const resp = await fetch(url);
  const buf  = await resp.arrayBuffer();
  const audio = await ctx.decodeAudioData(buf);
  await ctx.close();
  return analyseAudioBuffer(audio, opts);
}

/**
 * Compute magnitude spectrum via a minimal DFT.
 * Returns Float32Array of dBFS magnitudes, length fftSize/2.
 *
 * For production quality, swap this for fft.js or kiss-fft-wasm.
 */
function computeMagnitudeSpectrum(
  windowed: Float32Array,
  fftSize: number
): Float32Array {
  const half = fftSize / 2;
  const mags = new Float32Array(half);

  // Goertzel-lite: approximate per-bin via partial DFT
  // Only compute the bins we actually need for the three bands
  // (full DFT is O(N²) — fine for offline pre-pass, not for real-time)
  for (let k = 0; k < half; k++) {
    let re = 0, im = 0;
    const angle = (2 * Math.PI * k) / fftSize;
    for (let n = 0; n < fftSize; n++) {
      re += windowed[n] * Math.cos(angle * n);
      im -= windowed[n] * Math.sin(angle * n);
    }
    const linearMag = Math.sqrt(re * re + im * im) / fftSize;
    mags[k] = linearMag > 1e-10
      ? 20 * Math.log10(linearMag)
      : -120;
  }
  return mags;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ─── Fast-path: pre-computed analysis from JSON ───────────────────────────────

/**
 * Load a pre-computed AudioAnalysis from a JSON file (generated by the CLI pre-pass).
 * Use this in the hot render path to avoid re-analysis every render.
 */
export function loadAnalysisJson(json: unknown): AudioAnalysis {
  if (!Array.isArray(json)) throw new Error("Invalid audio analysis JSON");
  return json as AudioAnalysis;
}
