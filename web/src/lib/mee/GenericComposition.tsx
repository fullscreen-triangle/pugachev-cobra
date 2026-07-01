// ======================================================================
//  MEE — Generic Remotion Composition
//
//  Renders an IRNode tree directly at runtime — no eval, no TSX strings.
//  This is what @remotion/player receives as its `component` prop.
//  All clip/audio/effect behaviour is derived from the IR.
// ======================================================================

import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Video,
  Audio,
  Sequence,
  interpolate,
} from 'remotion';
import type {
  IRNode,
  IRClip,
  IRAudio,
  IRPrim,
  IRSegment,
  IRPeriodic,
  IRCompose,
} from './types';

// ---- Props -----------------------------------------------------------

export interface GenericCompositionProps {
  ir: IRNode;
  mediaBase?: string; // base for the ?path= query param, e.g. "/api/media-file?path"
}

// ---- Helpers ---------------------------------------------------------

function collectAll<T extends IRNode>(ir: IRNode, kind: T['kind']): T[] {
  if (ir.kind === kind) return [ir as T];
  if (ir.kind === 'IRCompose') {
    return (ir as IRCompose).steps.flatMap(s => collectAll<T>(s, kind));
  }
  return [];
}

function firstClip(ir: IRNode): IRClip | null {
  const clips = collectAll<IRClip>(ir, 'IRClip');
  return clips[0] ?? null;
}

// ---- Built-in effect overlays ----------------------------------------

function BWOverlay() {
  return (
    <AbsoluteFill
      style={{
        backdropFilter: 'grayscale(1)',
        filter: 'grayscale(1)',
        mixBlendMode: 'luminosity',
        pointerEvents: 'none',
      }}
    />
  );
}

function GlitchOverlay({ intensity = 0.4 }: { intensity?: number }) {
  const frame = useCurrentFrame();
  const shift = Math.sin(frame * 17.3) * intensity * 24;
  const hue = (frame * 37) % 360;
  return (
    <AbsoluteFill
      style={{
        mixBlendMode: 'screen',
        filter: `hue-rotate(${hue}deg) saturate(${1 + intensity * 2})`,
        transform: `translateX(${shift}px)`,
        opacity: intensity * 0.5,
        pointerEvents: 'none',
      }}
    />
  );
}

function TextOverlay({
  text,
  color = '#ffffff',
  fontSize = 96,
}: {
  text: string;
  color?: string;
  fontSize?: number;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fadeFrames = Math.min(18, Math.floor(durationInFrames * 0.2));
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
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          textAlign: 'center',
          padding: '0 80px',
          lineHeight: 1.3,
        }}
      >
        {text}
      </span>
    </AbsoluteFill>
  );
}

function PrimOverlay({ prim }: { prim: IRPrim }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  switch (prim.primitive) {
    case 'bw':
      return <BWOverlay />;

    case 'glitch':
      return <GlitchOverlay intensity={Number(prim.params.intensity ?? 0.4)} />;

    case 'text': {
      const text = String(prim.params.text ?? prim.params.content ?? '');
      const color = String(prim.params.color ?? '#ffffff');
      const fontSize = Number(prim.params.size ?? 96);
      return <TextOverlay text={text} color={color} fontSize={fontSize} />;
    }

    default: {
      // Registered spatial/photometric prims — express as CSS filter/transform
      const style = primToStyle(prim, t);
      if (!style) return null;
      return <AbsoluteFill style={{ ...style, pointerEvents: 'none' }} />;
    }
  }
}

function primToStyle(prim: IRPrim, t: number): React.CSSProperties | null {
  switch (prim.primitive) {
    case 'oscillate':
    case 'propagate': {
      const amp = Number(prim.params.amp ?? 12);
      const freq = Number(prim.params.freq ?? 0.8);
      const dy = Math.sin(t * freq * Math.PI * 2) * amp;
      return { transform: `translateY(${dy}px)` };
    }
    case 'colorGrade': {
      const temp = Number(prim.params.temperature ?? 0);
      const sat = Number(prim.params.saturation ?? 1);
      return { filter: `hue-rotate(${Math.round(temp / 30)}deg) saturate(${sat})` };
    }
    case 'saturation': {
      const amt = Number(prim.params.amount ?? 0);
      return { filter: `saturate(${amt})` };
    }
    case 'motionBlur': {
      const blur = Number(prim.params.amount ?? 4);
      return { filter: `blur(${blur}px)` };
    }
    default:
      return null;
  }
}

// ---- Segment renderer ------------------------------------------------

function SegmentLayer({
  seg,
  fps,
}: {
  seg: IRSegment;
  fps: number;
}) {
  const from = Math.round(seg.startSec * fps);
  const dur =
    seg.endSec >= 0
      ? Math.round((seg.endSec - seg.startSec) * fps)
      : undefined;

  return (
    <Sequence from={from} durationInFrames={dur}>
      <AbsoluteFill>
        {seg.effects
          .filter((e): e is IRPrim => e.kind === 'IRPrim')
          .map((prim, i) => (
            <PrimOverlay key={i} prim={prim} />
          ))}
      </AbsoluteFill>
    </Sequence>
  );
}

// ---- Periodic renderer -----------------------------------------------

function PeriodicLayers({
  per,
  totalDuration,
  fps,
}: {
  per: IRPeriodic;
  totalDuration: number;
  fps: number;
}) {
  const periodFrames = Math.round(per.periodSec * fps);
  const durFrames = Math.round(per.durationSec * fps);
  const count = Math.floor(totalDuration / per.periodSec) + 1;

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Sequence key={i} from={i * periodFrames} durationInFrames={durFrames}>
          <AbsoluteFill>
            {per.effects
              .filter((e): e is IRPrim => e.kind === 'IRPrim')
              .map((prim, j) => (
                <PrimOverlay key={j} prim={prim} />
              ))}
          </AbsoluteFill>
        </Sequence>
      ))}
    </>
  );
}

// ---- Main composition ------------------------------------------------

export const GenericComposition: React.FC<GenericCompositionProps> = ({
  ir,
  mediaBase = '/api/media-file?path',
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const totalSec = durationInFrames / fps;

  const clips   = collectAll<IRClip>(ir, 'IRClip');
  const audios  = collectAll<IRAudio>(ir, 'IRAudio');
  const segments = collectAll<IRSegment>(ir, 'IRSegment');
  const periodics = collectAll<IRPeriodic>(ir, 'IRPeriodic');
  const globalPrims = collectAll<IRPrim>(ir, 'IRPrim').filter(
    p => !segments.some(s => s.effects.includes(p)) &&
         !periodics.some(per => per.effects.includes(p))
  );

  const muteVideo = audios.some(a => a.muteVideo);

  const src = (filePath: string) => {
    if (filePath.startsWith('http') || filePath.startsWith('/api/')) return filePath;
    return `${mediaBase}=${encodeURIComponent(filePath)}`;
  };

  // For multi-clip scenes the `at` field is the composition timeline position,
  // and `duration` is how long it plays. Each clip starts at frame 0 of its file.
  const isMultiClip = clips.length > 1;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>

      {/* ---- Audio tracks ---- */}
      {audios.map((a, i) => (
        <Audio
          key={i}
          src={src(a.path)}
          startFrom={Math.round(a.startFrom * fps)}
          volume={a.volume}
        />
      ))}

      {/* ---- Video clips ---- */}
      {isMultiClip
        ? clips.map((clip, i) => (
            <Sequence
              key={i}
              from={Math.round(clip.at * fps)}
              durationInFrames={Math.round(clip.duration * fps)}
            >
              <Video src={src(clip.path)} startFrom={0} muted={muteVideo} />
            </Sequence>
          ))
        : clips.length === 1 && (
            <Video
              src={src(clips[0].path)}
              startFrom={Math.round(clips[0].at * fps)}
              muted={muteVideo}
            />
          )
      }

      {/* ---- Global prim overlays ---- */}
      {globalPrims.map((prim, i) => (
        <PrimOverlay key={i} prim={prim} />
      ))}

      {/* ---- Time-ranged segments ---- */}
      {segments.map((seg, i) => (
        <SegmentLayer key={i} seg={seg} fps={fps} />
      ))}

      {/* ---- Periodic effects ---- */}
      {periodics.map((per, i) => (
        <PeriodicLayers key={i} per={per} totalDuration={totalSec} fps={fps} />
      ))}

    </AbsoluteFill>
  );
};

// ---- Config helper ---------------------------------------------------
// Derives Remotion Player props from the IR so the caller doesn't need
// to dig into the tree.

export interface CompositionConfig {
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

export function irToConfig(ir: IRNode, fps = 30): CompositionConfig {
  const clips = collectAll<IRClip>(ir, 'IRClip');
  // For multi-clip: total duration = end of the last clip (at + duration)
  const durationSec = clips.length > 0
    ? Math.max(...clips.map(c => c.at + c.duration))
    : 30;
  return {
    durationInFrames: Math.ceil(durationSec * fps),
    fps,
    width: 1920,
    height: 1080,
  };
}
