// ======================================================================
//  MEE — Cube Camera primitive
//
//  Direct port of drei-hezvo CubeCamera.tsx.
//  Renders the scene from 6 faces of a cube to an FBO and exposes the
//  resulting environment texture to children via a render prop.
//
//  Usage:
//    <MEECubeCamera resolution={512} near={0.1} far={100}>
//      {(envTex) => (
//        <mesh>
//          <sphereGeometry />
//          <meshStandardMaterial envMap={envTex} />
//        </mesh>
//      )}
//    </MEECubeCamera>
//
//  The children function receives the CubeRenderTarget texture so
//  materials can use it as an environment map. The group containing
//  the children is hidden while the cube camera renders to avoid
//  self-reflection artefacts.
// ======================================================================

import * as React from 'react';
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

export interface CubeCameraProps {
  resolution?: number;
  near?: number;
  far?: number;
  frames?: number;
  children: (envTex: THREE.Texture) => React.ReactNode;
}

export function MEECubeCamera({
  resolution = 256,
  near = 0.1,
  far = 1000,
  frames = Infinity,
  children,
}: CubeCameraProps) {
  const { gl, scene } = useThree();

  const groupRef = useRef<THREE.Group>(null!);

  // Build the cube render target and camera once
  const [cubeCamera, renderTarget] = React.useMemo(() => {
    const rt = new THREE.WebGLCubeRenderTarget(resolution, {
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    const cam = new THREE.CubeCamera(near, far, rt);
    return [cam, rt];
  }, [resolution, near, far]);

  let count = 0;
  useFrame(() => {
    if (!groupRef.current) return;
    if (frames !== Infinity && count >= frames) return;
    groupRef.current.visible = false;
    cubeCamera.update(gl, scene);
    groupRef.current.visible = true;
    count++;
  });

  return (
    <group>
      <primitive object={cubeCamera} />
      <group ref={groupRef}>{children(renderTarget.texture)}</group>
    </group>
  );
}
