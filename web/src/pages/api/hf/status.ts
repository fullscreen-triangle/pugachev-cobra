import type { NextApiRequest, NextApiResponse } from 'next';
import type { HFJobStatus } from '@/lib/hf/client';

// HF Inference API exposes job status at /models/{model}/jobs/{id}
// for async (queued) requests. This route proxies that call.

const HF_BASE = 'https://api-inference.huggingface.co';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HFJobStatus | { error: string }>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'HF_TOKEN not configured' });
  }

  const { jobId } = req.body as { jobId: string };
  if (!jobId) {
    return res.status(400).json({ error: 'jobId required' });
  }

  const hfRes = await fetch(`${HF_BASE}/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!hfRes.ok) {
    return res.status(hfRes.status).json({ error: `HF status ${hfRes.status}` });
  }

  const data = await hfRes.json() as {
    status: string;
    progress?: number;
    output?: { url: string };
    error?: string;
  };

  const statusMap: Record<string, HFJobStatus['status']> = {
    queued: 'queued',
    running: 'running',
    succeeded: 'done',
    failed: 'error',
  };

  return res.status(200).json({
    status: statusMap[data.status] ?? 'queued',
    progress: data.progress,
    error: data.error,
  });
}
