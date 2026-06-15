import React, { useEffect, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import type { VideoEffect } from '../types';

interface EffectEntry {
  effect: VideoEffect;
  params?: Record<string, unknown>;
}

interface VideoEffectStackProps {
  effects: EffectEntry[];
  videoRef: React.RefObject<HTMLVideoElement>;
  width: number;
  height: number;
}

export const VideoEffectStack: React.FC<VideoEffectStackProps> = ({
  effects,
  videoRef,
  width,
  height,
}) => {
  const frame     = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const offscreen = document.createElement('canvas');
    offscreen.width  = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    offCtx.drawImage(video, 0, 0, width, height);
    let imageData = offCtx.getImageData(0, 0, width, height);

    for (const { effect, params } of effects) {
      imageData = effect.transform(imageData, params);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(imageData, 0, 0);
  }, [frame, effects, videoRef, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    />
  );
};
