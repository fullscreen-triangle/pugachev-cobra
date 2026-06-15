import type { ObjectInstance } from './types';
import { interpolateInstances } from './tracker';

export class DetectionCache {
  private readonly max = 300;
  private map = new Map<number, ObjectInstance[]>();

  set(frame: number, instances: ObjectInstance[]): void {
    if (this.map.size >= this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(frame, instances);
  }

  get(frame: number): ObjectInstance[] | undefined {
    const val = this.map.get(frame);
    if (val !== undefined) {
      // LRU: move to end
      this.map.delete(frame);
      this.map.set(frame, val);
    }
    return val;
  }

  has(frame: number): boolean {
    return this.map.has(frame);
  }

  clear(): void {
    this.map.clear();
  }
}

export class SampledDetection {
  private readonly sampleRate = 3;
  private cache = new DetectionCache();
  private detect: (frame: number) => Promise<ObjectInstance[]>;

  constructor(detect: (frame: number) => Promise<ObjectInstance[]>) {
    this.detect = detect;
  }

  async get(frame: number): Promise<ObjectInstance[]> {
    const keyFrame = Math.floor(frame / this.sampleRate) * this.sampleRate;
    const nextKeyFrame = keyFrame + this.sampleRate;

    if (!this.cache.has(keyFrame)) {
      this.cache.set(keyFrame, await this.detect(keyFrame));
    }

    const t = (frame - keyFrame) / this.sampleRate;
    if (t === 0) return this.cache.get(keyFrame)!;

    if (!this.cache.has(nextKeyFrame)) {
      this.cache.set(nextKeyFrame, await this.detect(nextKeyFrame));
    }

    return interpolateInstances(
      this.cache.get(keyFrame)!,
      this.cache.get(nextKeyFrame)!,
      t,
    );
  }
}
