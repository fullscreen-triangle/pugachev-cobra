/**
 * TTAdComp — Isle of Man TT advert composition.
 *
 * Layers (bottom to top):
 *   1. Source video
 *   2. Detection bounding boxes (optional debug)
 *   3. Relocated shadow (WebGL composite)
 *   4. Speed readout HUD
 *
 * Pre-pass CLI:
 *   npx tsx src/remotion/prepass.ts --video footage/tt.mp4 --out tt-data.json --fps 30
 *
 * Then pass the loaded JSON as `precomputedData` to skip all analysis at render time.
 */

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig, Video,
} from "remotion";

import { TTDetector }             from "../detector/TTDetector.js";
import { estimateSpeed }          from "../speed/SpeedEstimator.js";
import { simulateShadowPhysics, extractShadow } from "../shadow/ShadowSystem.js";
import { ShadowCompositor }       from "../shadow/ShadowCompositor.js";
import { SpeedDisplay }           from "../ui/SpeedDisplay.js";

import type {
  TTDetectionTimeline, SpeedTimeline, ShadowTimeline,
  ShadowConfig, SpeedUIConfig,
} from "../types/index.js";
import { DEFAULT_SHADOW, DEFAULT_SPEED_UI } from "../types/index.js";

// ─── Pre-computed data bundle ─────────────────────────────────────────────────

export interface TTPrecomputedData {
  detections: TTDetectionTimeline;
  speeds:     SpeedTimeline;
  shadows:    ShadowTimeline;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TTAdProps {
  videoSrc:           string;
  /** Pass output of prepass CLI to skip runtime analysis */
  precomputedData?:   TTPrecomputedData;
  shadow?:            Partial<ShadowConfig>;
  speedUI?:           Partial<SpeedUIConfig>;
  /** Show detection bboxes + centroid trail */
  debug?:             boolean;
  /** Show speed HUD */
  showSpeed?:         boolean;
  /** Show relocated shadow */
  showShadow?:        boolean;
  /** Frame at which shadow detaches and goes rogue */
  shadowDetachFrame?: number;
  /** Detection sample rate — 1 = every frame, 3 = every 3rd (faster pre-pass) */
  sampleEvery?:       number;
}

// ─── Composition ──────────────────────────────────────────────────────────────

export const TTAdComp: React.FC<TTAdProps> = ({
  videoSrc,
  precomputedData,
  shadow:       shadowCfgOverride = {},
  speedUI:      speedUICfgOverride = {},
  debug         = false,
  showSpeed     = true,
  showShadow    = true,
  shadowDetachFrame = 30,
  sampleEvery   = 2,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  const videoRef    = useRef<HTMLVideoElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);  // receives video pixels
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);  // shadow composite output
  const compositorRef   = useRef<ShadowCompositor | null>(null);
  const shadowFrameRef  = useRef<HTMLCanvasElement | null>(null); // frozen shadow snapshot

  const [data, setData]     = useState<TTPrecomputedData | null>(precomputedData ?? null);
  const [status, setStatus] = useState("Initialising…");

  const shadowCfg: ShadowConfig    = { ...DEFAULT_SHADOW, ...shadowCfgOverride, detachFrame: shadowDetachFrame };
  const speedUICfg: SpeedUIConfig  = { ...DEFAULT_SPEED_UI, ...speedUICfgOverride };

  // ── Init WebGL compositor ──────────────────────────────────────────────────
  useEffect(() => {
    if (!outputCanvasRef.current) return;
    try {
      compositorRef.current = new ShadowCompositor(outputCanvasRef.current);
    } catch (e) {
      console.warn("Shadow compositor unavailable:", e);
    }
    return () => { compositorRef.current?.dispose(); compositorRef.current = null; };
  }, []);

  // ── Pre-pass analysis (if no precomputedData) ──────────────────────────────
  useEffect(() => {
    if (precomputedData || data) return;

    let cancelled = false;
    (async () => {
      try {
        const video = videoRef.current;
        if (!video) return;

        setStatus("Loading detector…");
        const detector = new TTDetector({
          threshold: 0.3,
          onProgress: p => setStatus(`Loading model… ${Math.round(p * 100)}%`),
        });

        setStatus("Detecting rider + bike…");
        const detections = await detector.detectClip(
          video, fps, sampleEvery,
          (f, total) => setStatus(`Detecting… ${Math.round(f / total * 100)}%`),
        );

        if (cancelled) return;
        setStatus("Estimating speed…");
        const speeds = estimateSpeed(detections, fps, { smoothWindow: 10 });

        setStatus("Building shadow timeline…");
        const shadows = simulateShadowPhysics(detections, shadowCfg, durationInFrames);

        if (!cancelled) { setData({ detections, speeds, shadows }); setStatus("Ready"); }
      } catch (e) {
        if (!cancelled) setStatus(`Error: ${(e as Error).message}`);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fps, durationInFrames]);

  // ── Per-frame render ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!data || !videoRef.current || !sourceCanvasRef.current) return;

    const video  = videoRef.current;
    const srcCtx = sourceCanvasRef.current.getContext("2d")!;

    // Draw current video frame into source canvas
    srcCtx.drawImage(video, 0, 0, width, height);

    const physFrame = data.shadows[Math.min(frame, data.shadows.length - 1)];

    // ── Capture frozen shadow snapshot at detach frame ─────────────────────
    if (frame === shadowDetachFrame && showShadow) {
      const det = data.detections[Math.min(frame, data.detections.length - 1)];
      if (det.combinedBbox) {
        // Extract shadow region from current canvas pixels
        const shadowMask = extractShadow(srcCtx, det.combinedBbox, width, height);

        if (shadowMask.bbox) {
          // Create a canvas containing just the shadow region
          const snapCanvas     = document.createElement("canvas");
          snapCanvas.width     = width;
          snapCanvas.height    = height;
          const snapCtx        = snapCanvas.getContext("2d")!;

          // Paint the shadow mask pixels onto the snap canvas
          const snapImageData = snapCtx.createImageData(width, height);
          const { bbox } = shadowMask;

          for (let py = 0; py < shadowMask.height; py++) {
            for (let px2 = 0; px2 < shadowMask.width; px2++) {
              const maskIdx = py * shadowMask.width + px2;
              if (shadowMask.data[maskIdx] < 128) continue;

              // Full frame coords
              const fx = bbox.x + px2 - (det.combinedBbox.x - Math.max(0, det.combinedBbox.x - det.combinedBbox.w * 0.3));
              const fy = bbox.y + py - (det.combinedBbox.y + det.combinedBbox.h * 0.75);
              if (fx < 0 || fx >= width || fy < 0 || fy >= height) continue;

              const frameIdx  = (fy * width + fx) * 4;
              const snapIdx   = (fy * width + fx) * 4;
              snapImageData.data[snapIdx]     = snapImageData.data[frameIdx];
              snapImageData.data[snapIdx + 1] = snapImageData.data[frameIdx + 1];
              snapImageData.data[snapIdx + 2] = snapImageData.data[frameIdx + 2];
              snapImageData.data[snapIdx + 3] = shadowMask.data[maskIdx];
            }
          }

          snapCtx.putImageData(snapImageData, 0, 0);
          shadowFrameRef.current = snapCanvas;
          compositorRef.current?.uploadShadowFrame(snapCanvas);
        }
      }
    }

    // ── Shadow composite ───────────────────────────────────────────────────
    if (showShadow && compositorRef.current && frame >= shadowDetachFrame && shadowFrameRef.current) {
      compositorRef.current.render(
        sourceCanvasRef.current, physFrame, shadowCfg, width, height
      );
    }
  }, [frame, data, showShadow, shadowDetachFrame, shadowCfg, width, height]);

  // ── Current frame data ─────────────────────────────────────────────────────
  const speedFrame = data?.speeds[Math.min(frame, (data?.speeds.length ?? 1) - 1)];
  const detFrame   = data?.detections[Math.min(frame, (data?.detections.length ?? 1) - 1)];

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* Hidden video source */}
      <video ref={videoRef} src={videoSrc} style={{ display: "none" }} muted playsInline />

      {/* Source canvas (receives video pixels each frame) */}
      <canvas
        ref={sourceCanvasRef}
        width={width} height={height}
        style={{ display: "none" }}
      />

      {/* Output canvas (shadow composited) — shown when shadow active */}
      {showShadow ? (
        <canvas
          ref={outputCanvasRef}
          width={width} height={height}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      ) : (
        // When no shadow, just show the video directly
        <Video src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      )}

      {/* Debug overlay: bboxes + centroid */}
      {debug && detFrame && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {detFrame.regions.map(r => (
            <div key={r.id} style={{
              position: "absolute",
              left:   r.bbox_norm.x * width,
              top:    r.bbox_norm.y * height,
              width:  r.bbox_norm.w * width,
              height: r.bbox_norm.h * height,
              border: `2px solid ${r.label === "bike" ? "#ff6600" : "#00cfff"}`,
              boxSizing: "border-box",
            }}>
              <span style={{
                position: "absolute", top: -18, left: 0,
                fontFamily: "monospace", fontSize: 11,
                background: r.label === "bike" ? "#ff6600" : "#00cfff",
                color: "#000", padding: "1px 5px",
              }}>
                {r.label} {Math.round(r.confidence * 100)}%
              </span>
            </div>
          ))}
          {detFrame.combinedCentroid && (
            <div style={{
              position: "absolute",
              left: detFrame.combinedCentroid.x * width - 4,
              top:  detFrame.combinedCentroid.y * height - 4,
              width: 8, height: 8, borderRadius: "50%",
              background: "#fff", opacity: 0.8,
            }} />
          )}
        </div>
      )}

      {/* Speed HUD */}
      {showSpeed && speedFrame && (
        <SpeedDisplay
          speed={speedFrame.smoothSpeed}
          direction={speedFrame.direction}
          config={speedUICfg}
          frame={frame}
        />
      )}

      {/* Status */}
      {status !== "Ready" && (
        <div style={{
          position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
          fontFamily: "monospace", fontSize: 12, color: "#fff",
          background: "rgba(0,0,0,.7)", padding: "5px 14px", borderRadius: 5,
        }}>
          {status}
        </div>
      )}
    </AbsoluteFill>
  );
};
