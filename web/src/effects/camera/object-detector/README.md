# smartphone-detector

Smartphone body + sub-region detection for Remotion / MEE pipelines.

**Stage 1** — YOLOv10s via Transformers.js detects `phone_body` (COCO class `cell phone`).  
**Stage 2** — Geometry inference derives `screen`, `front_camera`, `rear_camera_cluster` from the body bbox.

All regions are returned as a typed `FrameManifest` with pixel and normalised bounding boxes.

---

## Files

```
src/
  types/index.ts                  # All types: FrameManifest, DetectedRegion, etc.
  utils/geometry.ts               # Sub-region derivation from phone body bbox
  detector/
    SmartphoneDetector.ts         # Core detector class
    useSmartphoneDetection.ts     # Remotion hook (per-frame, cached)
    prepass.ts                    # Offline pre-pass for static product shots
  RemotionExample.tsx             # Drop-in Remotion composition example
  index.ts                        # Barrel export
```

---

## Usage

### Option A — Remotion hook (live, per-frame)

```tsx
import { useRef } from "react";
import { AbsoluteFill } from "remotion";
import { useSmartphoneDetection } from "./detector/useSmartphoneDetection";

export const MyComp = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { manifest } = useSmartphoneDetection({
    canvasRef,
    sampleEveryNFrames: 15,   // re-detect every 15 frames (~0.5s at 30fps)
    threshold: 0.35,
    onManifest: (m) => {
      // Wire m.regions into your MEE acts_like() pipeline here
    },
  });

  return (
    <AbsoluteFill>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {/* your composition */}
    </AbsoluteFill>
  );
};
```

### Option B — Pre-pass for static product shots (recommended)

Run once before rendering. Produces `manifest.json` read at render time — no model inference during the hot render loop.

```bash
npx tsx src/detector/prepass.ts \
  --input footage/product.jpg \
  --out manifest.json \
  --threshold 0.35
```

Consume in Remotion:

```tsx
import manifest from "./manifest.json";
import type { ManifestRecord } from "./detector/prepass";

// In your composition:
const frameManifest = manifest[currentFrame] ?? manifest[0];
const regions = frameManifest.regions;
```

### Option C — Imperative, one-shot

```ts
import { SmartphoneDetector } from "./detector/SmartphoneDetector";

const detector = new SmartphoneDetector({ threshold: 0.4 });
const manifest = await detector.detectUrl("https://example.com/phone.jpg");
console.log(manifest.regions);
```

---

## Manifest shape

```json
{
  "frame": { "width": 1920, "height": 1080 },
  "timestamp_ms": 0,
  "regions": [
    {
      "id": 0,
      "label": "phone_body",
      "confidence": 0.87,
      "derived": false,
      "shape": "rect",
      "bbox":      { "x": 412, "y": 180, "w": 320, "h": 640 },
      "bbox_norm": { "x": 0.2146, "y": 0.1667, "w": 0.1667, "h": 0.5926 },
      "behaviour_hint": "acts_like(device_body)"
    },
    {
      "id": 1,
      "label": "screen",
      "confidence": 0.92,
      "derived": true,
      "shape": "rect",
      "bbox":      { "x": 430, "y": 229, "w": 285, "h": 530 },
      "bbox_norm": { "x": 0.2239, "y": 0.212, "w": 0.1484, "h": 0.4907 },
      "behaviour_hint": "acts_like(screen)"
    },
    {
      "id": 2,
      "label": "front_camera",
      "confidence": 0.85,
      "derived": true,
      "shape": "circle",
      "bbox":      { "x": 561, "y": 196, "w": 18, "h": 18 },
      "bbox_norm": { "x": 0.292, "y": 0.1815, "w": 0.0094, "h": 0.0167 }
    },
    {
      "id": 3,
      "label": "rear_camera_cluster",
      "confidence": 0.80,
      "derived": true,
      "shape": "rect",
      "note": "rear cluster — estimated; only fully visible when phone is face-down",
      "bbox":      { "x": 428, "y": 205, "w": 122, "h": 115 },
      "bbox_norm": { "x": 0.2229, "y": 0.1898, "w": 0.0635, "h": 0.1065 }
    }
  ]
}
```

---

## Geometry tuning

Edit `src/utils/geometry.ts` → `PORTRAIT` / `LANDSCAPE` constants if your
product shots use a specific handset. The ratios are self-documented inline.

---

## MEE hook point

Each region carries `behaviour_hint` — the intended `acts_like()` string for
your MEE compiler. The mapping is:

| label               | behaviour_hint          |
|---------------------|-------------------------|
| `phone_body`        | `acts_like(device_body)` |
| `screen`            | `acts_like(screen)`      |
| `front_camera`      | `acts_like(lens)`        |
| `rear_camera_cluster` | `acts_like(lens)`      |

These feed directly into your MEE `goal` block per region.
