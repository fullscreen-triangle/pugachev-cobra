// ======================================================================
//  MEE — Behaviour Registry
//
//  Maps description strings → sets of physical primitives.
//  Each primitive carries: namespace, estimated power, and a
//  Remotion render hint used by the emitter.
// ======================================================================

import { Namespace } from './types';

export interface PrimitiveSpec {
  name: string;
  namespace: Namespace;
  power: number;          // estimated catalytic power [0,1]
  remotionHint: string;   // how the emitter should lower this primitive
  defaultParams: Record<string, string | number>;
}

export interface BehaviourSpec {
  label: string;
  description: string;
  primitives: PrimitiveSpec[];
}

// ---- Primitive library -----------------------------------------------

export const PRIMITIVES: Record<string, PrimitiveSpec> = {
  // spatial
  oscillate: {
    name: 'oscillate', namespace: 'spatial', power: 0.25,
    remotionHint: 'interpolate:translateY',
    defaultParams: { axis: 'vertical', freq: 0.8, amp: 12 },
  },
  oscillate_horizontal: {
    name: 'oscillate_horizontal', namespace: 'spatial', power: 0.20,
    remotionHint: 'interpolate:translateX',
    defaultParams: { axis: 'horizontal', freq: 1.1, amp: 8 },
  },
  distort: {
    name: 'distort', namespace: 'spatial', power: 0.30,
    remotionHint: 'filter:displacement',
    defaultParams: { mode: 'ripple', depth: 0.3 },
  },
  shear: {
    name: 'shear', namespace: 'spatial', power: 0.20,
    remotionHint: 'interpolate:skewX',
    defaultParams: { angle: 5 },
  },
  radial_propagate: {
    name: 'radial_propagate', namespace: 'spatial', power: 0.30,
    remotionHint: 'filter:radialDisplacement',
    defaultParams: { origin: 'center', speed: 0.8 },
  },
  membrane_tension: {
    name: 'membrane_tension', namespace: 'spatial', power: 0.20,
    remotionHint: 'interpolate:scale',
    defaultParams: { tension: 0.6 },
  },
  stretch: {
    name: 'stretch', namespace: 'spatial', power: 0.15,
    remotionHint: 'interpolate:scaleY',
    defaultParams: { factor: 1.2 },
  },
  compress: {
    name: 'compress', namespace: 'spatial', power: 0.15,
    remotionHint: 'interpolate:scaleX',
    defaultParams: { factor: 0.85 },
  },
  blur_motion: {
    name: 'blur_motion', namespace: 'spatial', power: 0.18,
    remotionHint: 'filter:motionBlur',
    defaultParams: { amount: 4 },
  },

  // photometric
  reflect: {
    name: 'reflect', namespace: 'photometric', power: 0.25,
    remotionHint: 'layer:mirrorComposite',
    defaultParams: { plane: 'surface', blur: 4 },
  },
  refract: {
    name: 'refract', namespace: 'photometric', power: 0.28,
    remotionHint: 'filter:refractionMap',
    defaultParams: { ior: 1.33, depth: 0.2 },
  },
  scatter: {
    name: 'scatter', namespace: 'photometric', power: 0.20,
    remotionHint: 'filter:scatter',
    defaultParams: { radius: 6 },
  },
  grade_warm: {
    name: 'grade_warm', namespace: 'photometric', power: 0.22,
    remotionHint: 'filter:colorGrade',
    defaultParams: { temperature: 300, saturation: 1.15 },
  },
  grade_cool: {
    name: 'grade_cool', namespace: 'photometric', power: 0.22,
    remotionHint: 'filter:colorGrade',
    defaultParams: { temperature: -200, saturation: 1.1 },
  },
  desaturate: {
    name: 'desaturate', namespace: 'photometric', power: 0.18,
    remotionHint: 'filter:saturation',
    defaultParams: { amount: 0.0 },
  },
  specular: {
    name: 'specular', namespace: 'photometric', power: 0.20,
    remotionHint: 'filter:specularHighlight',
    defaultParams: { intensity: 0.7 },
  },
  caustics: {
    name: 'caustics', namespace: 'photometric', power: 0.25,
    remotionHint: 'layer:causticsOverlay',
    defaultParams: { intensity: 0.5, scale: 1.0 },
  },

  // temporal
  propagate: {
    name: 'propagate', namespace: 'temporal', power: 0.25,
    remotionHint: 'interpolate:wavePropagation',
    defaultParams: { origin: 'center', speed: 0.8 },
  },
  damp: {
    name: 'damp', namespace: 'temporal', power: 0.20,
    remotionHint: 'interpolate:amplitudeDecay',
    defaultParams: { decay: 0.3 },
  },
  pulse: {
    name: 'pulse', namespace: 'temporal', power: 0.18,
    remotionHint: 'interpolate:opacity',
    defaultParams: { freq: 2.0, duty: 0.5 },
  },
  stutter: {
    name: 'stutter', namespace: 'temporal', power: 0.20,
    remotionHint: 'sequence:stutter',
    defaultParams: { interval: 4, hold: 2 },
  },
  slow_push: {
    name: 'slow_push', namespace: 'temporal', power: 0.15,
    remotionHint: 'interpolate:translateZ',
    defaultParams: { speed: 0.02 },
  },
  rapid_cut: {
    name: 'rapid_cut', namespace: 'temporal', power: 0.22,
    remotionHint: 'sequence:rapidCut',
    defaultParams: { interval: 6 },
  },

  // acoustic
  resonate: {
    name: 'resonate', namespace: 'acoustic', power: 0.22,
    remotionHint: 'audio:eq',
    defaultParams: { freq: 200, gain: 6 },
  },
  attenuate: {
    name: 'attenuate', namespace: 'acoustic', power: 0.15,
    remotionHint: 'audio:lowpass',
    defaultParams: { cutoff: 800 },
  },
  reverb: {
    name: 'reverb', namespace: 'acoustic', power: 0.20,
    remotionHint: 'audio:reverb',
    defaultParams: { decay: 1.5, wet: 0.4 },
  },
  low_rumble: {
    name: 'low_rumble', namespace: 'acoustic', power: 0.18,
    remotionHint: 'audio:subBass',
    defaultParams: { freq: 60, gain: 8 },
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
