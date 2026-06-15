import type { ObjectInstance, BoundingBox } from './types';

function iou(a: BoundingBox, b: BoundingBox): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;

  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const intersection = ix * iy;
  if (intersection === 0) return 0;

  const union = a.width * a.height + b.width * b.height - intersection;
  return intersection / union;
}

class Track {
  instance: ObjectInstance;
  missed = 0;

  constructor(instance: ObjectInstance) {
    this.instance = instance;
  }
}

export class IoUTracker {
  private tracks: Track[] = [];
  private nextId = 0;
  private readonly iouThreshold = 0.3;
  private readonly maxMissed = 5;

  update(detections: ObjectInstance[]): ObjectInstance[] {
    const matched = new Set<number>();
    const usedTracks = new Set<number>();

    for (const det of detections) {
      let bestIoU = this.iouThreshold;
      let bestTrackIdx = -1;

      for (let i = 0; i < this.tracks.length; i++) {
        if (usedTracks.has(i)) continue;
        const score = iou(det.bbox, this.tracks[i].instance.bbox);
        if (score > bestIoU) {
          bestIoU = score;
          bestTrackIdx = i;
        }
      }

      if (bestTrackIdx >= 0) {
        const track = this.tracks[bestTrackIdx];
        const prevVel = track.instance.tracking.velocity;
        const dx = det.bbox.x - track.instance.bbox.x;
        const dy = det.bbox.y - track.instance.bbox.y;
        track.instance = {
          ...det,
          id: track.instance.id,
          tracking: {
            id: track.instance.id,
            age: track.instance.tracking.age + 1,
            // exponential moving average smooths velocity jitter
            velocity: [
              prevVel[0] * 0.7 + dx * 0.3,
              prevVel[1] * 0.7 + dy * 0.3,
            ],
          },
        };
        track.missed = 0;
        matched.add(bestTrackIdx);
        usedTracks.add(bestTrackIdx);
      } else {
        const id = `${det.type}_${this.nextId++}`;
        this.tracks.push(new Track({
          ...det,
          id,
          tracking: { id, age: 0, velocity: [0, 0] },
        }));
        matched.add(this.tracks.length - 1);
      }
    }

    for (let i = 0; i < this.tracks.length; i++) {
      if (!matched.has(i)) this.tracks[i].missed++;
    }

    this.tracks = this.tracks.filter(t => t.missed <= this.maxMissed);

    return this.tracks.map(t => t.instance);
  }
}

export function interpolateInstances(
  prev: ObjectInstance[],
  next: ObjectInstance[],
  t: number,
): ObjectInstance[] {
  const result: ObjectInstance[] = [];
  const nextById = new Map(next.map(o => [o.id, o]));

  for (const p of prev) {
    const n = nextById.get(p.id);
    if (!n) continue;
    result.push({
      ...p,
      bbox: {
        x: p.bbox.x + (n.bbox.x - p.bbox.x) * t,
        y: p.bbox.y + (n.bbox.y - p.bbox.y) * t,
        width: p.bbox.width + (n.bbox.width - p.bbox.width) * t,
        height: p.bbox.height + (n.bbox.height - p.bbox.height) * t,
      },
    });
  }

  return result;
}
