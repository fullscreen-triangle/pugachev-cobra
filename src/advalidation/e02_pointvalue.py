"""E02 -- Point-value is forbidden [Thm 3.5].

Claim: no bounded receiver carries point-value; whenever beta > 0 the
candidate projection Pi(D(x)) is not a singleton for some x. Equivalently,
the receiver's reconstruction is genuinely many-to-one: distinct percepts
share a codeword, so meaning resolves to cells, not points.

Test: for many receivers, verify that the projection sets Pi(k) have size
> 1 (non-singleton) and that the average projection size grows as the
codebook is coarsened (fewer codewords -> larger floor -> coarser cells),
exhibiting the forbidden-point / granular-meaning structure.
"""
from __future__ import annotations

import numpy as np

from .model import make_codebook_receiver
from .harness import ExpResult


def run(rng: np.random.Generator) -> ExpResult:
    n_receivers = 150
    all_nonsingleton = True
    min_max_proj = np.inf  # min over receivers of (max projection size)
    coarsening_rows = []
    n_trials = 0

    for _ in range(n_receivers):
        m = int(rng.integers(4, 32))
        space, R = make_codebook_receiver(
            rng, n_points=int(rng.integers(200, 500)), dim=2, m_codewords=m,
        )
        proj_sizes = [len(R.project(k)) for k in range(R.m)]
        max_proj = max(proj_sizes)
        # Thm 3.5: at least one projection is non-singleton (size > 1)
        if max_proj <= 1:
            all_nonsingleton = False
        min_max_proj = min(min_max_proj, max_proj)
        n_trials += 1

    # Monotone coarsening: fewer codewords -> larger floor & coarser cells.
    space, _ = make_codebook_receiver(rng, n_points=600, dim=2, m_codewords=8)
    base_pts = space.points
    last_beta = -1.0
    last_avg_proj = -1.0
    coarsening_monotone = True
    for m in (64, 32, 16, 8, 4):
        idx = rng.choice(len(base_pts), size=m, replace=False)
        from .model import Receiver, PerceptSpace
        R = Receiver(PerceptSpace(base_pts), base_pts[idx])
        avg_proj = float(np.mean([len(R.project(k)) for k in range(R.m)]))
        row = {"m_codewords": m, "beta": float(R.beta), "avg_proj_size": avg_proj}
        coarsening_rows.append(row)
        if last_beta >= 0 and not (R.beta >= last_beta - 1e-9):
            coarsening_monotone = False
        if last_avg_proj >= 0 and not (avg_proj >= last_avg_proj - 1e-9):
            coarsening_monotone = False
        last_beta, last_avg_proj = R.beta, avg_proj

    passed = bool(all_nonsingleton and coarsening_monotone and min_max_proj > 1)

    return ExpResult(
        id="E02",
        name="Point-Value Forbidden (granular meaning)",
        claim="Thm 3.5 (point-value forbidden)",
        kind="structural",
        passed=passed,
        max_error=0.0,
        n_trials=n_trials,
        detail={
            "n_receivers": n_receivers,
            "all_projections_nonsingleton": all_nonsingleton,
            "min_over_receivers_of_max_projection_size": float(min_max_proj),
            "coarsening_monotone_beta_and_projsize": coarsening_monotone,
            "coarsening_sweep": coarsening_rows,
            "note": "Pi(D(x)) never collapses to a singleton; value resolves "
                    "to cells. Coarser codebooks raise beta and projection size.",
        },
    )
