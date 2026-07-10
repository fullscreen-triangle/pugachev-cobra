/**
 * Remotion compositions:
 *
 *   <VideoBlendComp>    — Mix two videos with any blend mode + optional wipe
 *   <VideoTextMaskComp> — Video inside text / text punched out of video
 */

import React, { useEffect, useMemo, useRef } from "react";
import {
  AbsoluteFill, useCurrentFrame, useVideoConfig, Video,
  interpolate, Easing,
} from "remotion";

import { BlendRenderer }    from "../blend/BlendRenderer.js";
import { TextMaskRenderer } from "../textmask/TextMaskRenderer.js";
import type { BlendConfig, TextMaskConfig } from "../types/index.js";
import { DEFAULT_BLEND, DEFAULT_TEXT_MASK } from "../types/index.js";

// ══════════════════════════════════════════════════════════════════════════════
// VideoBlendComp
// ══════════════════════════════════════════════════════════════════════════════

export interface VideoBlendProps {
  /** Primary video (A) */
  srcA: string;
  /** Secondary video (B) */
  srcB: string;
  config?: Partial<BlendConfig>;
  /**
   * Animate the mix value over time.
   * Array of [frame, mixValue] keyframes — interpolated between them.
   * Overrides config.mix when provided.
   */
  mixKeyframes?: Array<[number, number]>;
  /**
   * Animate the wipe position over time.
   * Array of [frame, wipePosition 0-1] keyframes.
   */
  wipeKeyframes?: Array<[number, number]>;
}

export const VideoBlendComp: React.FC<VideoBlendProps> = ({
  srcA, srcB, config: cfgOverride = {}, mixKeyframes, wipeKeyframes,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BlendRenderer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    rendererRef.current = new BlendRenderer(canvasRef.current);
    return () => { rendererRef.current?.dispose(); rendererRef.current = null; };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    const vA = videoARef.current;
    const vB = videoBRef.current;
    if (!renderer || !vA || !vB) return;

    // Resolve animated mix
    let mix = cfgOverride.mix ?? DEFAULT_BLEND.mix;
    if (mixKeyframes && mixKeyframes.length >= 2) {
      const frames = mixKeyframes.map(k => k[0]);
      const values = mixKeyframes.map(k => k[1]);
      mix = interpolate(frame, frames, values, {
        extrapolateLeft:  "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.ease),
      });
    }

    // Resolve animated wipe
    let wipe = cfgOverride.wipe ?? DEFAULT_BLEND.wipe ?? null;
    if (wipeKeyframes && wipeKeyframes.length >= 2 && wipe) {
      const frames = wipeKeyframes.map(k => k[0]);
      const values = wipeKeyframes.map(k => k[1]);
      mix = interpolate(frame, frames, values, {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      });
      // When using wipe keyframes, the wipe position IS the mix value
    }

    const cfg: BlendConfig = { ...DEFAULT_BLEND, ...cfgOverride, mix };
    renderer.render(vA, vB, cfg);
  }, [frame, cfgOverride, mixKeyframes, wipeKeyframes]);

  return (
    <AbsoluteFill>
      <video ref={videoARef} src={srcA} style={{ display: "none" }} muted playsInline />
      <video ref={videoBRef} src={srcB} style={{ display: "none" }} muted playsInline />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// VideoTextMaskComp
// ══════════════════════════════════════════════════════════════════════════════

export interface VideoTextMaskProps {
  /** Main video that plays inside/outside the text */
  videoSrc: string;
  /**
   * Background video — shown outside text (video_in_text) or inside hole (hole_in_video).
   * If omitted, cfg.background is used (solid colour or transparent).
   */
  bgVideoSrc?: string;
  config?: Partial<TextMaskConfig>;
  /**
   * Animate the text content over time — swap words at keyframes.
   * Array of [frame, text].
   */
  textKeyframes?: Array<[number, string]>;
  /**
   * Flip between video_in_text and hole_in_video at this frame.
   * Useful for a mid-clip reveal.
   */
  flipModeAtFrame?: number;
}

export const VideoTextMaskComp: React.FC<VideoTextMaskProps> = ({
  videoSrc, bgVideoSrc, config: cfgOverride = {}, textKeyframes, flipModeAtFrame,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const videoRef   = useRef<HTMLVideoElement>(null);
  const bgRef      = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TextMaskRenderer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    rendererRef.current = new TextMaskRenderer(canvasRef.current);
    return () => { rendererRef.current?.dispose(); rendererRef.current = null; };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    const video    = videoRef.current;
    if (!renderer || !video) return;

    // Resolve text from keyframes
    let text = cfgOverride.text ?? DEFAULT_TEXT_MASK.text;
    if (textKeyframes && textKeyframes.length > 0) {
      // Use the text from the most recent keyframe at or before current frame
      for (let i = textKeyframes.length - 1; i >= 0; i--) {
        if (frame >= textKeyframes[i][0]) { text = textKeyframes[i][1]; break; }
      }
    }

    // Resolve mode flip
    let mode = cfgOverride.mode ?? DEFAULT_TEXT_MASK.mode;
    if (flipModeAtFrame !== undefined && frame >= flipModeAtFrame) {
      mode = mode === "video_in_text" ? "hole_in_video" : "video_in_text";
    }

    const cfg: TextMaskConfig = { ...DEFAULT_TEXT_MASK, ...cfgOverride, text, mode };
    renderer.render(video, cfg, bgRef.current ?? null);
  }, [frame, cfgOverride, textKeyframes, flipModeAtFrame]);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <video ref={videoRef}   src={videoSrc}   style={{ display: "none" }} muted playsInline />
      {bgVideoSrc && (
        <video ref={bgRef}    src={bgVideoSrc} style={{ display: "none" }} muted playsInline />
      )}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
