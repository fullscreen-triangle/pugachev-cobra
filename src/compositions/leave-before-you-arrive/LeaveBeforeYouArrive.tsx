// ============================================================
// MEE — Leave Before You Arrive
// 50s · 30fps · 1500 frames
//
// Sequence (all clips from leave-before-you-arrive/sequence/):
//  00–04s  01_gibbon-01          4s
//  04–07s  02_beamon-01          3s
//  07–10s  03_powell-01          3s
//  10–14s  04_zoom-climb-01      4s
//  14–15s  05_powell-last1s      1s
//  15–16s  06_beamon-01-last1s   1s
//  16–20s  07_lufthansa-jump-02  4s
//  20–24s  08_beamon-02          4s
//  24–30s  09_lufthansa-jump     6s
//  30–34s  10_powell-01-full     3.64s (padded to 4s)
//  34–37s  11_longjump-4to7      3s
//  37–43s  12_beamon-02-full     6s
//  43–50s  13_zoom-climb-02      7s
//
// Audio: face-off-clip.mp3 (full duration, starts at 0)
// ============================================================

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Video,
  Audio,
  Sequence,
  staticFile,
} from 'remotion';
import React from 'react';
import { VideoEffectStack } from '@/effects/video/remotion/VideoEffectStack';
import { getVideoEffect } from '@/effects/video/registry';

// ---- Helpers ---------------------------------------------------------

const p = (path: string) => staticFile(`leave-before-you-arrive/sequence/${path}`);

// ---- Text overlay ----------------------------------------------------

interface OverlayTextProps {
  text: string;
  fontSize?: number;
  color?: string;
  fadeFrames?: number;
}

const OverlayText: React.FC<OverlayTextProps> = ({
  text,
  fontSize = 52,
  color = '#ffffff',
  fadeFrames = 12,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(
    frame,
    [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity,
      }}
    >
      <span
        style={{
          fontFamily: 'monospace',
          fontSize,
          color,
          letterSpacing: '0.08em',
          textTransform: 'lowercase',
          textAlign: 'center',
          padding: '0 120px',
          lineHeight: 1.3,
        }}
      >
        {text}
      </span>
    </AbsoluteFill>
  );
};

// ---- Glitch overlay --------------------------------------------------

const GlitchOverlay: React.FC<{ intensity?: number }> = ({ intensity = 0.6 }) => {
  const frame = useCurrentFrame();
  const shift = Math.sin(frame * 17.3) * intensity * 24;
  const hue   = (frame * 37) % 360;
  return (
    <AbsoluteFill
      style={{
        mixBlendMode: 'screen',
        filter: `hue-rotate(${hue}deg) saturate(${1 + intensity * 2})`,
        transform: `translateX(${shift}px)`,
        opacity: intensity * 0.5,
        background: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0,255,200,0.03) 2px,
          rgba(0,255,200,0.03) 4px
        )`,
      }}
    />
  );
};

// ---- B&W overlay -----------------------------------------------------

const BWOverlay: React.FC = () => (
  <AbsoluteFill
    style={{
      backdropFilter: 'grayscale(1)',
      filter: 'grayscale(1)',
      mixBlendMode: 'luminosity',
    }}
  />
);

// ---- Drift effect spec -----------------------------------------------

const DRIFT_EFFECT = [
  { effect: getVideoEffect('chromatic.interstitialDrift')!, params: { drift: 0.6 } },
];

// ---- Main composition ------------------------------------------------

export const LeaveBeforeYouArrive: React.FC = () => {
  const { fps } = useVideoConfig();
  const lastVideoRef = React.useRef<HTMLVideoElement>(null);

  const s = (sec: number) => Math.round(sec * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>

      {/* ---- Audio — runs the full 50s -------------------------------- */}
      <Audio src={staticFile('leave-before-you-arrive/face-off-clip.mp3')} startFrom={0} />

      {/* ================================================================
          CLIPS
          All B&W until the final clip (zoom-climb-02) where colour
          returns through the interstitial drift.
      ================================================================ */}

      {/* 00–04s  gibbon-01 */}
      <Sequence from={s(0)} durationInFrames={s(4)}>
        <Video src={p('01_gibbon-01.mp4')} startFrom={0} />
        <BWOverlay />
      </Sequence>

      {/* 04–07s  beamon-01 (first 3s) */}
      <Sequence from={s(4)} durationInFrames={s(3)}>
        <Video src={p('02_beamon-01.mp4')} startFrom={0} />
        <BWOverlay />
      </Sequence>

      {/* 07–10s  powell-01 (first 3s) */}
      <Sequence from={s(7)} durationInFrames={s(3)}>
        <Video src={p('03_powell-01.mp4')} startFrom={0} />
        <BWOverlay />
      </Sequence>

      {/* 10–14s  zoom-climb-01 */}
      <Sequence from={s(10)} durationInFrames={s(4)}>
        <Video src={p('04_zoom-climb-01.mp4')} startFrom={0} />
        <BWOverlay />
      </Sequence>

      {/* 14–15s  powell last 1s */}
      <Sequence from={s(14)} durationInFrames={s(1)}>
        <Video src={p('05_powell-last1s.mp4')} startFrom={0} />
        <BWOverlay />
      </Sequence>

      {/* 15–16s  beamon-01 last 1s */}
      <Sequence from={s(15)} durationInFrames={s(1)}>
        <Video src={p('06_beamon-01-last1s.mp4')} startFrom={0} />
        <BWOverlay />
      </Sequence>

      {/* 16–20s  lufthansa-jump-02 */}
      <Sequence from={s(16)} durationInFrames={s(4)}>
        <Video src={p('07_lufthansa-jump-02.mp4')} startFrom={0} />
        <BWOverlay />
      </Sequence>

      {/* 20–24s  beamon-02 (first 4s) */}
      <Sequence from={s(20)} durationInFrames={s(4)}>
        <Video src={p('08_beamon-02.mp4')} startFrom={0} />
        <BWOverlay />
      </Sequence>

      {/* 24–30s  lufthansa-jump (first 6s) */}
      <Sequence from={s(24)} durationInFrames={s(6)}>
        <Video src={p('09_lufthansa-jump.mp4')} startFrom={0} />
        <BWOverlay />
      </Sequence>

      {/* 30–34s  powell-01 full */}
      <Sequence from={s(30)} durationInFrames={s(4)}>
        <Video src={p('10_powell-01-full.mp4')} startFrom={0} />
        <BWOverlay />
      </Sequence>

      {/* 34–37s  longjump 4s–7s */}
      <Sequence from={s(34)} durationInFrames={s(3)}>
        <Video src={p('11_longjump-4to7.mp4')} startFrom={0} />
        <BWOverlay />
      </Sequence>

      {/* 37–43s  beamon-02 full */}
      <Sequence from={s(37)} durationInFrames={s(6)}>
        <Video src={p('12_beamon-02-full.mp4')} startFrom={0} />
        <BWOverlay />
      </Sequence>

      {/* 43–50s  zoom-climb-02 — colour returns through drift */}
      <Sequence from={s(43)} durationInFrames={s(7)}>
        <Video src={p('13_zoom-climb-02.mp4')} startFrom={0} ref={lastVideoRef} />
        <VideoEffectStack
          effects={DRIFT_EFFECT}
          videoRef={lastVideoRef}
          width={1920}
          height={1080}
        />
      </Sequence>

      {/* ================================================================
          TEXT OVERLAYS
      ================================================================ */}

      {/* Question 1 — over gibbon / beamon opening */}
      <Sequence from={s(1)} durationInFrames={s(4)}>
        <OverlayText text="do you happen to not be interested in a lot" fontSize={52} />
      </Sequence>

      {/* Question 2 — over the jump sequence */}
      <Sequence from={s(17)} durationInFrames={s(4)}>
        <OverlayText text="is now the only thirst that should be quenched" fontSize={52} />
      </Sequence>

      {/* Question 3 — over the long run sequence */}
      <Sequence from={s(26)} durationInFrames={s(4)}>
        <OverlayText text="is it necessary to make an entrance" fontSize={52} />
      </Sequence>

      {/* Glitch at the peak of zoom-climb-02 */}
      <Sequence from={s(45)} durationInFrames={s(1)}>
        <GlitchOverlay intensity={0.6} />
      </Sequence>

      {/* Main line */}
      <Sequence from={s(46)} durationInFrames={s(3)}>
        <OverlayText text="leave before you arrive" fontSize={88} fadeFrames={8} />
      </Sequence>

      {/* Resolution */}
      <Sequence from={s(47)} durationInFrames={s(2)}>
        <OverlayText
          text="the only solution is to arrive before you leave"
          fontSize={40}
          fadeFrames={6}
        />
      </Sequence>

      {/* Brand */}
      <Sequence from={s(48)} durationInFrames={s(2)}>
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            padding: '0 60px 48px 0',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 28,
              color: '#888888',
              letterSpacing: '0.15em',
              textTransform: 'lowercase',
            }}
          >
            zero-decoder-shift
          </span>
        </AbsoluteFill>
      </Sequence>

    </AbsoluteFill>
  );
};

export const LeaveBeforeYouArriveConfig = {
  component: LeaveBeforeYouArrive,
  durationInFrames: 1500, // 50s × 30fps
  fps: 30,
  width: 1920,
  height: 1080,
  id: 'leave-before-you-arrive',
};
