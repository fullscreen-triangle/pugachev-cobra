// ======================================================================
//  MEE — IR Builder + Remotion Emitter
//
//  IR builder: AST + resolved primitives → IRNode tree.
//  Remotion emitter: IRNode tree → TypeScript/TSX source string.
// ======================================================================

import {
  SceneNode, PipelineStep,
  IRNode, IRClip, IRPrim, IRCompose, IRHole,
  IRDetect, IRSelect, IRObjectEffect, IRShader,
} from './types';
import { PrimitiveSpec, resolvePrimitive, deriveChain } from './registry';

// ---- IR builder ------------------------------------------------------

export function buildIR(scene: SceneNode, resolvedPrimitives: PrimitiveSpec[]): IRNode {
  const steps: IRNode[] = [];

  for (const step of scene.pipeline.steps) {
    const node = buildStep(step, resolvedPrimitives);
    if (node) steps.push(node);
  }

  // For acts_like steps: inject the derived chain in backward-completion
  // order (§8 Principle backward). deriveChain() returns the primitives
  // ordered so that each primitive is introduced after the primitives that
  // most support it have already appeared — building spatial context first,
  // then layering photometric and temporal effects.
  const hasActsLike = scene.pipeline.steps.some(s => s.kind === 'ActsLike');
  if (hasActsLike) {
    // Exclude any primitives already explicitly placed by compose() steps
    const explicitNames = new Set(
      steps
        .filter(s => s.kind === 'IRCompose')
        .flatMap(s => (s as IRCompose).steps)
        .filter(s => s.kind === 'IRPrim')
        .map(s => (s as IRPrim).primitive)
    );
    const unplaced = resolvedPrimitives.filter(p => !explicitNames.has(p.name));
    // Apply backward chain derivation to determine execution order
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

    case 'ActsLike':
      // Resolved primitives injected by buildIR; leave a hole here to be
      // replaced — the checker already expanded them into resolvedPrimitives.
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
      return null; // render directive handled by emitter metadata

    case 'Detect':
      return {
        kind: 'IRDetect',
        targets: step.targets,
        minConfidence: step.minConfidence,
      } satisfies IRDetect;

    case 'Select':
      return {
        kind: 'IRSelect',
        selector: step.selector,
      } satisfies IRSelect;

    case 'ApplyToSelection': {
      const effects: IRObjectEffect[] = step.effects.map(eff => ({
        kind: 'IRObjectEffect' as const,
        effect: eff.name,
        params: eff.params,
      }));
      // Wrap multiple effects in a compose; single effect returned directly
      if (effects.length === 1) return effects[0];
      return { kind: 'IRCompose', steps: effects };
    }

    case 'ForEach': {
      // Flatten for_each body into a compose of object effects
      const bodyNodes: IRNode[] = step.body
        .map(s => buildStep(s, _resolved))
        .filter((n): n is IRNode => n !== null);
      return { kind: 'IRCompose', steps: bodyNodes };
    }

    case 'Shader':
      // sourceClip is resolved in emitRemotion once the clip is known
      return {
        kind: 'IRShader',
        model: step.model,
        params: step.params,
        sourceClip: '',
      } satisfies IRShader;

    default:
      return null;
  }
}

// ---- Remotion emitter -----------------------------------------------

export interface EmitResult {
  composition: string;
  worker: string | null; // non-null when the scene uses cameras (offscreen rendering)
}

export function emitRemotion(ir: IRNode, sceneName: string, fps = 30): EmitResult {
  const clip = findClip(ir);
  const durationFrames = clip ? Math.ceil(clip.duration * fps) : fps * 30;
  const allPrims = collectPrims(ir);
  const detectionNodes = collectDetect(ir);
  const selectNode = collectSelect(ir);
  const shaderNodes = collectShaders(ir);

  const lines: string[] = [];

  lines.push(`// ============================================================`);
  lines.push(`// MEE — Generated Remotion composition`);
  lines.push(`// Scene: ${sceneName}`);
  lines.push(`// ============================================================`);
  lines.push(``);
  // Separate camera primitives from visual/temporal/acoustic primitives
  const cameraPrims = allPrims.filter(p => getPrimitiveHint(p.primitive).startsWith('camera:'));
  const effectPrims = allPrims.filter(p => !getPrimitiveHint(p.primitive).startsWith('camera:'));

  const hasCameras = cameraPrims.length > 0;
  const hasDetection = detectionNodes.length > 0;
  const videoPrims = effectPrims.filter(p => getPrimitiveHint(p.primitive).startsWith('video:'));
  const hasVideoEffects = videoPrims.length > 0;
  const hasShaders = shaderNodes.length > 0;

  lines.push(`import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Video, Audio, Sequence } from 'remotion';`);
  if (hasVideoEffects) {
    lines.push(`import { VideoEffectStack } from '@/effects/video/remotion/VideoEffectStack';`);
    lines.push(`import { getVideoEffect } from '@/effects/video/registry';`);
    lines.push(`import React from 'react';`);
  }
  if (hasCameras) {
    lines.push(`import { Canvas } from '@react-three/offscreen';`);
    lines.push(`import { OrbitControls } from '@react-three/drei';`);
    // Import the specific camera components needed
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
  lines.push(``);
  if (hasCameras) {
    lines.push(`// Worker created once at module scope to avoid re-creation on re-renders.`);
    lines.push(`const _worker = typeof window !== 'undefined'`);
    lines.push(`  ? new Worker(new URL('./${sceneName}.worker.tsx', import.meta.url), { type: 'module' })`);
    lines.push(`  : null;`);
    lines.push(``);
  }
  lines.push(`export const ${toCamelCase(sceneName)}: React.FC = () => {`);
  lines.push(`  const frame = useCurrentFrame();`);
  lines.push(`  const { fps, durationInFrames } = useVideoConfig();`);
  lines.push(`  const t = frame / fps; // time in seconds`);
  if (hasVideoEffects) {
    lines.push(`  const _videoRef = React.useRef<HTMLVideoElement>(null);`);
  }
  lines.push(``);

  // Emit interpolations for each non-camera primitive
  for (const prim of effectPrims) {
    lines.push(...emitPrimitive(prim, fps));
  }

  lines.push(``);
  lines.push(`  return (`);
  lines.push(`    <AbsoluteFill style={{ backgroundColor: '#000' }}>`);

  if (clip) {
    if (hasVideoEffects) {
      lines.push(`      <Video src="${clip.path}" startFrom={${Math.round(clip.at * fps)}} ref={_videoRef} />`);
    } else {
      lines.push(`      <Video src="${clip.path}" startFrom={${Math.round(clip.at * fps)}} />`);
    }
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

  // Emit HF shader layers — each IRShader becomes an HFPrimitiveLayer that
  // calls the HF Inference API and swaps the video src when the result arrives.
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

  // Emit visual layer for each spatial/photometric (non-camera) primitive
  const visualPrims = effectPrims.filter(p => p.namespace === 'spatial' || p.namespace === 'photometric');
  if (visualPrims.length > 0) {
    lines.push(`      <AbsoluteFill style={{`);
    for (const prim of visualPrims) {
      lines.push(...emitStyleProp(prim));
    }
    lines.push(`      }} />`);
  }

  // Emit R3F Canvas with camera primitives when present.
  // Uses @react-three/offscreen Canvas so WebGL rendering runs on a Worker
  // thread, keeping the main thread free for Remotion's video pipeline.
  if (hasCameras) {
    lines.push(`      <AbsoluteFill>`);
    lines.push(`        {/* Worker is created once — module-scope so it survives re-renders */}`);
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

  if (hasDetection) {
    const detectors = detectionNodes.flatMap(d => d.targets);
    const uniqueDetectors = [...new Set(detectors)];
    const selectorExpr = selectNode?.selector ?? 'all';
    lines.push(`      <ObjectDetection`);
    lines.push(`        videoSrc={clip?.path ?? ''}`);
    lines.push(`        detectors={[${uniqueDetectors.map(d => `'${d}'`).join(', ')}]}`);
    lines.push(`        selector="${selectorExpr}"`);
    lines.push(`      >`);
    lines.push(`        {(instances) => (`);
    lines.push(`          <>`);
    lines.push(`            <SkeletonOverlay instances={instances} style="neon" color="#00ffff" thickness={2} />`);
    lines.push(`          </>`);
    lines.push(`        )}`);
    lines.push(`      </ObjectDetection>`);
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

  // Generate a companion worker file when cameras are present.
  // The worker imports the scene components and calls render() from
  // @react-three/offscreen so that R3F runs on a dedicated thread.
  let workerCode: string | null = null;
  if (hasCameras) {
    const wlines: string[] = [];
    wlines.push(`// MEE — Generated offscreen worker for scene: ${sceneName}`);
    wlines.push(`// Companion to ${sceneName}.tsx — runs R3F on a Worker thread.`);
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

function emitPrimitive(prim: IRPrim, fps: number): string[] {
  const lines: string[] = [];
  const hint = getPrimitiveHint(prim.primitive);
  const varName = `${toCamelCase(prim.primitive)}_val`;

  switch (hint) {
    case 'interpolate:translateY': {
      const amp = (prim.params.amp as number) ?? 12;
      const freq = (prim.params.freq as number) ?? 0.8;
      lines.push(`  // ${prim.primitive} — ${prim.namespace}`);
      lines.push(`  const ${varName} = Math.sin(t * ${freq} * Math.PI * 2) * ${amp};`);
      break;
    }
    case 'interpolate:translateX': {
      const amp = (prim.params.amp as number) ?? 8;
      const freq = (prim.params.freq as number) ?? 1.1;
      lines.push(`  // ${prim.primitive} — ${prim.namespace}`);
      lines.push(`  const ${varName} = Math.sin(t * ${freq} * Math.PI * 2 + 0.5) * ${amp};`);
      break;
    }
    case 'interpolate:scale':
    case 'interpolate:scaleY':
    case 'interpolate:scaleX': {
      const tension = (prim.params.tension as number) ?? 0.6;
      const freq = (prim.params.freq as number) ?? 0.8;
      lines.push(`  // ${prim.primitive} — ${prim.namespace}`);
      lines.push(`  const ${varName} = 1 + Math.sin(t * ${freq} * Math.PI * 2) * ${tension * 0.05};`);
      break;
    }
    case 'interpolate:opacity': {
      const freq2 = (prim.params.freq as number) ?? 2.0;
      lines.push(`  // ${prim.primitive} — ${prim.namespace}`);
      lines.push(`  const ${varName} = 0.5 + 0.5 * Math.sin(t * ${freq2} * Math.PI * 2);`);
      break;
    }
    case 'interpolate:amplitudeDecay': {
      const decay = (prim.params.decay as number) ?? 0.3;
      lines.push(`  // ${prim.primitive} — ${prim.namespace}`);
      lines.push(`  const ${varName} = Math.exp(-t * ${decay});`);
      break;
    }
    default: {
      if (hint.startsWith('video:')) {
        const effectId = hint.replace('video:', '');
        const ns = prim.namespace;
        if (ns === 'temporal') {
          lines.push(`  const ${varName} = frame / fps;`);
        }
      }
      break;
    }
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
    case 'filter:displacement':
    case 'filter:refractionMap': {
      const depth = (prim.params.depth as number) ?? 0.3;
      lines.push(`        filter: 'url(#mee-displacement-${prim.primitive})',`);
      break;
    }
    case 'filter:colorGrade': {
      const temp = (prim.params.temperature as number) ?? 0;
      const sat = (prim.params.saturation as number) ?? 1;
      const hueRot = Math.round(temp / 30);
      lines.push(`        filter: \`hue-rotate(\${${hueRot}}deg) saturate(\${${sat}})\`,`);
      break;
    }
    case 'filter:saturation': {
      const amt = (prim.params.amount as number) ?? 0;
      lines.push(`        filter: \`saturate(\${${amt}})\`,`);
      break;
    }
    case 'filter:motionBlur': {
      const amount = (prim.params.amount as number) ?? 4;
      lines.push(`        filter: \`blur(\${${amount}}px)\`,`);
      break;
    }
    case 'layer:mirrorComposite':
    case 'layer:causticsOverlay':
      // These require separate React layer elements — emit as comment for now
      lines.push(`        /* ${prim.primitive}: add a separate <AbsoluteFill> layer */`);
      break;
    default:
      if (hint.startsWith('video:')) {
        // Video effects are composited via VideoEffectStack — no inline style needed
      }
      break;
  }

  return lines;
}

// ---- Helpers ---------------------------------------------------------

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

function getPrimitiveHint(name: string): string {
  const { PRIMITIVES } = require('./registry');
  return PRIMITIVES[name]?.remotionHint ?? '';
}

function toCamelCase(s: string): string {
  return s.replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, c => c.toUpperCase());
}

// ---- Camera emitter helpers -----------------------------------------

// Returns the import statement for the camera component needed by this prim.
function emitCameraImport(prim: IRPrim): string {
  const hint = getPrimitiveHint(prim.primitive);
  switch (hint) {
    case 'camera:perspective':
      return `import { MEEPerspectiveCamera } from '@/lib/cameras';`;
    case 'camera:orthographic':
      return `import { MEEOrthographicCamera } from '@/lib/cameras';`;
    case 'camera:shake':
      return `import { MEECameraShake } from '@/lib/cameras';`;
    case 'camera:transition':
      return `import { MEECameraTransition } from '@/lib/cameras';`;
    case 'camera:cube':
      return `import { MEECubeCamera } from '@/lib/cameras';`;
    case 'camera:map':
      return `import { MEEOrthographicCamera } from '@/lib/cameras';\nimport { MapControls } from '@react-three/drei';`;
    default:
      return '';
  }
}

// Returns the JSX lines that instantiate a camera primitive inside a Canvas.
function emitCameraJSX(prim: IRPrim): string[] {
  const hint = getPrimitiveHint(prim.primitive);
  const p = prim.params;
  const lines: string[] = [];

  switch (hint) {
    case 'camera:perspective': {
      const fov       = p.fov ?? 50;
      const near      = p.near ?? 0.1;
      const far       = p.far ?? 1000;
      const pos       = p.position ?? [0, 0, 5];
      const track     = p.trackMouse ?? false;
      const radius    = p.trackRadius ?? 5;
      lines.push(
        `          <MEEPerspectiveCamera fov={${fov}} near={${near}} far={${far}} ` +
        `position={[${(pos as number[]).join(', ')}]} ` +
        `trackMouse={${track}} trackRadius={${radius}} />`
      );
      break;
    }
    case 'camera:orthographic': {
      const zoom = p.zoom ?? 50;
      const near = p.near ?? 0.1;
      const far  = p.far ?? 1000;
      const pos  = p.position ?? [0, 0, 10];
      lines.push(
        `          <MEEOrthographicCamera zoom={${zoom}} near={${near}} far={${far}} ` +
        `position={[${(pos as number[]).join(', ')}]} />`
      );
      break;
    }
    case 'camera:shake': {
      const intensity     = p.intensity ?? 0.5;
      const decay         = p.decay ?? false;
      const decayRate     = p.decayRate ?? 0.65;
      const maxYaw        = p.maxYaw ?? 0.05;
      const maxPitch      = p.maxPitch ?? 0.05;
      const maxRoll       = p.maxRoll ?? 0.05;
      const yawFreq       = p.yawFrequency ?? 0.8;
      const pitchFreq     = p.pitchFrequency ?? 0.8;
      const rollFreq      = p.rollFrequency ?? 0.8;
      lines.push(
        `          <MEECameraShake intensity={${intensity}} decay={${decay}} decayRate={${decayRate}} ` +
        `maxYaw={${maxYaw}} maxPitch={${maxPitch}} maxRoll={${maxRoll}} ` +
        `yawFrequency={${yawFreq}} pitchFrequency={${pitchFreq}} rollFrequency={${rollFreq}} />`
      );
      break;
    }
    case 'camera:transition': {
      const initial  = p.initial ?? 'perspective';
      const fov      = p.perspectiveFov ?? 50;
      const zoom     = p.orthographicZoom ?? 100;
      lines.push(
        `          <MEECameraTransition initial="${initial}" perspectiveFov={${fov}} orthographicZoom={${zoom}} />`
      );
      break;
    }
    case 'camera:cube': {
      const res    = p.resolution ?? 256;
      const near   = p.near ?? 0.1;
      const far    = p.far ?? 1000;
      const frames = p.frames ?? 'Infinity';
      lines.push(`          <MEECubeCamera resolution={${res}} near={${near}} far={${far}} frames={${frames}}>`);
      lines.push(`            {(envTex) => null /* attach envTex to materials */}`);
      lines.push(`          </MEECubeCamera>`);
      break;
    }
    case 'camera:map': {
      const pos  = p.position ?? [0, 5, 0];
      const zoom = p.zoom ?? 1;
      const far  = p.far ?? 10000;
      lines.push(
        `          <MEEOrthographicCamera position={[${(pos as number[]).join(', ')}]} zoom={${zoom}} far={${far}} />`
      );
      lines.push(`          <MapControls />`);
      break;
    }
    default:
      lines.push(`          {/* unknown camera primitive: ${prim.primitive} */}`);
  }

  return lines;
}
