/**
 * Remotion compositions for the camera live-recording effect.
 *
 * Three independent exports:
 *
 *   <CameraUIComp>   — Just the HUD overlay. No shake.
 *   <TumbleComp>     — Just the shake/throw physics on the video. No HUD.
 *   <CameraLiveComp> — Both composed. The recommended entry point.
 *
 * All three are independent so you can mix and match with other effects
 * (e.g. ObjectFxComp + CameraUIComp, or TumbleComp + WreckingBallComp).
 */

import React, { useEffect, useMemo, useRef } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Video,
  Audio,
} from "remotion";

import { simulateTumble, THROW_UP, DROP, HANDHELD, EARTHQUAKE } from "../physics/tumble.js";
import { PhoneSkin, ActionSkin, BroadcastSkin, CCTVSkin } from "../ui/skins/CameraSkins.js";
import type {
  CameraUIConfig,
  TumbleConfig,
  TumbleTimeline,
  CameraStyle,
} from "../types/index.js";
import { DEFAULT_CAMERA_UI, DEFAULT_TUMBLE } from "../types/index.js";
import type { AudioAnalysis } from "../../wrecking-ball/src/types/index.js";

// ─── Re-export presets so consumers don't need to import from physics ─────────
export { THROW_UP, DROP, HANDHELD, EARTHQUAKE };

// ══════════════════════════════════════════════════════════════════════════════
// CameraUIComp — HUD overlay only
// ══════════════════════════════════════════════════════════════════════════════

export interface CameraUIProps {
  videoSrc: string;
  config?:  Partial<CameraUIConfig>;
}

export const CameraUIComp: React.FC<CameraUIProps> = ({
  videoSrc,
  config: configOverride = {},
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const config: CameraUIConfig = { ...DEFAULT_CAMERA_UI, ...configOverride };
  const Skin = skinFor(config.style);

  return (
    <AbsoluteFill>
      <Video src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <Skin config={config} frame={frame} fps={fps} width={width} height={height} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// TumbleComp — shake / throw only
// ══════════════════════════════════════════════════════════════════════════════

export interface TumbleProps {
  videoSrc:  string;
  audioSrc?: string;
  /** Pre-computed timeline from simulateTumble(). If omitted, computed on mount. */
  timeline?: TumbleTimeline;
  config?:   Partial<TumbleConfig>;
  /** Preset shorthand. Ignored if `config` is provided. */
  preset?:   "throw_up" | "drop" | "handheld" | "earthquake";
  /** Pre-computed AudioAnalysis for impulse driving */
  audio?:    AudioAnalysis;
}

export const TumbleComp: React.FC<TumbleProps> = ({
  videoSrc, audioSrc, timeline: timelineProp, config: configOverride = {},
  preset, audio,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const config: TumbleConfig = {
    ...DEFAULT_TUMBLE,
    ...presetConfig(preset),
    ...configOverride,
  };

  const timeline = useMemo<TumbleTimeline>(() => {
    if (timelineProp) return timelineProp;
    return simulateTumble(config, durationInFrames, fps, audio);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationInFrames, fps]);

  const tf = timeline[Math.min(frame, timeline.length - 1)];

  // Motion blur via CSS filter
  const blurPx = tf.speed * config.motionBlur * 4;

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <div style={{
        position:  "absolute",
        inset:     0,
        transform: `
          translate(${tf.translate.x * 100}%, ${tf.translate.y * 100}%)
          rotate(${tf.rotation}deg)
          scale(${tf.scale})
        `,
        transformOrigin: "center center",
        filter:    blurPx > 0.5 ? `blur(${blurPx.toFixed(1)}px)` : "none",
        willChange: "transform",
      }}>
        <Video
          src={videoSrc}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      {audioSrc && <Audio src={audioSrc} />}
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// CameraLiveComp — full effect: HUD + tumble, independently configured
// ══════════════════════════════════════════════════════════════════════════════

export interface CameraLiveProps {
  videoSrc:  string;
  audioSrc?: string;
  ui?:       Partial<CameraUIConfig>;
  tumble?:   Partial<TumbleConfig>;
  /** Tumble preset. Overridden by `tumble` config. */
  tumblePreset?: "throw_up" | "drop" | "handheld" | "earthquake";
  /** Disable shake entirely */
  noTumble?: boolean;
  /** Disable HUD entirely */
  noUI?:     boolean;
  /** Pre-computed AudioAnalysis */
  audio?:    AudioAnalysis;
  /** Pre-computed tumble timeline */
  tumbleTimeline?: TumbleTimeline;
}

export const CameraLiveComp: React.FC<CameraLiveProps> = ({
  videoSrc, audioSrc,
  ui:             uiOverride    = {},
  tumble:         tumbleOverride = {},
  tumblePreset,
  noTumble = false,
  noUI     = false,
  audio,
  tumbleTimeline: timelineProp,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  const uiConfig: CameraUIConfig     = { ...DEFAULT_CAMERA_UI, ...uiOverride };
  const tumbleConfig: TumbleConfig   = {
    ...DEFAULT_TUMBLE,
    ...presetConfig(tumblePreset),
    ...tumbleOverride,
  };

  const timeline = useMemo<TumbleTimeline>(() => {
    if (noTumble) return [];
    if (timelineProp) return timelineProp;
    return simulateTumble(tumbleConfig, durationInFrames, fps, audio);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noTumble, durationInFrames, fps]);

  const tf = !noTumble && timeline.length > 0
    ? timeline[Math.min(frame, timeline.length - 1)]
    : null;

  const Skin = skinFor(uiConfig.style);

  const blurPx = tf ? tf.speed * tumbleConfig.motionBlur * 4 : 0;

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {/* ── Video layer (shakes) ── */}
      <div style={{
        position:  "absolute",
        inset:     0,
        transform: tf
          ? `translate(${tf.translate.x * 100}%, ${tf.translate.y * 100}%) rotate(${tf.rotation}deg) scale(${tf.scale})`
          : "none",
        transformOrigin: "center center",
        filter: blurPx > 0.5 ? `blur(${blurPx.toFixed(1)}px)` : "none",
        willChange: "transform",
      }}>
        <Video
          src={videoSrc}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />

        {/* ── UI layer — moves WITH the video when coupled ── */}
        {/* To make it independent (floating HUD), move this outside the shake div */}
        {!noUI && (
          <Skin config={uiConfig} frame={frame} fps={fps} width={width} height={height} />
        )}
      </div>

      {audioSrc && <Audio src={audioSrc} />}
    </AbsoluteFill>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function skinFor(style: CameraStyle) {
  switch (style) {
    case "phone":      return PhoneSkin;
    case "action":     return ActionSkin;
    case "broadcast":  return BroadcastSkin;
    case "cctv":       return CCTVSkin;
    default:           return PhoneSkin;
  }
}

function presetConfig(preset?: string): Partial<TumbleConfig> {
  switch (preset) {
    case "throw_up":  return THROW_UP;
    case "drop":      return DROP;
    case "handheld":  return HANDHELD;
    case "earthquake":return EARTHQUAKE;
    default:          return {};
  }
}
