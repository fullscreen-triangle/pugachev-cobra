/**
 * WreckingBallComp.tsx
 *
 * Remotion composition that applies the audio-synchronised wrecking-ball
 * deformation to a source video.
 *
 * Architecture:
 *   1. On mount: load audio → analyse → simulate pendulum → build timeline
 *   2. Each frame: read DeformationFrame from timeline → upload to WebGL → render
 *
 * For production renders use the pre-pass:
 *   npx tsx src/remotion/prepass-cli.ts --video footage/product.mp4 --out timeline.json
 * Then pass timelineJson prop instead of audioSrc to skip re-analysis.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Video, Audio } from "remotion";

import { analyseAudioUrl }         from "../audio/analyser.js";
import { simulatePendulum, smoothTrajectory } from "../physics/pendulum.js";
import { buildDeformationTimeline } from "../deformation/timeline.js";
import { WebGLRenderer }            from "../deformation/WebGLRenderer.js";

import type {
  DeformationTimeline,
  WreckingBallConfig,
} from "../types/index.js";
import { DEFAULT_CONFIG } from "../types/index.js";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WreckingBallProps {
  /** Source video URL */
  videoSrc: string;
  /** Audio URL (can be the same file as videoSrc if it has an audio track) */
  audioSrc: string;
  /**
   * Pre-computed timeline JSON (from prepass-cli).
   * If provided, audioSrc analysis is skipped.
   */
  timelineJson?: DeformationTimeline;
  /** Effect configuration. Defaults to DEFAULT_CONFIG. */
  config?: Partial<WreckingBallConfig>;
  /** Show debug overlay (ball position, intensity readout) */
  debug?: boolean;
}

// ─── Composition ──────────────────────────────────────────────────────────────

export const WreckingBallComp: React.FC<WreckingBallProps> = ({
  videoSrc,
  audioSrc,
  timelineJson,
  config: configOverride = {},
  debug = false,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const config: WreckingBallConfig = {
    ...DEFAULT_CONFIG,
    ...configOverride,
    pendulum:    { ...DEFAULT_CONFIG.pendulum,    ...(configOverride.pendulum    ?? {}) },
    deformation: { ...DEFAULT_CONFIG.deformation, ...(configOverride.deformation ?? {}) },
    shader:      { ...DEFAULT_CONFIG.shader,      ...(configOverride.shader      ?? {}) },
  };

  // ── Refs ──────────────────────────────────────────────────────────────────
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);

  // ── State ─────────────────────────────────────────────────────────────────
  const [timeline, setTimeline] = useState<DeformationTimeline | null>(
    timelineJson ?? null
  );
  const [status, setStatus] = useState<string>("Initialising…");

  // ── Build timeline on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (timelineJson) { setStatus("Ready (pre-computed)"); return; }

    let cancelled = false;

    (async () => {
      try {
        setStatus("Analysing audio…");
        const audio = await analyseAudioUrl(audioSrc, { fps });

        if (cancelled) return;
        setStatus("Simulating pendulum…");
        const rawTraj  = simulatePendulum(config.pendulum, audio);
        const trajectory = smoothTrajectory(rawTraj, 3);

        setStatus("Building deformation timeline…");
        const tl = buildDeformationTimeline(audio, trajectory, config.deformation);

        if (!cancelled) {
          setTimeline(tl);
          setStatus("Ready");
        }
      } catch (e) {
        if (!cancelled) setStatus(`Error: ${(e as Error).message}`);
      }
    })();

    return () => { cancelled = true; };
  // Config changes intentionally do NOT re-trigger — use timelineJson for hot reload
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSrc, fps]);

  // ── Initialise WebGL renderer ─────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !config.shader.useWebGL) return;

    try {
      rendererRef.current = new WebGLRenderer(canvasRef.current, config.deformation);
    } catch (e) {
      console.warn("WebGL2 unavailable, falling back to CSS:", e);
    }

    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Per-frame render ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!timeline || !videoRef.current || !canvasRef.current) return;

    const deformFrame = timeline[Math.min(frame, timeline.length - 1)];
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;

    if (renderer) {
      // GPU path
      renderer.renderFrame(video, deformFrame);
    } else {
      // CSS fallback — approximate bulge via perspective distortion
      const { ballPosition, intensity } = deformFrame;
      const px = ballPosition.x * 100;
      const py = ballPosition.y * 100;
      const depth = intensity * 300;
      canvas.style.transform =
        `perspective(${800 - depth}px) ` +
        `rotateX(${(ballPosition.y - 0.5) * intensity * 8}deg) ` +
        `rotateY(${(ballPosition.x - 0.5) * intensity * 8}deg)`;
    }
  }, [frame, timeline]);

  // ── Current frame data for debug overlay ─────────────────────────────────
  const deformFrame = timeline?.[Math.min(frame, (timeline?.length ?? 1) - 1)];

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Source video (hidden — fed into WebGL as texture) */}
      <video
        ref={videoRef}
        src={videoSrc}
        style={{ display: "none" }}
        muted
        playsInline
      />

      {/* Audio track (Remotion manages playback sync) */}
      <Audio src={audioSrc} />

      {/* Output canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />

      {/* Debug overlay */}
      {debug && deformFrame && (
        <div style={{
          position:   "absolute",
          top:        12,
          left:       12,
          fontFamily: "monospace",
          fontSize:   11,
          color:      "#0f0",
          background: "rgba(0,0,0,.65)",
          padding:    "6px 10px",
          borderRadius: 4,
          lineHeight: 1.6,
          pointerEvents: "none",
        }}>
          <div>frame:     {frame}</div>
          <div>ball:      ({deformFrame.ballPosition.x.toFixed(3)}, {deformFrame.ballPosition.y.toFixed(3)})</div>
          <div>intensity: {deformFrame.intensity.toFixed(3)}</div>
          <div>speed:     {deformFrame.speed.toFixed(3)}</div>
          <div>rms:       {deformFrame.audio.rms.toFixed(3)}</div>
          <div>onset:     {deformFrame.audio.onset.toFixed(3)}</div>
          <div>rings:     {deformFrame.rippleRings.length}</div>
          <div>status:    {status}</div>
        </div>
      )}

      {/* Loading state */}
      {status !== "Ready" && status !== "Ready (pre-computed)" && (
        <div style={{
          position:   "absolute",
          bottom:     16,
          left:       "50%",
          transform:  "translateX(-50%)",
          fontFamily: "monospace",
          fontSize:   12,
          color:      "#fff",
          background: "rgba(0,0,0,.7)",
          padding:    "6px 14px",
          borderRadius: 6,
        }}>
          {status}
        </div>
      )}
    </AbsoluteFill>
  );
};
