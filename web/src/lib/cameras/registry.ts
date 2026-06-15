// ======================================================================
//  MEE — Camera Registry
//
//  Registers all camera primitives so they can appear in MEE scripts
//  and be processed by the type-checker and emitter. Camera primitives
//  live in a 'camera' namespace — an extension of the four core
//  namespaces (spatial/photometric/temporal/acoustic). They carry
//  catalytic power toward behaviour cells that involve a specific
//  point-of-view character (POV shake, field transition, reflection).
//
//  Integration with the MEE compiler:
//    - The emitter consults CAMERA_PRIMITIVES by remotionHint to decide
//      which R3F component to emit.
//    - The checker treats camera primitives as namespace 'spatial' for
//      the purposes of coherence and saturation — a camera controls the
//      spatial framing of the scene, which is the dominant perceptual
//      channel it addresses.
//    - Camera primitives can appear in compose() steps alongside spatial,
//      photometric, temporal, and acoustic effects.
// ======================================================================

export type CameraKind =
  | 'perspective'
  | 'orthographic'
  | 'shake'
  | 'transition'
  | 'cube'
  | 'map';

export interface CameraPrimitiveSpec {
  name: string;
  kind: CameraKind;
  // Mapped to 'spatial' for MEE namespace purposes (camera controls POV,
  // which is the dominant spatial transform).
  namespace: 'spatial';
  power: number;
  remotionHint: string;   // used by emitter to select R3F component
  defaultParams: Record<string, unknown>;
  supports: string[];     // other camera or MEE primitives this reinforces
  description: string;
}

export const CAMERA_PRIMITIVES: Record<string, CameraPrimitiveSpec> = {

  // ---- Perspective camera -------------------------------------------
  // Full-depth perspective projection. The baseline framing primitive:
  // establishes depth cues that spatial and photometric effects build on.
  camera_perspective: {
    name: 'camera_perspective',
    kind: 'perspective',
    namespace: 'spatial',
    power: 0.30,
    remotionHint: 'camera:perspective',
    defaultParams: {
      fov: 50,
      near: 0.1,
      far: 1000,
      position: [0, 0, 5],
      makeDefault: true,
      trackMouse: false,
      trackRadius: 5,
    },
    // Perspective framing reinforces: oscillate (depth amplifies vertical
    // motion), refract (perspective + refraction = believable water depth),
    // radial_propagate (depth perspective + radial = impact emanating away).
    supports: ['oscillate', 'refract', 'radial_propagate', 'distort'],
    description: 'Perspective camera with configurable FOV and optional mouse tracking.',
  },

  // ---- Perspective camera with mouse tracking -----------------------
  // The camera orbits around the origin following cursor position —
  // implements the cameras.tsx mouse-tracking variant (sin/cos orbit).
  camera_perspective_track: {
    name: 'camera_perspective_track',
    kind: 'perspective',
    namespace: 'spatial',
    power: 0.25,
    remotionHint: 'camera:perspective',
    defaultParams: {
      fov: 50,
      near: 0.1,
      far: 1000,
      position: [0, 0, 5],
      makeDefault: true,
      trackMouse: true,
      trackRadius: 5,
    },
    supports: ['oscillate', 'distort', 'scatter'],
    description: 'Perspective camera that orbits around the origin on mouse move.',
  },

  // ---- Orthographic camera ------------------------------------------
  // Parallel projection: removes depth cues, emphasises flatness and
  // pattern. Reinforces grid-like or uniform-field effects.
  camera_orthographic: {
    name: 'camera_orthographic',
    kind: 'orthographic',
    namespace: 'spatial',
    power: 0.22,
    remotionHint: 'camera:orthographic',
    defaultParams: {
      zoom: 50,
      near: 0.1,
      far: 1000,
      position: [0, 0, 10],
      makeDefault: true,
    },
    supports: ['shear', 'compress', 'stretch', 'desaturate'],
    description: 'Orthographic camera — parallel projection removes depth cues.',
  },

  // ---- Camera shake -------------------------------------------------
  // Simplex-noise yaw/pitch/roll composited onto the current camera.
  // Works with any of the above cameras; adds physicality to the framing.
  camera_shake: {
    name: 'camera_shake',
    kind: 'shake',
    namespace: 'spatial',
    power: 0.28,
    remotionHint: 'camera:shake',
    defaultParams: {
      intensity: 0.5,
      decay: false,
      decayRate: 0.65,
      maxYaw: 0.05,
      maxPitch: 0.05,
      maxRoll: 0.05,
      yawFrequency: 0.8,
      pitchFrequency: 0.8,
      rollFrequency: 0.8,
    },
    // Shake reinforces: radial_propagate (impact radiates + camera shakes),
    // damp (shake decays = damped oscillation), low_rumble (bass + shake).
    supports: ['radial_propagate', 'damp', 'low_rumble', 'stutter'],
    description: 'Simplex-noise camera shake with configurable intensity and optional decay.',
  },

  // ---- Decaying camera shake ----------------------------------------
  // Same as shake but with decay=true and higher default intensity —
  // for impact moments that settle back to stillness.
  camera_shake_decay: {
    name: 'camera_shake_decay',
    kind: 'shake',
    namespace: 'spatial',
    power: 0.35,
    remotionHint: 'camera:shake',
    defaultParams: {
      intensity: 1.0,
      decay: true,
      decayRate: 0.65,
      maxYaw: 0.1,
      maxPitch: 0.1,
      maxRoll: 0.1,
      yawFrequency: 0.6,
      pitchFrequency: 0.6,
      rollFrequency: 0.6,
    },
    supports: ['radial_propagate', 'damp', 'low_rumble', 'resonate', 'stutter'],
    description: 'Camera shake that decays to stillness — for impact moments.',
  },

  // ---- Camera transition --------------------------------------------
  // Perspective ↔ orthographic switch. Represents a visual grammar shift.
  camera_transition: {
    name: 'camera_transition',
    kind: 'transition',
    namespace: 'spatial',
    power: 0.20,
    remotionHint: 'camera:transition',
    defaultParams: {
      initial: 'perspective',
      triggerKey: null,
      perspectiveFov: 50,
      orthographicZoom: 100,
    },
    supports: ['desaturate', 'grade_cool', 'slow_push'],
    description: 'Animated switch between perspective and orthographic projection.',
  },

  // ---- Cube camera --------------------------------------------------
  // Renders the scene into a cubemap for environment map reflections.
  // Reinforces photometric effects that depend on environmental lighting.
  camera_cube: {
    name: 'camera_cube',
    kind: 'cube',
    namespace: 'spatial',
    power: 0.25,
    remotionHint: 'camera:cube',
    defaultParams: {
      resolution: 256,
      near: 0.1,
      far: 1000,
      frames: Infinity,
    },
    supports: ['reflect', 'specular', 'caustics', 'refract'],
    description: 'Cube camera rendering environment map for reflective materials.',
  },

  // ---- Map / top-down camera ----------------------------------------
  // Top-down parallel view with MapControls — useful for spatial-field
  // effect visualisations (magnetic field, propagation maps).
  camera_map: {
    name: 'camera_map',
    kind: 'map',
    namespace: 'spatial',
    power: 0.18,
    remotionHint: 'camera:map',
    defaultParams: {
      position: [0, 5, 0],
      zoom: 1,
      far: 10000,
    },
    supports: ['distort', 'radial_propagate', 'shear'],
    description: 'Top-down MapControls camera for field and propagation visualisations.',
  },
};

// ---- Lookup helpers --------------------------------------------------

export function resolveCameraPrimitive(name: string): CameraPrimitiveSpec | null {
  return CAMERA_PRIMITIVES[name.toLowerCase()] ?? null;
}

export function listCameraPrimitives(): CameraPrimitiveSpec[] {
  return Object.values(CAMERA_PRIMITIVES);
}

// ---- Behaviour → camera mapping -------------------------------------
//
// Some MEE behaviour descriptions imply a canonical camera. The compiler
// can read this to automatically inject a camera primitive when none is
// explicitly specified in the pipeline.

export const BEHAVIOUR_CAMERA: Record<string, string> = {
  'water surface':  'camera_perspective',
  'drum skin':      'camera_perspective',
  'heat haze':      'camera_perspective',
  'glass shatter':  'camera_shake_decay',
  'magnetic field': 'camera_map',
  'slow motion':    'camera_perspective',
  'old film':       'camera_perspective',
  'underwater':     'camera_perspective',
};

export function defaultCameraForBehaviour(behaviour: string): CameraPrimitiveSpec | null {
  const key = behaviour.trim().toLowerCase();
  const name = BEHAVIOUR_CAMERA[key];
  return name ? (CAMERA_PRIMITIVES[name] ?? null) : null;
}
