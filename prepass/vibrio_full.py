"""
Full Vibrio measurement stack, per sampling window.

This is the module the "2s every 20s" design is actually for. Rather than running
one cheap detector over the whole film, it runs Vibrio's *complete* measurement
suite over each short window clip:

    detector   -> HumanDetector           person boxes + confidence
    tracker    -> HumanTracker             Kalman tracks, velocity, history
    speed      -> SpeedEstimator           per-track km/h
    physics    -> PhysicsVerifier          physics-plausible speed + confidence
    optical    -> OpticalAnalyzer          5 methods, per-frame:
                    optical_flow      mean/max/std flow magnitude, direction, coherence
                    motion_energy     motion energy, active regions, orientation
                    neuromorphic      event density, polarity ratio
                    texture_analysis  texture score, muscle tension, entropy   [SLOW]
                    shadow_analysis   shadow area, direction, count

Vibrio lives outside this repo. Point PREPASS_VIBRIO_PATH (or --vibrio-path) at a
checkout; we add it to sys.path and import the measurement modules directly. The
package's own __init__ pulls in an LLM/embeddings stack we don't need — if that
import fails we fall back to importing the four measurement modules by file.

Cost note (measured, CPU): the texture Gabor bank is ~100x the others. A 2s @640px
window is seconds without it and minutes with it. `methods` defaults to the four
fast methods; pass include_texture=True to opt into texture.
"""

from __future__ import annotations

import importlib
import importlib.util
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# The four optical methods that run in seconds on a downscaled window. Texture is
# opt-in because its Gabor bank dominates runtime by ~2 orders of magnitude.
FAST_OPTICAL = ["optical_flow", "motion_energy", "neuromorphic", "shadow_analysis"]
ALL_OPTICAL = FAST_OPTICAL + ["texture_analysis"]


# ─── Loading Vibrio from an external checkout ─────────────────────────────────

class VibrioModules:
    """Handles to the four Vibrio measurement classes."""
    def __init__(self, HumanDetector, HumanTracker, SpeedEstimator,
                 PhysicsVerifier, OpticalAnalyzer):
        self.HumanDetector = HumanDetector
        self.HumanTracker = HumanTracker
        self.SpeedEstimator = SpeedEstimator
        self.PhysicsVerifier = PhysicsVerifier
        self.OpticalAnalyzer = OpticalAnalyzer


def load_vibrio(vibrio_path: Optional[str] = None) -> Optional[VibrioModules]:
    """
    Import Vibrio's measurement modules from a checkout. Returns None if Vibrio
    can't be found, so the caller can degrade to the built-in detector path.
    """
    path = vibrio_path or os.environ.get("PREPASS_VIBRIO_PATH")
    if path and path not in sys.path:
        sys.path.insert(0, path)

    def _via_package():
        m = importlib.import_module("modules")
        return VibrioModules(
            m.HumanDetector, m.HumanTracker, m.SpeedEstimator,
            m.PhysicsVerifier, m.OpticalAnalyzer)

    def _via_files():
        # The package __init__ imports an LLM stack (transformers, faiss, ...) we
        # don't need. If that fails, load only the measurement files. They use
        # relative imports, so register a minimal 'modules' package first.
        if not path:
            raise ImportError("no vibrio path for file-level import")
        pkg_dir = Path(path) / "modules"
        pkg = importlib.util.module_from_spec(
            importlib.util.spec_from_loader("modules", loader=None))
        pkg.__path__ = [str(pkg_dir)]
        sys.modules["modules"] = pkg

        def load(name):
            spec = importlib.util.spec_from_file_location(
                f"modules.{name}", str(pkg_dir / f"{name}.py"))
            mod = importlib.util.module_from_spec(spec)
            sys.modules[f"modules.{name}"] = mod
            spec.loader.exec_module(mod)
            return mod

        det = load("detector")
        trk = load("tracker")
        spd = load("speed_estimator")
        phy = load("physics_verifier")
        opt = load("optical_analysis")
        return VibrioModules(det.HumanDetector, trk.HumanTracker,
                             spd.SpeedEstimator, phy.PhysicsVerifier,
                             opt.OpticalAnalyzer)

    for loader in (_via_package, _via_files):
        try:
            return loader()
        except Exception:
            continue
    return None


# ─── Per-window measurement ───────────────────────────────────────────────────

@dataclass
class WindowMeasurement:
    """
    Every Vibrio measurement for one window, plus its peak frame.

    `optical` holds each method's per-frame list exactly as Vibrio returns it.
    `per_frame_speed` is [(frame_idx, km/h)] from tracker+speed+physics.
    `peak` is the single most salient frame's flattened measurement dict — this is
    what a beat carries.
    """
    window_index: int
    start_frame: int
    fps: float
    n_frames: int
    optical: dict = field(default_factory=dict)
    per_frame_speed: list = field(default_factory=list)
    peak: dict = field(default_factory=dict)


def _to_py(v):
    """numpy scalar -> python scalar, for JSON. Leaves everything else alone."""
    try:
        import numpy as np
        if isinstance(v, np.generic):
            return v.item()
    except Exception:
        pass
    return v


def measure_window_clip(vib: VibrioModules, clip_path: str, window_index: int,
                        start_frame: int, fps: float,
                        methods: Optional[list] = None,
                        conf_threshold: float = 0.3,
                        device: str = "cpu") -> WindowMeasurement:
    """
    Run the full Vibrio stack over one already-cut window clip.

    clip_path must be a short video file (the window, ideally downscaled). Returns
    a WindowMeasurement whose `peak` is the flattened measurement dict at the
    window's most salient frame (highest optical-flow magnitude — the sharpest
    burst of motion; falls back to speed, then frame 0).
    """
    import cv2

    methods = methods or FAST_OPTICAL

    # ── optical suite (whole clip in one call) ────────────────────────────────
    outdir = os.path.join(os.environ.get("TEMP", "."), "prepass_vibrio",
                          f"w{window_index}")
    analyzer = vib.OpticalAnalyzer(output_dir=outdir,
                                   visualization_dir=os.path.join(outdir, "vis"))
    optical = analyzer.analyze_video(clip_path, methods=methods,
                                     output_video=False, output_data=False)

    # ── detector + tracker + speed + physics (frame by frame) ─────────────────
    detector = vib.HumanDetector(conf_threshold=conf_threshold, device=device)
    tracker = vib.HumanTracker()
    speed_est = vib.SpeedEstimator()
    verifier = vib.PhysicsVerifier()

    # The tracker/speed/physics chain lives inside Vibrio and can raise on a given
    # frame (e.g. a numpy/filterpy version mismatch in Kalman get_state). Per the
    # "measurements are the art, skip what doesn't work" rule, a frame that throws
    # simply contributes no speed reading — it must not kill the window. The
    # optical suite already ran above and is unaffected.
    per_frame_speed = []
    speed_errors = 0
    cap = cv2.VideoCapture(clip_path)
    fi = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            try:
                dets = detector.detect(frame)
                tracks = tracker.update(dets, fi)
                states = [t.get_state() for t in tracks] if tracks and \
                    hasattr(tracks[0], "get_state") else tracks
                speed_est.estimate(states, fi, fps)
                verifier.verify(states, fps)
                best = max((s.get("speed", 0.0) for s in states), default=0.0)
                per_frame_speed.append((start_frame + fi, float(best)))
            except Exception:
                speed_errors += 1  # skip this frame's speed, keep going
            fi += 1
    finally:
        cap.release()
    if speed_errors:
        print(f"     (speed skipped on {speed_errors}/{fi} frames)", flush=True)

    wm = WindowMeasurement(window_index=window_index, start_frame=start_frame,
                           fps=fps, n_frames=fi, optical=optical,
                           per_frame_speed=per_frame_speed)
    wm.peak = _pick_peak(wm)
    return wm


def _index_by_frame(rows: list) -> dict:
    return {int(r["frame"]): r for r in rows if "frame" in r}


def _pick_peak(wm: WindowMeasurement) -> dict:
    """
    Choose the window's most salient local frame and flatten every method's
    measurement at that frame into one dict. Salience = optical-flow mean
    magnitude (sharpest motion); if flow is absent, use peak speed; else frame 0.
    """
    flow = wm.optical.get("optical_flow", [])
    if flow:
        peak_row = max(flow, key=lambda r: _to_py(r.get("mean_flow_magnitude", 0)) or 0)
        local = int(peak_row["frame"])
    elif wm.per_frame_speed:
        # per_frame_speed is in source-frame space; convert back to local index
        gi = max(wm.per_frame_speed, key=lambda p: p[1])[0]
        local = gi - wm.start_frame
    else:
        local = 0

    global_frame = wm.start_frame + local
    out = {
        "window_index": wm.window_index,
        "local_frame": local,
        "global_frame": global_frame,
        "t_ms": (global_frame / wm.fps) * 1000.0,
    }
    # Flatten every method's row at this local frame.
    for method, rows in wm.optical.items():
        if not isinstance(rows, list):
            continue
        row = _index_by_frame(rows).get(local)
        if row:
            for k, v in row.items():
                if k == "frame":
                    continue
                out[f"{method}.{k}"] = _to_py(v)
    # Speed at (nearest) peak frame.
    if wm.per_frame_speed:
        sp = dict(wm.per_frame_speed).get(global_frame)
        if sp is None:
            sp = max(wm.per_frame_speed, key=lambda p: p[1])[1]
        out["speed_kmh"] = round(float(sp), 2)
    return out
