import type { ObjectInstance } from '../types';

export interface EffectParameter {
  name: string;
  type: 'color' | 'float' | 'enum' | 'bool';
  default: unknown;
  range?: [number, number];
  values?: string[];
}

export interface ObjectEffect {
  id: string;
  namespace: 'object';
  name: string;
  description: string;
  power: number;
  supports: string[];
  parameters: EffectParameter[];
  apply: (frame: ImageData, instance: ObjectInstance, params: Record<string, unknown>) => ImageData;
}

export const OBJECT_EFFECTS: Record<string, ObjectEffect> = {
  silhouette: {
    id: 'silhouette',
    namespace: 'object',
    name: 'Silhouette',
    description: 'Fills the bounding box region with a solid color.',
    power: 0.80,
    supports: ['isolate', 'draw_skeleton'],
    parameters: [
      { name: 'color', type: 'color', default: '#000000' },
      { name: 'feather', type: 'float', default: 2, range: [0, 20] },
    ],
    apply: (frame, instance, params) => {
      // Fills bbox pixels with the color param; real pixel-level mask handled by overlay component
      const color = (params['color'] as string | undefined) ?? '#000000';
      const out = new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height);
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const x0 = Math.floor(instance.bbox.x * frame.width);
      const y0 = Math.floor(instance.bbox.y * frame.height);
      const x1 = Math.floor((instance.bbox.x + instance.bbox.width) * frame.width);
      const y1 = Math.floor((instance.bbox.y + instance.bbox.height) * frame.height);
      for (let row = y0; row < y1; row++) {
        for (let col = x0; col < x1; col++) {
          const i = (row * frame.width + col) * 4;
          out.data[i] = r;
          out.data[i + 1] = g;
          out.data[i + 2] = b;
          out.data[i + 3] = 255;
        }
      }
      return out;
    },
  },

  draw_skeleton: {
    id: 'draw_skeleton',
    namespace: 'object',
    name: 'Draw Skeleton',
    description: 'Renders joint connections as a neon skeleton overlay.',
    power: 0.60,
    supports: ['isolate', 'silhouette'],
    parameters: [
      { name: 'style', type: 'enum', default: 'neon', values: ['neon', 'solid', 'dashed'] },
      { name: 'color', type: 'color', default: '#00ffff' },
      { name: 'thickness', type: 'float', default: 2, range: [1, 10] },
      { name: 'showKeypoints', type: 'bool', default: true },
    ],
    // Rendering is delegated to SkeletonOverlay — the frame is returned unchanged
    apply: (frame) => frame,
  },

  isolate: {
    id: 'isolate',
    namespace: 'object',
    name: 'Isolate',
    description: 'Blurs everything outside the detected instance bounding box.',
    power: 0.75,
    supports: ['silhouette', 'draw_skeleton'],
    parameters: [
      { name: 'backgroundEffect', type: 'enum', default: 'blur', values: ['blur', 'darken', 'grayscale'] },
      { name: 'intensity', type: 'float', default: 0.8, range: [0, 1] },
      { name: 'feather', type: 'float', default: 10, range: [0, 50] },
    ],
    // GPU backdrop-filter handles the actual isolation; frame returned unchanged
    apply: (frame) => frame,
  },
};
