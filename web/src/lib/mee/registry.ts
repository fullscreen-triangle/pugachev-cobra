// ======================================================================
//  MEE — Behaviour Registry
//
//  Maps description strings → sets of physical primitives.
//  Each primitive carries: namespace, estimated power, Remotion render
//  hint, default params, and a support set.
//
//  The `supports` field is the pairwise sign-of-support relation from
//  §6 of the paper: primitive A supports primitive B when A's perceptual
//  channel reinforces (positively) the shift toward the target cell
//  induced by B. It is ordinal: we record only the sign (+1), not the
//  magnitude. The absence of an edge means neutral (0); we do not record
//  antagonism (−1) here because the registry describes single-behaviour
//  primitive sets where all primitives are directed toward the same cell.
//
//  The backward chain derivation engine (deriveChain) uses `supports`
//  to order primitives: place first those with the most incoming support
//  edges from the remaining set, so that each new primitive has the
//  most existing context to reinforce. This implements Principle
//  "backward chain derivation" from §8 of the paper.
// ======================================================================

import { Namespace } from './types';

export interface PrimitiveSpec {
  name: string;
  namespace: Namespace;
  power: number;          // estimated catalytic power [0,1]
  remotionHint: string;   // how the emitter should lower this primitive
  defaultParams: Record<string, string | number>;
  supports: string[];     // names of other primitives this one reinforces
}

export interface BehaviourSpec {
  label: string;
  description: string;
  primitives: PrimitiveSpec[];
}

// ---- Primitive library -----------------------------------------------
//
// supports[] encodes the directed support graph edges A → B (A supports B).
// Each entry is what the paper calls a "sign-of-pairwise-support" relation:
// these primitives mutually reinforce each other's shift toward the same
// behaviour cell. The graph is used by the coherence checker (§6) to
// detect 3-cycles, and by the backward chain derivation engine (§8) to
// order the chain.

export const PRIMITIVES: Record<string, PrimitiveSpec> = {

  // ---- SPATIAL --------------------------------------------------------

  oscillate: {
    name: 'oscillate', namespace: 'spatial', power: 0.25,
    remotionHint: 'interpolate:translateY',
    defaultParams: { axis: 'vertical', freq: 0.8, amp: 12 },
    // Vertical oscillation reinforces: horizontal oscillation (phase-shifted
    // companion), refraction (wave surface creates IOR gradient), propagation
    // (the wavefront that oscillate sets in motion).
    supports: ['oscillate_horizontal', 'refract', 'propagate', 'caustics'],
  },

  oscillate_horizontal: {
    name: 'oscillate_horizontal', namespace: 'spatial', power: 0.20,
    remotionHint: 'interpolate:translateX',
    defaultParams: { axis: 'horizontal', freq: 1.1, amp: 8 },
    // Phase-shifted companion to vertical oscillate; reinforces the same
    // refraction and propagation primitives.
    supports: ['oscillate', 'refract', 'propagate'],
  },

  distort: {
    name: 'distort', namespace: 'spatial', power: 0.30,
    remotionHint: 'filter:displacement',
    defaultParams: { mode: 'ripple', depth: 0.3 },
    // Aperiodic warp reinforces scatter (disrupted light paths) and
    // grade_warm (heat haze context — distortion co-occurs with warm air).
    supports: ['scatter', 'grade_warm', 'slow_push'],
  },

  shear: {
    name: 'shear', namespace: 'spatial', power: 0.20,
    remotionHint: 'interpolate:skewX',
    defaultParams: { angle: 5 },
    // Linear shear reinforces pulse (periodic shear = magnetic field lines)
    // and distort (combined = electromagnetic field effect).
    supports: ['pulse', 'distort', 'resonate'],
  },

  radial_propagate: {
    name: 'radial_propagate', namespace: 'spatial', power: 0.30,
    remotionHint: 'filter:radialDisplacement',
    defaultParams: { origin: 'center', speed: 0.8 },
    // Radial wavefront reinforces: damp (decay from impact), membrane_tension
    // (the medium through which propagation occurs), scatter (glass shatter),
    // stutter (impact timing).
    supports: ['damp', 'membrane_tension', 'scatter', 'stutter', 'resonate'],
  },

  membrane_tension: {
    name: 'membrane_tension', namespace: 'spatial', power: 0.20,
    remotionHint: 'interpolate:scale',
    defaultParams: { tension: 0.6 },
    // Membrane tension reinforces radial_propagate (provides the medium)
    // and oscillate (the restoring force of the membrane).
    supports: ['radial_propagate', 'oscillate', 'damp'],
  },

  stretch: {
    name: 'stretch', namespace: 'spatial', power: 0.15,
    remotionHint: 'interpolate:scaleY',
    defaultParams: { factor: 1.2 },
    supports: ['compress', 'slow_push'],
  },

  compress: {
    name: 'compress', namespace: 'spatial', power: 0.15,
    remotionHint: 'interpolate:scaleX',
    defaultParams: { factor: 0.85 },
    supports: ['stretch', 'blur_motion'],
  },

  blur_motion: {
    name: 'blur_motion', namespace: 'spatial', power: 0.18,
    remotionHint: 'filter:motionBlur',
    defaultParams: { amount: 4 },
    // Motion blur co-reinforces temporal slowdown and acoustic attenuation.
    supports: ['slow_push', 'attenuate', 'damp'],
  },

  // ---- PHOTOMETRIC ----------------------------------------------------

  reflect: {
    name: 'reflect', namespace: 'photometric', power: 0.25,
    remotionHint: 'layer:mirrorComposite',
    defaultParams: { plane: 'surface', blur: 4 },
    // A mirror composite reinforces refraction (surface with both effects =
    // water), oscillate (the thing being reflected is oscillating), and
    // caustics (reflection co-occurs with caustic patterning).
    supports: ['refract', 'oscillate', 'caustics'],
  },

  refract: {
    name: 'refract', namespace: 'photometric', power: 0.28,
    remotionHint: 'filter:refractionMap',
    defaultParams: { ior: 1.33, depth: 0.2 },
    // Refraction reinforces: oscillate (the medium oscillates), reflect
    // (water has both), caustics (refraction creates caustic patterns),
    // grade_cool (underwater = cool + refraction).
    supports: ['oscillate', 'reflect', 'caustics', 'grade_cool'],
  },

  scatter: {
    name: 'scatter', namespace: 'photometric', power: 0.20,
    remotionHint: 'filter:scatter',
    defaultParams: { radius: 6 },
    // Scatter reinforces: distort (disrupted media), specular (scatter +
    // specular = glass shatter light spread), grade_warm (heat haze scatter).
    supports: ['distort', 'specular', 'grade_warm', 'stutter'],
  },

  grade_warm: {
    name: 'grade_warm', namespace: 'photometric', power: 0.22,
    remotionHint: 'filter:colorGrade',
    defaultParams: { temperature: 300, saturation: 1.15 },
    // Warm grade reinforces: distort (heat haze), scatter (warm air scatter),
    // desaturate (archival = warm + faded).
    supports: ['distort', 'scatter', 'desaturate'],
  },

  grade_cool: {
    name: 'grade_cool', namespace: 'photometric', power: 0.22,
    remotionHint: 'filter:colorGrade',
    defaultParams: { temperature: -200, saturation: 1.1 },
    // Cool grade reinforces: refract (water), oscillate (underwater motion),
    // reverb (underwater sound), caustics (underwater light).
    supports: ['refract', 'oscillate', 'reverb', 'caustics'],
  },

  desaturate: {
    name: 'desaturate', namespace: 'photometric', power: 0.18,
    remotionHint: 'filter:saturation',
    defaultParams: { amount: 0.0 },
    // Desaturation reinforces: grade_warm (archival look), stutter (old film
    // temporal artefact), scatter (film grain as scatter proxy).
    supports: ['grade_warm', 'stutter', 'scatter'],
  },

  specular: {
    name: 'specular', namespace: 'photometric', power: 0.20,
    remotionHint: 'filter:specularHighlight',
    defaultParams: { intensity: 0.7 },
    // Specular highlight reinforces: scatter (glass), radial_propagate
    // (impact scatter), stutter (flash artefact at impact timing).
    supports: ['scatter', 'radial_propagate', 'stutter'],
  },

  caustics: {
    name: 'caustics', namespace: 'photometric', power: 0.25,
    remotionHint: 'layer:causticsOverlay',
    defaultParams: { intensity: 0.5, scale: 1.0 },
    // Caustic patterns reinforce: refract (source of caustics), oscillate
    // (moving caustics = oscillating water), grade_cool (underwater context).
    supports: ['refract', 'oscillate', 'grade_cool'],
  },

  // ---- TEMPORAL -------------------------------------------------------

  propagate: {
    name: 'propagate', namespace: 'temporal', power: 0.25,
    remotionHint: 'interpolate:wavePropagation',
    defaultParams: { origin: 'center', speed: 0.8 },
    // Temporal wave propagation reinforces: oscillate (the wave being
    // propagated), damp (decay of the propagating wave).
    supports: ['oscillate', 'damp', 'radial_propagate'],
  },

  damp: {
    name: 'damp', namespace: 'temporal', power: 0.20,
    remotionHint: 'interpolate:amplitudeDecay',
    defaultParams: { decay: 0.3 },
    // Amplitude decay reinforces: propagate (decaying wavefront), resonate
    // (resonance decays), membrane_tension (membrane returns to rest).
    supports: ['propagate', 'resonate', 'membrane_tension'],
  },

  pulse: {
    name: 'pulse', namespace: 'temporal', power: 0.18,
    remotionHint: 'interpolate:opacity',
    defaultParams: { freq: 2.0, duty: 0.5 },
    // Periodic temporal envelope reinforces: shear (pulsing field lines),
    // resonate (resonance at pulse frequency), distort (pulsing warp).
    supports: ['shear', 'resonate', 'distort'],
  },

  stutter: {
    name: 'stutter', namespace: 'temporal', power: 0.20,
    remotionHint: 'sequence:stutter',
    defaultParams: { interval: 4, hold: 2 },
    // Frame stutter reinforces: radial_propagate (impact timing), specular
    // (flash at impact), scatter (shattering context), desaturate (old film).
    supports: ['radial_propagate', 'specular', 'scatter', 'desaturate'],
  },

  slow_push: {
    name: 'slow_push', namespace: 'temporal', power: 0.15,
    remotionHint: 'interpolate:translateZ',
    defaultParams: { speed: 0.02 },
    // Slow temporal push reinforces: blur_motion (co-occurs in slow-motion),
    // attenuate (low-speed = low-frequency audio), damp (slow = decaying).
    supports: ['blur_motion', 'attenuate', 'damp'],
  },

  rapid_cut: {
    name: 'rapid_cut', namespace: 'temporal', power: 0.22,
    remotionHint: 'sequence:rapidCut',
    defaultParams: { interval: 6 },
    supports: ['stutter', 'pulse'],
  },

  // ---- ACOUSTIC -------------------------------------------------------

  resonate: {
    name: 'resonate', namespace: 'acoustic', power: 0.22,
    remotionHint: 'audio:eq',
    defaultParams: { freq: 200, gain: 6 },
    // Resonant frequency emphasis reinforces: damp (resonance decays),
    // radial_propagate (impact radiates resonance), pulse (resonant pulse),
    // low_rumble (sub-resonance companion).
    supports: ['damp', 'radial_propagate', 'pulse', 'low_rumble'],
  },

  attenuate: {
    name: 'attenuate', namespace: 'acoustic', power: 0.15,
    remotionHint: 'audio:lowpass',
    defaultParams: { cutoff: 800 },
    // High-frequency cutoff reinforces: blur_motion (muffled + blurred =
    // slow-motion), slow_push (slow context), damp.
    supports: ['blur_motion', 'slow_push', 'damp'],
  },

  reverb: {
    name: 'reverb', namespace: 'acoustic', power: 0.20,
    remotionHint: 'audio:reverb',
    defaultParams: { decay: 1.5, wet: 0.4 },
    // Reverb reinforces: grade_cool (underwater space), refract (submerged
    // context), low_rumble (underwater low-end + reverb = full underwater).
    supports: ['grade_cool', 'refract', 'low_rumble'],
  },

  low_rumble: {
    name: 'low_rumble', namespace: 'acoustic', power: 0.18,
    remotionHint: 'audio:subBass',
    defaultParams: { freq: 60, gain: 8 },
    // Sub-bass reinforces: resonate (frequency complement), radial_propagate
    // (impact generates sub-bass), reverb (sub-bass tail in reverberant space).
    supports: ['resonate', 'radial_propagate', 'reverb'],
  },
};

// ---- Behaviour descriptions -----------------------------------------

export const BEHAVIOURS: Record<string, BehaviourSpec> = {
  'water surface': {
    label: 'Water Surface',
    description: 'Oscillatory displacement, light refraction, specular reflection, and caustic patterns characteristic of a calm water surface.',
    primitives: [
      PRIMITIVES.oscillate,
      PRIMITIVES.oscillate_horizontal,
      PRIMITIVES.refract,
      PRIMITIVES.reflect,
      PRIMITIVES.caustics,
      PRIMITIVES.grade_cool,
    ],
  },
  'drum skin': {
    label: 'Drum Skin',
    description: 'Radial propagation from a strike point, damped overtone decay, and membrane tension oscillation characteristic of a struck drum skin.',
    primitives: [
      PRIMITIVES.radial_propagate,
      PRIMITIVES.oscillate,
      PRIMITIVES.damp,
      PRIMITIVES.membrane_tension,
      PRIMITIVES.resonate,
      PRIMITIVES.low_rumble,
    ],
  },
  'heat haze': {
    label: 'Heat Haze',
    description: 'Slow vertical distortion and scatter from rising warm air columns, with desaturated warm grade.',
    primitives: [
      PRIMITIVES.distort,
      PRIMITIVES.oscillate,
      PRIMITIVES.scatter,
      PRIMITIVES.grade_warm,
      PRIMITIVES.slow_push,
    ],
  },
  'glass shatter': {
    label: 'Glass Shatter',
    description: 'Rapid radial propagation from an impact point, specular scatter, and stutter timing characteristic of breaking glass.',
    primitives: [
      PRIMITIVES.radial_propagate,
      PRIMITIVES.scatter,
      PRIMITIVES.specular,
      PRIMITIVES.stutter,
      PRIMITIVES.resonate,
    ],
  },
  'magnetic field': {
    label: 'Magnetic Field',
    description: 'Radial and linear distortion fields, pulse timing, and low-frequency resonance characteristic of an electromagnetic field visualisation.',
    primitives: [
      PRIMITIVES.distort,
      PRIMITIVES.radial_propagate,
      PRIMITIVES.pulse,
      PRIMITIVES.shear,
      PRIMITIVES.resonate,
    ],
  },
  'slow motion': {
    label: 'Slow Motion',
    description: 'Temporal stretch with motion blur and low-frequency acoustic attenuation.',
    primitives: [
      PRIMITIVES.slow_push,
      PRIMITIVES.blur_motion,
      PRIMITIVES.attenuate,
      PRIMITIVES.damp,
    ],
  },
  'old film': {
    label: 'Old Film',
    description: 'Desaturated warm grade, stutter timing, scatter grain, and muffled acoustic attenuation characteristic of archival film stock.',
    primitives: [
      PRIMITIVES.desaturate,
      PRIMITIVES.grade_warm,
      PRIMITIVES.scatter,
      PRIMITIVES.stutter,
      PRIMITIVES.attenuate,
    ],
  },
  'underwater': {
    label: 'Underwater',
    description: 'Refraction, cool grade, reverb, low-frequency resonance, and oscillatory distortion characteristic of submerged footage.',
    primitives: [
      PRIMITIVES.refract,
      PRIMITIVES.grade_cool,
      PRIMITIVES.oscillate,
      PRIMITIVES.reverb,
      PRIMITIVES.low_rumble,
      PRIMITIVES.caustics,
    ],
  },
};

// ---- Lookup ----------------------------------------------------------

export function resolveDescription(desc: string): BehaviourSpec | null {
  const key = desc.trim().toLowerCase();
  return BEHAVIOURS[key] ?? null;
}

export function resolvePrimitive(name: string): PrimitiveSpec | null {
  return PRIMITIVES[name.toLowerCase()] ?? null;
}

// ---- Support graph utilities -----------------------------------------

// Returns the set of names supported by `a` that are also present in `within`.
export function outEdges(a: PrimitiveSpec, within: Set<string>): string[] {
  return a.supports.filter(name => within.has(name));
}

// Count incoming support edges for `a` from the set `within`.
export function inDegree(a: PrimitiveSpec, within: Set<string>): number {
  let count = 0;
  for (const name of within) {
    if (name === a.name) continue;
    const p = PRIMITIVES[name];
    if (p && p.supports.includes(a.name)) count++;
  }
  return count;
}

// Detect if the support graph restricted to `primitives` contains a
// directed cycle of length ≥ 3. Uses iterative DFS with three-colour
// marking (WHITE=0 / GRAY=1 / BLACK=2). Returns the cycle as an array
// of primitive names if found, or null.
export function findSupportCycle(primitives: PrimitiveSpec[]): string[] | null {
  const names = primitives.map(p => p.name);
  const nameSet = new Set(names);
  // Restrict support edges to only the primitives in this set
  const adj: Map<string, string[]> = new Map();
  for (const p of primitives) {
    adj.set(p.name, p.supports.filter(n => nameSet.has(n)));
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color: Map<string, number> = new Map(names.map(n => [n, WHITE]));
  const parent: Map<string, string | null> = new Map(names.map(n => [n, null]));

  // Reconstruct cycle from DFS parent map given back-edge u → v
  function extractCycle(from: string, to: string): string[] {
    const cycle: string[] = [from];
    let cur = from;
    while (cur !== to) {
      const p = parent.get(cur);
      if (p == null) break;
      cycle.push(p);
      cur = p;
    }
    cycle.push(to);
    return cycle.reverse();
  }

  function dfs(u: string): string[] | null {
    color.set(u, GRAY);
    for (const v of (adj.get(u) ?? [])) {
      if (color.get(v) === GRAY) {
        // Back edge u → v: cycle found. Check length ≥ 3.
        const cycle = extractCycle(u, v);
        if (cycle.length >= 3) return cycle;
      }
      if (color.get(v) === WHITE) {
        parent.set(v, u);
        const result = dfs(v);
        if (result) return result;
      }
    }
    color.set(u, BLACK);
    return null;
  }

  for (const name of names) {
    if (color.get(name) === WHITE) {
      const result = dfs(name);
      if (result) return result;
    }
  }
  return null;
}

// ---- Backward chain derivation engine (§8, Principle backward) -------
//
// Given a set of primitives for a behaviour description, derives the
// ordered isomorphism chain by backward trajectory completion:
//
//   1. Start from the target cell (all primitives form the "goal set").
//   2. At each step, select the primitive with the highest in-degree in
//      the current remaining set — the one most supported by others
//      already placed. This is the "most-grounded" next step: it has the
//      most incoming context from the chain already committed.
//   3. Place it at the FRONT of the chain-under-construction (we are
//      building backward from the terminus toward the source, so the most-
//      grounded steps appear first in the output, which is the forward
//      execution order: the chain that a renderer will apply left-to-right).
//   4. Repeat until all primitives are placed.
//
// The result is a topological-ish ordering where each primitive is
// introduced only after the primitives it most depends on for support
// have already appeared — giving the compiler the "most context" at
// each new step, matching the backward-completion intuition from §8.
//
// If multiple primitives tie on in-degree, break ties by namespace
// priority (spatial → photometric → temporal → acoustic) so that
// the chain builds spatial context before layering photometric and
// temporal effects on top of it.
//
// This is a deterministic O(n²) greedy algorithm. The Rust production
// compiler may use a richer heuristic (e.g., actual distance-to-cell
// estimates), but this faithfully implements the ordinal version of
// Principle backward from the paper.

const NS_ORDER: Namespace[] = ['spatial', 'photometric', 'temporal', 'acoustic'];

export function deriveChain(primitives: PrimitiveSpec[]): PrimitiveSpec[] {
  if (primitives.length === 0) return [];

  const remaining = new Map<string, PrimitiveSpec>(primitives.map(p => [p.name, p]));
  const chain: PrimitiveSpec[] = [];

  while (remaining.size > 0) {
    let best: PrimitiveSpec | null = null;
    let bestScore = -1;

    for (const [, p] of remaining) {
      // Count incoming support edges from the already-placed chain
      // (primitives no longer in `remaining`).
      const placedNames = new Set(chain.map(c => c.name));
      let inFromPlaced = 0;
      for (const name of placedNames) {
        const placed = PRIMITIVES[name];
        if (placed && placed.supports.includes(p.name)) inFromPlaced++;
      }

      // Tiebreak: namespace priority (lower index = higher priority)
      const nsScore = NS_ORDER.length - NS_ORDER.indexOf(p.namespace);
      // Combined score: in-degree from placed primitives (primary),
      // then namespace order (secondary), then power (tertiary)
      const score = inFromPlaced * 1000 + nsScore * 10 + Math.round(p.power * 9);

      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }

    if (!best) break;
    chain.push(best);
    remaining.delete(best.name);
  }

  return chain;
}
