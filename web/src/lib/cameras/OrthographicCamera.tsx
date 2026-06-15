// ======================================================================
//  MEE — Orthographic Camera primitive
//
//  Sources synthesised from:
//    - three-js-fundamentals OrthographicCamera.tsx (zoom/near/far params)
//    - r3f-by-example orthographic-camera index.js (frustum bounds)
//    - r3f-camera-transition Camera.jsx (name + dynamic switching)
//
//  Frustum bounds default to viewport-derived values if not supplied:
//    left  = -zoom * aspect
//    right =  zoom * aspect
//    top   =  zoom
//    bottom = -zoom
//  This matches the "auto-fit the viewport" convention from the
//  orthographic-camera example. Explicit bounds override this.
// ======================================================================

import * as React from 'react';
import { useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { OrthographicCamera as DreiOrthographicCamera } from '@react-three/drei';

export interface OrthographicCameraProps {
  zoom?: number;
  near?: number;
  far?: number;
  position?: [number, number, number];
  makeDefault?: boolean;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  name?: string;
}

export const MEEOrthographicCamera = React.forwardRef<
  THREE.OrthographicCamera,
  OrthographicCameraProps
>(function MEEOrthographicCamera(
  {
    zoom = 50,
    near = 0.1,
    far = 1000,
    position = [0, 0, 10],
    makeDefault = true,
    left,
    right,
    top,
    bottom,
    name = 'mee-ortho',
  },
  ref
) {
  const { size } = useThree();
  const aspect = size.width / size.height;

  // Derive frustum from zoom if explicit bounds not given
  const l = left   ?? -zoom * aspect;
  const r = right  ??  zoom * aspect;
  const t = top    ??  zoom;
  const b = bottom ?? -zoom;

  return (
    <DreiOrthographicCamera
      ref={ref}
      name={name}
      makeDefault={makeDefault}
      left={l}
      right={r}
      top={t}
      bottom={b}
      near={near}
      far={far}
      zoom={zoom}
      position={position}
    />
  );
});
