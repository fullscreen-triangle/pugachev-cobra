export * from './types';
export * from './tracker';
export * from './cache';
export * from './selection';
export * from './pipeline';
export * from './effects/index';

import { PRIMITIVES } from '../mee/registry';
import type { PrimitiveSpec } from '../mee/registry';

const DETECTION_PRIMITIVES: Record<string, PrimitiveSpec> = {
  draw_skeleton: {
    name: 'draw_skeleton',
    namespace: 'spatial',
    power: 0.60,
    remotionHint: 'object:skeleton',
    defaultParams: { style: 'neon', color: '#00ffff', thickness: 2, showKeypoints: 1 },
    supports: ['isolate', 'silhouette'],
  },
  isolate: {
    name: 'isolate',
    namespace: 'photometric',
    power: 0.75,
    remotionHint: 'object:isolate',
    defaultParams: { backgroundEffect: 'blur', intensity: 0.8, feather: 10 },
    supports: ['silhouette', 'draw_skeleton'],
  },
  silhouette: {
    name: 'silhouette',
    namespace: 'photometric',
    power: 0.80,
    remotionHint: 'object:silhouette',
    defaultParams: { color: '#000000', feather: 2 },
    supports: ['isolate', 'draw_skeleton'],
  },
  detect_people: {
    name: 'detect_people',
    namespace: 'spatial',
    power: 0.10,
    remotionHint: 'object:detect',
    defaultParams: { minConfidence: 0.5 },
    supports: ['draw_skeleton', 'isolate', 'silhouette'],
  },
};

// Side effect: patch detection primitives into the shared MEE registry
Object.assign(PRIMITIVES, DETECTION_PRIMITIVES);
