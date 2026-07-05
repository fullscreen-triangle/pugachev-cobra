// ============================================================
// Mbende Jerusarema Documentary
// 162.5s · 25fps · single clip
//
// Effects use VideoEffectStack (canvas pixel transforms — render-safe)
// Text uses Remotion Sequence + interpolate for fade/slide/scale/rotate/wave
// ============================================================

import React, { useRef } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Video,
  Audio,
  Sequence,
  interpolate,
  staticFile,
} from 'remotion';
import { VideoEffectStack } from '@/effects/video/remotion/VideoEffectStack';
import { getVideoEffect } from '@/effects/video/registry';

// ---- helpers -------------------------------------------------------

function sec(s: number, fps: number) {
  return Math.round(s * fps);
}

function smoothstep(t: number) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

// ---- MotionTrailWord -----------------------------------------------

function MotionTrailWord({ word, color = '#ffffff' }: { word: string; color?: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const inF  = Math.round(fps * 0.4);
  const outF = Math.round(fps * 0.4);

  const opacity = interpolate(
    frame,
    [0, inF, durationInFrames - outF, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const scale = interpolate(frame, [0, inF], [0.4, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const trails = [
    { delay: 4,  alpha: 0.30, sc: 0.92 },
    { delay: 8,  alpha: 0.18, sc: 0.84 },
    { delay: 13, alpha: 0.08, sc: 0.76 },
  ];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {trails.map((t, i) => {
        const f = Math.max(0, frame - t.delay);
        const tOp = smoothstep(Math.min(1, f / inF)) * opacity;
        const tSc = interpolate(f, [0, inF], [0.4, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        return (
          <span key={i} style={{
            position: 'absolute', top: 0, left: 0,
            opacity: t.alpha * tOp,
            transform: `scale(${tSc})`,
            transformOrigin: 'left center',
            color, pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            {word}
          </span>
        );
      })}
      <span style={{
        opacity, transform: `scale(${scale})`, transformOrigin: 'left center',
        display: 'inline-block', color,
      }}>
        {word}
      </span>
    </div>
  );
}

// ---- TextLine ------------------------------------------------------

type TT = 'fade' | 'slide-up' | 'slide-left' | 'scale' | 'rotate' | 'wave';

function TextLine({
  firstWord, rest, transition, color = '#ffffff', fontSize = 38,
}: { firstWord: string; rest: string; transition: TT; color?: string; fontSize?: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const inF  = Math.round(fps * 0.5);
  const outF = Math.round(fps * 0.4);

  const progress = smoothstep(Math.min(1, frame / inF));
  const exitProg = smoothstep(Math.min(1, (durationInFrames - frame) / outF));
  const opacity  = Math.min(progress, exitProg);

  let transform = 'none';
  switch (transition) {
    case 'slide-up':   transform = `translateY(${(1 - progress) * 50}px)`; break;
    case 'slide-left': transform = `translateX(${(1 - progress) * -80}px)`; break;
    case 'scale':      transform = `scale(${0.55 + progress * 0.45})`; break;
    case 'rotate':     transform = `rotate(${(1 - progress) * -10}deg) translateY(${(1 - progress) * 25}px)`; break;
    case 'wave': {
      const w = Math.sin(frame * 0.25) * 5 * (1 - Math.min(1, frame / (inF * 2)));
      transform = `translateY(${(1 - progress) * 35 + w}px)`;
      break;
    }
  }

  const lines = rest.split('\n');

  return (
    <div style={{
      opacity, transform,
      fontFamily: 'monospace',
      textAlign: 'center',
      pointerEvents: 'none',
    }}>
      {/* First word — large with motion trail */}
      <div style={{
        fontSize: 80, fontWeight: 900, letterSpacing: '0.06em',
        color, textShadow: '0 3px 16px rgba(0,0,0,1)',
        marginBottom: 12,
      }}>
        <MotionTrailWord word={firstWord} color={color} />
      </div>
      {/* Body lines */}
      {lines.map((line, i) => (
        <div key={i} style={{
          fontSize, color: 'rgba(255,255,255,0.88)',
          letterSpacing: '0.04em', lineHeight: 1.55,
          textShadow: '0 2px 10px rgba(0,0,0,0.95)',
          padding: '0 100px',
        }}>
          {line}
        </div>
      ))}
    </div>
  );
}

// ---- Paragraph data ------------------------------------------------

const PARAGRAPHS: Array<{ firstWord: string; rest: string; transition: TT; color: string }> = [
  { firstWord: 'Mbende',        rest: 'is a popular dance style\npractised by the Zezuru of Murehwa',                   transition: 'scale',      color: '#ffffff' },
  { firstWord: 'Characterised', rest: 'by acrobatic and sensual movements\nthe point is for the encounter to feel good',  transition: 'slide-up',   color: '#ffd700' },
  { firstWord: 'The',           rest: 'dance was named Mbende before colonialism\nwrapped as "fertility" — pleasure costs labour', transition: 'fade', color: '#ffffff' },
  { firstWord: 'Colonial',      rest: 'social pressure forced a name change\nto Jerusarema — to remove sexual connotations', transition: 'slide-left', color: '#ff6666' },
  { firstWord: 'Couples',       rest: 'take turns dancing in the centre\na front flip is a strict requirement for flair', transition: 'wave',       color: '#ffffff' },
  { firstWord: 'Men',           rest: 'often crouch whilst jerking their arms\nvigorously kicking the ground — imitating a mole', transition: 'rotate', color: '#aaffaa' },
  { firstWord: 'Played',        rest: 'by a polyrhythmic single drummer\nwith clappers, triangles and women yodelling',  transition: 'slide-up',   color: '#ffffff' },
  { firstWord: 'Mbende',        rest: 'needs no footwork, no drummers\nno songs or lyrics are involved',                 transition: 'scale',      color: '#ffd700' },
  { firstWord: 'It',            rest: 'just has to be an encounter\nsufficient to make one feel good.',                  transition: 'fade',       color: '#ffffff' },
];

const TEXT_START = 20;  // first para at 20s
const TEXT_SLOT  = 16;  // each para: 12s visible + 4s gap

// ---- Effect schedule: 10 × 3s, every 15s from 0.03s ---------------
// Maps to real pixel-transform effects via the registry

const EFFECT_SCHEDULE: Array<{ at: number; ids: string[]; params?: Record<string, unknown>[] }> = [
  { at: 0.03,   ids: ['temporal.vhs', 'degradation.scanlines', 'degradation.grain'] },
  { at: 15.03,  ids: ['chromatic.bw', 'degradation.grain'] },
  { at: 30.03,  ids: ['degradation.scanlines'],             params: [{ intensity: 0.65 }] },
  { at: 45.03,  ids: ['degradation.scanlines'],             params: [{ intensity: 0.65 }] },
  { at: 60.03,  ids: ['degradation.glitch', 'chromatic.invert', 'chromatic.posterize'] },
  { at: 75.03,  ids: ['chromatic.invert', 'degradation.grain'] },
  { at: 90.03,  ids: ['chromatic.posterize'],               params: [{ levels: 4 }] },
  { at: 105.03, ids: ['degradation.scanlines'],             params: [{ intensity: 0.65 }] },
  { at: 120.03, ids: ['temporal.vhs', 'degradation.scanlines', 'degradation.grain'] },
  { at: 135.03, ids: ['chromatic.bw', 'degradation.grain'] },
];

const EFFECT_DUR = 3; // seconds

// ---- Main composition ----------------------------------------------

export const Mbende: React.FC = () => {
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>

      {/* Video — muted; audio replaced below */}
      <Video
        ref={videoRef}
        src={staticFile('mbende/mbende.mp4')}
        startFrom={0}
        volume={0}
      />

      {/* Replacement audio track */}
      <Audio src={staticFile('mbende/phace-noise-cut.mp3')} />

      {/* ---- Effect slots: canvas pixel transforms ---- */}
      {EFFECT_SCHEDULE.map((slot, si) => {
        const effects = slot.ids
          .map((id, ei) => {
            const eff = getVideoEffect(id);
            if (!eff) return null;
            return { effect: eff, params: slot.params?.[ei] };
          })
          .filter((e): e is { effect: NonNullable<ReturnType<typeof getVideoEffect>>; params: Record<string, unknown> | undefined } => e !== null);

        if (effects.length === 0) return null;

        return (
          <Sequence key={`eff-${si}`} from={sec(slot.at, fps)} durationInFrames={sec(EFFECT_DUR, fps)}>
            <VideoEffectStack
              effects={effects}
              videoRef={videoRef}
              width={width}
              height={height}
            />
          </Sequence>
        );
      })}

      {/* ---- Text overlays ---- */}
      {PARAGRAPHS.map((para, i) => {
        const start = TEXT_START + i * TEXT_SLOT;
        const dur   = TEXT_SLOT - 4; // 12s visible
        if (start + dur > durationInFrames / fps) return null;
        return (
          <Sequence key={`text-${i}`} from={sec(start, fps)} durationInFrames={sec(dur, fps)}>
            <AbsoluteFill style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', pointerEvents: 'none',
            }}>
              <TextLine
                firstWord={para.firstWord}
                rest={para.rest}
                transition={para.transition}
                color={para.color}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

    </AbsoluteFill>
  );
};

export const MbendeConfig = {
  component: Mbende,
  durationInFrames: Math.round(162.5 * 25),
  fps: 25,
  width: 1920,
  height: 1080,
  id: 'mbende',
};
