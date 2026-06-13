"""E04 -- Representational Invariance [Thm 3.7].

Claim: if phi is an isometric bijection of percept space and R' is the
receiver transported along phi, then S(R, x; C) = S(R', phi(x); phi(C)) for
all x, C. Cell-membership and semantic distance survive change of
representation (rotation/translation/reflection of the meaning carrier).

Test: apply random rigid motions phi (rotation + translation, and reflection)
to the whole construction (percepts, codebook, cell, query) and verify S is
preserved to machine precision. This is the formal licence for "color,
rhythm, layout are interchangeable carriers of one meaning".
"""
from __future__ import annotations

import numpy as np

from .model import PerceptSpace, Receiver, Cell, s_functional
from .harness import ExpResult


def _rigid(rng: np.random.Generator, reflect: bool) -> tuple[np.ndarray, np.ndarray]:
    theta = float(rng.uniform(0, 2 * np.pi))
    Rot = np.array([[np.cos(theta), -np.sin(theta)],
                    [np.sin(theta), np.cos(theta)]])
    if reflect:
        Rot = Rot @ np.array([[1.0, 0.0], [0.0, -1.0]])
    t = rng.uniform(-5, 5, size=2)
    return Rot, t


def run(rng: np.random.Generator) -> ExpResult:
    n_cases = 400
    max_err = 0.0
    n_trials = 0

    for i in range(n_cases):
        pts = rng.uniform(-8, 8, size=(300, 2))
        space = PerceptSpace(pts)
        idx = rng.choice(300, size=int(rng.integers(8, 20)), replace=False)
        R = Receiver(space, pts[idx])

        x = pts[rng.integers(300)]
        center = pts[rng.integers(300)]
        radius = float(rng.uniform(1.0, 3.0))
        C = Cell(center, radius, tolerance=radius)
        S_orig = s_functional(R, x, C)

        # transported construction
        Rot, t = _rigid(rng, reflect=(i % 3 == 0))
        pts2 = pts @ Rot.T + t
        space2 = PerceptSpace(pts2)
        R2 = Receiver(space2, pts2[idx])
        x2 = x @ Rot.T + t
        center2 = center @ Rot.T + t
        C2 = Cell(center2, radius, tolerance=radius)
        S_trans = s_functional(R2, x2, C2)

        max_err = max(max_err, abs(S_orig - S_trans))
        n_trials += 1

    passed = bool(max_err <= 1e-9)
    return ExpResult(
        id="E04",
        name="Representational Invariance (isometry preserves S)",
        claim="Thm 3.7 (representational invariance)",
        kind="identity",
        passed=passed,
        max_error=float(max_err),
        n_trials=n_trials,
        detail={
            "transforms": "random rotation + translation; reflection on 1/3 of cases",
            "max_abs_error_S_orig_vs_transported": float(max_err),
            "note": "S is invariant under isometric re-encoding of the carrier; "
                    "meaning lives one level above its representation.",
        },
    )
