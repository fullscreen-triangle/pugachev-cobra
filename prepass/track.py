"""
Tracking pass.

A constant-velocity Kalman filter over the *combined* rider+bike box, mirroring
vibrio's tracker state `[cx, cy, w, h, ċx, ċy]`. Since the promo follows a single
subject, we run one filter on the merged centroid+size rather than full
multi-object assignment — this gives us smooth, gap-filling tracks (the thing the
raw per-frame detection lacks) without the Hungarian machinery.

Two responsibilities:
  1. Smooth the combinedBbox / combinedCentroid across the sampled timeline,
     coasting through frames where detection dropped out (predict-only).
  2. Interpolate the sampled timeline up to every frame (sample_every > 1).
"""

from __future__ import annotations

from typing import Optional

from .schema import Bbox, Point, FrameDetection


# ─── Minimal constant-velocity Kalman filter ──────────────────────────────────

class _CVKalman:
    """
    State: [cx, cy, w, h, vx, vy]. Measurement: [cx, cy, w, h].
    Pure-python (no numpy dependency) so the tracker runs even in a bare env.
    """
    def __init__(self, meas, process_var=1e-3, meas_var=1e-2):
        # state
        self.x = [meas[0], meas[1], meas[2], meas[3], 0.0, 0.0]
        # diagonal covariance
        self.P = [1.0] * 6
        self.q = process_var
        self.r = meas_var

    def predict(self):
        # position += velocity
        self.x[0] += self.x[4]
        self.x[1] += self.x[5]
        for i in range(6):
            self.P[i] += self.q
        return self.x[:4]

    def update(self, meas):
        for i in range(4):
            k = self.P[i] / (self.P[i] + self.r)   # Kalman gain (scalar per dim)
            self.x[i] += k * (meas[i] - self.x[i])
            self.P[i] *= (1 - k)
        # crude velocity estimate from corrected position handled by predict step

    def nudge_velocity(self, prev_center):
        self.x[4] = self.x[0] - prev_center[0]
        self.x[5] = self.x[1] - prev_center[1]


def smooth_tracks(timeline: list[FrameDetection], max_coast: int = 30
                  ) -> list[FrameDetection]:
    """
    Run the Kalman filter across the sampled timeline. Frames with a detection
    correct the filter; frames without coast on prediction for up to `max_coast`
    samples. Rewrites combinedBbox / combinedCentroid in place with the filtered
    estimate, preserving frame_w/h implied by the existing normalised values.
    """
    kf: Optional[_CVKalman] = None
    coast = 0
    prev_center = None

    for det in timeline:
        cb = det.combinedBbox
        if cb is not None:
            meas = [cb.cx, cb.cy, cb.w, cb.h]
            if kf is None:
                kf = _CVKalman(meas)
            else:
                kf.predict()
                kf.update(meas)
                if prev_center:
                    kf.nudge_velocity(prev_center)
            coast = 0
            prev_center = (kf.x[0], kf.x[1])
        else:
            if kf is None or coast >= max_coast:
                continue  # nothing to coast from; leave as null
            kf.predict()
            coast += 1

        cx, cy, w, h = kf.x[0], kf.x[1], kf.x[2], kf.x[3]
        if w <= 0 or h <= 0:
            continue
        filtered = Bbox(cx - w / 2, cy - h / 2, w, h)
        det.combinedBbox = filtered
        # Recover frame dims from any region's pixel↔norm ratio if present.
        fw, fh = _frame_dims(det)
        if fw and fh:
            det.combinedCentroid = Point(cx / fw, cy / fh)

    return timeline


def _frame_dims(det: FrameDetection):
    for r in det.regions:
        if r.bbox_norm.w > 0 and r.bbox_norm.h > 0:
            return r.bbox.w / r.bbox_norm.w, r.bbox.h / r.bbox_norm.h
    return None, None


# ─── Interpolation to full frame rate ─────────────────────────────────────────

def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def densify_sparse(sampled: list[FrameDetection], total_frames: int,
                   fps: float, bridge: int = 0) -> list[FrameDetection]:
    """
    Expand a sparse, non-uniform timeline (windowed sampling) to one entry per
    frame WITHOUT interpolating across the gaps between windows.

    Frames that were actually detected keep their detection; frames in the gaps
    become empty detections (no regions, null combined box) — the speed stage
    reads these as "subject absent" and the HUD/shadow simply idle there. This is
    correct for windowed mode: we make no claim about footage we never analysed.

    `bridge` optionally interpolates across gaps up to this many frames wide
    (within a window, `sample_every` leaves small gaps worth bridging); larger
    gaps between windows are left empty.
    """
    by_frame = {d.frame: d for d in sampled}
    if not by_frame:
        return []
    out: list[FrameDetection] = []
    keys = sorted(by_frame)
    for f in range(total_frames):
        if f in by_frame:
            out.append(by_frame[f])
            continue
        # find bracketing detected frames
        lo = _floor_key(keys, f)
        hi = _ceil_key(keys, f)
        can_bridge = (lo is not None and hi is not None
                      and (hi - lo) <= bridge)
        if can_bridge:
            a, b = by_frame[lo], by_frame[hi]
            t = (f - lo) / (hi - lo)
            out.append(_interp_pair(a, b, t, f, fps))
        else:
            out.append(FrameDetection(
                frame=f, timestamp_ms=(f / fps) * 1000.0,
                regions=[], combinedBbox=None, combinedCentroid=None))
    return out


def _floor_key(keys, f):
    prev = None
    for k in keys:
        if k <= f:
            prev = k
        else:
            break
    return prev


def _ceil_key(keys, f):
    for k in keys:
        if k >= f:
            return k
    return None


def _interp_pair(a: FrameDetection, b: FrameDetection, t: float,
                 f: int, fps: float) -> FrameDetection:
    ca, cb = a.combinedCentroid, b.combinedCentroid
    centroid = (Point(_lerp(ca.x, cb.x, t), _lerp(ca.y, cb.y, t))
                if ca and cb else (ca or cb))
    ba, bb = a.combinedBbox, b.combinedBbox
    bbox = (Bbox(_lerp(ba.x, bb.x, t), _lerp(ba.y, bb.y, t),
                 _lerp(ba.w, bb.w, t), _lerp(ba.h, bb.h, t))
            if ba and bb else (ba or bb))
    return FrameDetection(frame=f, timestamp_ms=(f / fps) * 1000.0,
                          regions=a.regions, combinedBbox=bbox,
                          combinedCentroid=centroid)


def interpolate_timeline(sampled: list[FrameDetection], total_frames: int,
                         step: int, fps: float) -> list[FrameDetection]:
    """Expand a timeline sampled every `step` frames to one entry per frame."""
    if step <= 1:
        return sampled
    if not sampled:
        return sampled

    out: list[FrameDetection] = []
    for f in range(total_frames):
        lo = min(f // step, len(sampled) - 1)
        hi = min(lo + 1, len(sampled) - 1)
        t = (f % step) / step
        a, b = sampled[lo], sampled[hi]

        ca, cb = a.combinedCentroid, b.combinedCentroid
        centroid = (
            Point(_lerp(ca.x, cb.x, t), _lerp(ca.y, cb.y, t))
            if ca and cb else (ca or cb)
        )
        ba, bb = a.combinedBbox, b.combinedBbox
        bbox = (
            Bbox(_lerp(ba.x, bb.x, t), _lerp(ba.y, bb.y, t),
                 _lerp(ba.w, bb.w, t), _lerp(ba.h, bb.h, t))
            if ba and bb else (ba or bb)
        )
        out.append(FrameDetection(
            frame=f,
            timestamp_ms=(f / fps) * 1000.0,
            regions=a.regions,        # carry nearest sampled regions
            combinedBbox=bbox,
            combinedCentroid=centroid,
        ))
    return out
