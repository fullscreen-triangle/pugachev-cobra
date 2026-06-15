// Volumetric god-rays via @react-three/postprocessing.

import * as React from 'react';
import { useRef, useState, useEffect } from 'react';
import { Mesh } from 'three';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, GodRays } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';

// -1 is the postprocessing AUTO_SIZE constant (Resizer.AUTO_SIZE is a
// type-only export in this version's d.ts, so we use the literal).
const AUTO_SIZE = -1;

// ---- Animated sun mesh -----------------------------------------------

interface SunMeshProps {
  color?: string;
  radius?: number;
  position?: [number, number, number];
  orbit?: boolean;
  orbitRadius?: number;
  onRef?: (mesh: Mesh) => void;
}

function SunMesh({
  color = '#ffffff',
  radius = 1,
  position = [0, 0, -15],
  orbit = false,
  orbitRadius = 8,
  onRef,
}: SunMeshProps) {
  const meshRef = useRef<Mesh>(null!);

  useEffect(() => {
    if (meshRef.current) onRef?.(meshRef.current);
  }, [onRef]);

  useFrame(({ clock }) => {
    if (!orbit || !meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.position.x = Math.sin(t) * -orbitRadius;
    meshRef.current.position.y = Math.cos(t) * -orbitRadius;
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[radius, 36, 36]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

// ---- Public component ------------------------------------------------

export interface MEEGodRaysProps {
  sunColor?: string;
  sunRadius?: number;
  sunPosition?: [number, number, number];
  orbitSun?: boolean;
  orbitRadius?: number;
  samples?: number;
  density?: number;
  decay?: number;
  weight?: number;
  exposure?: number;
  clampMax?: number;
  blur?: boolean;
  blendFunction?: BlendFunction;
  kernelSize?: KernelSize;
}

export function MEEGodRays({
  sunColor = '#ffffff',
  sunRadius = 1,
  sunPosition = [0, 0, -15],
  orbitSun = true,
  orbitRadius = 8,
  samples = 30,
  density = 0.97,
  decay = 0.96,
  weight = 0.6,
  exposure = 0.4,
  clampMax = 1,
  blur = true,
  blendFunction = BlendFunction.SCREEN,
  kernelSize = KernelSize.SMALL,
}: MEEGodRaysProps) {
  const [sun, setSun] = useState<Mesh | null>(null);

  return (
    <>
      <SunMesh
        color={sunColor}
        radius={sunRadius}
        position={sunPosition}
        orbit={orbitSun}
        orbitRadius={orbitRadius}
        onRef={setSun}
      />
      {sun && (
        <EffectComposer multisampling={0}>
          <GodRays
            sun={sun}
            blendFunction={blendFunction}
            samples={samples}
            density={density}
            decay={decay}
            weight={weight}
            exposure={exposure}
            clampMax={clampMax}
            width={AUTO_SIZE}
            height={AUTO_SIZE}
            kernelSize={kernelSize}
            blur={blur}
          />
        </EffectComposer>
      )}
    </>
  );
}
