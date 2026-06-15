// ======================================================================
//  MEE — Camera module types
//
//  Camera primitives live in their own namespace alongside spatial,
//  photometric, temporal, and acoustic. They are first-class MEE
//  primitives: they can appear in a scene pipeline, carry catalytic
//  power toward the behaviour cell, and are emitted as R3F components
//  by the Remotion/R3F backend.
// ======================================================================

export type CameraKind =
  | 'perspective'
  | 'orthographic'
  | 'shake'
  | 'transition'
  | 'cube'
  | 'map';

// Parameters for each camera primitive

export interface PerspectiveCameraParams {
  fov?: number;           // vertical field of view in degrees (default 50)
  near?: number;          // near clip plane (default 0.1)
  far?: number;           // far clip plane (default 1000)
  position?: [number, number, number];  // default [0, 0, 5]
  makeDefault?: boolean;  // register as the R3F default camera (default true)
  trackMouse?: boolean;   // orbit around target on mouse move (default false)
  trackRadius?: number;   // radius for mouse-tracking orbit (default 5)
}

export interface OrthographicCameraParams {
  zoom?: number;          // ortho zoom factor (default 50)
  near?: number;
  far?: number;
  position?: [number, number, number];  // default [0, 0, 10]
  makeDefault?: boolean;
  // Frustum bounds — if omitted, derived from viewport at construction time
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

export interface CameraShakeParams {
  intensity?: number;     // shake intensity [0,1] (default 0.5)
  decay?: boolean;        // whether intensity decays over time (default false)
  decayRate?: number;     // decay rate per second (default 0.65)
  maxYaw?: number;        // max yaw angle in radians (default 0.05)
  maxPitch?: number;      // max pitch angle in radians (default 0.05)
  maxRoll?: number;       // max roll angle in radians (default 0.05)
  yawFrequency?: number;  // simplex noise frequency for yaw (default 0.8)
  pitchFrequency?: number;
  rollFrequency?: number;
}

export interface CameraTransitionParams {
  // Which camera is shown initially: 'perspective' or 'orthographic'
  initial?: 'perspective' | 'orthographic';
  // Key that triggers the switch (default: any key)
  triggerKey?: string;
  perspectiveFov?: number;
  orthographicZoom?: number;
  position?: [number, number, number];
}

export interface CubeCameraParams {
  resolution?: number;    // FBO resolution (default 256)
  near?: number;          // default 0.1
  far?: number;           // default 1000
  frames?: number;        // frames to render (default Infinity)
}

export interface MapCameraParams {
  position?: [number, number, number];  // default [0, 5, 0]
  zoom?: number;
  far?: number;
}

export type CameraParams =
  | ({ kind: 'perspective' } & PerspectiveCameraParams)
  | ({ kind: 'orthographic' } & OrthographicCameraParams)
  | ({ kind: 'shake' } & CameraShakeParams)
  | ({ kind: 'transition' } & CameraTransitionParams)
  | ({ kind: 'cube' } & CubeCameraParams)
  | ({ kind: 'map' } & MapCameraParams);

// The MEE camera spec — returned by the camera registry
export interface CameraSpec {
  kind: CameraKind;
  label: string;
  description: string;
  power: number;         // catalytic power contribution toward behaviour cell
  params: Record<string, unknown>;
}
