"""
Speed pass.

Combines two things:
  * the relative 0–100 readout the TS HUD already expects (self-calibrated to the
    clip's own maximum), and
  * vibrio's absolute speed formula when a pixel-to-metre ratio is supplied:

        v = (d_pixels * r_calibration) / (Δframes / fps)     [m/s]  → km/h

Strategy per frame:
  1. centroid displacement between consecutive frames (pixel velocity)
  2. jitter filter — sub-threshold micro-moves are treated as stationary
  3. causal moving-average smoothing (no future lookahead)
  4. normalise to 0–100 against the global smoothed maximum
  5. if calibrated, also convert raw pixel speed to km/h
"""

from __future__ import annotations

import math
from typing import Optional

from .schema import FrameDetection, SpeedFrame, Point
from .config import SpeedConfig, CalibrationConfig


def estimate_speed(timeline: list[FrameDetection], fps: float,
                   speed_cfg: SpeedConfig,
                   calib: CalibrationConfig,
                   frame_w: int, frame_h: int) -> list[SpeedFrame]:
    smooth_window = speed_cfg.smooth_window
    jitter = speed_cfg.jitter_threshold
    hold = speed_cfg.hold_frames

    # ── Pass 1: raw pixel velocity (normalised centroid space) ────────────────
    raw_speeds: list[float] = []
    raw_vels: list[Point] = []
    prev = None
    hold_count = 0

    for det in timeline:
        c = det.combinedCentroid
        if c is None:
            hold_count += 1
            held = raw_speeds[-1] if raw_speeds else 0.0
            raw_speeds.append(held * 0.9 if hold_count <= hold else 0.0)
            raw_vels.append(Point(0.0, 0.0))
            continue

        hold_count = 0
        if prev is None:
            raw_speeds.append(0.0)
            raw_vels.append(Point(0.0, 0.0))
            prev = c
            continue

        dx = c.x - prev.x
        dy = c.y - prev.y
        mag = math.hypot(dx, dy)
        if mag < jitter:
            raw_speeds.append(raw_speeds[-1] if raw_speeds else 0.0)
            raw_vels.append(Point(0.0, 0.0))
        else:
            raw_speeds.append(mag)
            raw_vels.append(Point(dx, dy))
        prev = c

    # ── Pass 2: causal moving average ─────────────────────────────────────────
    smoothed = []
    for i in range(len(raw_speeds)):
        lo = max(0, i - smooth_window + 1)
        win = raw_speeds[lo:i + 1]
        smoothed.append(sum(win) / len(win) if win else 0.0)

    max_smoothed = max(smoothed) if smoothed else 0.0
    max_smoothed = max(max_smoothed, 1e-9)

    # ── Pass 3: assemble frames (+ optional km/h) ─────────────────────────────
    ppm = calib.px_per_meter
    out: list[SpeedFrame] = []
    for i, det in enumerate(timeline):
        vel = raw_vels[i]
        raw = raw_speeds[i]
        smooth = smoothed[i]
        relative = (smooth / max_smoothed) * 100.0

        kmh: Optional[float] = None
        if ppm:
            # raw is normalised displacement/frame → convert to pixels/frame,
            # then metres/frame, then metres/s, then km/h.
            px_per_frame = raw * frame_w  # x-dominant motion; frame_w scales norm
            m_per_frame = px_per_frame / ppm
            m_per_s = m_per_frame * fps
            kmh = round(m_per_s * 3.6, 1)

        out.append(SpeedFrame(
            frame=det.frame,
            pixelVelocity=vel,
            pixelSpeed=round(raw, 5),
            relativeSpeed=round(relative, 1),
            smoothSpeed=round(relative),
            direction=1 if vel.x >= 0 else -1,
            kmh=kmh,
        ))
    return out


def peak_speed_frames(speeds: list[SpeedFrame], top_n: int = 3) -> list[SpeedFrame]:
    """Return the N highest-speed frames — used to place effect triggers."""
    return sorted(speeds, key=lambda s: s.smoothSpeed, reverse=True)[:top_n]
