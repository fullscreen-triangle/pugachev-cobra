import type {
  AudioAnalysis,
  DeformationConfig,
  DeformationFrame,
  DeformationTimeline,
  PendulumTrajectory,
  RippleRing,
  Vec2,
} from "../types/index.js";

// ─── Timeline builder ─────────────────────────────────────────────────────────

/**
 * Combine the audio analysis and pendulum trajectory into a per-frame
 * DeformationTimeline ready for the shader/CSS renderer.
 *
 * This is the pre-computation step — run it once before rendering.
 */
export function buildDeformationTimeline(
  audio: AudioAnalysis,
  trajectory: PendulumTrajectory,
  config: DeformationConfig
): DeformationTimeline {
  const frameCount = Math.min(audio.length, trajectory.length);
  const timeline: DeformationTimeline = [];

  // Live ripple rings pool — rings are born on onsets, die when amplitude < threshold
  const activeRings: RippleRing[] = [];

  for (let frame = 0; frame < frameCount; frame++) {
    const af   = audio[frame];
    const traj = trajectory[frame];

    // ── Spawn new ripple ring on onset ─────────────────────────────────────
    if (af.onset > 0.25) {
      activeRings.push({
        origin:     { ...traj.position },
        radius:     0,
        amplitude:  af.onset * config.waveRipple.amplitude,
        birthFrame: frame,
      });
    }

    // ── Advance all active rings ───────────────────────────────────────────
    const ringsSnapshot: RippleRing[] = [];
    for (let r = activeRings.length - 1; r >= 0; r--) {
      activeRings[r].radius    += config.waveRipple.propagationSpeed;
      activeRings[r].amplitude *= config.waveRipple.decay;

      if (activeRings[r].amplitude > 0.001) {
        ringsSnapshot.push({ ...activeRings[r] });
      } else {
        activeRings.splice(r, 1);
      }
    }

    // ── Intensity = audio rms × speed (both drive depth) ──────────────────
    // Using the multiplicative model from the MEE paper:
    // intensity = 1 - (1 - rms_contribution)(1 - speed_contribution)
    const rmsContrib   = af.rms;
    const speedContrib = traj.speed;
    const intensity    = 1 - (1 - rmsContrib) * (1 - speedContrib * 0.6);

    timeline.push({
      ballPosition:   { ...traj.position },
      intensity:      clamp01(intensity),
      smearDirection: { ...traj.direction },
      speed:          traj.speed,
      rippleRings:    ringsSnapshot,
      audio:          af,
    });
  }

  return timeline;
}

// ─── Per-pixel displacement functions ────────────────────────────────────────
//
// These are called by both the WebGL shader (as GLSL translations) and the
// CPU fallback. Kept here as the authoritative reference implementation.

/**
 * Radial bulge displacement at pixel (px, py) given ball at (bx, by).
 * Returns a displacement vector in normalised screen space.
 */
export function radialBulgeDisplacement(
  px: number, py: number,   // pixel position, normalised
  bx: number, by: number,   // ball position, normalised
  intensity: number,
  radius: number,
  maxDisplacement: number,
  falloff: number
): Vec2 {
  const dx = px - bx;
  const dy = py - by;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist >= radius || dist < 1e-9) return { x: 0, y: 0 };

  const t = 1 - dist / radius;
  const strength = Math.pow(t, falloff) * intensity * maxDisplacement;
  const invDist = 1 / dist;

  // Push pixels away from the ball centre (outward bulge)
  return {
    x: dx * invDist * strength,
    y: dy * invDist * strength,
  };
}

/**
 * Directional smear displacement — drags pixels in the direction of travel.
 * Creates a motion-blur-like trail behind the ball.
 */
export function smearDisplacement(
  px: number, py: number,
  bx: number, by: number,
  dirX: number, dirY: number,   // ball direction unit vector
  speed: number,
  intensity: number,
  smearLength: number,
  softness: number,
  influenceRadius: number       // same as bulge radius for consistency
): Vec2 {
  const dx = px - bx;
  const dy = py - by;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist >= influenceRadius * 1.5) return { x: 0, y: 0 };

  // Project pixel offset onto the direction of travel
  const projOnDir = dx * dirX + dy * dirY;

  // Only affect pixels in the trail (behind the ball)
  if (projOnDir < -smearLength || projOnDir > 0) return { x: 0, y: 0 };

  // Lateral falloff (perpendicular to direction)
  const perpX  = dx - projOnDir * dirX;
  const perpY  = dy - projOnDir * dirY;
  const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
  const lateralT = 1 - perpDist / (influenceRadius * 0.5);

  if (lateralT <= 0) return { x: 0, y: 0 };

  // Longitudinal falloff (fades over smear length)
  const longT  = (projOnDir + smearLength) / smearLength; // 0 at tail, 1 at ball
  const soft   = Math.pow(Math.max(0, lateralT), 1 / Math.max(softness, 0.01));
  const strength = soft * longT * speed * intensity * smearLength;

  return {
    x: dirX * strength,
    y: dirY * strength,
  };
}

/**
 * Wave ripple displacement from a single ring.
 */
export function rippleDisplacement(
  px: number, py: number,
  ring: RippleRing,
  thickness: number
): Vec2 {
  const dx   = px - ring.origin.x;
  const dy   = py - ring.origin.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Pixel is on the ring if dist ≈ ring.radius ± thickness/2
  const delta = Math.abs(dist - ring.radius);
  if (delta > thickness / 2 || dist < 1e-9) return { x: 0, y: 0 };

  // Bell-curve profile across ring thickness
  const t        = 1 - (delta / (thickness / 2));
  const profile  = t * t * (3 - 2 * t);  // smoothstep
  const strength = profile * ring.amplitude;
  const invDist  = 1 / dist;

  // Ripple pushes radially outward
  return {
    x: dx * invDist * strength,
    y: dy * invDist * strength,
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
