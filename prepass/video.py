"""
Video I/O — cross-platform frame access via OpenCV.

No ffmpeg subprocess, no /tmp scratch dirs (the old tt_prepass.ts approach was
POSIX-only). Frames are read directly from the container. Two access patterns:

  * iter_frames()        — every frame, in order (for the pixel-layer passes)
  * iter_sampled()       — every Nth frame (for the expensive detection pass)
  * probe()              — dimensions / fps / frame count without decoding all
"""

from __future__ import annotations

from dataclasses import dataclass

try:
    import cv2
    _CV = True
except Exception:
    _CV = False


@dataclass
class VideoInfo:
    width: int
    height: int
    fps: float
    total_frames: int


def probe(path: str, fallback_fps: float = 30.0) -> VideoInfo:
    if not _CV:
        # Can't decode; return a benign default so the pipeline still emits a
        # schema-valid (empty) bundle rather than crashing.
        return VideoInfo(width=1920, height=1080, fps=fallback_fps, total_frames=0)
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        cap.release()
        raise FileNotFoundError(f"Cannot open video: {path}")
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or fallback_fps
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    return VideoInfo(width=w, height=h, fps=fps, total_frames=n)


def iter_windows(path: str, window_period_s: float, window_len_s: float,
                 fps: float, step: int = 1, max_width: int | None = None):
    """
    Sample short bursts spread across the film instead of the whole thing.

    Every `window_period_s` seconds, grab a `window_len_s`-second window and yield
    its frames (every `step`-th, optionally downscaled). Seeks straight to each
    window start via CAP_PROP_POS_FRAMES, so cost scales with total *sampled*
    footage, not clip length — a 4-minute 4K film becomes a handful of cheap
    bursts.

    Yields (frame_index, BGR ndarray). frame_index is the true index in the
    source, so timestamps and the shadow/speed timelines stay aligned to the
    real video.
    """
    if not _CV:
        return
    cap = cv2.VideoCapture(path)
    try:
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        period_f = max(1, round(window_period_s * fps))
        len_f = max(1, round(window_len_s * fps))
        start = 0
        while start < total:
            cap.set(cv2.CAP_PROP_POS_FRAMES, start)
            for off in range(len_f):
                idx = start + off
                if idx >= total:
                    break
                if off % step == 0:
                    ok, frame = cap.read()
                    if not ok:
                        break
                    if max_width and frame.shape[1] > max_width:
                        scale = max_width / frame.shape[1]
                        frame = cv2.resize(
                            frame, (max_width, round(frame.shape[0] * scale)),
                            interpolation=cv2.INTER_AREA)
                    yield idx, frame
                else:
                    if not cap.grab():
                        break
            start += period_f
    finally:
        cap.release()


def iter_frames(path: str):
    """Yield every frame as a BGR ndarray."""
    if not _CV:
        return
    cap = cv2.VideoCapture(path)
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            yield frame
    finally:
        cap.release()


def iter_sampled(path: str, step: int, max_width: int | None = None):
    """
    Yield (frame_index, BGR ndarray) for every `step`-th frame.

    If `max_width` is set, sampled frames are downscaled so their width does not
    exceed it. Detection gains nothing from 4K on an advert, and keeping the
    sampled frames small is what makes a 4K clip fit in memory — bboxes are
    rescaled to full resolution by the caller via the scale factor.

    Uses `grab()` (decode-skip) for the frames we throw away, so we don't pay the
    full colour-convert cost on 9 of every 10 frames.
    """
    if not _CV:
        return
    cap = cv2.VideoCapture(path)
    try:
        idx = 0
        while True:
            if idx % step == 0:
                ok, frame = cap.read()
                if not ok:
                    break
                if max_width and frame.shape[1] > max_width:
                    scale = max_width / frame.shape[1]
                    frame = cv2.resize(
                        frame, (max_width, round(frame.shape[0] * scale)),
                        interpolation=cv2.INTER_AREA)
                yield idx, frame
            else:
                if not cap.grab():   # advance without decoding
                    break
            idx += 1
    finally:
        cap.release()
