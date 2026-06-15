// ======================================================================
//  MEE — Camera Shake primitive
//
//  Direct port of drei-hezvo CameraShake.tsx with:
//    - Simplex-noise yaw/pitch/roll on every frame
//    - Optional intensity decay (exponential)
//    - Ref-based imperative API: getIntensity / setIntensity
//    - Listens to OrbitControls "change" event to track base rotation
//      so shake composites onto existing orbital position correctly.
//
//  The drei SimplexNoise import is replaced with the three-stdlib
//  version (same class, explicit import path for Next.js compatibility).
// ======================================================================

import * as React from 'react';
import { useRef, useState, useEffect, useImperativeHandle } from 'react';
import { Euler } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { SimplexNoise } from 'three-stdlib';

export interface ShakeController {
  getIntensity: () => number;
  setIntensity: (val: number) => void;
}

export interface CameraShakeProps {
  intensity?: number;
  decay?: boolean;
  decayRate?: number;
  maxYaw?: number;
  maxPitch?: number;
  maxRoll?: number;
  yawFrequency?: number;
  pitchFrequency?: number;
  rollFrequency?: number;
}

type ControlsProto = {
  update(): void;
  target: { x: number; y: number; z: number };
  addEventListener: (event: string, callback: (event: unknown) => void) => void;
  removeEventListener: (event: string, callback: (event: unknown) => void) => void;
};

export const MEECameraShake = React.forwardRef<ShakeController, CameraShakeProps>(
  function MEECameraShake(
    {
      intensity = 0.5,
      decay = false,
      decayRate = 0.65,
      maxYaw = 0.05,
      maxPitch = 0.05,
      maxRoll = 0.05,
      yawFrequency = 0.8,
      pitchFrequency = 0.8,
      rollFrequency = 0.8,
    },
    ref
  ) {
    const camera = useThree((s) => s.camera);
    const defaultControls = useThree((s) => s.controls) as unknown as ControlsProto;
    const intensityRef = useRef<number>(intensity);
    const initialRotation = useRef<Euler>(camera.rotation.clone());

    // Three independent simplex noise instances — one per axis
    const [yawNoise]   = useState(() => new SimplexNoise());
    const [pitchNoise] = useState(() => new SimplexNoise());
    const [rollNoise]  = useState(() => new SimplexNoise());

    const constrainIntensity = () => {
      if (intensityRef.current < 0) intensityRef.current = 0;
      if (intensityRef.current > 1) intensityRef.current = 1;
    };

    useImperativeHandle(ref, () => ({
      getIntensity: () => intensityRef.current,
      setIntensity: (val: number) => {
        intensityRef.current = val;
        constrainIntensity();
      },
    }));

    // Track orbital controls changes so shake composites onto them
    useEffect(() => {
      if (!defaultControls) return;
      const callback = () => {
        initialRotation.current = camera.rotation.clone();
      };
      defaultControls.addEventListener('change', callback);
      callback();
      return () => defaultControls.removeEventListener('change', callback);
    }, [camera, defaultControls]);

    useFrame((state, delta) => {
      const shake = Math.pow(intensityRef.current, 2);
      const t = state.clock.elapsedTime;
      const yaw   = maxYaw   * shake * yawNoise.noise(t * yawFrequency, 1);
      const pitch = maxPitch * shake * pitchNoise.noise(t * pitchFrequency, 1);
      const roll  = maxRoll  * shake * rollNoise.noise(t * rollFrequency, 1);

      camera.rotation.set(
        initialRotation.current.x + pitch,
        initialRotation.current.y + yaw,
        initialRotation.current.z + roll
      );

      if (decay && intensityRef.current > 0) {
        intensityRef.current -= decayRate * delta;
        constrainIntensity();
      }
    });

    return null;
  }
);
