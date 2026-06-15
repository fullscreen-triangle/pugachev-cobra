// HuggingFace Inference API client.
// All calls go through Next.js API routes (/api/hf/*) so the HF_TOKEN
// never touches the browser. This module is SSR-safe.

import type {
  DiffusionShaderRequest,
  VideoFrom3DRequest,
  HFVideoResponse,
} from './types';

// ---- Low-level fetch wrapper -----------------------------------------

async function hfPost<T>(
  route: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HF API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---- Public API ------------------------------------------------------

export async function runDiffusionShader(
  req: DiffusionShaderRequest,
  signal?: AbortSignal,
): Promise<HFVideoResponse> {
  return hfPost<HFVideoResponse>('/api/hf/diffusion-shader', req, signal);
}

export async function runVideoFrom3D(
  req: VideoFrom3DRequest,
  signal?: AbortSignal,
): Promise<HFVideoResponse> {
  return hfPost<HFVideoResponse>('/api/hf/video-from-3d', req, signal);
}

// ---- Status polling --------------------------------------------------
// HF inference on large models can exceed 30 s. We expose a polling
// helper so callers can show progress without holding a long-lived fetch.

export interface HFJobStatus {
  status: 'queued' | 'running' | 'done' | 'error';
  progress?: number;   // 0-1
  result?: HFVideoResponse;
  error?: string;
}

export async function pollJob(jobId: string, signal?: AbortSignal): Promise<HFJobStatus> {
  return hfPost<HFJobStatus>('/api/hf/status', { jobId }, signal);
}
