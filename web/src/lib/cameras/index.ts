// ======================================================================
//  MEE — Camera module public API
//
//  Re-exports all camera components and registry utilities.
//  Also patches the MEE primitive registry so that camera primitives
//  can appear in compose() pipeline steps and be resolved by the
//  type-checker (check (a) description resolution) and emitter.
//
//  Import this module once at application startup to activate cameras:
//    import '@/lib/cameras';
//
//  Or import named components directly:
//    import { MEEPerspectiveCamera, MEECameraShake } from '@/lib/cameras';
// ======================================================================

// ---- R3F components --------------------------------------------------
export { MEEPerspectiveCamera }  from './PerspectiveCamera';
export type { PerspectiveCameraProps } from './PerspectiveCamera';

export { MEEOrthographicCamera } from './OrthographicCamera';
export type { OrthographicCameraProps } from './OrthographicCamera';

export { MEECameraShake }        from './CameraShake';
export type { CameraShakeProps, ShakeController } from './CameraShake';

export { MEECameraTransition }   from './CameraTransition';
export type { CameraTransitionProps, CameraTransitionController } from './CameraTransition';

export { MEECubeCamera }         from './CubeCamera';
export type { CubeCameraProps }  from './CubeCamera';

// ---- Registry --------------------------------------------------------
export {
  CAMERA_PRIMITIVES,
  BEHAVIOUR_CAMERA,
  resolveCameraPrimitive,
  listCameraPrimitives,
  defaultCameraForBehaviour,
} from './registry';
export type { CameraPrimitiveSpec, CameraKind } from './registry';

// ---- Patch MEE primitive registry -----------------------------------
//
// Camera primitives are injected into the MEE PRIMITIVES record so that
// compose(camera_shake) is valid MEE syntax resolved by the type-checker.
// We do this here (side-effect import) rather than in registry.ts itself
// to avoid a circular dependency between the two registries.
//
// The camera primitives map to namespace 'spatial' for coherence/
// saturation analysis — this is the correct assignment because a camera
// primitive controls the dominant spatial framing of the scene.

import { PRIMITIVES } from '../mee/registry';
import { CAMERA_PRIMITIVES } from './registry';

for (const [name, spec] of Object.entries(CAMERA_PRIMITIVES)) {
  if (!PRIMITIVES[name]) {
    // Cast is safe: CameraPrimitiveSpec is structurally compatible with
    // PrimitiveSpec (same fields: name, namespace, power, remotionHint,
    // defaultParams, supports). The only extra field is `kind` and
    // `description`, which the MEE registry ignores.
    (PRIMITIVES as Record<string, unknown>)[name] = {
      name: spec.name,
      namespace: spec.namespace,
      power: spec.power,
      remotionHint: spec.remotionHint,
      defaultParams: spec.defaultParams as Record<string, string | number>,
      supports: spec.supports,
    };
  }
}
