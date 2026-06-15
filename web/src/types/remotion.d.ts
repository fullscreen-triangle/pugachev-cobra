// Ambient stub so TypeScript resolves remotion imports without the package installed.
// Replace with the real package when remotion is added to dependencies.
declare module 'remotion' {
  export function useCurrentFrame(): number;
  export interface VideoConfig {
    fps: number;
    durationInFrames: number;
    width: number;
    height: number;
  }
  export function useVideoConfig(): VideoConfig;
  export function interpolate(
    value: number,
    inputRange: number[],
    outputRange: number[],
    options?: Record<string, unknown>,
  ): number;
  export const AbsoluteFill: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const Video: React.FC<{ src: string; startFrom?: number; [key: string]: unknown }>;
  export const Audio: React.FC<{ src: string; [key: string]: unknown }>;
  export const Sequence: React.FC<{ from?: number; durationInFrames?: number; children?: React.ReactNode }>;
}
