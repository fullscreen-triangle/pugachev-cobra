// Classic three-point lighting rig (key, fill, rim/back).
// Ported from r3f-by-example three-point-lighting.

import * as React from 'react';

export interface MEEThreePointLightingProps {
  keyIntensity?: number;
  fillIntensity?: number;
  rimIntensity?: number;
  keyPosition?: [number, number, number];
  fillPosition?: [number, number, number];
  rimPosition?: [number, number, number];
  shadowMapSize?: number;
  castShadow?: boolean;
}

export function MEEThreePointLighting({
  keyIntensity = 0.7,
  fillIntensity = 0.1,
  rimIntensity = 0.1,
  keyPosition = [0, 15, 15],
  fillPosition = [15, 25, 5],
  rimPosition = [15, 15, 15],
  shadowMapSize = 1024,
  castShadow = true,
}: MEEThreePointLightingProps) {
  const shadowProps = castShadow
    ? {
        castShadow: true,
        'shadow-mapSize-height': shadowMapSize,
        'shadow-mapSize-width': shadowMapSize,
        'shadow-radius': 10,
        'shadow-bias': -0.0001,
      }
    : {};

  return (
    <>
      {/* Key light — primary, highest intensity, crisper shadows */}
      <pointLight
        position={keyPosition}
        intensity={keyIntensity}
        {...shadowProps}
        shadow-mapSize-height={shadowMapSize * 2}
        shadow-mapSize-width={shadowMapSize * 2}
        shadow-radius={20}
      />
      {/* Fill light — softens key-side shadows */}
      <pointLight
        position={fillPosition}
        intensity={fillIntensity}
        {...shadowProps}
      />
      {/* Rim/back light — separates subject from background */}
      <pointLight
        position={rimPosition}
        intensity={rimIntensity}
        {...shadowProps}
      />
    </>
  );
}
