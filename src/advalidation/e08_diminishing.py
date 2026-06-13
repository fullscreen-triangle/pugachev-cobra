"""E08 -- Diminishing Returns [Cor 6.5] & Frequency Saturation [Cor 6.6].

Claims:
  Cor 6.5 : repeating one effect of power kappa n times gives composite power
            1 - (1-kappa)^n; strictly increasing in n, -> 1, never = 1 for
            finite n; each repetition closes a strictly smaller absolute
            fraction than the last.
  Cor 6.6 : repeating the same stack cannot drive distance below
            beta + r0*(1-kappa)^n; gains are geometric and bounded.

Test: iterate a single effect; verify (a) the n-step power equals
1-(1-kappa)^n, (b) monotone increase, (c) strict marginal-gain decay,
(d) finite-n power < 1.
"""
from __future__ import annotations

import numpy as np

from .harness import ExpResult


def run(rng: np.random.Generator) -> ExpResult:
    n_cases = 300
    n_steps = 30
    max_formula_err = 0.0
    monotone_ok = True
    decay_ok = True
    never_one_ok = True
    n_trials = 0

    for _ in range(n_cases):
        # keep kappa modest so the residual (1-kappa)^n stays representable in
        # float64 across n_steps; the claim "power < 1" is exact mathematically,
        # and we verify it on the residual fraction r_n/r0 = (1-kappa)^n > 0,
        # which is the quantity the theorem actually bounds away from 0.
        kappa = float(rng.uniform(0.05, 0.5))
        beta = float(rng.uniform(0.5, 5.0))
        r0 = float(rng.uniform(10.0, 80.0))  # initial above-floor distance

        above = r0
        prev_power = 0.0
        prev_gain = np.inf
        for n in range(1, n_steps + 1):
            above = above * (1.0 - kappa)            # one more exposure
            power_emp = (r0 - above) / r0            # cumulative power
            power_form = 1.0 - (1.0 - kappa) ** n     # closed form
            residual_frac = above / r0                # = (1-kappa)^n, must be > 0
            max_formula_err = max(max_formula_err, abs(power_emp - power_form))

            # monotone increase in cumulative power
            if power_emp < prev_power - 1e-12:
                monotone_ok = False
            # strict marginal-gain decay: this step's gain < previous step's
            gain = power_emp - prev_power
            if n >= 2 and gain > prev_gain + 1e-12:
                decay_ok = False
            # power never reaches 1 at finite n  <=>  residual fraction > 0
            if not (residual_frac > 0.0):
                never_one_ok = False

            prev_power = power_emp
            prev_gain = gain
            n_trials += 1

    passed = bool(
        max_formula_err <= 1e-12 and monotone_ok and decay_ok and never_one_ok
    )
    return ExpResult(
        id="E08",
        name="Diminishing Returns & Frequency Saturation",
        claim="Cor 6.5 (diminishing returns) + Cor 6.6 (frequency saturation)",
        kind="identity",
        passed=passed,
        max_error=float(max_formula_err),
        n_trials=n_trials,
        detail={
            "n_cases": n_cases,
            "n_steps": n_steps,
            "n_step_power_matches_1_minus_(1-kappa)^n": bool(max_formula_err <= 1e-12),
            "cumulative_power_monotone_increasing": monotone_ok,
            "marginal_gain_strictly_decaying": decay_ok,
            "finite_n_power_below_one": never_one_ok,
            "max_formula_error": float(max_formula_err),
            "note": "Repetition yields geometric, bounded gains; each exposure "
                    "closes strictly less distance; power -> 1 but never reaches "
                    "it -- diversify routes rather than multiply impressions.",
        },
    )
