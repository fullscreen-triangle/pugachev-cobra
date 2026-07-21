"""
Pre-pass orchestrator + CLI.

Runs the vibrio-backed analysis over any video and emits the outputs the Remotion
compositor consumes:

    measurements.json   detections + Kalman-smoothed tracks + speed + shadow
    flow.mp4            (optional) optical-flow visualisation layer
    energy.mp4         (optional) motion-energy / neuromorphic layer

Usage:
    python -m prepass.run --video footage/clip.mp4 --out out/ \
        --fps 30 --sample 2 --detach 45 --ppm 12.5

    --ppm  pixels-per-metre for calibrated km/h (omit for relative 0–100)
    --no-flow / --no-energy   skip a pixel layer
    --no-vibrio               force the ultralytics/fallback path

The command is fully cross-platform; all paths go through pathlib.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Windows consoles default to cp1252; our progress output uses unicode. Force
# UTF-8 so prints don't crash the run on a codec error.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except Exception:
        pass

from .config import (PrepassConfig, DetectorConfig, SpeedConfig, ShadowConfig,
                     CalibrationConfig, LayerConfig)
from .schema import PrepassBundle, PrepassMeta
from . import video, detect, track, speed, shadow, layers, beats


def run(video_path: str, out_dir: str, cfg: PrepassConfig) -> PrepassBundle:
    src = Path(video_path)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    info = video.probe(str(src), fallback_fps=cfg.fps)
    fps = info.fps or cfg.fps
    W, H = info.width, info.height
    print(f"\nTT pre-pass")
    print(f"  video:  {src}  ({W}x{H} @ {fps:.3f}fps, {info.total_frames} frames)")
    print(f"  out:    {out}")
    print(f"  sample: every {cfg.sample_every}\n")

    # ── Detection (sampled, downscaled) ───────────────────────────────────────
    # Detect on downscaled frames (memory + speed); report coords in the
    # downscaled space so bbox_norm stays correct. meta keeps full-res dims.
    dw = cfg.detector.detect_width
    det_w = min(dw, W) if dw else W
    det_h = round(H * det_w / W)
    print(f"Detecting rider + bike…  (at {det_w}x{det_h})")
    if cfg.window.enabled:
        print(f"  windowed: {cfg.window.length_s}s every {cfg.window.period_s}s")
        sampled = list(video.iter_windows(
            str(src), cfg.window.period_s, cfg.window.length_s, fps,
            step=cfg.sample_every, max_width=dw))
    else:
        sampled = list(video.iter_sampled(str(src), cfg.sample_every, max_width=dw))

    def prog(i, n):
        if i % 10 == 0 or i == n:
            sys.stdout.write(f"\r  detecting {i}/{n}   ")
            sys.stdout.flush()

    det_timeline, backend_name, used_vibrio = detect.detect_frames(
        sampled, fps, det_w, det_h, cfg.detector, cfg.use_vibrio, on_progress=prog)
    print(f"\n  backend: {backend_name}")

    # ── Track (smooth + coast) ────────────────────────────────────────────────
    print("Smoothing tracks (Kalman)…")
    det_timeline = track.smooth_tracks(det_timeline)

    total_frames = info.total_frames or (
        det_timeline[-1].frame + 1 if det_timeline else 0)

    # ── Expand to full frame rate ─────────────────────────────────────────────
    # Windowed mode is deliberately NOT densified: the product there is one peak
    # measurement per window (see beats below), not a re-inflated per-frame track.
    if not cfg.window.enabled and cfg.sample_every > 1:
        det_timeline = track.interpolate_timeline(
            det_timeline, total_frames, cfg.sample_every, fps)

    # ── Speed ─────────────────────────────────────────────────────────────────
    print("Estimating speed…")
    speeds = speed.estimate_speed(det_timeline, fps, cfg.speed,
                                  cfg.calibration, W, H)

    # ── Beats: one measurement per sampling window ────────────────────────────
    beat_list = []
    if cfg.window.enabled:
        print(f"Reducing to beats (peak per {cfg.window.period_s:g}s)…")
        beat_list = beats.reduce_to_beats(
            det_timeline, speeds, fps, cfg.window.period_s)
        print(f"  {len(beat_list)} beats")

    # ── Shadow physics ────────────────────────────────────────────────────────
    print("Building shadow timeline…")
    shadows = shadow.simulate_shadow(det_timeline, cfg.shadow,
                                     total_frames or len(det_timeline))

    # ── Pixel layers ──────────────────────────────────────────────────────────
    layer_map: dict[str, str] = {}
    if cfg.layers.flow:
        print("Rendering optical-flow layer…")
        p = layers.render_flow(video.iter_frames(str(src)),
                               str(out / cfg.layers.flow_name), fps, W, H)
        if p:
            layer_map["flow"] = cfg.layers.flow_name
    if cfg.layers.energy:
        print("Rendering motion-energy layer…")
        p = layers.render_energy(video.iter_frames(str(src)),
                                 str(out / cfg.layers.energy_name), fps, W, H,
                                 cfg.layers.mhi_duration, cfg.layers.event_threshold)
        if p:
            layer_map["energy"] = cfg.layers.energy_name

    # ── Assemble bundle ───────────────────────────────────────────────────────
    meta = PrepassMeta(
        source=str(src),
        frame_width=W, frame_height=H, fps=fps,
        total_frames=total_frames or len(det_timeline),
        sample_every=cfg.sample_every,
        detector=backend_name,
        calibrated=cfg.calibration.px_per_meter is not None,
        px_per_meter=cfg.calibration.px_per_meter,
        vibrio=used_vibrio,
        layers=layer_map,
    )
    bundle = PrepassBundle(meta=meta, detections=det_timeline,
                           speeds=speeds, shadows=shadows,
                           beats=beats.beats_to_dicts(beat_list))

    out_json = out / "measurements.json"
    out_json.write_text(json.dumps(bundle.to_dict(), indent=2))
    print(f"\nDone.")
    print(f"  {len(det_timeline)} detection frames")
    print(f"  {len(speeds)} speed frames")
    print(f"  {len(shadows)} shadow frames")
    print(f"  {len(beat_list)} beats")
    print(f"  layers: {', '.join(layer_map) or 'none'}")
    print(f"  → {out_json}")
    return bundle


# ─── CLI ──────────────────────────────────────────────────────────────────────

def _parse_args(argv=None):
    p = argparse.ArgumentParser(description="Vibrio TT pre-pass")
    p.add_argument("--video", required=True)
    p.add_argument("--out", default="out")
    p.add_argument("--fps", type=float, default=30.0)
    p.add_argument("--sample", type=int, default=2)
    p.add_argument("--detach", type=int, default=30)
    p.add_argument("--ppm", type=float, default=None,
                   help="pixels per metre for calibrated km/h")
    p.add_argument("--conf", type=float, default=0.30)
    p.add_argument("--device", default="cpu")
    p.add_argument("--model", default="yolov8n.pt")
    p.add_argument("--window", action="store_true",
                   help="windowed sampling — short bursts across the film")
    p.add_argument("--window-period", type=float, default=20.0,
                   help="seconds between window starts (default 20)")
    p.add_argument("--window-length", type=float, default=2.0,
                   help="seconds per window (default 2)")
    p.add_argument("--no-flow", action="store_true")
    p.add_argument("--no-energy", action="store_true")
    p.add_argument("--no-vibrio", action="store_true")
    return p.parse_args(argv)


def main(argv=None):
    a = _parse_args(argv)
    from .config import WindowConfig
    cfg = PrepassConfig(
        fps=a.fps,
        sample_every=a.sample,
        window=WindowConfig(enabled=a.window, period_s=a.window_period,
                            length_s=a.window_length),
        detector=DetectorConfig(model=a.model, conf_threshold=a.conf, device=a.device),
        speed=SpeedConfig(),
        shadow=ShadowConfig(detachFrame=a.detach),
        calibration=CalibrationConfig(px_per_meter=a.ppm),
        layers=LayerConfig(flow=not a.no_flow, energy=not a.no_energy),
        use_vibrio=not a.no_vibrio,
    )
    run(a.video, a.out, cfg)


if __name__ == "__main__":
    main()
