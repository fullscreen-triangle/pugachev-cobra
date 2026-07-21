"""
Vibrio-backed pre-pass for the Isle of Man TT composition.

Emits a language-agnostic bundle consumed by the Remotion compositor:
  * measurements.json  — detections, Kalman tracks, speed (relative + km/h), shadow
  * flow.mp4 / energy.mp4 — optional vibrio pixel-effect layers

Public entry: `prepass.run.run(video_path, out_dir, PrepassConfig)`  or  `python -m prepass.run`.
"""

from .config import (PrepassConfig, DetectorConfig, SpeedConfig, ShadowConfig,
                     CalibrationConfig, LayerConfig)
from .run import run

__all__ = [
    "run",
    "PrepassConfig", "DetectorConfig", "SpeedConfig", "ShadowConfig",
    "CalibrationConfig", "LayerConfig",
]
