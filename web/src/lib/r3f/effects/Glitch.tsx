import * as React from 'react';
import { EffectComposer, Glitch } from '@react-three/postprocessing';
import { GlitchMode } from 'postprocessing';
import { Vector2 } from 'three';

export interface MEEGlitchProps {
  delay?: [number, number];    // min/max seconds between glitches
  duration?: [number, number]; // min/max seconds each glitch lasts
  strength?: [number, number]; // min/max displacement strength
  mode?: GlitchMode;
  active?: boolean;
  ratio?: number;              // probability of a "strong" glitch column
}

export function MEEGlitch({
  delay = [0.5, 1.5],
  duration = [0.6, 1.0],
  strength = [0.1, 0.2],
  mode = GlitchMode.SPORADIC,
  active = true,
  ratio = 0.1,
}: MEEGlitchProps) {
  return (
    <EffectComposer>
      <Glitch
        delay={new Vector2(...delay)}
        duration={new Vector2(...duration)}
        strength={new Vector2(...strength)}
        mode={mode}
        active={active}
        ratio={ratio}
      />
    </EffectComposer>
  );
}
