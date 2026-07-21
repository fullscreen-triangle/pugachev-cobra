"""
Beat reducer — one measurement per sampling window.

The windowed prepass (`--window`) analyses a short burst every N seconds instead
of the whole film, so a long/unstable clip stays cheap to process. But the rest
of the pipeline then *densifies* those bursts back into per-frame timelines. For
the "one measurement every 20s" product we want the opposite: collapse each 2s
window down to the single most salient frame — its peak — and emit a compact
readout per beat.

"Salient" is defined by a per-frame scalar the analysis already produces. Today
that is speed (`SpeedFrame.smoothSpeed`, derived from displacement); the reducer
takes the scoring key as a callable so a richer Vibrio metric (optical-flow
coherence, motion energy) can drive peak selection later without changing shape.

A beat carries only what a downstream "stamp a measurement on screen" consumer
needs — window index, the peak timestamp, the peak value, and the rider's
position/box at that instant — not the full FrameDetection.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Callable, Optional

from .schema import FrameDetection, SpeedFrame, Bbox, Point


@dataclass
class Beat:
    """One window collapsed to its peak frame."""
    window_index: int          # 0-based beat number across the film
    frame: int                 # source frame index of the peak
    t_start_ms: float          # when this window began (window_index * period)
    t_peak_ms: float           # timestamp of the peak frame
    metric: str                # which scalar defined the peak (e.g. "smoothSpeed")
    peak_value: float          # value of that scalar at the peak
    kmh: Optional[float]       # calibrated speed at the peak, if available
    direction: int             # +1 / -1 travel direction at the peak
    centroid: Optional[Point]  # rider+bike centroid, normalised [0,1]
    bbox: Optional[Bbox]       # rider+bike box, pixel space


# Default scorer: the speed the HUD already trusts. Higher = more salient.
def _score_speed(det: FrameDetection, spd: Optional[SpeedFrame]) -> float:
    return float(spd.smoothSpeed) if spd else 0.0


def reduce_to_beats(
    timeline: list[FrameDetection],
    speeds: list[SpeedFrame],
    fps: float,
    period_s: float,
    metric: str = "smoothSpeed",
    score: Callable[[FrameDetection, Optional[SpeedFrame]], float] = _score_speed,
) -> list[Beat]:
    """
    Group analysed frames into their `period_s`-second windows and keep, per
    window, the single frame maximising `score`.

    Frames are assigned to windows by their true source-frame timestamp, so this
    works whether the frames came from `iter_windows` (already sparse) or a dense
    pass — a window with no analysed frames simply produces no beat.
    """
    if not timeline:
        return []

    speed_by_frame = {s.frame: s for s in speeds}
    period_f = max(1, round(period_s * fps))

    # window index -> (best_score, det, speed)
    best: dict[int, tuple[float, FrameDetection, Optional[SpeedFrame]]] = {}
    for det in timeline:
        # Skip frames with nothing detected — a beat should mark a real reading.
        if det.combinedCentroid is None:
            continue
        w = det.frame // period_f
        spd = speed_by_frame.get(det.frame)
        s = score(det, spd)
        cur = best.get(w)
        if cur is None or s > cur[0]:
            best[w] = (s, det, spd)

    beats: list[Beat] = []
    for w in sorted(best):
        s, det, spd = best[w]
        beats.append(Beat(
            window_index=w,
            frame=det.frame,
            t_start_ms=(w * period_f / fps) * 1000.0,
            t_peak_ms=det.timestamp_ms,
            metric=metric,
            peak_value=round(s, 3),
            kmh=spd.kmh if spd else None,
            direction=spd.direction if spd else 1,
            centroid=det.combinedCentroid,
            bbox=det.combinedBbox,
        ))
    return beats


def beats_to_dicts(beats: list[Beat]) -> list[dict]:
    return [asdict(b) for b in beats]
