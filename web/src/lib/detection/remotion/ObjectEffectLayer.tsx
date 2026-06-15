import React from 'react';
import type { ObjectInstance } from '../types';

type EffectKind = 'isolate' | 'silhouette' | 'glow' | 'outline';

interface ObjectEffectLayerProps {
  instances: ObjectInstance[];
  effect: EffectKind;
  color?: string;
  intensity?: number;
  backgroundEffect?: string;
}

function instanceStyle(
  instance: ObjectInstance,
  effect: EffectKind,
  color: string,
  intensity: number,
): React.CSSProperties {
  const { x, y, width, height } = instance.bbox;
  const base: React.CSSProperties = {
    position: 'absolute',
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    width: `${width * 100}%`,
    height: `${height * 100}%`,
    pointerEvents: 'none',
  };

  switch (effect) {
    case 'isolate':
      return { ...base, backdropFilter: `blur(${(1 - intensity) * 20}px)` };
    case 'silhouette':
      return { ...base, backgroundColor: color, opacity: intensity };
    case 'glow':
      return { ...base, boxShadow: `0 0 ${intensity * 40}px ${color}`, borderRadius: '4px' };
    case 'outline':
      return { ...base, border: `${Math.max(1, intensity * 4)}px solid ${color}`, borderRadius: '4px' };
  }
}

export const ObjectEffectLayer: React.FC<ObjectEffectLayerProps> = ({
  instances,
  effect,
  color = '#00ffff',
  intensity = 0.8,
}) => {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {instances.map((instance) => (
        <div
          key={instance.id}
          style={instanceStyle(instance, effect, color, intensity)}
        />
      ))}
    </div>
  );
};
