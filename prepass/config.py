"""
Pre-pass configuration.

Defaults here mirror the TS-side `DEFAULT_SHADOW` so that the physics baked into
`shadows[]` at pre-pass time matches what the renderer would compute live. Keep
the two in sync.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class ShadowConfig:
    """Ballistic parameters for the detaching-shadow effect."""
    detachFrame: int = 30
    detachVelocity_x: float = 0.004    # normalised screen units / frame
    detachVelocity_y: float = -0.010   # negative = upward launch
    gravity: float = 0.0009            # added to vy each frame
    drag: float = 0.02                 # velocity *= (1 - drag) each frame
    initialOpacity: float = 0.55
    opacityDecay: float = 0.006        # subtracted from opacity each frame
    scaleDecay: float = 0.997          # scale *= this each frame


@dataclass
class SpeedConfig:
    smooth_window: int = 10            # causal moving-average window, frames
    jitter_threshold: float = 0.003    # normalised min displacement to register
    hold_frames: int = 6               # frames to hold last speed on lost track


@dataclass
class DetectorConfig:
    model: str = "yolov8n.pt"          # ultralytics weight; auto-downloaded
    conf_threshold: float = 0.30
    device: str = "cpu"                # "cpu" | "cuda" | "0"
    # COCO classes we keep, mapped to our labels.
    targets: tuple = ("person", "motorcycle")
    # Downscale sampled frames to this width before detection. 4K buys an advert
    # detector nothing and blows up memory; normalised coords stay resolution-
    # independent. None = detect at native resolution.
    detect_width: int = 1280


@dataclass
class CalibrationConfig:
    """
    Pixel-to-metre calibration for real km/h. If `px_per_meter` is None the speed
    stays a relative 0–100 readout (vibrio's documented approximate mode).
    """
    px_per_meter: Optional[float] = None


@dataclass
class LayerConfig:
    """Which pixel-level video layers to render, and how."""
    flow: bool = True                  # Farneback optical-flow visualisation
    energy: bool = True                # motion-energy / neuromorphic
    flow_name: str = "flow.mp4"
    energy_name: str = "energy.mp4"
    # MHI decay: higher = longer motion trails.
    mhi_duration: float = 0.75         # seconds of history retained
    # Neuromorphic event threshold on per-pixel luminance delta [0,1].
    event_threshold: float = 0.06


@dataclass
class WindowConfig:
    """
    Windowed sampling — analyse short bursts spread across the film rather than
    the whole thing. Keeps memory/time bounded on long or high-res clips.
    Set `enabled=False` to process the entire clip.
    """
    enabled: bool = False
    period_s: float = 30.0             # start a new window every N seconds
    length_s: float = 3.0              # each window is this many seconds long


@dataclass
class PrepassConfig:
    fps: float = 30.0
    sample_every: int = 2              # analyse every Nth frame, interpolate rest
    window: WindowConfig = None
    detector: DetectorConfig = None
    speed: SpeedConfig = None
    shadow: ShadowConfig = None
    calibration: CalibrationConfig = None
    layers: LayerConfig = None
    use_vibrio: bool = True            # try to import the real vibrio package

    def __post_init__(self):
        self.window = self.window or WindowConfig()
        self.detector = self.detector or DetectorConfig()
        self.speed = self.speed or SpeedConfig()
        self.shadow = self.shadow or ShadowConfig()
        self.calibration = self.calibration or CalibrationConfig()
        self.layers = self.layers or LayerConfig()
