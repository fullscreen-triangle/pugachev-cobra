// ======================================================================
//  MEE — Type-checker / Static Assessor
//
//  Six checks run on the AST before any IR is built:
//  (a) Description resolution   — acts_like strings must be in registry
//  (b) Coherence                — support graph must contain a 3-cycle
//  (c) Saturation estimate      — composite power must be non-summable
//  (d) Brand constraint         — brand invariant primitives present
//  (e) Goal reachability        — chain covers all goal namespaces
//  (f) Duration budget          — clip duration fits declared maximum
// ======================================================================

import { SceneNode, PipelineStep, Diagnostic, Namespace } from './types';
import { resolveDescription, resolvePrimitive, PrimitiveSpec, findSupportCycle } from './registry';

export interface CheckResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  resolvedPrimitives: PrimitiveSpec[];   // full expanded primitive list
}

export function check(scene: SceneNode): CheckResult {
  const diagnostics: Diagnostic[] = [];
  const resolvedPrimitives: PrimitiveSpec[] = [];

  // ---- (a) Resolve acts_like descriptions ----------------------------

  for (const step of scene.pipeline.steps) {
    // Detection nodes carry no primitives into the registry — they are purely
    // structural and resolved at emit time by the detection pipeline
    if (
      step.kind === 'Detect' ||
      step.kind === 'Select' ||
      step.kind === 'ApplyToSelection' ||
      step.kind === 'ForEach'
    ) {
      continue;
    }

    if (step.kind === 'ActsLike') {
      const spec = resolveDescription(step.description);
      if (!spec) {
        diagnostics.push({
          level: 'error', code: 'UnknownDescription',
          message: `acts_like("${step.description}") — no behaviour registered for this description. ` +
            `Known behaviours: water surface, drum skin, heat haze, glass shatter, magnetic field, slow motion, old film, underwater.`,
        });
      } else {
        resolvedPrimitives.push(...spec.primitives);
      }
    }

    if (step.kind === 'Compose') {
      for (const eff of step.effects) {
        if (eff.name.startsWith('brand:')) continue; // handled in (d)
        const spec = resolvePrimitive(eff.name);
        if (!spec) {
          diagnostics.push({
            level: 'warning', code: 'UnknownPrimitive',
            message: `compose() — primitive '${eff.name}' not in registry; it will be emitted as a no-op comment.`,
          });
        } else {
          resolvedPrimitives.push(spec);
        }
      }
    }
  }

  // ---- (b) Coherence: support graph must contain a directed 3-cycle --
  //
  //  From §6 Theorem (coherence requires a triangle) and Corollary
  //  (ordinal decidability): coherence is decidable from the signs of
  //  pairwise support relations alone. We inspect the directed support
  //  graph restricted to the resolved primitives and look for a directed
  //  cycle of length ≥ 3. The `findSupportCycle` function (registry.ts)
  //  implements iterative DFS with three-colour marking. A cycle of
  //  length ≥ 3 certifies that the chain is self-grounding: each member
  //  of the cycle is supported by the others, so removing any one still
  //  leaves the remaining two mutually supporting (§6 Thm ii).

  if (resolvedPrimitives.length > 0) {
    const cycle = findSupportCycle(resolvedPrimitives);
    if (!cycle) {
      // Acyclic support graph or only 1- or 2-cycles: chain is not self-grounding.
      // Report which primitives have zero in-degree (no support from peers) as
      // the most actionable diagnostic.
      const nameSet = new Set(resolvedPrimitives.map(p => p.name));
      const unsupported = resolvedPrimitives.filter(p => {
        return !resolvedPrimitives.some(q => q.name !== p.name && q.supports.includes(p.name));
      });
      const unsupportedNames = unsupported.map(p => p.name).join(', ');
      diagnostics.push({
        level: 'warning', code: 'CoherenceWarning',
        message: `Support graph contains no directed 3-cycle — chain is not self-grounding (§6). ` +
          `Primitives with no incoming support: ${unsupportedNames || 'none'}. ` +
          `Add a primitive that reinforces one of these, or add a behaviour description ` +
          `whose primitives form a mutually supporting triangle.`,
      });
    }
    // If cycle found, coherence is confirmed; no diagnostic emitted.
  }

  // ---- (c) Saturation: composite power should be non-summable -------
  //
  //  Proxy: sum of distinct-namespace power contributions.
  //  If all primitives are from the same namespace, the chain is summable
  //  (one channel exhausted) and will plateau.

  if (resolvedPrimitives.length > 0) {
    const powerByNamespace: Partial<Record<Namespace, number>> = {};
    for (const p of resolvedPrimitives) {
      powerByNamespace[p.namespace] = (powerByNamespace[p.namespace] ?? 0) + p.power;
    }
    const nsCoverage = Object.keys(powerByNamespace).length;
    if (nsCoverage < 2) {
      diagnostics.push({
        level: 'warning', code: 'SaturationWarning',
        message: `All effects target a single namespace — composite power will plateau (summable). ` +
          `Add effects from other namespaces for non-summable power.`,
      });
    }
  }

  // ---- (d) Brand constraints ----------------------------------------

  for (const brand of scene.brands) {
    // A brand invariant is satisfied when at least one primitive in the
    // chain addresses the photometric channel (colour/style constraint).
    const hasPhotometric = resolvedPrimitives.some(p => p.namespace === 'photometric');
    if (!hasPhotometric) {
      diagnostics.push({
        level: 'warning', code: 'BrandConstraintMissing',
        message: `brand '${brand.name}' declares invariant "${brand.invariant}" but ` +
          `the chain has no photometric effects to carry it.`,
      });
    }
  }

  // ---- (e) Goal reachability ----------------------------------------

  if (scene.goal) {
    const goal = scene.goal;

    if (goal.behaviour) {
      const spec = resolveDescription(goal.behaviour);
      if (!spec) {
        diagnostics.push({
          level: 'error', code: 'GoalUnreachable',
          message: `goal behaviour "${goal.behaviour}" is not a registered description — goal is unreachable.`,
        });
      } else {
        // Check that the chain covers every namespace present in the goal description
        const goalNamespaces = new Set(spec.primitives.map(p => p.namespace));
        const chainNamespaces = new Set(resolvedPrimitives.map(p => p.namespace));
        const missing: Namespace[] = [...goalNamespaces].filter(n => !chainNamespaces.has(n)) as Namespace[];
        if (missing.length > 0) {
          diagnostics.push({
            level: 'error', code: 'GoalUnreachable',
            message: `Goal "${goal.behaviour}" requires namespaces [${missing.join(', ')}] ` +
              `that the current chain does not cover. Add effects for: ${missing.join(', ')}.`,
          });
        }
      }
    }
  }

  // ---- (f) Duration budget ------------------------------------------

  let totalClipDuration = 0;
  for (const step of scene.pipeline.steps) {
    if (step.kind === 'Clip' && step.for > 0) totalClipDuration += step.for;
  }

  if (scene.goal?.maxDuration != null && totalClipDuration > scene.goal.maxDuration) {
    diagnostics.push({
      level: 'error', code: 'DurationExceeded',
      message: `Clip duration ${totalClipDuration}s exceeds goal limit of ${scene.goal.maxDuration}s.`,
    });
  }

  const hasErrors = diagnostics.some(d => d.level === 'error');
  return { ok: !hasErrors, diagnostics, resolvedPrimitives };
}

// ---- Composite power calculator (exported for display) ---------------

export function compositePower(primitives: PrimitiveSpec[]): number {
  return 1 - primitives.reduce((acc, p) => acc * (1 - p.power), 1);
}
