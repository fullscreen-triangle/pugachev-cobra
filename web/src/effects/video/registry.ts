import type { VideoEffect } from './types';
import { VIDEO_BEHAVIORS } from './behaviors';

import { blackAndWhite }     from './chromatic/blackAndWhite';
import { invertColors }      from './chromatic/invertColors';
import { posterize }         from './chromatic/posterize';
import { duotone }             from './chromatic/duotone';
import { silhouetteReplace }   from './chromatic/silhouetteReplace';
import { interstitialDrift }   from './chromatic/interstitialDrift';
import { fabricWeave }       from './material/fabricWeave';
import { paperTexture }      from './material/paperTexture';
import { halftoneScreen }    from './material/halftoneScreen';
import { vhsTape }           from './temporal/vhsTape';
import { filmGrain }         from './degradation/filmGrain';
import { digitalGlitch }     from './degradation/digitalGlitch';
import { scanlines }         from './degradation/scanlines';

export { VIDEO_BEHAVIORS };

export const VIDEO_EFFECT_REGISTRY: Record<string, VideoEffect> = {
  'chromatic.bw':           blackAndWhite,
  'chromatic.invert':       invertColors,
  'chromatic.posterize':    posterize,
  'chromatic.duotone':      duotone,
  'chromatic.silhouette':         silhouetteReplace,
  'chromatic.interstitialDrift':  interstitialDrift,
  'material.fabric':        fabricWeave,
  'material.paper':         paperTexture,
  'material.screen':        halftoneScreen,
  'temporal.vhs':           vhsTape,
  'degradation.grain':      filmGrain,
  'degradation.glitch':     digitalGlitch,
  'degradation.scanlines':  scanlines,
};

export function getVideoEffect(id: string): VideoEffect | undefined {
  return VIDEO_EFFECT_REGISTRY[id];
}

export function getEffectsForBehavior(behavior: string): VideoEffect[] {
  const ids = VIDEO_BEHAVIORS[behavior.toLowerCase()];
  if (!ids) return [];
  return ids.map(id => VIDEO_EFFECT_REGISTRY[id]).filter((e): e is VideoEffect => e !== undefined);
}
