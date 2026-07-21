"""
Generic object-box detector for the Resilient-Wheels advert.

The main prepass pipeline (prepass/run.py) hard-filters detections to COCO
person/motorcycle mapped onto rider/bike — right for the TT footage, useless for
an industrial wheels video. The wheels spec wants boxes around *discrete items*
with NO classification. So this standalone pass keeps EVERY COCO class as an
anonymous box and emits a minimal per-frame bbox timeline the Remotion overlay
consumes.

Output JSON:
    { "meta": {video, width, height, fps, total_frames, sample_every},
      "frames": [ {frame, t_ms, boxes: [ {x,y,w,h,   # normalised [0,1]
                                          conf} ] }, ... ] }

Boxes are normalised so the overlay scales to any output resolution. Detection is
sampled every N frames (default 3) and NOT interpolated — the overlay can hold the
last boxes between samples, which reads fine for a stylised advert.

Usage:
    python -m prepass.detect_generic --video X.mkv --out out/wheels_det.json \
        --sample 3 --conf 0.25 --model yolov8n.pt
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

from . import video


def main(argv=None):
    p = argparse.ArgumentParser(description="Generic unlabeled box detector")
    p.add_argument("--video", required=True)
    p.add_argument("--out", default="out/wheels_det.json")
    p.add_argument("--sample", type=int, default=3, help="detect every Nth frame")
    p.add_argument("--conf", type=float, default=0.25)
    p.add_argument("--model", default="yolov8n.pt")
    p.add_argument("--device", default="cpu")
    p.add_argument("--max-width", type=int, default=960,
                   help="downscale detect frames to this width")
    a = p.parse_args(argv)

    try:
        from ultralytics import YOLO
    except Exception as e:
        print(f"ERROR: ultralytics not available: {e}", file=sys.stderr)
        return 2

    info = video.probe(a.video)
    fps = info.fps
    W, H = info.width, info.height
    print(f"video: {a.video}  {W}x{H} @ {fps:.2f}fps  {info.total_frames} frames")
    print(f"detecting every {a.sample} frames, conf>={a.conf}, all COCO classes")

    model = YOLO(a.model)

    frames_out = []
    n_boxes = 0
    for idx, img in video.iter_sampled(a.video, a.sample, max_width=a.max_width):
        # detect on the (downscaled) frame; boxes come back in that frame's pixel
        # space, which we normalise by the downscaled dims -> resolution-independent.
        fh, fw = img.shape[:2]
        res = model.predict(img, conf=a.conf, device=a.device, verbose=False)[0]
        boxes = []
        for b in res.boxes:
            x1, y1, x2, y2 = (float(v) for v in b.xyxy[0])
            bw, bh = x2 - x1, y2 - y1
            if bw <= 0 or bh <= 0:
                continue
            boxes.append({
                "x": round(x1 / fw, 5), "y": round(y1 / fh, 5),
                "w": round(bw / fw, 5), "h": round(bh / fh, 5),
                "conf": round(float(b.conf), 3),
            })
        n_boxes += len(boxes)
        frames_out.append({
            "frame": idx, "t_ms": round(idx / fps * 1000, 1), "boxes": boxes,
        })
        if idx % 60 == 0:
            sys.stdout.write(f"\r  frame {idx}  ({len(frames_out)} sampled, "
                             f"{n_boxes} boxes)   ")
            sys.stdout.flush()

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "meta": {
            "video": a.video, "width": W, "height": H, "fps": fps,
            "total_frames": info.total_frames, "sample_every": a.sample,
        },
        "frames": frames_out,
    }, indent=1))
    print(f"\nDone. {len(frames_out)} sampled frames, {n_boxes} boxes -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
