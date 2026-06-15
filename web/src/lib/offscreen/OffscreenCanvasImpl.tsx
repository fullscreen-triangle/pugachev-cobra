// MEE — OffscreenCanvas implementation (client-only, no SSR).
// Split from OffscreenCanvas.tsx so Next.js dynamic() can exclude it from SSR.

import React, { lazy, useRef } from 'react';
import { Canvas } from '@react-three/offscreen';
import type { CanvasProps } from '@react-three/fiber';

// Fallback scene rendered on the main thread when OffscreenCanvas is not supported.
// Lazily loaded so it doesn't enter the SSR bundle.
const FallbackScene = lazy(() => import('./FallbackScene'));

interface OffscreenCanvasImplProps {
  canvasProps: Omit<CanvasProps, 'children'>;
  workerUrl?: string;
  children?: React.ReactNode;
}

export default function OffscreenCanvasImpl({
  canvasProps,
  workerUrl,
  children,
}: OffscreenCanvasImplProps) {
  const workerRef = useRef<Worker | null>(null);

  if (!workerRef.current) {
    // Use a custom worker URL if provided, otherwise use the default MEE worker.
    const url = workerUrl
      ? new URL(workerUrl, import.meta.url)
      : new URL('./worker.tsx', import.meta.url);
    workerRef.current = new Worker(url, { type: 'module' });
  }

  return (
    <Canvas
      {...canvasProps}
      worker={workerRef.current}
      fallback={children ?? <FallbackScene />}
    />
  );
}
