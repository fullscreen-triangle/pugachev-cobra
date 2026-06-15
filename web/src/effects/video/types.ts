export type VideoEffectNamespace = 'chromatic' | 'temporal' | 'material' | 'degradation';

export type EffectParameterType = 'float' | 'int' | 'bool' | 'color' | 'enum' | 'flags';

export interface EffectParameter {
  name: string;
  type: EffectParameterType;
  default: unknown;
  range?: [number, number];
  values?: string[];
}

export interface VideoEffect {
  id: string;
  namespace: VideoEffectNamespace;
  name: string;
  description: string;
  power: number;
  supports: string[];
  parameters: EffectParameter[];
  shader?: string;
  transform: (frame: ImageData, params?: Record<string, unknown>) => ImageData;
}
