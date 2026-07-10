import type {
  PendulumConfig,
  PendulumState,
  PendulumTrajectory,
  AudioAnalysis,
  Vec2,
} from "../types/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function vec2(x: number, y: number): Vec2 { return { x, y }; }

function len(v: Vec2): number { return Math.sqrt(v.x * v.x + v.y * v.y); }

function normalize(v: Vec2): Vec2 {
  const l = len(v);
  return l > 1e-9 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
}

// ─── Pendulum simulation ──────────────────────────────────────────────────────

/**
 * Simulate a driven pendulum for every frame in the audio analysis.
 *
 * Physics model:
 *   θ̈ = -(g/L)·sin(θ) - b·θ̇ + I(t)
 *
 * where:
 *   θ   = angle from vertical (radians)
 *   g   = gravity (normalised)
 *   L   = pendulum length (normalised)
 *   b   = damping coefficient
 *   I(t)= audio impulse at frame t (from onset + rms)
 *
 * Both position AND intensity are audio-driven:
 *   - Onset events inject angular velocity (impulses → swings)
 *   - RMS continuously modulates a gentle restoring force offset
 *     so the ball drifts toward louder regions of the screen
 */
export function simulatePendulum(
  config: PendulumConfig,
  audio: AudioAnalysis
): PendulumTrajectory {
  const { pivot, length, damping, mass, gravity, impulseScale } = config;

  let angle    = 0.15;  // small initial displacement so it moves from frame 1
  let angVel   = 0;

  const trajectory: PendulumTrajectory = [];

  for (let frame = 0; frame < audio.length; frame++) {
    const af = audio[frame];

    // ── Audio impulse ──────────────────────────────────────────────────────
    // Onset fires a sharp kick proportional to onset strength
    const impulse = af.onset * impulseScale / mass;

    // RMS adds a slow continuous bias — ball drifts with the energy
    // The bias shifts the effective gravity direction slightly
    const rmsBias = (af.rms - 0.5) * 0.002;

    // ── Equations of motion (Euler integration) ────────────────────────────
    const angAccel =
      -(gravity / length) * Math.sin(angle)  // gravity restoring force
      - damping * angVel                      // air resistance
      + impulse                               // beat kick
      + rmsBias;                              // continuous audio drift

    angVel += angAccel;
    angle  += angVel;

    // Soft clamp angle to ±85° so the ball stays in frame
    const maxAngle = Math.PI * 0.47;
    if (Math.abs(angle) > maxAngle) {
      angle    =  Math.sign(angle) * maxAngle;
      angVel  *= -0.4;  // partial rebound
    }

    // ── Ball position in normalised screen space ───────────────────────────
    const bx = pivot.x + length * Math.sin(angle);
    const by = pivot.y + length * Math.cos(angle);

    // ── Speed and direction ────────────────────────────────────────────────
    const prevAngle = angle - angVel;
    const prevBx = pivot.x + length * Math.sin(prevAngle);
    const prevBy = pivot.y + length * Math.cos(prevAngle);
    const vel = vec2(bx - prevBx, by - prevBy);
    const speed = Math.min(1, len(vel) / 0.02);  // normalise: 0.02 = fast swing

    trajectory.push({
      angle,
      angularVelocity: angVel,
      position: vec2(bx, by),
      speed,
      direction: normalize(vel),
    });
  }

  return trajectory;
}

// ─── Trajectory utilities ─────────────────────────────────────────────────────

/**
 * Return a smoothed version of the trajectory using a simple moving average.
 * Useful for reducing jitter when onset impulses are very spiky.
 */
export function smoothTrajectory(
  traj: PendulumTrajectory,
  windowSize = 3
): PendulumTrajectory {
  const half = Math.floor(windowSize / 2);
  return traj.map((state, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(traj.length - 1, i + half);
    const count = hi - lo + 1;

    let ax = 0, ay = 0, aSpd = 0;
    for (let j = lo; j <= hi; j++) {
      ax   += traj[j].position.x;
      ay   += traj[j].position.y;
      aSpd += traj[j].speed;
    }

    return {
      ...state,
      position: { x: ax / count, y: ay / count },
      speed:    aSpd / count,
    };
  });
}

/**
 * Retime a trajectory to match a different frame count.
 * Used when the audio analysis was done at a different fps than the render.
 */
export function retimeTrajectory(
  traj: PendulumTrajectory,
  targetFrames: number
): PendulumTrajectory {
  if (traj.length === targetFrames) return traj;

  return Array.from({ length: targetFrames }, (_, i) => {
    const t  = (i / (targetFrames - 1)) * (traj.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(traj.length - 1, lo + 1);
    const alpha = t - lo;

    const a = traj[lo];
    const b = traj[hi];

    return {
      angle:           lerp(a.angle, b.angle, alpha),
      angularVelocity: lerp(a.angularVelocity, b.angularVelocity, alpha),
      position: {
        x: lerp(a.position.x, b.position.x, alpha),
        y: lerp(a.position.y, b.position.y, alpha),
      },
      speed:     lerp(a.speed, b.speed, alpha),
      direction: {
        x: lerp(a.direction.x, b.direction.x, alpha),
        y: lerp(a.direction.y, b.direction.y, alpha),
      },
    };
  });
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
