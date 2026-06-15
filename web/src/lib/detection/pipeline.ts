import type { ObjectInstance } from './types';
import { PoseDetector } from './models/pose';
import { IoUTracker } from './tracker';
import { SampledDetection } from './cache';

export interface Detection {
  frame: number;
  instances: ObjectInstance[];
}

export interface DetectionModel {
  initialize(): Promise<void>;
  detect(video: HTMLVideoElement, timestamp: number): Promise<ObjectInstance[]>;
  destroy(): void;
}

export interface DetectionPipeline {
  initialize(modelIds: string[]): Promise<void>;
  detectFrame(video: HTMLVideoElement, frame: number, fps: number): Promise<ObjectInstance[]>;
  destroy(): void;
}

export class MEEDetectionPipeline implements DetectionPipeline {
  private poseDetector = new PoseDetector();
  private tracker = new IoUTracker();
  private sampler: SampledDetection | null = null;

  async initialize(modelIds: string[]): Promise<void> {
    if (modelIds.includes('pose')) {
      await this.poseDetector.initialize();
    }
  }

  async detectFrame(video: HTMLVideoElement, frame: number, fps: number): Promise<ObjectInstance[]> {
    if (!this.sampler) {
      this.sampler = new SampledDetection(async (f) => {
        const timestamp = (f / fps) * 1000;
        const raw = await this.poseDetector.detect(video, timestamp);
        return this.tracker.update(raw);
      });
    }
    return this.sampler.get(frame);
  }

  destroy(): void {
    this.poseDetector.destroy();
  }
}
