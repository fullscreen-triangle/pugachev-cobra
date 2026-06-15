export type { VideoEffect, VideoEffectNamespace, EffectParameter, EffectParameterType } from './types';
export { VIDEO_EFFECT_REGISTRY, getVideoEffect, getEffectsForBehavior } from './registry';
export { VIDEO_BEHAVIORS } from './behaviors';
export { VideoEffectLayer } from './remotion/VideoEffectLayer';
export { VideoEffectStack } from './remotion/VideoEffectStack';

import { PRIMITIVES, BEHAVIOURS } from '../../lib/mee/registry';
import type { PrimitiveSpec, BehaviourSpec } from '../../lib/mee/registry';
import type { Namespace } from '../../lib/mee/types';
import type { VideoEffectNamespace } from './types';
import { VIDEO_EFFECT_REGISTRY } from './registry';
import { VIDEO_BEHAVIORS } from './behaviors';

const NS_MAP: Record<VideoEffectNamespace, Namespace> = {
  chromatic:   'photometric',
  temporal:    'temporal',
  material:    'spatial',
  degradation: 'temporal',
};

const VIDEO_PRIMITIVES: Record<string, PrimitiveSpec> = {};

for (const [id, effect] of Object.entries(VIDEO_EFFECT_REGISTRY)) {
  const primitiveKey = id.replace('.', '_');
  VIDEO_PRIMITIVES[primitiveKey] = {
    name:         primitiveKey,
    namespace:    NS_MAP[effect.namespace],
    power:        effect.power,
    remotionHint: `video:${effect.id}`,
    defaultParams: {},
    supports:     effect.supports.map(s => s.replace('.', '_')),
  };
}

Object.assign(PRIMITIVES, VIDEO_PRIMITIVES);

for (const [label, ids] of Object.entries(VIDEO_BEHAVIORS)) {
  const behaviorPrimitives: PrimitiveSpec[] = ids
    .map(id => VIDEO_PRIMITIVES[id.replace('.', '_')])
    .filter((p): p is PrimitiveSpec => p !== undefined);

  if (behaviorPrimitives.length === 0) continue;

  const spec: BehaviourSpec = {
    label:       label.replace(/\b\w/g, c => c.toUpperCase()),
    description: `Video effect preset: ${label}.`,
    primitives:  behaviorPrimitives,
  };

  BEHAVIOURS[label] = spec;
}
