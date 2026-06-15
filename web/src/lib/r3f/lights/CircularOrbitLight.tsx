// Point light that orbits around the origin on the XZ plane.
// Ported from r3f-by-example circular-light-path.

import * as React from 'react';
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export interface MEECircularOrbitLightProps {
  color?: string;
  intensity?: number;
  orbitRadius?: number;
  orbitSpeed?: number;    // radians per second
  height?: number;
  castShadow?: boolean;
  shadowMapSize?: number;
  shadowRadius?: number;
}

export function MEECircularOrbitLight({
  color = 'white',
  intensity = 0.5,
  orbitRadius = 10,
  orbitSpeed = 0.5,
  height = 15,
  castShadow = true,
  shadowMapSize = 1024,
  shadowRadius = 3,
}: MEECircularOrbitLightProps) {
  const lightRef = useRef<THREE.PointLight>(null!);

  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    const t = clock.getElapsedTime() * orbitSpeed;
    lightRef.current.position.x = Math.sin(t) * orbitRadius;
    lightRef.current.position.z = Math.cos(t) * orbitRadius;
  });

  return (
    <>
      <ambientLight color="#444444" />
      <pointLight
        ref={lightRef}
        color={color}
        intensity={intensity}
        position={[orbitRadius, height, 0]}
        castShadow={castShadow}
        shadow-mapSize-height={shadowMapSize}
        shadow-mapSize-width={shadowMapSize}
        shadow-radius={shadowRadius}
        shadow-bias={-0.0001}
      />
    </>
  );
}
