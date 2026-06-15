import * as React from 'react';
import { EffectComposer, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

export interface MEEVignetteProps {
  offset?: number;
  darkness?: number;
  eskil?: boolean;
  blendFunction?: BlendFunction;
}

export function MEEVignette({
  offset = 0.5,
  darkness = 0.5,
  eskil = false,
  blendFunction = BlendFunction.NORMAL,
}: MEEVignetteProps) {
  return (
    <EffectComposer>
      <Vignette
        offset={offset}
        darkness={darkness}
        eskil={eskil}
        blendFunction={blendFunction}
      />
    </EffectComposer>
  );
}
