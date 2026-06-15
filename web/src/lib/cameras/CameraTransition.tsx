// ======================================================================
//  MEE — Camera Transition primitive
//
//  Synthesised from r3f-camera-transition Camera.jsx:
//    - Holds refs to both a PerspectiveCamera and an OrthographicCamera.
//    - On mount (or key press) switches the R3F default camera between them.
//    - Exposes an imperative API (switchTo / toggle) via ref.
//
//  The triggerKey prop defaults to null (no keyboard trigger). Pass a
//  key string (e.g. "v") to enable keyboard-driven switching, or call
//  the ref API directly from an animation timeline.
// ======================================================================

import * as React from 'react';
import { useRef, useEffect, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrthographicCamera } from '@react-three/drei';

export interface CameraTransitionController {
  switchTo: (kind: 'perspective' | 'orthographic') => void;
  toggle: () => void;
  current: () => 'perspective' | 'orthographic';
}

export interface CameraTransitionProps {
  initial?: 'perspective' | 'orthographic';
  triggerKey?: string | null;
  perspectiveFov?: number;
  perspectivePosition?: [number, number, number];
  orthographicZoom?: number;
  orthographicPosition?: [number, number, number];
}

export const MEECameraTransition = React.forwardRef<
  CameraTransitionController,
  CameraTransitionProps
>(function MEECameraTransition(
  {
    initial = 'perspective',
    triggerKey = null,
    perspectiveFov = 50,
    perspectivePosition = [0, 2, 10],
    orthographicZoom = 100,
    orthographicPosition = [0, 2, 0],
  },
  ref
) {
  const { get, set, size } = useThree(({ get, set, size }) => ({ get, set, size }));
  const perspRef = useRef<THREE.PerspectiveCamera>(null!);
  const orthoRef = useRef<THREE.OrthographicCamera>(null!);
  const activeRef = useRef<'perspective' | 'orthographic'>(initial);

  const switchTo = React.useCallback(
    (kind: 'perspective' | 'orthographic') => {
      activeRef.current = kind;
      if (kind === 'perspective') {
        set({ camera: perspRef.current });
      } else {
        set({ camera: orthoRef.current });
        orthoRef.current.lookAt(0, 0, 0);
      }
    },
    [set]
  );

  const toggle = React.useCallback(() => {
    switchTo(activeRef.current === 'perspective' ? 'orthographic' : 'perspective');
  }, [switchTo]);

  useImperativeHandle(ref, () => ({
    switchTo,
    toggle,
    current: () => activeRef.current,
  }));

  // Set initial camera on mount
  useEffect(() => {
    switchTo(initial);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Optional keyboard trigger — mirrors the Camera.jsx keyup handler
  useEffect(() => {
    if (!triggerKey) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === triggerKey) toggle();
    };
    window.addEventListener('keyup', handler);
    return () => window.removeEventListener('keyup', handler);
  }, [triggerKey, toggle]);

  const aspect = size.width / size.height;
  const hw = (size.width / 2);
  const hh = (size.height / 2);

  return (
    <>
      <PerspectiveCamera
        ref={perspRef}
        name="mee-perspective"
        fov={perspectiveFov}
        position={perspectivePosition}
      />
      <OrthographicCamera
        ref={orthoRef}
        name="mee-orthographic"
        zoom={orthographicZoom}
        near={-100}
        far={100}
        left={-hw}
        right={hw}
        top={hh}
        bottom={-hh}
        position={orthographicPosition}
      />
    </>
  );
});
