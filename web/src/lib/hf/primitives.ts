// MEE primitive specs for HF-backed models.
// Patched into PRIMITIVES/BEHAVIOURS at import time via index.ts.

import type { PrimitiveSpec, BehaviourSpec } from '../mee/registry';

export const HF_PRIMITIVES: Record<string, PrimitiveSpec> = {

  diffusion_shader: {
    name: 'diffusion_shader',
    namespace: 'photometric',
    power: 0.85,
    remotionHint: 'hf:diffusion_shader',
    defaultParams: {
      model: 'EXCAI/Diffusion-As-Shader',
      style_prompt: 'cinematic color grading',
      motion_strength: 0.7,
      steps: 20,
    },
    // Diffusion shader is the dominant photometric primitive: it subsumes
    // colour grading, surface material, and temporal coherence in one pass.
    // It reinforces video effects that alter texture/surface independently.
    supports: ['isolate', 'draw_skeleton', 'temporal.vhs', 'degradation.grain'],
  },

  video_from_3d: {
    name: 'video_from_3d',
    namespace: 'spatial',
    power: 0.90,
    remotionHint: 'hf:video_from_3d',
    defaultParams: {
      model: 'VideoFrom3D/VideoFrom3D',
      style_prompt: '',
      fps: 24,
      duration_seconds: 5,
      geometry_url: '',
    },
    // Synthesises video from geometry + camera trajectory produced by the
    // camera module. Reinforces camera primitives (provides the scene to film)
    // and photometric effects that are layered on top.
    supports: ['camera_perspective', 'camera_shake', 'diffusion_shader', 'isolate'],
  },
};

export const HF_BEHAVIOURS: Record<string, BehaviourSpec> = {
  'neon wireframe': {
    label: 'Neon Wireframe',
    description: 'Renders subjects as glowing neon wireframe geometry',
    primitives: [
      HF_PRIMITIVES['diffusion_shader']!,
    ],
  },
  'oil painting': {
    label: 'Oil Painting',
    description: 'Transforms footage into an oil painting style',
    primitives: [
      HF_PRIMITIVES['diffusion_shader']!,
    ],
  },
  '3d scene video': {
    label: '3D Scene Video',
    description: 'Synthesises video from 3D geometry and camera trajectory',
    primitives: [
      HF_PRIMITIVES['video_from_3d']!,
    ],
  },
  'shader enhanced': {
    label: 'Shader Enhanced',
    description: 'GPU-style diffusion shader applied to existing footage',
    primitives: [
      HF_PRIMITIVES['diffusion_shader']!,
    ],
  },
};
