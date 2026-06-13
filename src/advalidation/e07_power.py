"""E07 -- Catalytic power is bounded [Lem 6.2] and Multiplicative Law [Thm 6.4].

Claims:
  Lem 6.2  : kappa_C(eff) in [0, 1].
  Thm 6.4  : kappa(eff_1 diamond ... diamond eff_n) = 1 - prod_i (1 - kappa_i).

Test (power bound): realise effects as catalysts that close a fraction of the
above-floor distance; measure power directly from the S-functional and verify
it lands in [0,1].

Test (multiplicative): apply a stack of effects sequentially to an initial
above-floor distance; measure the composite power empirically (fraction of
distance closed) and compare to the closed form 1 - prod(1-kappa_i).
"""
from __future__ import annotations

import numpy as np

from .model import composite_power, apply_catalyst
from .harness import ExpResult


def run(rng: np.random.Generator) -> ExpResult:
    # ---- power-bound check ----
    bound_ok = True
    min_pow, max_pow = np.inf, -np.inf
    for _ in range(2000):
        # an effect closes some fraction f of above-floor distance; the
        # *measured* power is exactly that fraction, which must lie in [0,1].
        above = float(rng.uniform(0.1, 90.0))
        f = float(rng.uniform(0.0, 1.0))
        after = apply_catalyst(above, f)
        measured = (above - after) / above  # = f
        min_pow, max_pow = min(min_pow, measured), max(max_pow, measured)
        if measured < -1e-12 or measured > 1 + 1e-12:
            bound_ok = False

    # ---- multiplicative law check ----
    max_err = 0.0
    n_stacks = 500
    for _ in range(n_stacks):
        n = int(rng.integers(1, 8))
        powers = rng.uniform(0.0, 0.95, size=n)
        above0 = float(rng.uniform(1.0, 90.0))
        above = above0
        for k in powers:
            above = apply_catalyst(above, k)  # sequential application
        empirical = (above0 - above) / above0          # measured composite power
        predicted = composite_power(powers)             # 1 - prod(1-k)
        max_err = max(max_err, abs(empirical - predicted))

    passed = bool(bound_ok and max_err <= 1e-12)
    return ExpResult(
        id="E07",
        name="Power Bound & Multiplicative Law",
        claim="Lem 6.2 (kappa in [0,1]) + Thm 6.4 (1 - prod(1-kappa_i))",
        kind="identity",
        passed=passed,
        max_error=float(max_err),
        n_trials=2000 + n_stacks,
        detail={
            "power_in_unit_interval": bound_ok,
            "min_measured_power": float(min_pow),
            "max_measured_power": float(max_pow),
            "n_stacks": n_stacks,
            "max_abs_error_empirical_vs_closed_form": float(max_err),
            "note": "Sequential catalysts multiply residual above-floor distance; "
                    "composite power matches 1 - prod(1-kappa_i) to machine "
                    "precision.",
        },
    )
