// Volumetric spot light — ported from drei SpotLight.tsx.
// Uses a cone mesh with a custom ShaderMaterial to fake volumetric
// light scattering. Optionally accepts a depthBuffer for soft edges.
//
// Stripped to the essentials: no SpotlightShadow child, no SpotLightMaterial
// dependency (that requires drei internals). Instead we inline a simplified
// volumetric cone shader.

import * as React from 'react';
import { useRef, useMemo } from 'react';
import {
  Mesh, CylinderGeometry, Matrix4, Vector3, ShaderMaterial,
  DoubleSide, Color, AdditiveBlending,
} from 'three';
import { useFrame } from '@react-three/fiber';

// ---- Volumetric cone shader ------------------------------------------
const VERT = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vConeDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vConeDir  = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3  lightColor;
  uniform float attenuation;
  uniform float anglePower;
  uniform float opacity;
  uniform vec3  spotPosition;
  varying vec3  vWorldPos;
  varying vec3  vConeDir;

  void main() {
    float d      = length(vWorldPos - spotPosition);
    float atten  = 1.0 / (1.0 + attenuation * d * d);
    float angle  = pow(max(dot(normalize(vConeDir), vec3(0.0, 0.0, -1.0)), 0.0), anglePower);
    gl_FragColor = vec4(lightColor * angle * atten, atten * angle * opacity);
  }
`;

// ---- Volumetric cone mesh --------------------------------------------

interface ConeMeshProps {
  distance: number;
  angle: number;
  radiusTop: number;
  radiusBottom: number;
  color: string;
  attenuation: number;
  anglePower: number;
  opacity: number;
}

function ConeMesh({
  distance, angle, radiusTop, radiusBottom,
  color, attenuation, anglePower, opacity,
}: ConeMeshProps) {
  const meshRef = useRef<Mesh>(null!);
  const posVec  = useRef(new Vector3());

  const geom = useMemo(() => {
    const g = new CylinderGeometry(radiusTop, radiusBottom, distance, 64, 32, true);
    g.applyMatrix4(new Matrix4().makeTranslation(0, -distance / 2, 0));
    g.applyMatrix4(new Matrix4().makeRotationX(-Math.PI / 2));
    return g;
  }, [distance, radiusTop, radiusBottom]);

  const mat = useMemo(() => new ShaderMaterial({
    uniforms: {
      lightColor:   { value: new Color(color) },
      attenuation:  { value: attenuation },
      anglePower:   { value: anglePower },
      opacity:      { value: opacity },
      spotPosition: { value: new Vector3() },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  }), [color, attenuation, anglePower, opacity]);

  useFrame(() => {
    if (!meshRef.current) return;
    mat.uniforms.spotPosition.value.copy(meshRef.current.getWorldPosition(posVec.current));
    meshRef.current.lookAt((meshRef.current.parent as any)?.target?.getWorldPosition(posVec.current) ?? new Vector3());
  });

  return <mesh ref={meshRef} geometry={geom} material={mat} raycast={() => null} />;
}

// ---- Public component ------------------------------------------------

export interface MEEVolumetricSpotLightProps {
  position?: [number, number, number];
  target?: [number, number, number];
  color?: string;
  intensity?: number;
  distance?: number;
  angle?: number;
  penumbra?: number;
  attenuation?: number;
  anglePower?: number;
  opacity?: number;
  radiusTop?: number;
  radiusBottom?: number;
  castShadow?: boolean;
  volumetric?: boolean;
}

export function MEEVolumetricSpotLight({
  position = [0, 5, 0],
  target = [0, 0, 0],
  color = 'white',
  intensity = 1,
  distance = 5,
  angle = 0.15,
  penumbra = 0.1,
  attenuation = 5,
  anglePower = 5,
  opacity = 1,
  radiusTop = 0.1,
  radiusBottom,
  castShadow = true,
  volumetric = true,
}: MEEVolumetricSpotLightProps) {
  const spotRef = useRef<THREE.SpotLight>(null!);
  const targetRef = useRef<THREE.Object3D>(null!);

  const rb = radiusBottom ?? angle * 7;

  return (
    <group>
      <object3D ref={targetRef} position={target} />
      <spotLight
        ref={spotRef}
        position={position}
        color={color}
        intensity={intensity}
        distance={distance}
        angle={angle}
        penumbra={penumbra}
        castShadow={castShadow}
        target={targetRef.current}
      >
        {volumetric && (
          <ConeMesh
            distance={distance}
            angle={angle}
            radiusTop={radiusTop}
            radiusBottom={rb}
            color={color}
            attenuation={attenuation}
            anglePower={anglePower}
            opacity={opacity}
          />
        )}
      </spotLight>
    </group>
  );
}

// Need THREE namespace for spotLight ref type
import * as THREE from 'three';
