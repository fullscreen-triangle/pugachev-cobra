import type { NextApiRequest, NextApiResponse } from 'next';
import type { DiffusionShaderRequest, HFVideoResponse } from '@/lib/hf/types';

// Proxies diffusion-shader requests to HF Inference API.
// HF_TOKEN is read server-side only — never exposed to the browser.

const HF_API = 'https://api-inference.huggingface.co/models/EXCAI/Diffusion-As-Shader';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HFVideoResponse | { error: string }>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'HF_TOKEN not configured' });
  }

  const body = req.body as DiffusionShaderRequest;

  const t0 = Date.now();

  const hfRes = await fetch(HF_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: body.inputs.video_url,
      parameters: {
        style_prompt: body.inputs.style_prompt,
        motion_strength: body.inputs.motion_strength ?? 0.7,
        num_inference_steps: body.inputs.steps ?? 20,
        seed: body.inputs.seed,
      },
    }),
  });

  if (!hfRes.ok) {
    const text = await hfRes.text().catch(() => hfRes.statusText);
    return res.status(hfRes.status).json({ error: `HF returned ${hfRes.status}: ${text}` });
  }

  // HF returns the processed video as a binary blob for video models.
  // We re-encode it as a data URL and return the metadata the client needs.
  const blob = await hfRes.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const dataUrl = `data:${blob.type || 'video/mp4'};base64,${base64}`;

  return res.status(200).json({
    output_url: dataUrl,
    duration_seconds: (body.inputs as Record<string, unknown>).duration as number ?? 0,
    width: 1280,
    height: 720,
    model: 'EXCAI/Diffusion-As-Shader',
    latency_ms: Date.now() - t0,
  });
}

export const config = {
  api: {
    // HF video responses can be large; raise the body limit.
    responseLimit: '50mb',
    bodyParser: { sizeLimit: '10mb' },
  },
};
