/**
 * RemotionExample.tsx
 *
 * Minimal Remotion composition demonstrating the detector.
 * The canvas ref is passed into useSmartphoneDetection; detected regions
 * are overlaid as labelled boxes each frame.
 *
 * Intended as a starting point — replace the overlay rendering with
 * your MEE effect pipeline once the manifest shape is confirmed.
 */

import React, { useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, Video } from "remotion";
import { useSmartphoneDetection } from "./detector/useSmartphoneDetection.js";
import type { DetectedRegion } from "./types/index.js";

// ─── Colour map matching the types ───────────────────────────────────────────

const REGION_COLOURS: Record<string, string> = {
  phone_body:          "#378ADD",
  screen:              "#1D9E75",
  front_camera:        "#D4537E",
  rear_camera_cluster: "#D85A30",
};

// ─── Region overlay component ─────────────────────────────────────────────────

function RegionOverlay({ region }: { region: DetectedRegion }) {
  const colour = REGION_COLOURS[region.label] ?? "#888";
  const { bbox } = region;

  const boxStyle: React.CSSProperties = {
    position:  "absolute",
    left:      bbox.x,
    top:       bbox.y,
    width:     bbox.w,
    height:    bbox.h,
    border:    `2px ${region.derived ? "dashed" : "solid"} ${colour}`,
    boxSizing: "border-box",
    borderRadius: region.shape === "circle" ? "50%" : 4,
  };

  const labelStyle: React.CSSProperties = {
    position:   "absolute",
    top:        -20,
    left:       0,
    fontSize:   11,
    fontFamily: "monospace",
    fontWeight: 600,
    color:      "#fff",
    background: colour,
    padding:    "1px 5px",
    borderRadius: 3,
    whiteSpace: "nowrap",
  };

  return (
    <div style={boxStyle}>
      <span style={labelStyle}>
        {region.label} {Math.round(region.confidence * 100)}%
        {region.derived ? " ~" : ""}
      </span>
    </div>
  );
}

// ─── Composition ──────────────────────────────────────────────────────────────

interface Props {
  videoSrc: string;
  /** Run detection every N frames. Default 1 (every frame). */
  sampleEveryNFrames?: number;
}

export const SmartphoneDetectionComp: React.FC<Props> = ({
  videoSrc,
  sampleEveryNFrames = 1,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // The canvas we draw into and read back from for detection
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { manifest, loading, error } = useSmartphoneDetection({
    canvasRef,
    sampleEveryNFrames,
    threshold: 0.35,
    onProgress: (p) => console.log(`Model loading: ${Math.round(p * 100)}%`),
    onManifest: (m) => {
      // ── Hook point for MEE pipeline ──────────────────────────────────────
      // m.regions contains typed DetectedRegion[]
      // Each region has label, bbox_norm, and behaviour_hint ready for
      // acts_like() resolution in your effect compiler.
      console.log(`Frame ${frame}: ${m.regions.length} regions`, m.regions);
    },
  });

  return (
    <AbsoluteFill>
      {/* Source video */}
      <Video src={videoSrc} style={{ width, height, objectFit: "cover" }} />

      {/* Detection canvas (hidden — used only for model input) */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: "none" }}
      />

      {/* Region overlays */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        {manifest?.regions.map((region) => (
          <RegionOverlay key={region.id} region={region} />
        ))}
      </div>

      {/* Debug status */}
      {loading && (
        <div style={{
          position: "absolute", bottom: 16, left: 16,
          fontSize: 12, color: "#fff", background: "rgba(0,0,0,.6)",
          padding: "4px 8px", borderRadius: 4,
        }}>
          Loading model…
        </div>
      )}
      {error && (
        <div style={{
          position: "absolute", bottom: 16, left: 16,
          fontSize: 12, color: "#f66", background: "rgba(0,0,0,.6)",
          padding: "4px 8px", borderRadius: 4,
        }}>
          {error}
        </div>
      )}
    </AbsoluteFill>
  );
};
