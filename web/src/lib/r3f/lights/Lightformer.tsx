// Lightformer — emissive mesh that acts as a shaped area light.
// Ported from drei Lightformer.tsx. Supported forms: circle, ring, rect.
// Typically used inside an <Environment> or as a standalone emissive panel.

import * as React from 'react';
import { useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';

export type LightformerForm = 'circle' | 'ring' | 'rect';

export interface MEELightformerProps {
  form?: LightformerForm;
  color?: string;
  intensity?: number;
  scale?: number | [number, number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];
  target?: [number, number, number];
  toneMapped?: boolean;
  map?: THREE.Texture;
}

export const MEELightformer = React.forwardRef<THREE.Mesh, MEELightformerProps>(
  function MEELightformer(
    {
      form = 'rect',
      color = 'white',
      intensity = 1,
      scale = 1,
      position,
      rotation,
      target,
      toneMapped = false,
      map,
    },
    ref
  ) {
    const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null!);

    // Multiply emissive by intensity the same way drei does
    useLayoutEffect(() => {
      if (!meshRef.current) return;
      (meshRef.current.material as THREE.MeshBasicMaterial).color.set(color).multiplyScalar(intensity);
    }, [color, intensity]);

    useLayoutEffect(() => {
      if (target && meshRef.current) {
        meshRef.current.lookAt(new THREE.Vector3(...target));
      }
    }, [target]);

    const normalizedScale: [number, number, number] =
      typeof scale === 'number'
        ? [scale, scale, scale]
        : (scale as number[]).length === 2
          ? [(scale as number[])[0], (scale as number[])[1], 1]
          : scale as [number, number, number];

    return (
      <mesh
        ref={(node) => {
          (meshRef as React.MutableRefObject<THREE.Mesh>).current = node!;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        scale={normalizedScale}
        position={position}
        rotation={rotation}
      >
        {form === 'circle' && <ringGeometry args={[0, 1, 64]} />}
        {form === 'ring'   && <ringGeometry args={[0.5, 1, 64]} />}
        {form === 'rect'   && <planeGeometry />}
        <meshBasicMaterial toneMapped={toneMapped} map={map} side={THREE.DoubleSide} />
      </mesh>
    );
  }
);
