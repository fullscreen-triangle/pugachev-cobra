"""E09 -- Campaign Saturation [Thm 6.8] (Borel-Cantelli dichotomy).

Claim: a campaign applying distinct effects with powers (kappa_i) drives
residual above-floor distance to 0 (saturates the cell) iff sum_i kappa_i
diverges.

Test: run four canonical power sequences to a large horizon and read off the
residual fraction prod(1-kappa_i):
  * constant   kappa_i = c          -> sum diverges -> residual -> 0  (saturates)
  * harmonic   kappa_i = 1/i        -> sum diverges -> residual -> 0  (saturates)
  * geometric  kappa_i = 2^{-i}     -> sum converges -> residual > 0  (no sat.)
  * p-series   kappa_i = 1/i^2      -> sum converges -> residual > 0  (no sat.)
Verify the dichotomy: divergent-sum sequences hit (numerical) zero residual,
convergent-sum sequences leave residual bounded away from zero.
"""
from __future__ import annotations

import numpy as np

from .harness import ExpResult


def _residual(powers: np.ndarray) -> float:
    # prod(1 - kappa_i), computed in log-space for stability
    p = np.clip(powers, 0.0, 1.0 - 1e-18)
    return float(np.exp(np.sum(np.log1p(-p))))


def run(rng: np.random.Generator) -> ExpResult:
    N = 100_000
    # Start the index at 2 so that no single term is an absolute catalyst
    # (kappa_i = 1), which would trivially saturate regardless of the tail.
    # The theorem concerns whether the *sum* of powers diverges, so we isolate
    # the tail behaviour by keeping every kappa_i strictly inside (0, 1).
    i = np.arange(2, N + 2, dtype=float)

    seqs = {
        "constant_0.1":   (np.full(N, 0.1),        True),   # sum diverges
        "harmonic_1/i":   (1.0 / i,                True),   # sum diverges
        "geometric_2^-i": (np.power(2.0, -i),      False),  # sum converges
        "p_series_1/i^2": (1.0 / (i * i),          False),  # sum converges
    }

    # The theorem is a limit statement: residual -> 0 iff sum diverges. At a
    # finite horizon, a divergent sum (e.g. harmonic) drives the residual to a
    # vanishing-WITH-N value (~1/N for harmonic), not to machine zero, while a
    # convergent sum plateaus at a positive constant. We therefore detect
    # saturation by the correct asymptotic criterion: does the residual keep
    # shrinking as the horizon grows from N/10 to N? Divergent-sum sequences
    # keep shrinking (ratio << 1); convergent-sum sequences have stopped
    # (ratio ~ 1).
    rows = []
    dichotomy_ok = True
    for name, (powers, sum_diverges) in seqs.items():
        residual = _residual(powers)
        residual_tenth = _residual(powers[: N // 10])  # horizon N/10
        ksum = float(np.sum(powers))
        ksum_tenth = float(np.sum(powers[: N // 10]))
        # shrink ratio: residual(N) / residual(N/10). << 1 => still vanishing.
        shrink = (residual / residual_tenth) if residual_tenth > 0 else 0.0
        still_vanishing = shrink < 0.5      # divergent: residual keeps dropping
        plateaued = shrink > 0.99           # convergent: residual has settled
        saturates = still_vanishing
        rows.append({
            "sequence": name,
            "sum_of_powers_at_N": ksum if np.isfinite(ksum) else 1e308,
            "sum_of_powers_at_N_over_10": ksum_tenth if np.isfinite(ksum_tenth) else 1e308,
            "sum_diverges_predicted": sum_diverges,
            "residual_at_N": residual,
            "residual_at_N_over_10": residual_tenth,
            "shrink_ratio_N_vs_N10": shrink,
            "still_vanishing": still_vanishing,
            "plateaued": plateaued,
            "saturates_observed": saturates,
        })
        # prediction must match the asymptotic behaviour, and the two regimes
        # must be cleanly separated (vanishing XOR plateaued).
        if saturates != sum_diverges:
            dichotomy_ok = False
        if sum_diverges and not still_vanishing:
            dichotomy_ok = False
        if (not sum_diverges) and not plateaued:
            dichotomy_ok = False

    passed = bool(dichotomy_ok)
    return ExpResult(
        id="E09",
        name="Campaign Saturation (Borel-Cantelli dichotomy)",
        claim="Thm 6.8 (saturate iff sum kappa_i = infinity)",
        kind="boundary",
        passed=passed,
        max_error=0.0,
        n_trials=len(seqs),
        detail={
            "horizon_N": N,
            "sequences": rows,
            "dichotomy_holds": dichotomy_ok,
            "saturation_criterion": "residual keeps vanishing as horizon grows "
                                    "(shrink ratio N/10 -> N below 0.5) for "
                                    "divergent sums; plateaus (ratio > 0.99) for "
                                    "convergent sums",
            "note": "Divergent-sum power sequences drive residual toward 0 in "
                    "the limit (still vanishing at the horizon); convergent-sum "
                    "sequences stall above the floor. Long-run effectiveness "
                    "needs non-summable fresh routes.",
        },
    )
