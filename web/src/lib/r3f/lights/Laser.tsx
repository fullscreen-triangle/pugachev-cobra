// Laser / ring-of-spheres sun with GodRays.
// Ported from r3f-by-example postprocessing-laser-2.
// Uses a Group of sphere meshes instead of a merged geometry so we
// avoid the three/examples/jsm utils import (no d.ts in this three version).

import * as React from 'react';
import { useState, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, GodRays } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';

// -1 is the postprocessing AUTO_SIZE constant.
const AUTO_SIZE = -1;

// ---- helpers ---------------------------------------------------------

function ringPositions(count: number, radius: number): [number, number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const angle = ((Math.PI * 2) / count) * i;
    return [Math.sin(angle) * radius, Math.cos(angle) * radius, 0];
  });
}

// ---- internal sub-component ------------------------------------------

interface LaserGroupProps {
  position?: [number, number, number];
  color?: string;
  satelliteCount?: number;
  orbitRadius?: number;
  spinSpeed?: number;
  onRef: (mesh: THREE.Mesh) => void;
}

function LaserGroup({
  position = [0, 0, -15],
  color = '#00ffff',
  satelliteCount = 20,
  orbitRadius = 10,
  spinSpeed = 0.01,
  onRef,
}: LaserGroupProps) {
  const groupRef = useRef<THREE.Group>(null!);
  // The "sun" that GodRays tracks is the centre sphere.
  const centreRef = useRef<THREE.Mesh>(null!);

  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color }), [color]);
  const sphereGeom = useMemo(() => new THREE.SphereGeometry(1, 4, 4), []);
  const positions = useMemo(() => ringPositions(satelliteCount, orbitRadius), [satelliteCount, orbitRadius]);

  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.z -= spinSpeed;
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Centre sphere — this mesh is passed to GodRays as the "sun" */}
      <mesh
        ref={(node) => {
          (centreRef as React.MutableRefObject<THREE.Mesh>).current = node!;
          if (node) onRef(node);
        }}
        geometry={sphereGeom}
        material={mat}
      />
      {positions.map((pos, i) => (
        <mesh key={i} position={pos} geometry={sphereGeom} material={mat} />
      ))}
    </group>
  );
}

// ---- public component ------------------------------------------------

export interface MEELaserProps {
  sunPosition?: [number, number, number];
  sunColor?: string;
  satelliteCount?: number;
  orbitRadius?: number;
  spinSpeed?: number;
  // GodRays params
  samples?: number;
  density?: number;
  decay?: number;
  weight?: number;
  exposure?: number;
  clampMax?: number;
  kernelSize?: KernelSize;
  blur?: boolean;
}

export function MEELaser({
  sunPosition = [0, 0, -15],
  sunColor = '#00ffff',
  satelliteCount = 20,
  orbitRadius = 10,
  spinSpeed = 0.01,
  samples = 50,
  density = 0.97,
  decay = 0.97,
  weight = 0.5,
  exposure = 0.75,
  clampMax = 1,
  kernelSize = KernelSize.SMALL,
  blur = true,
}: MEELaserProps) {
  const [sun, setSun] = useState<THREE.Mesh | null>(null);

  return (
    <>
      <LaserGroup
        position={sunPosition}
        color={sunColor}
        satelliteCount={satelliteCount}
        orbitRadius={orbitRadius}
        spinSpeed={spinSpeed}
        onRef={setSun}
      />
      {sun && (
        <EffectComposer multisampling={0}>
          <GodRays
            sun={sun}
            blendFunction={BlendFunction.ADD}
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
