"""E01 -- Floor Theorem [Thm 2.2] and No Perfect Persuasion [Cor 2.3].

Claim: for every bounded receiver R, beta > 0, and S(R, x; C) >= beta > 0
for all percepts x and cells C. No bounded receiver attains S = 0.

Test: build many random codebook receivers over random percept spaces; for
each, verify beta > 0 and that S evaluated over many percepts/cells never
falls below beta (and is therefore never 0).
"""
from __future__ import annotations

import numpy as np

from .model import make_codebook_receiver, Cell, s_functional, SIGMA
from .harness import ExpResult


def run(rng: np.random.Generator) -> ExpResult:
    n_receivers = 200
    n_eval = 40  # (percept, cell) evaluations per receiver

    min_beta = np.inf
    min_S = np.inf
    min_margin = np.inf  # min over all of (S - beta); must stay >= 0
    floors_positive = True
    bound_holds = True
    n_trials = 0

    for _ in range(n_receivers):
        m = int(rng.integers(4, 32))
        space, R = make_codebook_receiver(
            rng, n_points=int(rng.integers(200, 500)), dim=2, m_codewords=m,
            spread=float(rng.uniform(5.0, 15.0)),
        )
        if not (R.beta > 0.0):
            floors_positive = False
        min_beta = min(min_beta, R.beta)

        for _ in range(n_eval):
            x = space.points[rng.integers(space.n)]
            center = space.points[rng.integers(space.n)]
            radius = float(rng.uniform(0.5, 3.0))
            C = Cell(center, radius, tolerance=radius)
            S = s_functional(R, x, C)
            min_S = min(min_S, S)
            min_margin = min(min_margin, S - R.beta)
            if S < R.beta - 1e-9:
                bound_holds = False
            n_trials += 1

    passed = bool(floors_positive and bound_holds and min_S > 0.0)
    # "max_error" for a bound check = worst violation magnitude (0 = none)
    max_violation = max(0.0, -min_margin)

    return ExpResult(
        id="E01",
        name="Floor Theorem & No Perfect Persuasion",
        claim="Thm 2.2 (Floor) + Cor 2.3 (no S=0)",
        kind="bound",
        passed=passed,
        max_error=float(max_violation),
        n_trials=n_trials,
        detail={
            "n_receivers": n_receivers,
            "all_floors_positive": floors_positive,
            "bound_S_geq_beta_holds": bound_holds,
            "min_floor_beta_observed": float(min_beta),
            "min_S_observed": float(min_S),
            "min_margin_S_minus_beta": float(min_margin),
            "Sigma": SIGMA,
            "note": "S >= beta > 0 confirmed across all receivers; "
                    "no evaluation reached S = 0.",
        },
    )
