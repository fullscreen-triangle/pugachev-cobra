// Remotion component that calls an HF primitive and renders its output.
// Used in emitted compositions when a shader: or hf: primitive is present.
//
// Rendering flow:
//   1. On mount, POST to the appropriate /api/hf/* route.
//   2. While waiting, render the source clip unmodified (passthrough).
//   3. When HF returns a processed video URL, swap the src.
//
// This means the Remotion preview always plays something immediately
// and the HF-enhanced version replaces it as soon as it arrives.
// In production Remotion renders, the call is made once and the result
// is cached for the duration of the composition.

import React, { useEffect, useRef, useState } from 'react';
import { AbsoluteFill, Video, useCurrentFrame } from 'remotion';
import type { HFPrimitiveParams } from '../types';
import { runDiffusionShader, runVideoFrom3D } from '../client';

interface HFPrimitiveLayerProps {
  sourceClip: string;
  params: HFPrimitiveParams;
  startFrom?: number;
}

type LoadState = 'idle' | 'loading' | 'done' | 'error';

export const HFPrimitiveLayer: React.FC<HFPrimitiveLayerProps> = ({
  sourceClip,
  params,
  startFrom = 0,
}) => {
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>('idle');
  const abortRef = useRef<AbortController | null>(null);
  // Keep inference to one call per mount even in Remotion's strict double-invoke.
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState('loading');

    const run = async () => {
      try {
        let result;
        if (params.model === 'EXCAI/Diffusion-As-Shader') {
          result = await runDiffusionShader(
            {
              model: params.model,
              inputs: {
                video_url: sourceClip,
                style_prompt: params.style_prompt,
                motion_strength: params.motion_strength,
                steps: params.steps,
                seed: params.seed,
              },
            },
            ctrl.signal,
          );
        } else {
          result = await runVideoFrom3D(
            {
              model: params.model,
              inputs: {
                geometry_url: params.geometry_url,
                camera_trajectory: [],
                style_prompt: params.style_prompt,
                fps: params.fps,
                duration_seconds: params.duration_seconds,
              },
            },
            ctrl.signal,
          );
        }
        setProcessedUrl(result.output_url);
        setState('done');
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error('[MEE/HF]', e);
          setState('error');
        }
      }
    };

    run();
    return () => ctrl.abort();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps -- intentionally runs once

  const src = processedUrl ?? sourceClip;

  return (
    <AbsoluteFill>
      <Video src={src} startFrom={startFrom} />
      {state === 'loading' && (
        <AbsoluteFill style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start',
          padding: 16, pointerEvents: 'none',
        }}>
          <span style={{
            background: 'rgba(0,0,0,0.6)', color: '#fff',
            fontSize: 12, padding: '4px 8px', borderRadius: 4,
            fontFamily: 'monospace',
          }}>
            HF inference running…
          </span>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
