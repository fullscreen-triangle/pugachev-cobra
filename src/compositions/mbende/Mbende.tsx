// Mbende Jerusarema — chaotic documentary
// All effects run through VideoEffectStack (canvas pixel transforms, render-safe)
// Text is full-screen, massive, animated via interpolate from absolute frame number

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
import type { VideoEffect } from '@/effects/video/types';
import { vhsTape }         from '@/effects/video/temporal/vhsTape';
import { blackAndWhite }   from '@/effects/video/chromatic/blackAndWhite';
import { invertColors }    from '@/effects/video/chromatic/invertColors';
import { posterize }       from '@/effects/video/chromatic/posterize';
import { silhouetteReplace } from '@/effects/video/chromatic/silhouetteReplace';
import { digitalGlitch }  from '@/effects/video/degradation/digitalGlitch';
import { scanlines }       from '@/effects/video/degradation/scanlines';
import { filmGrain }       from '@/effects/video/degradation/filmGrain';
import { halftoneScreen }  from '@/effects/video/material/halftoneScreen';
import { fabricWeave }     from '@/effects/video/material/fabricWeave';
import { paperTexture }    from '@/effects/video/material/paperTexture';

// ─────────────────────────────────────────────────────────────
// INLINE PIXEL-TRANSFORM EFFECTS
// These don't exist in the registry — implemented here directly
// ─────────────────────────────────────────────────────────────

// Sobel edge detection → neon wireframe on black
const edgeWireframe: VideoEffect = {
  id: 'custom.edge', namespace: 'custom', name: 'Edge Wireframe', description: '', power: 1, supports: [], parameters: [],
  transform(frame: ImageData): ImageData {
    const w = frame.width, h = frame.height;
    const d = frame.data;
    const src = new Uint8ClampedArray(d);
    const lum = (i: number) => (0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2]);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        const tl = lum((( y-1)*w+(x-1))*4), tc = lum(((y-1)*w+x)*4), tr = lum(((y-1)*w+(x+1))*4);
        const ml = lum((y*w+(x-1))*4),                                 mr = lum((y*w+(x+1))*4);
        const bl = lum(((y+1)*w+(x-1))*4), bc = lum(((y+1)*w+x)*4), br = lum(((y+1)*w+(x+1))*4);
        const gx = -tl - 2*ml - bl + tr + 2*mr + br;
        const gy = -tl - 2*tc - tr + bl + 2*bc + br;
        const mag = Math.min(255, Math.sqrt(gx*gx + gy*gy) * 2.5);
        // Neon green edges on black
        d[idx]   = 0;
        d[idx+1] = mag;
        d[idx+2] = Math.round(mag * 0.4);
        d[idx+3] = 255;
      }
    }
    return frame;
  },
  shader: '',
};

// Flip vertically (upside down)
const flipVertical: VideoEffect = {
  id: 'custom.flipV', namespace: 'custom', name: 'Flip Vertical', description: '', power: 1, supports: [], parameters: [],
  transform(frame: ImageData): ImageData {
    const w = frame.width, h = frame.height;
    const d = frame.data;
    const tmp = new Uint8ClampedArray(4);
    for (let y = 0; y < Math.floor(h / 2); y++) {
      for (let x = 0; x < w; x++) {
        const top = (y * w + x) * 4;
        const bot = ((h - 1 - y) * w + x) * 4;
        tmp[0]=d[top]; tmp[1]=d[top+1]; tmp[2]=d[top+2]; tmp[3]=d[top+3];
        d[top]=d[bot]; d[top+1]=d[bot+1]; d[top+2]=d[bot+2]; d[top+3]=d[bot+3];
        d[bot]=tmp[0]; d[bot+1]=tmp[1]; d[bot+2]=tmp[2]; d[bot+3]=tmp[3];
      }
    }
    return frame;
  },
  shader: '',
};

// Flip horizontally (mirror)
const flipHorizontal: VideoEffect = {
  id: 'custom.flipH', namespace: 'custom', name: 'Flip Horizontal', description: '', power: 1, supports: [], parameters: [],
  transform(frame: ImageData): ImageData {
    const w = frame.width, h = frame.height;
    const d = frame.data;
    const tmp = new Uint8ClampedArray(4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < Math.floor(w / 2); x++) {
        const l = (y * w + x) * 4;
        const r = (y * w + (w - 1 - x)) * 4;
        tmp[0]=d[l]; tmp[1]=d[l+1]; tmp[2]=d[l+2]; tmp[3]=d[l+3];
        d[l]=d[r]; d[l+1]=d[r+1]; d[l+2]=d[r+2]; d[l+3]=d[r+3];
        d[r]=tmp[0]; d[r+1]=tmp[1]; d[r+2]=tmp[2]; d[r+3]=tmp[3];
      }
    }
    return frame;
  },
  shader: '',
};

// Hard red silhouette — dark areas → solid saturated red
const redSilhouette: VideoEffect = {
  id: 'custom.redSilhouette', namespace: 'custom', name: 'Red Silhouette', description: '', power: 1, supports: [], parameters: [],
  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const threshold = (params?.threshold as number) ?? 0.45;
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2]) / 255;
      if (lum < threshold) {
        d[i] = 220; d[i+1] = 0; d[i+2] = 30;
      }
    }
    return frame;
  },
  shader: '',
};

// Chromatic blast — massive RGB channel split
const chromaticBlast: VideoEffect = {
  id: 'custom.chromaticBlast', namespace: 'custom', name: 'Chromatic Blast', description: '', power: 1, supports: [], parameters: [],
  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const shift = (params?.shift as number) ?? 40;
    const w = frame.width, h = frame.height;
    const d = frame.data;
    const src = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const di = (y * w + x) * 4;
        const rx = Math.min(w-1, x + shift);
        const bx = Math.max(0, x - shift);
        const ri = (y * w + rx) * 4;
        const bi = (y * w + bx) * 4;
        d[di]   = src[ri];       // red from right
        d[di+1] = src[di+1];     // green stays
        d[di+2] = src[bi+2];     // blue from left
      }
    }
    return frame;
  },
  shader: '',
};

// Pixel sort — sort pixels by brightness in vertical strips (chaotic)
const pixelSort: VideoEffect = {
  id: 'custom.pixelSort', namespace: 'custom', name: 'Pixel Sort', description: '', power: 1, supports: [], parameters: [],
  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const threshold = (params?.threshold as number) ?? 100;
    const w = frame.width, h = frame.height;
    const d = frame.data;
    for (let x = 0; x < w; x++) {
      // Collect pixels in column above threshold brightness
      let start = -1;
      for (let y = 0; y <= h; y++) {
        const i = (y * w + x) * 4;
        const lum = y < h ? (d[i] + d[i+1] + d[i+2]) / 3 : 0;
        if (lum > threshold && start === -1) { start = y; }
        else if ((lum <= threshold || y === h) && start !== -1) {
          // Sort the run [start, y) by brightness ascending
          const run: Array<[number,number,number,number]> = [];
          for (let ry = start; ry < y; ry++) {
            const ri = (ry * w + x) * 4;
            run.push([d[ri], d[ri+1], d[ri+2], d[ri+3]]);
          }
          run.sort((a,b) => (a[0]+a[1]+a[2]) - (b[0]+b[1]+b[2]));
          for (let ry = start; ry < y; ry++) {
            const ri = (ry * w + x) * 4;
            const px = run[ry - start];
            d[ri]=px[0]; d[ri+1]=px[1]; d[ri+2]=px[2]; d[ri+3]=px[3];
          }
          start = -1;
        }
      }
    }
    return frame;
  },
  shader: '',
};

// Hue rotate — shift all colours around the wheel
const hueRotate: VideoEffect = {
  id: 'custom.hueRotate', namespace: 'custom', name: 'Hue Rotate', description: '', power: 1, supports: [], parameters: [],
  transform(frame: ImageData, params?: Record<string, unknown>): ImageData {
    const angle = ((params?.angle as number) ?? 120) * Math.PI / 180;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    // Hue rotation matrix
    const m = [
      cos + (1-cos)/3,         (1-cos)/3 - sin*Math.sqrt(1/3), (1-cos)/3 + sin*Math.sqrt(1/3),
      (1-cos)/3 + sin*Math.sqrt(1/3), cos + (1-cos)/3,         (1-cos)/3 - sin*Math.sqrt(1/3),
      (1-cos)/3 - sin*Math.sqrt(1/3), (1-cos)/3 + sin*Math.sqrt(1/3), cos + (1-cos)/3,
    ];
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i]/255, g = d[i+1]/255, b = d[i+2]/255;
      d[i]   = Math.max(0, Math.min(255, Math.round((m[0]*r + m[1]*g + m[2]*b) * 255)));
      d[i+1] = Math.max(0, Math.min(255, Math.round((m[3]*r + m[4]*g + m[5]*b) * 255)));
      d[i+2] = Math.max(0, Math.min(255, Math.round((m[6]*r + m[7]*g + m[8]*b) * 255)));
    }
    return frame;
  },
  shader: '',
};

// ─────────────────────────────────────────────────────────────
// EFFECT SCHEDULE — dense, overlapping, rollercoaster
// Format: [startSec, endSec, effectIds[], params?[]]
// ─────────────────────────────────────────────────────────────

type EffSlot = { s: number; e: number; effects: Array<{ effect: VideoEffect; params?: Record<string,unknown> }> };

function slot(s: number, e: number, ...entries: Array<[VideoEffect, Record<string,unknown>?]>): EffSlot {
  return { s, e, effects: entries.map(([effect, params]) => ({ effect, params })) };
}

// Named aliases for the imported effects
const vhs        = vhsTape;
const bw         = blackAndWhite;
const glitch     = digitalGlitch;
const invert     = invertColors;
const grain      = filmGrain;
const silhouette = silhouetteReplace;
const halftone   = halftoneScreen;
const fabric     = fabricWeave;
const paper      = paperTexture;

const SLOTS: EffSlot[] = [
  // 0–3s: VHS tape + heavy grain intro
  slot(0,    3,    [vhs], [grain, {intensity:0.8}]),
  // 3–6s: flip upside down + chromatic blast
  slot(3,    6,    [flipVertical], [chromaticBlast, {shift:60}]),
  // 6–9s: hard edge wireframe (neon on black)
  slot(6,    9,    [edgeWireframe]),
  // 9–12s: BW + heavy scanlines
  slot(9,    12,   [bw], [scanlines, {intensity:0.85}]),
  // 12–15s: red silhouette — people become red ghosts
  slot(12,   15,   [redSilhouette, {threshold:0.5}]),
  // 15–18s: pixel sort chaos
  slot(15,   18,   [pixelSort, {threshold:80}]),
  // 18–21s: invert + posterize 3 levels = harsh cartoon
  slot(18,   21,   [invert], [posterize, {levels:3}]),
  // 21–24s: hue rotate 180° = alien colours
  slot(21,   24,   [hueRotate, {angle:180}]),
  // 24–27s: glitch maximum intensity
  slot(24,   27,   [glitch, {intensity:0.9, blockSize:8, frequency:0.8}], [chromaticBlast, {shift:30}]),
  // 27–30s: flip horizontal + grain
  slot(27,   30,   [flipHorizontal], [grain, {intensity:0.6}]),
  // 30–33s: halftone screen — newsprint look
  slot(30,   33,   [halftone, {dotSize:4, sharpness:1.0}]),
  // 33–36s: wireframe again but now combined with hue shift
  slot(33,   36,   [edgeWireframe], [hueRotate, {angle:90}]),
  // 36–40s: BW silhouette + scanlines double combo
  slot(36,   40,   [silhouette, {threshold:0.4, color:'#000000'}], [scanlines, {intensity:0.9}], [bw]),
  // 40–44s: VHS + pixel sort
  slot(40,   44,   [vhs], [pixelSort, {threshold:60}]),
  // 44–47s: full invert + chromatic blast
  slot(44,   47,   [invert], [chromaticBlast, {shift:50}]),
  // 47–51s: posterize 2 levels — pure flat shapes
  slot(47,   51,   [posterize, {levels:2}]),
  // 51–54s: red silhouette + glitch
  slot(51,   54,   [redSilhouette, {threshold:0.55}], [glitch, {intensity:0.7}]),
  // 54–57s: flip vertical + hue rotate — literally upside down alien
  slot(54,   57,   [flipVertical], [hueRotate, {angle:240}]),
  // 57–61s: fabric weave texture
  slot(57,   61,   [fabric]),
  // 61–64s: edge wireframe + posterize — pure skeleton lines
  slot(61,   64,   [edgeWireframe], [posterize, {levels:4}]),
  // 64–68s: chromatic blast max + scanlines
  slot(64,   68,   [chromaticBlast, {shift:80}], [scanlines, {intensity:0.7}]),
  // 68–72s: BW + grain + paper texture — old photograph explosion
  slot(68,   72,   [bw], [grain, {intensity:0.9}], [paper]),
  // 72–75s: glitch + flip horizontal
  slot(72,   75,   [glitch, {intensity:1.0, blockSize:12}], [flipHorizontal]),
  // 75–78s: invert only — hard cut
  slot(75,   78,   [invert]),
  // 78–82s: pixel sort + hue rotate
  slot(78,   82,   [pixelSort, {threshold:90}], [hueRotate, {angle:150}]),
  // 82–86s: red silhouette + chromatic blast
  slot(82,   86,   [redSilhouette, {threshold:0.5}], [chromaticBlast, {shift:45}]),
  // 86–90s: VHS full stack
  slot(86,   90,   [vhs], [scanlines, {intensity:0.6}], [grain, {intensity:0.7}]),
  // 90–93s: wireframe — back to skeleton bones
  slot(90,   93,   [edgeWireframe]),
  // 93–97s: flip vertical + BW — upside down B&W
  slot(93,   97,   [flipVertical], [bw], [scanlines, {intensity:0.8}]),
  // 97–101s: halftone + invert — CMYK nightmare
  slot(97,   101,  [halftone, {dotSize:3}], [invert]),
  // 101–105s: posterize 2 + flip horizontal
  slot(101,  105,  [posterize, {levels:2}], [flipHorizontal]),
  // 105–109s: chromatic blast + grain
  slot(105,  109,  [chromaticBlast, {shift:70}], [grain, {intensity:0.8}]),
  // 109–113s: glitch + hue 270°
  slot(109,  113,  [glitch, {intensity:0.85, blockSize:6}], [hueRotate, {angle:270}]),
  // 113–117s: red silhouette + wireframe — red skeleton outlines
  slot(113,  117,  [redSilhouette, {threshold:0.45}], [edgeWireframe]),
  // 117–121s: pixel sort + posterize
  slot(117,  121,  [pixelSort, {threshold:70}], [posterize, {levels:3}]),
  // 121–125s: VHS + flip + chromatic
  slot(121,  125,  [vhs], [flipVertical], [chromaticBlast, {shift:25}]),
  // 125–129s: BW + halftone — true newspaper
  slot(125,  129,  [bw], [halftone, {dotSize:5}]),
  // 129–133s: invert + pixel sort
  slot(129,  133,  [invert], [pixelSort, {threshold:100}]),
  // 133–137s: glitch + silhouette — shapes disintegrating
  slot(133,  137,  [glitch, {intensity:0.95}], [silhouette, {threshold:0.35, color:'#ffffff'}]),
  // 137–141s: hue rotate + scanlines finale
  slot(137,  141,  [hueRotate, {angle:200}], [scanlines, {intensity:0.75}]),
  // 141–145s: wireframe finale
  slot(141,  145,  [edgeWireframe], [grain, {intensity:0.5}]),
  // 145–162s: VHS + grain fade out
  slot(145,  162,  [vhs], [grain, {intensity:0.4}]),
];

// ─────────────────────────────────────────────────────────────
// TEXT DATA — enormous, colourful, positioned off-centre
// ─────────────────────────────────────────────────────────────

type TextEntry = {
  startSec: number;
  durSec: number;
  line1: string;
  line2?: string;
  line3?: string;
  color: string;
  size: number;
  x: string;  // CSS left
  y: string;  // CSS top
  transition: 'slam' | 'slide-left' | 'slide-up' | 'rotate-in' | 'scale-blast';
};

const TEXTS: TextEntry[] = [
  { startSec:  4,   durSec: 9,  line1: 'MBENDE',         line2: 'a popular dance',                   color: '#ffffff', size: 120, x: '5%',  y: '10%', transition: 'slam'       },
  { startSec: 20,   durSec: 10, line1: 'CHARACTERISED',   line2: 'by acrobatic',    line3: 'sensual movements', color: '#ffd700', size: 90,  x: '8%',  y: '55%', transition: 'slide-left' },
  { startSec: 36,   durSec: 10, line1: 'THE DANCE',       line2: 'named Mbende',    line3: 'before colonialism', color: '#ff4444', size: 100, x: '4%',  y: '15%', transition: 'rotate-in'  },
  { startSec: 52,   durSec: 10, line1: 'COLONIAL',        line2: 'pressure forced', line3: 'JERUSAREMA',         color: '#ffffff', size: 85,  x: '10%', y: '60%', transition: 'scale-blast'},
  { startSec: 68,   durSec: 9,  line1: 'COUPLES',         line2: 'take turns',      line3: 'in the centre',      color: '#aaffaa', size: 95,  x: '5%',  y: '20%', transition: 'slide-up'   },
  { startSec: 84,   durSec: 9,  line1: 'MEN CROUCH',      line2: 'jerking arms',    line3: 'kicking the ground', color: '#ff8800', size: 90,  x: '7%',  y: '50%', transition: 'slam'       },
  { startSec: 100,  durSec: 9,  line1: 'ONE DRUMMER',     line2: 'polyrhythmic',    line3: 'three drums',        color: '#00ffff', size: 100, x: '3%',  y: '12%', transition: 'rotate-in'  },
  { startSec: 116,  durSec: 9,  line1: 'NO FOOTWORK',     line2: 'no lyrics',       line3: 'no songs',           color: '#ffd700', size: 110, x: '6%',  y: '45%', transition: 'slide-left' },
  { startSec: 132,  durSec: 12, line1: 'JUST',            line2: 'an encounter',    line3: 'feel good',          color: '#ffffff', size: 140, x: '4%',  y: '25%', transition: 'scale-blast'},
];

// ─────────────────────────────────────────────────────────────
// TEXT COMPONENT — uses absolute frame, massive and animated
// ─────────────────────────────────────────────────────────────

function BigText({ entry, absFrame, fps }: { entry: TextEntry; absFrame: number; fps: number }) {
  const startFrame = Math.round(entry.startSec * fps);
  const endFrame   = Math.round((entry.startSec + entry.durSec) * fps);
  const inDur  = Math.round(fps * 0.3);
  const outDur = Math.round(fps * 0.4);

  const localFrame = absFrame - startFrame;
  if (localFrame < 0 || absFrame > endFrame) return null;

  const inProg  = Math.min(1, localFrame / inDur);
  const outProg = Math.min(1, (endFrame - absFrame) / outDur);
  const opacity = Math.min(smoothstep(inProg), smoothstep(outProg));

  let transform = 'none';
  switch (entry.transition) {
    case 'slam':
      const slam = 1 - smoothstep(inProg);
      transform = `scale(${2.5 - slam * 1.5})`;
      break;
    case 'slide-left':
      transform = `translateX(${(1 - smoothstep(inProg)) * -300}px)`;
      break;
    case 'slide-up':
      transform = `translateY(${(1 - smoothstep(inProg)) * 200}px)`;
      break;
    case 'rotate-in':
      const rp = smoothstep(inProg);
      transform = `rotate(${(1 - rp) * -15}deg) translateY(${(1 - rp) * 100}px)`;
      break;
    case 'scale-blast':
      const sp = smoothstep(inProg);
      transform = `scale(${0.2 + sp * 0.8}) skewX(${(1 - sp) * 10}deg)`;
      break;
  }

  // Ghost trail behind first word
  const trailOpacity = opacity * 0.35;

  return (
    <div style={{
      position: 'absolute',
      left: entry.x,
      top: entry.y,
      opacity,
      transform,
      fontFamily: '"Arial Black", "Impact", sans-serif',
      fontWeight: 900,
      lineHeight: 1.0,
      letterSpacing: '-0.02em',
      pointerEvents: 'none',
      maxWidth: '90%',
    }}>
      {/* Ghost trail for first word */}
      <div style={{
        position: 'absolute',
        color: entry.color,
        fontSize: entry.size,
        opacity: trailOpacity,
        transform: 'translateX(-20px)',
        whiteSpace: 'nowrap',
        filter: 'blur(2px)',
      }}>
        {entry.line1}
      </div>
      <div style={{
        position: 'absolute',
        color: entry.color,
        fontSize: entry.size,
        opacity: trailOpacity * 0.5,
        transform: 'translateX(-40px)',
        whiteSpace: 'nowrap',
        filter: 'blur(4px)',
      }}>
        {entry.line1}
      </div>

      {/* Line 1 — massive */}
      <div style={{
        fontSize: entry.size,
        color: entry.color,
        textShadow: `4px 4px 0px rgba(0,0,0,1), -2px -2px 0 rgba(0,0,0,1), 0 0 40px ${entry.color}`,
        whiteSpace: 'nowrap',
        position: 'relative',
      }}>
        {entry.line1}
      </div>

      {/* Line 2 */}
      {entry.line2 && (
        <div style={{
          fontSize: Math.round(entry.size * 0.55),
          color: '#ffffff',
          textShadow: '2px 2px 0 rgba(0,0,0,1)',
          marginTop: 4,
          letterSpacing: '0.05em',
        }}>
          {entry.line2}
        </div>
      )}

      {/* Line 3 */}
      {entry.line3 && (
        <div style={{
          fontSize: Math.round(entry.size * 0.55),
          color: entry.color === '#ffffff' ? '#ffff00' : entry.color,
          textShadow: '2px 2px 0 rgba(0,0,0,1)',
          letterSpacing: '0.05em',
        }}>
          {entry.line3}
        </div>
      )}
    </div>
  );
}

function smoothstep(t: number) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPOSITION
// ─────────────────────────────────────────────────────────────

export const Mbende: React.FC = () => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentSec = frame / fps;

  // Find active effect slots
  const activeSlots = SLOTS.filter(sl => currentSec >= sl.s && currentSec < sl.e);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>

      {/* VIDEO — muted, audio replaced */}
      <Video
        ref={videoRef}
        src={staticFile('mbende/mbende.mp4')}
        startFrom={0}
        volume={0}
      />

      {/* Replacement audio */}
      <Audio src={staticFile('mbende/phace-noise-cut.mp3')} />

      {/* EFFECTS — canvas pixel transforms, only when slot is active */}
      {SLOTS.map((sl, i) => {
        const fromFrame = Math.round(sl.s * fps);
        const durFrames = Math.round((sl.e - sl.s) * fps);
        return (
          <Sequence key={`sl-${i}`} from={fromFrame} durationInFrames={durFrames}>
            <VideoEffectStack
              effects={sl.effects}
              videoRef={videoRef}
              width={width}
              height={height}
            />
          </Sequence>
        );
      })}

      {/* TEXT — rendered from absolute frame, no Sequence wrapping */}
      {TEXTS.map((entry, i) => (
        <BigText key={`txt-${i}`} entry={entry} absFrame={frame} fps={fps} />
      ))}

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
