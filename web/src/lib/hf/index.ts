export * from './types';
export * from './client';
export * from './primitives';

import { PRIMITIVES, BEHAVIOURS } from '../mee/registry';
import { HF_PRIMITIVES, HF_BEHAVIOURS } from './primitives';

// Patch HF primitives and behaviours into the shared MEE registries.
// Import this module once at app startup (or include it in _app.js).
Object.assign(PRIMITIVES, HF_PRIMITIVES);
Object.assign(BEHAVIOURS, HF_BEHAVIOURS);
