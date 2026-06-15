// ---- Effects --------------------------------------------------------
export { MEEBloom }                from './effects/Bloom';
export type { MEEBloomProps }      from './effects/Bloom';

export { MEEGlitch }               from './effects/Glitch';
export type { MEEGlitchProps }     from './effects/Glitch';

export { MEEVignette }             from './effects/Vignette';
export type { MEEVignetteProps }   from './effects/Vignette';

export { MEETriangularPixelation } from './effects/TriangularPixelation';
export type { MEETriangularPixelationProps } from './effects/TriangularPixelation';

// ---- Lights ---------------------------------------------------------
export { MEEGodRays }              from './lights/GodRays';
export type { MEEGodRaysProps }    from './lights/GodRays';

export { MEEVolumetricSpotLight }  from './lights/VolumetricSpotLight';
export type { MEEVolumetricSpotLightProps } from './lights/VolumetricSpotLight';

export { MEELightformer }          from './lights/Lightformer';
export type { MEELightformerProps, LightformerForm } from './lights/Lightformer';

export { MEECircularOrbitLight }   from './lights/CircularOrbitLight';
export type { MEECircularOrbitLightProps } from './lights/CircularOrbitLight';

export { MEEThreePointLighting }   from './lights/ThreePointLighting';
export type { MEEThreePointLightingProps } from './lights/ThreePointLighting';

export { MEELaser }                from './lights/Laser';
export type { MEELaserProps }      from './lights/Laser';

// ---- MEE registry patch --------------------------------------------
// Patches r3f effect/light primitives into the shared MEE PRIMITIVES
// so they can be used in compose() steps and resolved by the emitter.

import { PRIMITIVES } from '../mee/registry';
import type { PrimitiveSpec } from '../mee/registry';

const R3F_PRIMITIVES: Record<string, PrimitiveSpec> = {

  // Effects
  bloom: {
    name: 'bloom', namespace: 'photometric', power: 0.55,
    remotionHint: 'r3f:bloom',
    defaultParams: { intensity: 1.5, luminanceThreshold: 0.1, luminanceSmoothing: 0.5 },
    supports: ['grade_warm', 'specular', 'caustics', 'diffusion_shader'],
  },
  glitch: {
    name: 'glitch', namespace: 'temporal', power: 0.60,
    remotionHint: 'r3f:glitch',
    defaultParams: { delayMin: 0.5, delayMax: 1.5, strengthMin: 0.1, strengthMax: 0.2, ratio: 0.1 },
    supports: ['stutter', 'scatter', 'chromatic.invert'],
  },
  vignette: {
    name: 'vignette', namespace: 'photometric', power: 0.25,
    remotionHint: 'r3f:vignette',
    defaultParams: { offset: 0.5, darkness: 0.5 },
    supports: ['grade_cool', 'desaturate', 'bloom'],
  },
  pixelate: {
    name: 'pixelate', namespace: 'spatial', power: 0.35,
    remotionHint: 'r3f:pixelate',
    defaultParams: { fragments: 153 },
    supports: ['glitch', 'chromatic.posterize'],
  },

  // Lights
  godrays: {
    name: 'godrays', namespace: 'photometric', power: 0.70,
    remotionHint: 'r3f:godrays',
    defaultParams: { sunColor: '#ffffff', samples: 30, density: 0.97, decay: 0.96, weight: 0.6, exposure: 0.4 },
    supports: ['bloom', 'specular', 'scatter', 'diffusion_shader'],
  },
  volumetric_spot: {
    name: 'volumetric_spot', namespace: 'photometric', power: 0.60,
    remotionHint: 'r3f:volumetric_spot',
    defaultParams: { color: 'white', intensity: 1, distance: 5, angle: 0.15, attenuation: 5, anglePower: 5, opacity: 1 },
    supports: ['godrays', 'bloom', 'caustics'],
  },
  lightformer: {
    name: 'lightformer', namespace: 'photometric', power: 0.40,
    remotionHint: 'r3f:lightformer',
    defaultParams: { form: 'rect', color: 'white', intensity: 1, scale: 1 },
    supports: ['specular', 'reflect', 'bloom'],
  },
  orbit_light: {
    name: 'orbit_light', namespace: 'temporal', power: 0.30,
    remotionHint: 'r3f:orbit_light',
    defaultParams: { color: 'white', intensity: 0.5, orbitRadius: 10, orbitSpeed: 0.5, height: 15 },
    supports: ['oscillate', 'caustics', 'godrays'],
  },
  three_point_lighting: {
    name: 'three_point_lighting', namespace: 'photometric', power: 0.45,
    remotionHint: 'r3f:three_point_lighting',
    defaultParams: { keyIntensity: 0.7, fillIntensity: 0.1, rimIntensity: 0.1 },
    supports: ['specular', 'reflect', 'bloom', 'volumetric_spot'],
  },
  laser: {
    name: 'laser', namespace: 'photometric', power: 0.75,
    remotionHint: 'r3f:laser',
    defaultParams: { sunColor: '#00ffff', samples: 50, density: 0.97, decay: 0.97, weight: 0.5, exposure: 0.75 },
    supports: ['godrays', 'bloom', 'glitch', 'diffusion_shader'],
  },
};

Object.assign(PRIMITIVES, R3F_PRIMITIVES);
