'use client';

// MEE — OffscreenCanvas wrapper for React Three Fiber.
//
// Renders the R3F scene on a dedicated Web Worker thread via OffscreenCanvas,
// keeping the main thread free of WebGL work. Falls back transparently to a
// regular in-thread Canvas on browsers that don't support OffscreenCanvas
// (Safari < 16.4, some mobile browsers).
//
// Usage:
//   import { MEEOffscreenCanvas } from '@/lib/offscreen/OffscreenCanvas';
//
//   <MEEOffscreenCanvas camera={{ position: [0, 0, 10], fov: 25 }} fallback={<Scene />}>
//     <Scene />   ← rendered in worker; fallback rendered on main thread if unsupported
//   </MEEOffscreenCanvas>
//
// The `children` prop is passed as the fallback. The worker always renders its
// own fixed scene (worker.tsx). To pass a dynamic scene to the worker, use
// the companion SceneWorker pattern (create a per-scene worker.tsx).

import React, { lazy, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { CanvasProps } from '@react-three/fiber';

// `@react-three/offscreen` Canvas is a drop-in for `@react-three/fiber` Canvas.
// It accepts the same props plus `worker` (the Worker instance) and `fallback`
// (rendered when OffscreenCanvas is unsupported).
const OffscreenCanvasImpl = dynamic(
  () => import('./OffscreenCanvasImpl'),
  { ssr: false }
);

export interface MEEOffscreenCanvasProps extends Omit<CanvasProps, 'children'> {
  children?: React.ReactNode;
  workerUrl?: string;
}

export function MEEOffscreenCanvas({
  children,
  workerUrl,
  ...canvasProps
}: MEEOffscreenCanvasProps) {
  return (
    <OffscreenCanvasImpl canvasProps={canvasProps} workerUrl={workerUrl}>
      {children}
    </OffscreenCanvasImpl>
  );
}
