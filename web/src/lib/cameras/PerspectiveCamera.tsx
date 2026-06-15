// ======================================================================
//  MEE — Perspective Camera primitive
//
//  Sources synthesised from:
//    - react-three-fiber-journey cameras.tsx (mouse-tracking orbit)
//    - drei PerspectiveCamera.tsx (makeDefault + FBO children)
//    - three-js-fundamentals PerspectiveCamera.tsx (fov/near/far params)
//
//  Usage in a MEE R3F scene:
//    <MEEPerspectiveCamera fov={50} position={[0, 2, 10]} trackMouse />
//
//  The component:
//    1. Creates a drei PerspectiveCamera and registers it as default.
//    2. Optionally tracks the mouse: the camera orbits in a sphere of
//       `trackRadius` around the origin, following cursor position. This
//       implements the cameras.tsx mouse-tracking variant exactly.
//    3. Exposes a ref via forwardRef so callers can read camera state.
// ======================================================================

import * as React from 'react';
import { useRef, useEffect, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera as DreiPerspectiveCamera } from '@react-three/drei';

export interface PerspectiveCameraProps {
  fov?: number;
  near?: number;
  far?: number;
  position?: [number, number, number];
  makeDefault?: boolean;
  // When true, the camera orbits around origin following the mouse cursor.
  trackMouse?: boolean;
  trackRadius?: number;
}

export const MEEPerspectiveCamera = React.forwardRef<
  THREE.PerspectiveCamera,
  PerspectiveCameraProps
>(function MEEPerspectiveCamera(
  {
    fov = 50,
    near = 0.1,
    far = 1000,
    position = [0, 0, 5],
    makeDefault = true,
    trackMouse = false,
    trackRadius = 5,
  },
  ref
) {
  const innerRef = useRef<THREE.PerspectiveCamera>(null!);
  const mouse = useRef({ x: 0, y: 0 });

  // Mouse tracking — mirrors the cameras.tsx pattern exactly:
  //   camera.position.x = Math.sin(x * PI * 2) * radius
  //   camera.position.z = Math.cos(x * PI * 2) * radius
  //   camera.position.y = y * 5
  // where x,y are normalised [-0.5, 0.5] cursor offsets.
  useEffect(() => {
    if (!trackMouse) return;
    const handler = (e: MouseEvent) => {
      mouse.current.x = e.clientX / window.innerWidth - 0.5;
      mouse.current.y = -(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [trackMouse]);

  useFrame(() => {
    if (!trackMouse || !innerRef.current) return;
    const { x, y } = mouse.current;
    innerRef.current.position.x = Math.sin(x * Math.PI * 2) * trackRadius;
    innerRef.current.position.z = Math.cos(x * Math.PI * 2) * trackRadius;
    innerRef.current.position.y = y * trackRadius;
    innerRef.current.lookAt(0, 0, 0);
  });

  return (
    <DreiPerspectiveCamera
      ref={(cam) => {
        // Merge external ref
        (innerRef as React.MutableRefObject<THREE.PerspectiveCamera>).current = cam!;
        if (typeof ref === 'function') ref(cam);
        else if (ref) ref.current = cam;
      }}
      fov={fov}
      near={near}
      far={far}
      position={position}
      makeDefault={makeDefault}
    />
  );
});
