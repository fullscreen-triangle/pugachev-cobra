export const VIDEO_BEHAVIORS: Record<string, string[]> = {
  'old photograph':  ['chromatic.bw', 'material.paper', 'degradation.grain'],
  'newspaper print': ['chromatic.bw', 'material.screen', 'material.paper'],
  'vhs recording':   ['temporal.vhs', 'degradation.scanlines', 'degradation.grain'],
  'glitch art':      ['degradation.glitch', 'chromatic.invert', 'chromatic.posterize'],
  'fabric screen':   ['material.fabric', 'material.screen'],
  'film noir':       ['chromatic.bw', 'chromatic.duotone', 'degradation.grain'],
  'crt monitor':     ['degradation.scanlines', 'chromatic.posterize'],
  'negative film':   ['chromatic.invert', 'degradation.grain'],
  'silk screen':     ['chromatic.posterize', 'material.screen', 'material.fabric'],
};
