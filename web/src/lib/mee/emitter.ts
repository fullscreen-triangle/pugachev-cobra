// ======================================================================
//  MEE — IR Builder + Remotion Emitter
//
//  IR builder: AST + resolved primitives → IRNode tree.
//  Remotion emitter: IRNode tree → TypeScript/TSX source string.
// ======================================================================

import {
  SceneNode, PipelineStep,
  IRNode, IRClip, IRPrim, IRCompose, IRHole,
} from './types';
import { PrimitiveSpec, resolvePrimitive } from './registry';

// ---- IR builder ------------------------------------------------------

export function buildIR(scene: SceneNode, resolvedPrimitives: PrimitiveSpec[]): IRNode {
  const steps: IRNode[] = [];

  for (const step of scene.pipeline.steps) {
    const node = buildStep(step, resolvedPrimitives);
    if (node) steps.push(node);
  }

  // If the acts_like primitives haven't been inlined yet, append them now
  // (they come from the checker's resolution and are not directly in the AST).
  const hasActsLike = scene.pipeline.steps.some(s => s.kind === 'ActsLike');
  if (hasActsLike) {
    const primNodes: IRPrim[] = resolvedPrimitives
      .filter(p => !steps.some(s => s.kind === 'IRPrim' && (s as IRPrim).primitive === p.name))
      .map(p => ({
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

    default:
      return null;
  }
}

// ---- Remotion emitter -----------------------------------------------

export function emitRemotion(ir: IRNode, sceneName: string, fps = 30): string {
  const clip = findClip(ir);
  const durationFrames = clip ? Math.ceil(clip.duration * fps) : fps * 30;
  const allPrims = collectPrims(ir);

  const lines: string[] = [];

  lines.push(`// ============================================================`);
  lines.push(`// MEE — Generated Remotion composition`);
  lines.push(`// Scene: ${sceneName}`);
  lines.push(`// ============================================================`);
  lines.push(``);
  lines.push(`import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Video, Audio, Sequence } from 'remotion';`);
  lines.push(``);
  lines.push(`export const ${toCamelCase(sceneName)}: React.FC = () => {`);
  lines.push(`  const frame = useCurrentFrame();`);
  lines.push(`  const { fps, durationInFrames } = useVideoConfig();`);
  lines.push(`  const t = frame / fps; // time in seconds`);
  lines.push(``);

  // Emit interpolations for each primitive
  for (const prim of allPrims) {
    lines.push(...emitPrimitive(prim, fps));
  }

  lines.push(``);
  lines.push(`  return (`);
  lines.push(`    <AbsoluteFill style={{ backgroundColor: '#000' }}>`);

  if (clip) {
    lines.push(`      <Video src="${clip.path}" startFrom={${Math.round(clip.at * fps)}} />`);
  }

  // Emit visual layer for each spatial/photometric primitive
  const visualPrims = allPrims.filter(p => p.namespace === 'spatial' || p.namespace === 'photometric');
  if (visualPrims.length > 0) {
    lines.push(`      <AbsoluteFill style={{`);
    for (const prim of visualPrims) {
      lines.push(...emitStyleProp(prim));
    }
    lines.push(`      }} />`);
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

  return lines.join('\n');
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
    default:
      // No JS-side interpolation needed — handled as CSS filter or layer
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

function getPrimitiveHint(name: string): string {
  const { PRIMITIVES } = require('./registry');
  return PRIMITIVES[name]?.remotionHint ?? '';
}

function toCamelCase(s: string): string {
  return s.replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, c => c.toUpperCase());
}
