import { useEffect, useRef, useState } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { FrameManifest, DetectorOptions } from "../types/index.js";
import { SmartphoneDetector } from "./SmartphoneDetector.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseSmartphoneDetectionOptions extends DetectorOptions {
  /** Canvas ref pointing at the Remotion composition canvas */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /**
   * How often to re-run detection, in frames.
   * Default 1 = every frame. Set higher for performance (e.g. 30 = once/sec at 30fps).
   */
  sampleEveryNFrames?: number;
  /** Called when detection produces a new manifest */
  onManifest?: (manifest: FrameManifest) => void;
}

export interface UseSmartphoneDetectionResult {
  manifest: FrameManifest | null;
  loading: boolean;
  error: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Remotion hook that runs smartphone detection on the current frame's canvas.
 *
 * Usage:
 * ```tsx
 * const canvasRef = useRef<HTMLCanvasElement>(null);
 * const { manifest } = useSmartphoneDetection({ canvasRef, sampleEveryNFrames: 15 });
 * ```
 *
 * The manifest is stable between sample points — the last successful detection
 * is returned on every frame, so downstream effects can interpolate continuously.
 */
export function useSmartphoneDetection(
  opts: UseSmartphoneDetectionOptions
): UseSmartphoneDetectionResult {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const [manifest, setManifest] = useState<FrameManifest | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const detectorRef = useRef<SmartphoneDetector | null>(null);
  const lastSampledFrame = useRef<number>(-1);

  const sampleEvery = opts.sampleEveryNFrames ?? 1;

  // ── Initialise detector once ──────────────────────────────────────────────
  useEffect(() => {
    detectorRef.current = new SmartphoneDetector({
      threshold:  opts.threshold,
      model:      opts.model,
      dtype:      opts.dtype,
      onProgress: opts.onProgress,
    });
    // Eagerly load the model so the first sampled frame isn't slow
    setLoading(true);
    detectorRef.current
      .load()
      .then(() => setLoading(false))
      .catch((e) => {
        setError(`Model load failed: ${(e as Error).message}`);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Per-frame detection ───────────────────────────────────────────────────
  useEffect(() => {
    if (!detectorRef.current) return;
    if (frame % sampleEvery !== 0) return;
    if (frame === lastSampledFrame.current) return;
    if (!opts.canvasRef.current) return;

    lastSampledFrame.current = frame;
    const canvas = opts.canvasRef.current;
    const timestampMs = (frame / fps) * 1000;

    detectorRef.current
      .detectCanvas(canvas, timestampMs)
      .then((m) => {
        setManifest(m);
        opts.onManifest?.(m);
      })
      .catch((e) => setError((e as Error).message));
  }, [frame, sampleEvery, fps, opts]);

  return { manifest, loading, error };
}
