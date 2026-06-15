import React from 'react';
import type { ObjectInstance } from '../types';

interface SkeletonOverlayProps {
  instances: ObjectInstance[];
  style?: string;
  color?: string;
  thickness?: number;
}

export const SkeletonOverlay: React.FC<SkeletonOverlayProps> = ({
  instances,
  color = '#00ffff',
  thickness = 2,
}) => {
  const keypointRadius = thickness * 2;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
    >
      {instances.map((instance) => {
        const sk = instance.skeleton;
        if (!sk) return null;

        const kpMap = new Map(sk.keypoints.map(k => [k.name, k]));

        return (
          <g key={instance.id}>
            {sk.connections.map(([a, b]) => {
              const ka = kpMap.get(a);
              const kb = kpMap.get(b);
              if (!ka || !kb) return null;
              const opacity = Math.min(ka.score ?? 1, kb.score ?? 1);
              return (
                <line
                  key={`${instance.id}-${a}-${b}`}
                  x1={ka.x}
                  y1={ka.y}
                  x2={kb.x}
                  y2={kb.y}
                  stroke={color}
                  strokeWidth={thickness / 1000}
                  strokeLinecap="round"
                  opacity={opacity}
                />
              );
            })}
            {sk.keypoints.map((kp) => (
              <circle
                key={`${instance.id}-kp-${kp.name}`}
                cx={kp.x}
                cy={kp.y}
                r={keypointRadius / 1000}
                fill={color}
                opacity={kp.score ?? 1}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
};
