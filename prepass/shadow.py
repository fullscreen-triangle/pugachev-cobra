"""
Shadow physics pass.

Mirrors the TS `simulateShadowPhysics`: before `detachFrame` the shadow tracks
the rider (zero offset, full opacity); at detach it snapshots the combined box;
after, it integrates a simple ballistic trajectory (gravity + drag) while opacity
and scale decay. The renderer freezes the actual shadow *pixels* at the detach
frame — here we only produce the per-frame transform the compositor applies.

`maskBbox` is emitted in pixel space, matching what ShadowCompositor normalises.
"""

from __future__ import annotations

from .schema import ShadowPhysicsFrame, Point, Bbox, FrameDetection
from .config import ShadowConfig


def simulate_shadow(timeline: list[FrameDetection], cfg: ShadowConfig,
                    total_frames: int) -> list[ShadowPhysicsFrame]:
    frames: list[ShadowPhysicsFrame] = []

    vx = cfg.detachVelocity_x
    vy = cfg.detachVelocity_y
    ox = oy = 0.0
    opacity = cfg.initialOpacity
    scale = 1.0

    detach_det = _at(timeline, cfg.detachFrame)
    detach_bbox = detach_det.combinedBbox if detach_det else None

    for f in range(total_frames):
        det = _at(timeline, f)

        if f < cfg.detachFrame:
            frames.append(ShadowPhysicsFrame(
                offset=Point(0.0, 0.0),
                opacity=cfg.initialOpacity,
                scale=1.0,
                maskBbox=det.combinedBbox if det else None,
            ))
            continue

        if f == cfg.detachFrame:
            frames.append(ShadowPhysicsFrame(
                offset=Point(0.0, 0.0),
                opacity=opacity,
                scale=scale,
                maskBbox=detach_bbox,
            ))
            continue

        # Euler integration
        vy += cfg.gravity
        vx *= (1 - cfg.drag)
        vy *= (1 - cfg.drag)
        ox += vx
        oy += vy
        opacity = max(0.0, opacity - cfg.opacityDecay)
        scale *= cfg.scaleDecay

        frames.append(ShadowPhysicsFrame(
            offset=Point(round(ox, 5), round(oy, 5)),
            opacity=round(opacity, 4),
            scale=round(scale, 4),
            maskBbox=detach_bbox,
        ))

    return frames


def _at(timeline: list[FrameDetection], f: int):
    if not timeline:
        return None
    return timeline[min(f, len(timeline) - 1)]
