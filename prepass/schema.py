"""
Output schema for the TT pre-pass.

This module is the single source of truth for the JSON contract consumed by the
Remotion TypeScript side (`TTAdComp` via its `precomputedData` prop). The shapes
here mirror the TS interfaces in `web/src/effects/camera/tt-speed/types` exactly —
if a field name changes on one side it must change on the other.

Bundle layout:

    {
      "meta":       PrepassMeta,
      "detections": TTFrameDetection[],
      "speeds":     SpeedFrame[],
      "shadows":    ShadowPhysicsFrame[]
    }

All coordinates come in two flavours:
  * pixel-space  ({x,y,w,h} integers) — used by bbox / combinedBbox / maskBbox
  * normalised   ({x,y,w,h} in [0,1]) — used by bbox_norm / centroid / combinedCentroid

The normalised forms let the renderer scale to any output resolution without
knowing the analysis resolution.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Optional


# ─── Geometry primitives ──────────────────────────────────────────────────────

@dataclass
class Bbox:
    """Axis-aligned box. Pixel-space when integers, normalised when in [0,1]."""
    x: float
    y: float
    w: float
    h: float

    def to_norm(self, frame_w: int, frame_h: int) -> "Bbox":
        return Bbox(self.x / frame_w, self.y / frame_h,
                    self.w / frame_w, self.h / frame_h)

    @property
    def cx(self) -> float:
        return self.x + self.w / 2

    @property
    def cy(self) -> float:
        return self.y + self.h / 2


@dataclass
class Point:
    x: float
    y: float


# ─── Detection ────────────────────────────────────────────────────────────────

# Labels the renderer understands. YOLO's COCO "person"/"motorcycle" are mapped
# onto these two on the way out.
LABEL_RIDER = "rider"
LABEL_BIKE = "bike"


@dataclass
class Region:
    """One detected object (rider or bike) in one frame."""
    id: int
    label: str                 # "rider" | "bike"
    confidence: float
    bbox: Bbox                 # pixel space
    bbox_norm: Bbox            # [0,1]
    centroid: Point            # [0,1]


@dataclass
class FrameDetection:
    """All detections for a single frame, plus the merged rider+bike box."""
    frame: int
    timestamp_ms: float
    regions: list[Region]
    combinedBbox: Optional[Bbox]        # pixel space, merge of all regions
    combinedCentroid: Optional[Point]   # [0,1]


# ─── Speed ────────────────────────────────────────────────────────────────────

@dataclass
class SpeedFrame:
    """Per-frame speed readout consumed by the SpeedDisplay HUD."""
    frame: int
    pixelVelocity: Point       # per-frame displacement of the centroid, pixels
    pixelSpeed: float          # magnitude of pixelVelocity (or bg-flow), pixels/frame
    relativeSpeed: float       # 0–100, one decimal
    smoothSpeed: int           # 0–100, integer (what the HUD renders)
    direction: int             # +1 rightward, -1 leftward
    kmh: Optional[float] = None  # calibrated real speed; null if no calibration


# ─── Shadow physics ───────────────────────────────────────────────────────────

@dataclass
class ShadowPhysicsFrame:
    """
    One frame of the detaching-shadow simulation (ShadowCompositor reads these).
    Before the detach frame: offset=(0,0), full opacity, tracking the rider.
    After: ballistic offset accumulates, opacity/scale decay.
    """
    offset: Point              # normalised screen units
    opacity: float
    scale: float
    maskBbox: Optional[Bbox]   # pixel space; frozen at detach frame


# ─── Meta ─────────────────────────────────────────────────────────────────────

@dataclass
class PrepassMeta:
    source: str
    frame_width: int
    frame_height: int
    fps: float
    total_frames: int
    sample_every: int
    detector: str              # e.g. "yolov8n" or "fallback:none"
    calibrated: bool
    px_per_meter: Optional[float]
    vibrio: bool               # True if the real vibrio package was used
    layers: dict = field(default_factory=dict)  # {"flow": "flow.mp4", ...}


@dataclass
class PrepassBundle:
    meta: PrepassMeta
    detections: list[FrameDetection]
    speeds: list[SpeedFrame]
    shadows: list[ShadowPhysicsFrame]
    # Sparse "one measurement per sampling window" readout. Populated only in
    # windowed mode; empty for a full-timeline pass. See prepass/beats.py.
    beats: list = field(default_factory=list)

    def to_dict(self) -> dict:
        """Serialise with `None` preserved as JSON null (matches TS `| null`)."""
        return asdict(self)
