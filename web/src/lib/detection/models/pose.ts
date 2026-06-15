// @ts-ignore
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { ObjectInstance, Keypoint, Skeleton, BoundingBox } from '../types';

const CONNECTIONS: [string, string][] = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
];

const LANDMARK_NAMES = [
  'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer',
  'right_eye_inner', 'right_eye', 'right_eye_outer',
  'left_ear', 'right_ear', 'mouth_left', 'mouth_right',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_pinky', 'right_pinky',
  'left_index', 'right_index', 'left_thumb', 'right_thumb',
  'left_hip', 'right_hip', 'left_knee', 'right_knee',
  'left_ankle', 'right_ankle', 'left_heel', 'right_heel',
  'left_foot_index', 'right_foot_index',
];

type RawLandmark = { x: number; y: number; z: number; visibility?: number };
type LandmarkerResult = { landmarks: RawLandmark[][] };
type LandmarkerInstance = {
  detectForVideo: (el: HTMLVideoElement, ts: number) => LandmarkerResult;
  close: () => void;
};

export class PoseDetector {
  private landmarker: LandmarkerInstance | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (this.initialized) return;

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
    );

    this.landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 10,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }) as LandmarkerInstance;

    this.initialized = true;
  }

  async detect(videoElement: HTMLVideoElement, timestamp: number): Promise<ObjectInstance[]> {
    if (typeof window === 'undefined') return [];
    if (!this.initialized || !this.landmarker) return [];

    const results = this.landmarker.detectForVideo(videoElement, timestamp);
    if (!results.landmarks) return [];

    return results.landmarks.map((landmarks, idx) => {
      const keypoints: Keypoint[] = landmarks.map((lm, i) => ({
        name: LANDMARK_NAMES[i] ?? `landmark_${i}`,
        x: lm.x,
        y: lm.y,
        z: lm.z,
        score: lm.visibility,
      }));

      const bbox = this.keypointsToBbox(keypoints);
      const skeleton: Skeleton = { keypoints, connections: CONNECTIONS };

      return {
        id: `pose_${idx}`,
        type: 'person' as const,
        bbox,
        skeleton,
        confidence: this.avgVisibility(keypoints),
        tracking: { id: `pose_${idx}`, age: 0, velocity: [0, 0] as [number, number] },
        metadata: {},
      };
    });
  }

  private keypointsToBbox(keypoints: Keypoint[]): BoundingBox {
    const xs = keypoints.map(k => k.x);
    const ys = keypoints.map(k => k.y);
    const minX = Math.max(0, Math.min(...xs));
    const minY = Math.max(0, Math.min(...ys));
    const maxX = Math.min(1, Math.max(...xs));
    const maxY = Math.min(1, Math.max(...ys));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  private avgVisibility(keypoints: Keypoint[]): number {
    const scores = keypoints.map(k => k.score ?? 0);
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  destroy(): void {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
      this.initialized = false;
    }
  }
}
