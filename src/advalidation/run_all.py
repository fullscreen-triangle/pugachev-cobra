"""Run the full advertising-theory validation suite and persist JSON.

Usage (from the repository root):

    python -m advalidation.run_all          # if src/ is on sys.path
    python src/advalidation/run_all.py       # direct

Writes one ``data/eNN.json`` per experiment and ``data/master_results.json``.
Deterministic given the fixed seed in :mod:`advalidation.harness`.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import numpy as np

# allow running as a plain script: ensure the package's parent (src/) is importable
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from advalidation.harness import SEED, write_result, write_master, ExpResult  # noqa: E402
from advalidation import (  # noqa: E402
    e01_floor, e02_pointvalue, e03_celltruth, e04_repinvariance,
    e05_decoderlocus, e06_decoupling, e07_power, e08_diminishing,
    e09_saturation, e10_coherence, e11_ordinal,
)

EXPERIMENTS = [
    e01_floor.run,
    e02_pointvalue.run,
    e03_celltruth.run,
    e04_repinvariance.run,
    e05_decoderlocus.run,
    e06_decoupling.run,
    e07_power.run,
    e08_diminishing.run,
    e09_saturation.run,
    e10_coherence.run,
    e11_ordinal.run,
]


def main() -> int:
    t0 = time.perf_counter()
    results: list[ExpResult] = []

    print(f"Coordinate Theory of Advertising -- validation suite (seed={SEED})")
    print("=" * 68)
    for run_fn in EXPERIMENTS:
        # each experiment gets its own independent, seed-derived RNG stream so
        # results are deterministic and order-independent.
        rng = np.random.default_rng(SEED + len(results) * 101)
        res = run_fn(rng)
        results.append(res)
        write_result(res)
        flag = "PASS" if res.passed else "FAIL"
        err = f"max_err={res.max_error:.2e}" if res.kind in ("identity", "bound") else ""
        print(f"  [{flag}] {res.id}  {res.name:<48} {err}")

    elapsed = time.perf_counter() - t0
    master = write_master(results, elapsed)

    n_pass = sum(r.passed for r in results)
    print("=" * 68)
    print(f"  {n_pass}/{len(results)} passed in {elapsed:.3f}s")
    print(f"  master: {master}")
    return 0 if n_pass == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
