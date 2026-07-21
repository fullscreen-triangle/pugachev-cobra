"""
Pixel-layer passes — the vibrio effects that genuinely transform pixels and are
therefore rendered as their own video files for Remotion to composite:

  * flow.mp4   — Farneback dense optical flow, visualised as HSV (hue=direction,
                 value=magnitude). The motion field itself becomes visible.
  * energy.mp4 — Motion-energy: a Motion History Image (fading trails of movement)
                 blended with a neuromorphic event layer (per-pixel luminance
                 threshold crossings), giving a ghostly event-camera look.

Both require OpenCV. If it is unavailable the renderer logs and skips, leaving the
layer out of `meta.layers` so the renderer knows it is absent.
"""

from __future__ import annotations

import math
from typing import Optional

try:
    import cv2
    import numpy as np
    _CV = True
except Exception:
    _CV = False


def _writer(path: str, fps: float, w: int, h: int):
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    return cv2.VideoWriter(path, fourcc, fps, (w, h))


def render_flow(frames_iter, path: str, fps: float, w: int, h: int) -> Optional[str]:
    """
    frames_iter: iterable of BGR ndarrays (full frame rate, not sampled).
    Returns the output path on success, None if skipped.
    """
    if not _CV:
        print("  [flow] OpenCV unavailable — skipping flow layer")
        return None

    out = _writer(path, fps, w, h)
    prev_gray = None
    hsv = np.zeros((h, w, 3), dtype=np.uint8)
    hsv[..., 1] = 255  # full saturation

    count = 0
    for frame in frames_iter:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if prev_gray is None:
            out.write(np.zeros((h, w, 3), dtype=np.uint8))
        else:
            flow = cv2.calcOpticalFlowFarneback(
                prev_gray, gray, None,
                pyr_scale=0.5, levels=3, winsize=15,
                iterations=3, poly_n=5, poly_sigma=1.2, flags=0,
            )
            mag, ang = cv2.cartToPolar(flow[..., 0], flow[..., 1])
            hsv[..., 0] = (ang * 180 / math.pi / 2).astype(np.uint8)
            hsv[..., 2] = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
            out.write(cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR))
        prev_gray = gray
        count += 1

    out.release()
    print(f"  [flow] wrote {count} frames → {path}")
    return path


def render_energy(frames_iter, path: str, fps: float, w: int, h: int,
                  mhi_duration: float = 0.75,
                  event_threshold: float = 0.06) -> Optional[str]:
    """
    Motion-energy (MHI) + neuromorphic event overlay.
      * MHI: a float buffer where recent motion is bright and fades over
        `mhi_duration` seconds.
      * Events: pixels whose luminance changed by more than `event_threshold`
        emit a coloured spark (green = brightening, magenta = darkening),
        the classic event-camera polarity split.
    """
    if not _CV:
        print("  [energy] OpenCV unavailable — skipping energy layer")
        return None

    out = _writer(path, fps, w, h)
    mhi = np.zeros((h, w), dtype=np.float32)
    decay = 1.0 / max(1.0, mhi_duration * fps)
    prev_lum = None
    thr255 = event_threshold * 255.0

    count = 0
    for frame in frames_iter:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        lum = gray.astype(np.float32)

        # ── Motion History Image ──────────────────────────────────────────────
        if prev_lum is not None:
            diff = cv2.absdiff(gray, prev_lum_u8)
            motion = (diff > 20).astype(np.float32)
            mhi = np.maximum(mhi - decay, 0.0)
            mhi[motion > 0] = 1.0

        mhi_vis = (mhi * 255).astype(np.uint8)
        canvas = cv2.applyColorMap(mhi_vis, cv2.COLORMAP_INFERNO)
        canvas[mhi_vis == 0] = 0  # keep untouched areas black

        # ── Neuromorphic events ───────────────────────────────────────────────
        if prev_lum is not None:
            delta = lum - prev_lum
            pos = delta > thr255    # brightening
            neg = delta < -thr255   # darkening
            canvas[pos] = (60, 255, 60)      # green spark (BGR)
            canvas[neg] = (255, 60, 200)     # magenta spark (BGR)

        out.write(canvas)
        prev_lum = lum
        prev_lum_u8 = gray
        count += 1

    out.release()
    print(f"  [energy] wrote {count} frames → {path}")
    return path
