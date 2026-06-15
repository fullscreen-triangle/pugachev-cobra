// Triangular lens pixelation — ported from the r3f-by-example source.
// Uses a custom postprocessing Effect subclass with the exact GLSL from
// triLensEffect.js, adapted for the @react-three/postprocessing v6 API.

import * as React from 'react';
import { forwardRef, useMemo } from 'react';
import { Uniform, Vector2 } from 'three';
import { Effect } from 'postprocessing';
import { EffectComposer } from '@react-three/postprocessing';

// ---- GLSL (verbatim from source, wrapped for postprocessing v6) ------

const FRAG = /* glsl */ `
  uniform bool active;
  uniform float fragments;

  float rand(vec2 uv) {
    return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec2 uv2tri(vec2 uv) {
    float sx  = uv.x - uv.y / 2.0;
    float sxf = fract(sx);
    float offs = step(fract(1.0 - uv.y), sxf);
    return vec2(floor(sx) * 2.0 + sxf + offs, uv.y);
  }

  float tri(vec2 uv) {
    float sp = 0.3 * rand(floor(uv2tri(uv)));
    return max(0.0, sin(sp));
  }

  void mainUv(inout vec2 uv) {
    float t1 = 1.5;
    float c1 = tri(uv * (1.0 + fragments * fract(t1)) + floor(t1));
    uv.x += c1 * 0.1;
  }
`;

class TriangularLensEffect extends Effect {
  constructor(fragments = 153) {
    super('TriangularLensEffect', FRAG, {
      uniforms: new Map<string, Uniform<unknown>>([
        ['active',    new Uniform(fragments > 0)],
        ['fragments', new Uniform(fragments)],
      ]),
    });
  }

  setFragments(n: number) {
    const u = this.uniforms;
    u.get('active')!.value    = n > 0;
    u.get('fragments')!.value = Math.floor(n);
  }
}

// ---- React wrapper ---------------------------------------------------

const TriangularLensImpl = forwardRef<TriangularLensEffect, { fragments?: number }>(
  ({ fragments = 153 }, ref) => {
    const effect = useMemo(() => new TriangularLensEffect(fragments), [fragments]);
    return <primitive ref={ref} object={effect} dispose={null} />;
  }
);

export interface MEETriangularPixelationProps {
  fragments?: number;
}

export function MEETriangularPixelation({ fragments = 153 }: MEETriangularPixelationProps) {
  return (
    <EffectComposer>
      <TriangularLensImpl fragments={fragments} />
    </EffectComposer>
  );
}
