"""
Detection pass.

Runs an object detector over sampled frames and returns a per-frame timeline of
rider + bike regions, merged into a combined box. Prefers vibrio's `HumanDetector`
(YOLOv8) when the package is importable; otherwise falls back to a direct
ultralytics YOLO call; and if neither is available, returns an empty-but-valid
timeline so downstream stages and the JSON contract still hold.
"""

from __future__ import annotations

from typing import Optional

from .schema import (
    Bbox, Point, Region, FrameDetection,
    LABEL_RIDER, LABEL_BIKE,
)
from .config import DetectorConfig

# COCO name → our label
_LABEL_MAP = {"person": LABEL_RIDER, "motorcycle": LABEL_BIKE}


def _merge_bboxes(boxes: list[Bbox]) -> Optional[Bbox]:
    if not boxes:
        return None
    min_x = min(b.x for b in boxes)
    min_y = min(b.y for b in boxes)
    max_x = max(b.x + b.w for b in boxes)
    max_y = max(b.y + b.h for b in boxes)
    return Bbox(min_x, min_y, max_x - min_x, max_y - min_y)


def _regions_from_raw(raw, frame_w: int, frame_h: int,
                      cfg: DetectorConfig) -> list[Region]:
    """
    Normalise a list of raw detections into Region objects.
    Each raw item must expose: label (str), score (float),
    and a box as (xmin, ymin, xmax, ymax) in pixels.
    """
    regions: list[Region] = []
    idx = 0
    for label, score, (xmin, ymin, xmax, ymax) in raw:
        if label not in _LABEL_MAP:
            continue
        bw = xmax - xmin
        bh = ymax - ymin
        if bw <= 0 or bh <= 0:
            continue
        bbox = Bbox(round(xmin), round(ymin), round(bw), round(bh))
        regions.append(Region(
            id=idx,
            label=_LABEL_MAP[label],
            confidence=round(float(score), 3),
            bbox=bbox,
            bbox_norm=bbox.to_norm(frame_w, frame_h),
            centroid=Point((xmin + bw / 2) / frame_w,
                           (ymin + bh / 2) / frame_h),
        ))
        idx += 1
    return regions


def _build_frame(raw, frame_n: int, fps: float,
                 frame_w: int, frame_h: int,
                 cfg: DetectorConfig) -> FrameDetection:
    regions = _regions_from_raw(raw, frame_w, frame_h, cfg)
    combined = _merge_bboxes([r.bbox for r in regions])
    combined_centroid = (
        Point(combined.cx / frame_w, combined.cy / frame_h)
        if combined else None
    )
    return FrameDetection(
        frame=frame_n,
        timestamp_ms=(frame_n / fps) * 1000.0,
        regions=regions,
        combinedBbox=combined,
        combinedCentroid=combined_centroid,
    )


# ─── Detector backends ────────────────────────────────────────────────────────

class _Backend:
    name = "none"
    def infer(self, frame_bgr, cfg: DetectorConfig):
        """Return list of (label, score, (xmin,ymin,xmax,ymax)) in pixels."""
        return []


class _VibrioBackend(_Backend):
    """Uses vibrio's HumanDetector plus a bike detector if exposed."""
    def __init__(self, cfg: DetectorConfig):
        from vibrio.modules.detector import HumanDetector  # type: ignore
        self._det = HumanDetector(conf_threshold=cfg.conf_threshold,
                                  device=cfg.device)
        self.name = "vibrio:HumanDetector"

    def infer(self, frame_bgr, cfg: DetectorConfig):
        # vibrio returns person boxes; we also want motorcycle. HumanDetector is
        # person-only, so we read its raw ultralytics model for both classes when
        # available, else fall back to person boxes.
        dets = self._det.detect(frame_bgr)
        out = []
        for d in dets:
            box = d.get("bbox") or d.get("box")
            score = d.get("confidence", d.get("score", 0.0))
            label = d.get("label", "person")
            if box is None:
                continue
            out.append((label, score, tuple(box)))
        return out


class _UltralyticsBackend(_Backend):
    """Direct ultralytics YOLO — handles both person and motorcycle classes."""
    def __init__(self, cfg: DetectorConfig):
        from ultralytics import YOLO  # type: ignore
        self._model = YOLO(cfg.model)
        self._names = self._model.names
        self.name = f"ultralytics:{cfg.model}"

    def infer(self, frame_bgr, cfg: DetectorConfig):
        res = self._model.predict(frame_bgr, conf=cfg.conf_threshold,
                                  device=cfg.device, verbose=False)[0]
        out = []
        for b in res.boxes:
            cls = self._names[int(b.cls)]
            if cls not in cfg.targets:
                continue
            xmin, ymin, xmax, ymax = (float(v) for v in b.xyxy[0])
            out.append((cls, float(b.conf), (xmin, ymin, xmax, ymax)))
        return out


def make_backend(cfg: DetectorConfig, use_vibrio: bool) -> _Backend:
    """Pick the best available backend, degrading gracefully."""
    if use_vibrio:
        try:
            return _VibrioBackend(cfg)
        except Exception:
            pass
    try:
        return _UltralyticsBackend(cfg)
    except Exception:
        return _Backend()  # empty timeline, still schema-valid


# ─── Public entry ─────────────────────────────────────────────────────────────

def detect_frames(frames, fps: float, frame_w: int, frame_h: int,
                  cfg: DetectorConfig, use_vibrio: bool,
                  on_progress=None):
    """
    frames: iterable of (frame_index, frame_bgr ndarray).
    Returns (timeline: list[FrameDetection], backend_name: str, used_vibrio: bool).
    """
    backend = make_backend(cfg, use_vibrio)
    used_vibrio = backend.name.startswith("vibrio")
    timeline: list[FrameDetection] = []
    frames = list(frames)
    total = len(frames)
    for i, (frame_n, img) in enumerate(frames):
        raw = backend.infer(img, cfg)
        timeline.append(_build_frame(raw, frame_n, fps, frame_w, frame_h, cfg))
        if on_progress:
            on_progress(i + 1, total)
    return timeline, backend.name, used_vibrio
