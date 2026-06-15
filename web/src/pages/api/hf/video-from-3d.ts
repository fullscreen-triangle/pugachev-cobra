import type { NextApiRequest, NextApiResponse } from 'next';
import type { VideoFrom3DRequest, HFVideoResponse } from '@/lib/hf/types';

const HF_API = 'https://api-inference.huggingface.co/models/VideoFrom3D/VideoFrom3D';

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

  const body = req.body as VideoFrom3DRequest;
  const t0 = Date.now();

  const hfRes = await fetch(HF_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {
        geometry_url: body.inputs.geometry_url,
        camera_trajectory: body.inputs.camera_trajectory,
        reference_image_url: body.inputs.reference_image_url,
      },
      parameters: {
        style_prompt: body.inputs.style_prompt ?? '',
        fps: body.inputs.fps ?? 24,
        duration_seconds: body.inputs.duration_seconds ?? 5,
      },
    }),
  });

  if (!hfRes.ok) {
    const text = await hfRes.text().catch(() => hfRes.statusText);
    return res.status(hfRes.status).json({ error: `HF returned ${hfRes.status}: ${text}` });
  }

  const blob = await hfRes.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const dataUrl = `data:${blob.type || 'video/mp4'};base64,${base64}`;

  return res.status(200).json({
    output_url: dataUrl,
    duration_seconds: body.inputs.duration_seconds ?? 5,
    width: 1280,
    height: 720,
    model: 'VideoFrom3D/VideoFrom3D',
    latency_ms: Date.now() - t0,
  });
}

export const config = {
  api: {
    responseLimit: '50mb',
    bodyParser: { sizeLimit: '10mb' },
  },
};
