import * as React from 'react';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { BlurPass, KernelSize } from 'postprocessing';

export interface MEEBloomProps {
  intensity?: number;
  luminanceThreshold?: number;
  luminanceSmoothing?: number;
  kernelSize?: KernelSize;
  // When true, uses an emissive-texture-based approach (unreal bloom)
  // rather than the luminance-threshold approach.
  mipmapBlur?: boolean;
}

export function MEEBloom({
  intensity = 1.5,
  luminanceThreshold = 0.1,
  luminanceSmoothing = 0.5,
  kernelSize = KernelSize.LARGE,
  mipmapBlur = true,
}: MEEBloomProps) {
  return (
    <EffectComposer>
      <Bloom
        intensity={intensity}
        luminanceThreshold={luminanceThreshold}
        luminanceSmoothing={luminanceSmoothing}
        kernelSize={kernelSize}
        mipmapBlur={mipmapBlur}
      />
    </EffectComposer>
  );
}
