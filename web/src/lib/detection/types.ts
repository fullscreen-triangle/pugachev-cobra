export type ObjectType = 'person' | 'face' | 'hand' | 'vehicle' | 'object';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Keypoint {
  name: string;
  x: number;
  y: number;
  z?: number;
  score?: number;
}

export type PoseType = 'standing' | 'sitting' | 'running' | 'jumping' | 'crouching';

export interface Skeleton {
  keypoints: Keypoint[];
  connections: [string, string][];
}

export interface TrackData {
  id: string;
  age: number;
  velocity: [number, number];
}

export interface TrackedObject {
  id: string;
  type: ObjectType;
  bbox: BoundingBox;
  confidence: number;
  keypoints?: Keypoint[];
  pose?: PoseType;
}

export interface TracksFile {
  version: 1;
  fps: number;
  width: number;
  height: number;
  frames: Record<number, TrackedObject[]>;
}

export interface ObjectInstance {
  id: string;
  type: ObjectType;
  bbox: BoundingBox;
  mask?: ImageData;
  skeleton?: Skeleton;
  confidence: number;
  tracking: TrackData;
  metadata: Record<string, unknown>;
}
