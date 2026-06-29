// ============================================================
// MEE — Generated Remotion composition
// Scene: be-the-one-we-need
// Source: be-the-one-we-need.mee
// ============================================================

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Video,
  Sequence,
  staticFile,
} from 'remotion';
import React from 'react';
import { VideoEffectStack } from '@/effects/video/remotion/VideoEffectStack';
import { getVideoEffect } from '@/effects/video/registry';

// ---- Shared primitives -----------------------------------------------

interface OverlayTextProps {
  text: string;
  fontSize?: number;
  color?: string;
  fadeFrames?: number;
  align?: 'center' | 'left' | 'right';
}

const OverlayText: React.FC<OverlayTextProps> = ({
  text,
  fontSize = 52,
  color = '#ffffff',
  fadeFrames = 12,
  align = 'center',
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
        justifyContent: align === 'center' ? 'center' : align === 'left' ? 'flex-start' : 'flex-end',
        pointerEvents: 'none',
        opacity,
        padding: '0 120px',
      }}
    >
      <span
        style={{
          fontFamily: 'monospace',
          fontSize,
          color,
          letterSpacing: '0.06em',
          textTransform: 'lowercase',
          textAlign: align,
          lineHeight: 1.35,
        }}
      >
        {text}
      </span>
    </AbsoluteFill>
  );
};

// B&W via CSS filter — layered over the video
const BWOverlay: React.FC = () => (
  <AbsoluteFill
    style={{
      backdropFilter: 'grayscale(1)',
      filter: 'grayscale(1)',
      mixBlendMode: 'luminosity',
    }}
  />
);

// Desaturated (partial colour return) — used in act IV
const DesatOverlay: React.FC<{ amount?: number }> = ({ amount = 0.6 }) => (
  <AbsoluteFill
    style={{
      filter: `saturate(${1 - amount})`,
      mixBlendMode: 'luminosity',
      opacity: amount,
    }}
  />
);

// ---- Clip helper ---------------------------------------------------------

interface ClipProps {
  src: string;
  startFrom?: number;
}

const Clip: React.FC<ClipProps> = ({ src, startFrom = 0 }) => (
  <Video src={src} startFrom={startFrom} />
);

// InterstitialDrift — the signature effect. Applied only to the light clip
// (the single colour moment). At drift=0.5 it's subtle on the keyhole beam.
const DRIFT_EFFECT = [
  { effect: getVideoEffect('chromatic.interstitialDrift')!, params: { drift: 0.5 } },
];

// ---- Main composition ---------------------------------------------------
//
// Timeline (30fps):
//   Act I   — The Three Questions (0–9s, frames 0–270)
//     mirror   0s–3s    frames   0–90
//     shadow   3s–6s    frames  90–180
//     crowd    6s–9s    frames 180–270
//   Act II  — The Gap (9–12s, frames 270–360)
//     hands    9s–12s   frames 270–360
//   Act III — The Theorem (12–18s, frames 360–540)
//     static  12s–15s   frames 360–450
//     archive 15s–18s   frames 450–540
//   Act IV  — The Unbridgeable (18–22s, frames 540–660)
//     lip     18s–20s   frames 540–600
//     ocean   20s–22s   frames 600–660
//   Act V   — Resolution (22–28s, frames 660–840)
//     babel   22s–25s   frames 660–750
//     light   25s–28s   frames 750–840

export const BeTheOneWeNeed: React.FC = () => {
  const { fps } = useVideoConfig();
  const s = (sec: number) => Math.round(sec * fps);
  const lightVideoRef = React.useRef<HTMLVideoElement>(null);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>

      {/* ---- ACT I: THE THREE QUESTIONS (0–9s) -------------------- */}

      {/* mirror — "are you what you are?" */}
      <Sequence from={s(0)} durationInFrames={s(3)}>
        <Clip src={staticFile('be-the-one-we-need/mirror.mp4')} />
        <BWOverlay />
      </Sequence>
      <Sequence from={s(0.3)} durationInFrames={s(2.4)}>
        <OverlayText text="are you what you are ?" fontSize={56} />
      </Sequence>

      {/* shadow — "are you represented by what you are?" */}
      <Sequence from={s(3)} durationInFrames={s(3)}>
        <Clip src={staticFile('be-the-one-we-need/shadow.mp4')} />
        <BWOverlay />
      </Sequence>
      <Sequence from={s(3.3)} durationInFrames={s(2.4)}>
        <OverlayText text="are you represented by what you are ?" fontSize={48} />
      </Sequence>

      {/* crowd — "are you what you understand you are?" */}
      <Sequence from={s(6)} durationInFrames={s(3)}>
        <Clip src={staticFile('be-the-one-we-need/crowd.mp4')} />
        <BWOverlay />
      </Sequence>
      <Sequence from={s(6.3)} durationInFrames={s(2.4)}>
        <OverlayText text="are you what you understand you are ?" fontSize={48} />
      </Sequence>

      {/* ---- ACT II: THE GAP (9–12s) ------------------------------ */}
      {/* hands reaching but not touching — no text */}

      <Sequence from={s(9)} durationInFrames={s(3)}>
        <Clip src={staticFile('be-the-one-we-need/hands.mp4')} />
        <BWOverlay />
      </Sequence>

      {/* ---- ACT III: THE THEOREM (12–18s) ------------------------ */}
      {/* Split sentence across two clips — weight each half */}

      {/* static — "others can only understand" */}
      <Sequence from={s(12)} durationInFrames={s(3)}>
        <Clip src={staticFile('be-the-one-we-need/static.mp4')} />
        <BWOverlay />
      </Sequence>
      <Sequence from={s(12.2)} durationInFrames={s(2.6)}>
        <OverlayText text="others can only understand" fontSize={60} />
      </Sequence>

      {/* archive — "what you understand" */}
      <Sequence from={s(15)} durationInFrames={s(3)}>
        <Clip src={staticFile('be-the-one-we-need/archive.mp4')} />
        <BWOverlay />
      </Sequence>
      <Sequence from={s(15.2)} durationInFrames={s(2.6)}>
        <OverlayText text="what you understand" fontSize={60} />
      </Sequence>

      {/* ---- ACT IV: THE UNBRIDGEABLE (18–22s) -------------------- */}
      {/* Mouth moving — no text. Then ocean. Colour begins returning. */}

      {/* lip — silent, desaturated (not fully B&W) */}
      <Sequence from={s(18)} durationInFrames={s(2)}>
        <Clip src={staticFile('be-the-one-we-need/lip.mp4')} />
        <DesatOverlay amount={0.7} />
      </Sequence>

      {/* ocean — depth invisible, desaturated */}
      <Sequence from={s(20)} durationInFrames={s(2)}>
        <Clip src={staticFile('be-the-one-we-need/ocean.mp4')} />
        <DesatOverlay amount={0.5} />
      </Sequence>

      {/* ---- ACT V: RESOLUTION (22–28s) --------------------------- */}

      {/* babel — B&W diagnosis */}
      <Sequence from={s(22)} durationInFrames={s(3)}>
        <Clip src={staticFile('be-the-one-we-need/babel.mp4')} />
        <BWOverlay />
      </Sequence>
      <Sequence from={s(22.2)} durationInFrames={s(2.6)}>
        <OverlayText text="no soul should be misunderstood" fontSize={52} />
      </Sequence>

      {/* light — full colour, the only colour moment.             */}
      {/* InterstitialDrift applied: colour returns, but through   */}
      {/* a pipeline that belongs to no display. The signature.    */}
      <Sequence from={s(25)} durationInFrames={s(3)}>
        <Video src={staticFile('be-the-one-we-need/light.mp4')} startFrom={0} ref={lightVideoRef} />
        <VideoEffectStack
          effects={DRIFT_EFFECT}
          videoRef={lightVideoRef}
          width={1920}
          height={1080}
        />
      </Sequence>
      <Sequence from={s(25.5)} durationInFrames={s(2)}>
        <OverlayText text="be the one we need" fontSize={72} fadeFrames={8} />
      </Sequence>

    </AbsoluteFill>
  );
};

export const BeTheOneWeNeedConfig = {
  component: BeTheOneWeNeed,
  durationInFrames: 840,   // 28s × 30fps
  fps: 30,
  width: 1920,
  height: 1080,
  id: 'be-the-one-we-need',
};
