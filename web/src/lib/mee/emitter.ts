// ======================================================================
//  MEE — IR Builder + Remotion Emitter
//
//  IR builder: AST + resolved primitives → IRNode tree.
//  Remotion emitter: IRNode tree → TypeScript/TSX source string.
// ======================================================================

import {
  SceneNode, PipelineStep,
  IRNode, IRClip, IRAudio, IRPrim, IRCompose, IRHole,
  IRDetect, IRSelect, IRObjectEffect, IRShader, IRSegment, IRPeriodic,
} from './types';
import { PrimitiveSpec, resolvePrimitive, deriveChain } from './registry';

// ---- IR builder ------------------------------------------------------

export function buildIR(scene: SceneNode, resolvedPrimitives: PrimitiveSpec[]): IRNode {
  const steps: IRNode[] = [];

  for (const step of scene.pipeline.steps) {
    const node = buildStep(step, resolvedPrimitives);
    if (node) steps.push(node);
  }

  const hasActsLike = scene.pipeline.steps.some(s => s.kind === 'ActsLike');
  if (hasActsLike) {
    const explicitNames = new Set(
      steps
        .filter(s => s.kind === 'IRCompose')
        .flatMap(s => (s as IRCompose).steps)
        .filter(s => s.kind === 'IRPrim')
        .map(s => (s as IRPrim).primitive)
    );
    const unplaced = resolvedPrimitives.filter(p => !explicitNames.has(p.name));
    const ordered = deriveChain(unplaced);
    const primNodes: IRPrim[] = ordered.map(p => ({
      kind: 'IRPrim' as const,
      primitive: p.name,
      namespace: p.namespace,
      params: { ...p.defaultParams },
      power: p.power,
    }));
    if (primNodes.length > 0) steps.push({ kind: 'IRCompose', steps: primNodes });
  }

  return { kind: 'IRCompose', steps };
}

function buildStep(step: PipelineStep, _resolved: PrimitiveSpec[]): IRNode | null {
  switch (step.kind) {
    case 'Clip':
      return {
        kind: 'IRClip',
        path: step.path,
        at: step.at,
        duration: step.for > 0 ? step.for : 30,
      } satisfies IRClip;

    case 'Audio':
      return {
        kind: 'IRAudio',
        path: step.path,
        muteVideo: step.muteVideo,
        startFrom: step.startFrom,
        volume: step.volume,
      } satisfies IRAudio;

    case 'Segment': {
      const effects: IRNode[] = step.effects.map(eff => {
        const spec = resolvePrimitive(eff.name);
        if (spec) {
          return {
            kind: 'IRPrim' as const,
            primitive: spec.name,
            namespace: spec.namespace,
            params: { ...spec.defaultParams, ...eff.params },
            power: spec.power,
          };
        }
        // Unknown primitives (bw, boxes, text, glitch) emitted as tagged IRPrim
        return {
          kind: 'IRPrim' as const,
          primitive: eff.name,
          namespace: 'photometric' as const,
          params: eff.params,
          power: 0.3,
        };
      });
      return {
        kind: 'IRSegment',
        startSec: step.startSec,
        endSec: step.endSec,
        effects,
      } satisfies IRSegment;
    }

    case 'Periodic': {
      const effects: IRNode[] = step.effects.map(eff => {
        const spec = resolvePrimitive(eff.name);
        if (spec) {
          return {
            kind: 'IRPrim' as const,
            primitive: spec.name,
            namespace: spec.namespace,
            params: { ...spec.defaultParams, ...eff.params },
            power: spec.power,
          };
        }
        return {
          kind: 'IRPrim' as const,
          primitive: eff.name,
          namespace: 'temporal' as const,
          params: eff.params,
          power: 0.3,
        };
      });
      return {
        kind: 'IRPeriodic',
        periodSec: step.periodSec,
        durationSec: step.durationSec,
        effects,
      } satisfies IRPeriodic;
    }

    case 'ActsLike':
      return { kind: 'IRHole', description: step.description } satisfies IRHole;

    case 'Compose': {
      const primNodes: IRPrim[] = [];
      for (const eff of step.effects) {
        if (eff.name.startsWith('brand:')) {
          const conf = (eff.params.confidence as number) ?? 0.8;
          primNodes.push({
            kind: 'IRPrim', primitive: eff.name,
            namespace: 'photometric', params: eff.params, power: conf * 0.3,
          });
          continue;
        }
        const spec = resolvePrimitive(eff.name);
        if (spec) {
          primNodes.push({
            kind: 'IRPrim', primitive: spec.name,
            namespace: spec.namespace,
            params: { ...spec.defaultParams, ...eff.params },
            power: spec.power,
          });
        } else {
          primNodes.push({
            kind: 'IRPrim', primitive: eff.name,
            namespace: 'spatial', params: eff.params, power: 0,
          });
        }
      }
      return { kind: 'IRCompose', steps: primNodes };
    }

    case 'Render':
      return null;

    case 'Detect':
      return { kind: 'IRDetect', targets: step.targets, minConfidence: step.minConfidence } satisfies IRDetect;

    case 'Select':
      return { kind: 'IRSelect', selector: step.selector } satisfies IRSelect;

    case 'ApplyToSelection': {
      const effects: IRObjectEffect[] = step.effects.map(eff => ({
        kind: 'IRObjectEffect' as const,
        effect: eff.name,
        params: eff.params,
      }));
      if (effects.length === 1) return effects[0];
      return { kind: 'IRCompose', steps: effects };
    }

    case 'ForEach': {
      const bodyNodes: IRNode[] = step.body
        .map(s => buildStep(s, _resolved))
        .filter((n): n is IRNode => n !== null);
      return { kind: 'IRCompose', steps: bodyNodes };
    }

    case 'Shader':
      return { kind: 'IRShader', model: step.model, params: step.params, sourceClip: '' } satisfies IRShader;

    default:
      return null;
  }
}

// ---- Remotion emitter -----------------------------------------------

export interface EmitResult {
  composition: string;
  worker: string | null;
}

export function emitRemotion(ir: IRNode, sceneName: string, fps = 30): EmitResult {
  const clip = findClip(ir);
  const durationFrames = clip ? Math.ceil(clip.duration * fps) : fps * 30;
  const allPrims = collectPrims(ir);
  const detectionNodes = collectDetect(ir);
  const selectNode = collectSelect(ir);
  const shaderNodes = collectShaders(ir);
  const audioNodes = collectAudios(ir);
  const segments = collectSegments(ir);
  const periodics = collectPeriodics(ir);

  const lines: string[] = [];

  lines.push(`// ============================================================`);
  lines.push(`// MEE — Generated Remotion composition`);
  lines.push(`// Scene: ${sceneName}`);
  lines.push(`// ============================================================`);
  lines.push(``);

  const cameraPrims = allPrims.filter(p => getPrimitiveHint(p.primitive).startsWith('camera:'));
  const effectPrims = allPrims.filter(p => !getPrimitiveHint(p.primitive).startsWith('camera:'));

  const hasCameras = cameraPrims.length > 0;
  const hasDetection = detectionNodes.length > 0;
  const videoPrims = effectPrims.filter(p => getPrimitiveHint(p.primitive).startsWith('video:'));
  const hasVideoEffects = videoPrims.length > 0;
  const hasShaders = shaderNodes.length > 0;
  const hasAudio = audioNodes.length > 0;
  const hasSegments = segments.length > 0;
  const hasPeriodics = periodics.length > 0;

  const muteVideo = audioNodes.some(a => a.muteVideo);

  lines.push(`import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Video, Audio, Sequence } from 'remotion';`);
  lines.push(`import React from 'react';`);
  if (hasVideoEffects) {
    lines.push(`import { VideoEffectStack } from '@/effects/video/remotion/VideoEffectStack';`);
    lines.push(`import { getVideoEffect } from '@/effects/video/registry';`);
  }
  if (hasCameras) {
    lines.push(`import { Canvas } from '@react-three/offscreen';`);
    lines.push(`import { OrbitControls } from '@react-three/drei';`);
    const cameraImports = [...new Set(cameraPrims.map(p => emitCameraImport(p)))].filter(Boolean);
    for (const imp of cameraImports) lines.push(imp);
  }
  if (hasDetection) {
    lines.push(`import { ObjectDetection } from '@/lib/detection/remotion/ObjectDetection';`);
    lines.push(`import { SkeletonOverlay } from '@/lib/detection/remotion/SkeletonOverlay';`);
  }
  if (hasShaders) {
    lines.push(`import { HFPrimitiveLayer } from '@/lib/hf/remotion/HFPrimitiveLayer';`);
  }
  // Built-in effects used by segments/periodics
  const builtinEffects = collectBuiltins([...segments, ...periodics]);
  if (builtinEffects.has('bw')) {
    lines.push(`// bw() — black-and-white filter via CSS`);
  }
  if (builtinEffects.has('text')) {
    lines.push(`// text() — text overlay rendered inline`);
  }
  if (builtinEffects.has('glitch')) {
    lines.push(`import { Glitch } from '@react-three/postprocessing';`);
  }
  if (builtinEffects.has('boxes')) {
    lines.push(`// boxes() — detection bounding box overlay`);
  }
  lines.push(``);

  if (hasCameras) {
    lines.push(`const _worker = typeof window !== 'undefined'`);
    lines.push(`  ? new Worker(new URL('./${sceneName}.worker.tsx', import.meta.url), { type: 'module' })`);
    lines.push(`  : null;`);
    lines.push(``);
  }

  lines.push(`export const ${toCamelCase(sceneName)}: React.FC = () => {`);
  lines.push(`  const frame = useCurrentFrame();`);
  lines.push(`  const { fps, durationInFrames } = useVideoConfig();`);
  lines.push(`  const t = frame / fps; // seconds`);
  if (hasVideoEffects) {
    lines.push(`  const _videoRef = React.useRef<HTMLVideoElement>(null);`);
  }
  lines.push(``);

  for (const prim of effectPrims) {
    lines.push(...emitPrimitive(prim, fps));
  }

  lines.push(``);
  lines.push(`  return (`);
  lines.push(`    <AbsoluteFill style={{ backgroundColor: '#000' }}>`);

  // Video layer
  if (clip) {
    const attrs = [
      `src="${clip.path}"`,
      `startFrom={${Math.round(clip.at * fps)}}`,
      muteVideo ? 'muted' : '',
      hasVideoEffects ? 'ref={_videoRef}' : '',
    ].filter(Boolean).join(' ');
    lines.push(`      <Video ${attrs} />`);
  }

  // Audio tracks
  for (const audio of audioNodes) {
    const startFromFrames = Math.round(audio.startFrom * fps);
    lines.push(`      <Audio src="${audio.path}" startFrom={${startFromFrames}} volume={${audio.volume}} />`);
  }

  if (hasVideoEffects) {
    lines.push(`      <VideoEffectStack`);
    lines.push(`        effects={[`);
    for (const vp of videoPrims) {
      const effectId = getPrimitiveHint(vp.primitive).replace('video:', '');
      lines.push(`          { effect: getVideoEffect('${effectId}')!, params: ${JSON.stringify(vp.params)} },`);
    }
    lines.push(`        ]}`);
    lines.push(`        videoRef={_videoRef}`);
    lines.push(`        width={1920}`);
    lines.push(`        height={1080}`);
    lines.push(`      />`);
  }

  if (hasShaders) {
    const clipPath = clip?.path ?? '';
    const startFrom = clip ? Math.round(clip.at * fps) : 0;
    for (const shader of shaderNodes) {
      const paramsJson = JSON.stringify({ model: shader.model, ...shader.params });
      lines.push(`      <HFPrimitiveLayer`);
      lines.push(`        sourceClip="${clipPath}"`);
      lines.push(`        params={${paramsJson}}`);
      lines.push(`        startFrom={${startFrom}}`);
      lines.push(`      />`);
    }
  }

  // Global (non-segmented) visual effects
  const visualPrims = effectPrims.filter(p =>
    (p.namespace === 'spatial' || p.namespace === 'photometric') &&
    !getPrimitiveHint(p.primitive).startsWith('video:')
  );
  if (visualPrims.length > 0) {
    lines.push(`      <AbsoluteFill style={{`);
    for (const prim of visualPrims) {
      lines.push(...emitStyleProp(prim));
    }
    lines.push(`      }} />`);
  }

  // Camera canvas
  if (hasCameras) {
    lines.push(`      <AbsoluteFill>`);
    lines.push(`        <Canvas`);
    lines.push(`          worker={_worker ?? undefined}`);
    lines.push(`          fallback={(`);
    lines.push(`            <>`);
    for (const cam of cameraPrims) {
      for (const l of emitCameraJSX(cam)) lines.push(`              ${l.trim()}`);
    }
    lines.push(`              <OrbitControls />`);
    lines.push(`            </>`);
    lines.push(`          )}`);
    lines.push(`        />`);
    lines.push(`      </AbsoluteFill>`);
  }

  // Detection overlay
  if (hasDetection) {
    const detectors = [...new Set(detectionNodes.flatMap(d => d.targets))];
    const selectorExpr = selectNode?.selector ?? 'all';
    lines.push(`      <ObjectDetection`);
    lines.push(`        videoSrc="${clip?.path ?? ''}"`);
    lines.push(`        detectors={[${detectors.map(d => `'${d}'`).join(', ')}]}`);
    lines.push(`        selector="${selectorExpr}"`);
    lines.push(`      >`);
    lines.push(`        {(instances) => (`);
    lines.push(`          <>`);
    lines.push(`            <SkeletonOverlay instances={instances} style="neon" color="#00ffff" thickness={2} />`);
    lines.push(`          </>`);
    lines.push(`        )}`);
    lines.push(`      </ObjectDetection>`);
  }

  // ---- Time-ranged segments ----------------------------------------
  for (const seg of segments) {
    const fromFrame = Math.round(seg.startSec * fps);
    const durationF = seg.endSec >= 0
      ? Math.round((seg.endSec - seg.startSec) * fps)
      : `durationInFrames - ${fromFrame}`;
    lines.push(`      <Sequence from={${fromFrame}} durationInFrames={${durationF}}>`);
    lines.push(`        <AbsoluteFill>`);
    for (const eff of seg.effects) {
      lines.push(...emitBuiltinEffect(eff as IRPrim, fps));
    }
    lines.push(`        </AbsoluteFill>`);
    lines.push(`      </Sequence>`);
  }

  // ---- Periodic effects --------------------------------------------
  for (const per of periodics) {
    const periodFrames = Math.round(per.periodSec * fps);
    const durFrames    = Math.round(per.durationSec * fps);
    const count = clip ? Math.floor(clip.duration / per.periodSec) + 1 : 10;
    lines.push(`      {/* every ${per.periodSec}s */}`);
    lines.push(`      {Array.from({ length: ${count} }, (_, i) => (`);
    lines.push(`        <Sequence key={i} from={i * ${periodFrames}} durationInFrames={${durFrames}}>`);
    lines.push(`          <AbsoluteFill>`);
    for (const eff of per.effects) {
      lines.push(...emitBuiltinEffect(eff as IRPrim, fps, '            '));
    }
    lines.push(`          </AbsoluteFill>`);
    lines.push(`        </Sequence>`);
    lines.push(`      ))}`);
  }

  lines.push(`    </AbsoluteFill>`);
  lines.push(`  );`);
  lines.push(`};`);
  lines.push(``);
  lines.push(`export const ${toCamelCase(sceneName)}Config = {`);
  lines.push(`  component: ${toCamelCase(sceneName)},`);
  lines.push(`  durationInFrames: ${durationFrames},`);
  lines.push(`  fps: ${fps},`);
  lines.push(`  width: 1920,`);
  lines.push(`  height: 1080,`);
  lines.push(`  id: '${sceneName}',`);
  lines.push(`};`);

  let workerCode: string | null = null;
  if (hasCameras) {
    const wlines: string[] = [];
    wlines.push(`// MEE — Generated offscreen worker for scene: ${sceneName}`);
    wlines.push(`import React from 'react';`);
    wlines.push(`import { render } from '@react-three/offscreen';`);
    wlines.push(`import { OrbitControls } from '@react-three/drei';`);
    const cameraImports = [...new Set(cameraPrims.map(p => emitCameraImport(p)))].filter(Boolean);
    for (const imp of cameraImports) wlines.push(imp);
    wlines.push(``);
    wlines.push(`function Scene() {`);
    wlines.push(`  return (`);
    wlines.push(`    <>`);
    for (const cam of cameraPrims) {
      for (const l of emitCameraJSX(cam)) wlines.push(`      ${l.trim()}`);
    }
    wlines.push(`      <OrbitControls />`);
    wlines.push(`    </>`);
    wlines.push(`  );`);
    wlines.push(`}`);
    wlines.push(``);
    wlines.push(`render(<Scene />);`);
    workerCode = wlines.join('\n');
  }

  return { composition: lines.join('\n'), worker: workerCode };
}

// ---- Built-in effect emitter (segment/periodic bodies) --------------

function emitBuiltinEffect(prim: IRPrim, fps: number, indent = '            '): string[] {
  const lines: string[] = [];
  const name = prim.primitive;
  const p = prim.params;

  switch (name) {
    case 'bw': {
      lines.push(`${indent}<AbsoluteFill style={{ mixBlendMode: 'luminosity', backdropFilter: 'grayscale(1)', filter: 'grayscale(1)' }} />`);
      break;
    }
    case 'text': {
      const txt   = String(p.text ?? p.content ?? 'TEXT');
      const color = String(p.color ?? '#ffffff');
      const size  = Number(p.size ?? 96);
      const style = String(p.style ?? 'fade');
      lines.push(`${indent}{/* text: "${txt}" style: ${style} */}`);
      lines.push(`${indent}<AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>`);
      lines.push(`${indent}  <span style={{`);
      lines.push(`${indent}    fontFamily: 'monospace',`);
      lines.push(`${indent}    fontSize: ${size},`);
      lines.push(`${indent}    color: '${color}',`);
      lines.push(`${indent}    WebkitTextStroke: '2px ${color}',`);
      lines.push(`${indent}    letterSpacing: '0.15em',`);
      lines.push(`${indent}    textTransform: 'uppercase',`);
      lines.push(`${indent}  }}>${txt}</span>`);
      lines.push(`${indent}</AbsoluteFill>`);
      break;
    }
    case 'boxes': {
      lines.push(`${indent}{/* boxes() — bounding-box overlay; wire in ObjectDetection instances here */}`);
      lines.push(`${indent}<AbsoluteFill style={{ border: '2px solid #00ff00', pointerEvents: 'none' }} />`);
      break;
    }
    case 'glitch': {
      const intensity = Number(p.intensity ?? 0.4);
      lines.push(`${indent}{/* glitch intensity: ${intensity} — rendered as CSS animation */}`);
      lines.push(`${indent}<AbsoluteFill style={{`);
      lines.push(`${indent}  animation: 'mee-glitch 0.1s steps(1) infinite',`);
      lines.push(`${indent}  filter: \`hue-rotate(\${Math.random() * 360}deg) saturate(3)\`,`);
      lines.push(`${indent}}} />`);
      break;
    }
    default: {
      // Fall through to normal style-prop emission for registered prims
      const hint = getPrimitiveHint(name);
      if (hint) {
        lines.push(...emitStyleProp(prim).map(l => indent + l.trim()));
      } else {
        lines.push(`${indent}{/* ${name}(${JSON.stringify(p)}) */}`);
      }
    }
  }

  return lines;
}

// ---- Helpers ---------------------------------------------------------

function collectBuiltins(nodes: (IRSegment | IRPeriodic)[]): Set<string> {
  const set = new Set<string>();
  for (const n of nodes) {
    for (const eff of n.effects) {
      if (eff.kind === 'IRPrim') set.add(eff.primitive);
    }
  }
  return set;
}

function emitPrimitive(prim: IRPrim, fps: number): string[] {
  const lines: string[] = [];
  const hint = getPrimitiveHint(prim.primitive);
  const varName = `${toCamelCase(prim.primitive)}_val`;

  switch (hint) {
    case 'interpolate:translateY': {
      const amp = (prim.params.amp as number) ?? 12;
      const freq = (prim.params.freq as number) ?? 0.8;
      lines.push(`  const ${varName} = Math.sin(t * ${freq} * Math.PI * 2) * ${amp};`);
      break;
    }
    case 'interpolate:translateX': {
      const amp = (prim.params.amp as number) ?? 8;
      const freq = (prim.params.freq as number) ?? 1.1;
      lines.push(`  const ${varName} = Math.sin(t * ${freq} * Math.PI * 2 + 0.5) * ${amp};`);
      break;
    }
    case 'interpolate:scale':
    case 'interpolate:scaleY':
    case 'interpolate:scaleX': {
      const tension = (prim.params.tension as number) ?? 0.6;
      const freq = (prim.params.freq as number) ?? 0.8;
      lines.push(`  const ${varName} = 1 + Math.sin(t * ${freq} * Math.PI * 2) * ${tension * 0.05};`);
      break;
    }
    case 'interpolate:opacity': {
      const freq2 = (prim.params.freq as number) ?? 2.0;
      lines.push(`  const ${varName} = 0.5 + 0.5 * Math.sin(t * ${freq2} * Math.PI * 2);`);
      break;
    }
    case 'interpolate:amplitudeDecay': {
      const decay = (prim.params.decay as number) ?? 0.3;
      lines.push(`  const ${varName} = Math.exp(-t * ${decay});`);
      break;
    }
    default:
      break;
  }

  return lines;
}

function emitStyleProp(prim: IRPrim): string[] {
  const hint = getPrimitiveHint(prim.primitive);
  const varName = `${toCamelCase(prim.primitive)}_val`;
  const lines: string[] = [];

  switch (hint) {
    case 'interpolate:translateY':
      lines.push(`        transform: \`translateY(\${${varName}}px)\`,`);
      break;
    case 'interpolate:translateX':
      lines.push(`        transform: \`translateX(\${${varName}}px)\`,`);
      break;
    case 'interpolate:scaleY':
      lines.push(`        transform: \`scaleY(\${${varName}})\`,`);
      break;
    case 'interpolate:scaleX':
      lines.push(`        transform: \`scaleX(\${${varName}})\`,`);
      break;
    case 'filter:colorGrade': {
      const temp = (prim.params.temperature as number) ?? 0;
      const sat = (prim.params.saturation as number) ?? 1;
      const hueRot = Math.round(temp / 30);
      lines.push(`        filter: \`hue-rotate(${hueRot}deg) saturate(${sat})\`,`);
      break;
    }
    case 'filter:saturation': {
      const amt = (prim.params.amount as number) ?? 0;
      lines.push(`        filter: \`saturate(${amt})\`,`);
      break;
    }
    case 'filter:motionBlur': {
      const amount = (prim.params.amount as number) ?? 4;
      lines.push(`        filter: \`blur(${amount}px)\`,`);
      break;
    }
    default:
      break;
  }

  return lines;
}

function findClip(ir: IRNode): { path: string; at: number; duration: number } | null {
  if (ir.kind === 'IRClip') return ir;
  if (ir.kind === 'IRCompose') {
    for (const step of ir.steps) {
      const found = findClip(step);
      if (found) return found;
    }
  }
  return null;
}

function collectPrims(ir: IRNode): IRPrim[] {
  if (ir.kind === 'IRPrim') return [ir];
  if (ir.kind === 'IRCompose') return ir.steps.flatMap(collectPrims);
  // Don't collect prims from inside segments/periodics — they're emitted separately
  return [];
}

function collectShaders(ir: IRNode): IRShader[] {
  if (ir.kind === 'IRShader') return [ir];
  if (ir.kind === 'IRCompose') return ir.steps.flatMap(collectShaders);
  return [];
}

function collectDetect(ir: IRNode): IRDetect[] {
  if (ir.kind === 'IRDetect') return [ir];
  if (ir.kind === 'IRCompose') return ir.steps.flatMap(collectDetect);
  return [];
}

function collectSelect(ir: IRNode): IRSelect | null {
  if (ir.kind === 'IRSelect') return ir;
  if (ir.kind === 'IRCompose') {
    for (const step of ir.steps) {
      const found = collectSelect(step);
      if (found) return found;
    }
  }
  return null;
}

function collectAudios(ir: IRNode): IRAudio[] {
  if (ir.kind === 'IRAudio') return [ir];
  if (ir.kind === 'IRCompose') return ir.steps.flatMap(collectAudios);
  return [];
}

function collectSegments(ir: IRNode): IRSegment[] {
  if (ir.kind === 'IRSegment') return [ir];
  if (ir.kind === 'IRCompose') return ir.steps.flatMap(collectSegments);
  return [];
}

function collectPeriodics(ir: IRNode): IRPeriodic[] {
  if (ir.kind === 'IRPeriodic') return [ir];
  if (ir.kind === 'IRCompose') return ir.steps.flatMap(collectPeriodics);
  return [];
}

function getPrimitiveHint(name: string): string {
  const { PRIMITIVES } = require('./registry');
  return PRIMITIVES[name]?.remotionHint ?? '';
}

function toCamelCase(s: string): string {
  return s.replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, c => c.toUpperCase());
}

function emitCameraImport(prim: IRPrim): string {
  const hint = getPrimitiveHint(prim.primitive);
  switch (hint) {
    case 'camera:perspective':   return `import { MEEPerspectiveCamera } from '@/lib/cameras';`;
    case 'camera:orthographic':  return `import { MEEOrthographicCamera } from '@/lib/cameras';`;
    case 'camera:shake':         return `import { MEECameraShake } from '@/lib/cameras';`;
    case 'camera:transition':    return `import { MEECameraTransition } from '@/lib/cameras';`;
    case 'camera:cube':          return `import { MEECubeCamera } from '@/lib/cameras';`;
    case 'camera:map':
      return `import { MEEOrthographicCamera } from '@/lib/cameras';\nimport { MapControls } from '@react-three/drei';`;
    default: return '';
  }
}

function emitCameraJSX(prim: IRPrim): string[] {
  const hint = getPrimitiveHint(prim.primitive);
  const p = prim.params;
  const lines: string[] = [];

  switch (hint) {
    case 'camera:perspective': {
      const fov = p.fov ?? 50, near = p.near ?? 0.1, far = p.far ?? 1000;
      const pos = p.position ?? [0, 0, 5];
      lines.push(`<MEEPerspectiveCamera fov={${fov}} near={${near}} far={${far}} position={[${(pos as number[]).join(', ')}]} />`);
      break;
    }
    case 'camera:orthographic': {
      const zoom = p.zoom ?? 50, near = p.near ?? 0.1, far = p.far ?? 1000;
      const pos = p.position ?? [0, 0, 10];
      lines.push(`<MEEOrthographicCamera zoom={${zoom}} near={${near}} far={${far}} position={[${(pos as number[]).join(', ')}]} />`);
      break;
    }
    case 'camera:shake': {
      lines.push(`<MEECameraShake intensity={${p.intensity ?? 0.5}} decay={${p.decay ?? false}} />`);
      break;
    }
    default:
      lines.push(`{/* unknown camera primitive: ${prim.primitive} */}`);
  }

  return lines;
}
