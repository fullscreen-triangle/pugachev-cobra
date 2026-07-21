"""
Windowed full-Vibrio runner — one measurement beat per period.

Cuts a short window every `--period` seconds, runs the full Vibrio measurement
stack (prepass.vibrio_full) over each, reduces each window to its peak frame, and
writes a compact `vibrio_beats.json`:

    python -m prepass.run_vibrio --video clip.mp4 --out out/ \
        --vibrio-path C:/tmp/vibrio --period 20 --length 2 \
        --width 640 [--texture]

Windows are cut with ffmpeg (fast seek) and downscaled to --width, because even a
2s window is minutes of CPU at full resolution once the optical suite runs.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

from . import video
from .vibrio_full import load_vibrio, measure_window_clip, FAST_OPTICAL, ALL_OPTICAL


def _cut_window(src: str, start_s: float, length_s: float, width: int,
                dst: str) -> bool:
    cmd = ["ffmpeg", "-y", "-ss", str(start_s), "-t", str(length_s),
           "-i", src, "-an"]
    if width:
        cmd += ["-vf", f"scale={width}:-2"]
    cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", dst]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode == 0 and Path(dst).exists()


def main(argv=None):
    p = argparse.ArgumentParser(description="Windowed full-Vibrio measurement")
    p.add_argument("--video", required=True)
    p.add_argument("--out", default="out")
    p.add_argument("--vibrio-path", default=None)
    p.add_argument("--period", type=float, default=20.0)
    p.add_argument("--length", type=float, default=2.0)
    p.add_argument("--width", type=int, default=0,
                   help="downscale width; 0 = native resolution (default)")
    p.add_argument("--conf", type=float, default=0.3)
    p.add_argument("--device", default="cpu")
    p.add_argument("--no-texture", action="store_true",
                   help="skip the slow texture Gabor method (default: run all)")
    p.add_argument("--max-windows", type=int, default=0,
                   help="cap number of windows (0 = all)")
    a = p.parse_args(argv)

    vib = load_vibrio(a.vibrio_path)
    if vib is None:
        print("ERROR: could not load Vibrio. Pass --vibrio-path to a checkout "
              "or set PREPASS_VIBRIO_PATH.", file=sys.stderr)
        return 2

    info = video.probe(a.video)
    fps = info.fps
    duration_s = (info.total_frames / fps) if fps else 0
    methods = FAST_OPTICAL if a.no_texture else ALL_OPTICAL

    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    clips_dir = out / "windows"; clips_dir.mkdir(exist_ok=True)

    starts = []
    t = 0.0
    while t < duration_s:
        starts.append(t)
        t += a.period
    if a.max_windows:
        starts = starts[:a.max_windows]

    print(f"video: {a.video}  {info.width}x{info.height} @ {fps:.2f}fps  "
          f"{duration_s:.1f}s")
    print(f"windows: {len(starts)}  (every {a.period:g}s, {a.length:g}s each, "
          f"scaled to {a.width}w)")
    print(f"optical methods: {', '.join(methods)}"
          f"{'' if a.no_texture else '  [+texture: SLOW]'}\n")

    beats = []
    for wi, start_s in enumerate(starts):
        clip = str(clips_dir / f"w{wi:03d}.mp4")
        if not _cut_window(a.video, start_s, a.length, a.width, clip):
            print(f"  window {wi}: cut failed, skipping")
            continue
        start_frame = round(start_s * fps)
        print(f"  window {wi} @ {start_s:g}s → measuring…", flush=True)
        wm = measure_window_clip(vib, clip, wi, start_frame, fps,
                                 methods=methods, conf_threshold=a.conf,
                                 device=a.device)
        beats.append(wm.peak)
        pk = wm.peak
        flow = pk.get("optical_flow.mean_flow_magnitude")
        spd = pk.get("speed_kmh")
        print(f"     peak @ frame {pk.get('global_frame')} "
              f"(t={pk.get('t_ms',0)/1000:.2f}s)  "
              f"flow={flow if flow is None else round(flow,3)}  "
              f"speed={spd} km/h")

    out_json = out / "vibrio_beats.json"
    out_json.write_text(json.dumps({
        "meta": {
            "source": a.video, "fps": fps, "duration_s": duration_s,
            "period_s": a.period, "length_s": a.length, "width": a.width,
            "methods": methods, "n_windows": len(beats),
        },
        "beats": beats,
    }, indent=2))
    print(f"\nDone. {len(beats)} beats → {out_json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
