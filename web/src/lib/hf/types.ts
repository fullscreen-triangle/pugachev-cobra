// HuggingFace inference integration types for MEE.
// Two models are first-class primitives:
//   - diffusion_shader  (EXCAI/Diffusion-As-Shader)
//   - video_from_3d     (VideoFrom3D)

export type HFModelId =
  | 'EXCAI/Diffusion-As-Shader'
  | 'VideoFrom3D/VideoFrom3D';

export type HFPrimitiveKind = 'diffusion_shader' | 'video_from_3d';

// ---- Request shapes sent to the HF Inference API ---------------------

export interface DiffusionShaderRequest {
  model: 'EXCAI/Diffusion-As-Shader';
  inputs: {
    video_url: string;       // source video
    style_prompt: string;    // e.g. "neon wireframe", "oil painting"
    motion_strength?: number; // 0-1, how much 3D motion signal drives the shader
    steps?: number;          // diffusion steps, default 20
    seed?: number;
  };
}

export interface VideoFrom3DRequest {
  model: 'VideoFrom3D/VideoFrom3D';
  inputs: {
    geometry_url: string;       // coarse 3D geometry (glb/obj)
    camera_trajectory: CameraKeyframe[];
    reference_image_url?: string;
    style_prompt?: string;
    fps?: number;
    duration_seconds?: number;
  };
}

export interface CameraKeyframe {
  time: number;              // seconds
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
}

// ---- Response shapes -------------------------------------------------

export interface HFVideoResponse {
  output_url: string;        // URL of processed video returned by HF
  duration_seconds: number;
  width: number;
  height: number;
  model: HFModelId;
  latency_ms: number;
}

// ---- Primitive params stored in IR -----------------------------------

export interface DiffusionShaderParams {
  model: 'EXCAI/Diffusion-As-Shader';
  style_prompt: string;
  motion_strength: number;
  steps: number;
  seed?: number;
}

export interface VideoFrom3DParams {
  model: 'VideoFrom3D/VideoFrom3D';
  geometry_url: string;
  style_prompt: string;
  fps: number;
  duration_seconds: number;
}

export type HFPrimitiveParams = DiffusionShaderParams | VideoFrom3DParams;

// ---- IR node ---------------------------------------------------------

export interface IRHFPrimitive {
  kind: 'IRHFPrimitive';
  primitiveKind: HFPrimitiveKind;
  params: HFPrimitiveParams;
  // clip path this primitive operates on (from the nearest IRClip ancestor)
  sourceClip: string;
}
