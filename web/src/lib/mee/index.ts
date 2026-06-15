// ======================================================================
//  MEE — Compiler Entry Point
//
//  compile(source: string): CompileResult
//  validate(source: string): Diagnostic[]
// ======================================================================

import { tokenize } from './tokenizer';
import { parse } from './parser';
import { check, compositePower } from './checker';
import { buildIR, emitRemotion, EmitResult } from './emitter';
import { CompileResult, Diagnostic } from './types';
import { BEHAVIOURS, findSupportCycle } from './registry';

export { BEHAVIOURS };
export type { CompileResult, Diagnostic };

export function compile(source: string): CompileResult {
  const allDiagnostics: Diagnostic[] = [];

  // Stage 1 — tokenise
  let tokens;
  try {
    tokens = tokenize(source);
  } catch (e: any) {
    return {
      ok: false, scene: null, ir: null, remotion: null, remotionWorker: null,
      diagnostics: [{ level: 'error', code: 'LexError', message: String(e.message) }],
    };
  }

  // Stage 2 — parse
  const { scene, diagnostics: parseDiags } = parse(tokens);
  allDiagnostics.push(...parseDiags);

  if (!scene) {
    return { ok: false, scene: null, ir: null, remotion: null, remotionWorker: null, diagnostics: allDiagnostics };
  }

  // Stage 3 — type-check + resolve
  const { ok, diagnostics: checkDiags, resolvedPrimitives } = check(scene);
  allDiagnostics.push(...checkDiags);

  // Stage 4 — build IR
  const ir = buildIR(scene, resolvedPrimitives);

  // Stage 5 — emit Remotion (only if no errors)
  let remotion: string | null = null;
  let remotionWorker: string | null = null;
  if (ok) {
    try {
      const result: EmitResult = emitRemotion(ir, scene.name);
      remotion = result.composition;
      remotionWorker = result.worker;
    } catch (e: any) {
      allDiagnostics.push({ level: 'error', code: 'EmitError', message: String(e.message) });
    }
  }

  return {
    ok: ok && remotion !== null,
    scene,
    ir,
    remotion,
    remotionWorker,
    diagnostics: allDiagnostics,
  };
}

export function validate(source: string): Diagnostic[] {
  return compile(source).diagnostics;
}

// ---- Summary helpers (for playground display) -----------------------

export interface CompileSummary {
  sceneName: string;
  primitiveCount: number;
  namespaces: string[];
  compositePowerPct: number;
  coherent: boolean;
  diagnosticCounts: { errors: number; warnings: number; info: number };
}

export function summarise(result: CompileResult): CompileSummary | null {
  if (!result.scene) return null;

  const { check: _check, compositePower: _cp } = require('./checker');
  const { resolveDescription } = require('./registry');

  // Collect all resolved primitives from the scene
  const primitives: any[] = [];
  for (const step of result.scene.pipeline.steps) {
    if (step.kind === 'ActsLike') {
      const spec = resolveDescription(step.description);
      if (spec) primitives.push(...spec.primitives);
    }
    if (step.kind === 'Compose') {
      for (const eff of step.effects) {
        const { resolvePrimitive } = require('./registry');
        const spec = resolvePrimitive(eff.name);
        if (spec) primitives.push(spec);
      }
    }
  }

  const namespaces = [...new Set(primitives.map((p: any) => p.namespace))];
  const power = compositePower(primitives);
  const errors = result.diagnostics.filter(d => d.level === 'error').length;
  const warnings = result.diagnostics.filter(d => d.level === 'warning').length;
  const info = result.diagnostics.filter(d => d.level === 'info').length;

  // Coherence from actual 3-cycle detection (§6), not namespace count
  const coherent = findSupportCycle(primitives) !== null;

  return {
    sceneName: result.scene.name,
    primitiveCount: primitives.length,
    namespaces,
    compositePowerPct: Math.round(power * 1000) / 10,
    coherent,
    diagnosticCounts: { errors, warnings, info },
  };
}
