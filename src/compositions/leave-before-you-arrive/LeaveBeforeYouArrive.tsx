// ============================================================
// MEE — Generated Remotion composition
// Scene: leave-before-you-arrive
// Source: leave-before-you-arrive.mee
// ============================================================

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Video,
  Sequence,
} from 'remotion';
import React from 'react';

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
  fadeFrames = 18,
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

// ---- Main composition ------------------------------------------------

// fps=30, 30s → 900 frames
// Clip slots:
//   Act I   parkour.mp4   frames   0–240  (0s–8s)
//   Act II  longjump.mp4  frames 240–510  (8s–17s)
//   Act III cobra.mp4     frames 510–750  (17s–25s)
//   Act IV  black         frames 750–900  (25s–30s)

export const LeaveBeforeYouArrive: React.FC = () => {
  const { fps } = useVideoConfig();

  const s = (sec: number) => Math.round(sec * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>

      {/* ---- ACT I: PARKOUR (0–8s) --------------------------------- */}
      <Sequence from={s(0)} durationInFrames={s(8)}>
        <Video src="assets/leave-before-you-arrive/parkour.mp4" startFrom={0} />
        <BWOverlay />
      </Sequence>

      <Sequence from={s(1.5)} durationInFrames={s(3)}>
        <OverlayText
          text="do you happen to not be interested in a lot"
          fontSize={52}
        />
      </Sequence>

      {/* ---- ACT II: LONG JUMP (8–17s) ----------------------------- */}
      <Sequence from={s(8)} durationInFrames={s(9)}>
        <Video src="assets/leave-before-you-arrive/longjump.mp4" startFrom={0} />
        <BWOverlay />
      </Sequence>

      <Sequence from={s(9.5)} durationInFrames={s(3)}>
        <OverlayText
          text="is now the only thirst that should be quenched"
          fontSize={52}
        />
      </Sequence>

      <Sequence from={s(13.5)} durationInFrames={s(3)}>
        <OverlayText
          text="is it necessary to make an entrance"
          fontSize={52}
        />
      </Sequence>

      {/* ---- ACT III: COBRA (17–25s) -------------------------------- */}
      {/* Color returns here — the visual grammar breaks */}
      <Sequence from={s(17)} durationInFrames={s(8)}>
        <Video src="assets/leave-before-you-arrive/cobra.mp4" startFrom={0} />
      </Sequence>

      {/* Glitch on cobra nose-peak: ~19s–20s */}
      <Sequence from={s(19)} durationInFrames={s(1)}>
        <GlitchOverlay intensity={0.6} />
      </Sequence>

      {/* Main line — held across the peak */}
      <Sequence from={s(20)} durationInFrames={s(4)}>
        <OverlayText
          text="leave before you arrive"
          fontSize={88}
          fadeFrames={12}
        />
      </Sequence>

      {/* ---- ACT IV: BLACK (25–30s) --------------------------------- */}
      {/* No video — just black from backgroundColor */}

      <Sequence from={s(25)} durationInFrames={s(4)}>
        <OverlayText
          text="the only solution is to arrive before you leave"
          fontSize={44}
        />
      </Sequence>

      {/* Brand — bottom-right, small, grey */}
      <Sequence from={s(27)} durationInFrames={s(3)}>
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
  durationInFrames: 900,
  fps: 30,
  width: 1920,
  height: 1080,
  id: 'leave-before-you-arrive',
};
