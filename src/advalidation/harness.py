"""Result records and JSON persistence for the validation suite.

Each experiment returns an :class:`ExpResult`. The harness writes one JSON
file per experiment into ``src/advalidation/data/`` and an aggregate
``master_results.json``. Output is deterministic given the fixed seed.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent / "data"
SEED = 20260613  # fixed for reproducibility


@dataclass
class ExpResult:
    """A single experiment's outcome.

    Attributes
    ----------
    id : short experiment id, e.g. "E01".
    name : human-readable title.
    claim : the theorem/corollary verified (paper label).
    kind : "identity" | "bound" | "boundary" | "structural".
    passed : whether the predicted relation held within tolerance.
    max_error : worst-case discrepancy on identity/bound checks (0 if N/A).
    n_trials : number of independent cases tested.
    detail : free-form, JSON-serialisable evidence.
    """

    id: str
    name: str
    claim: str
    kind: str
    passed: bool
    max_error: float = 0.0
    n_trials: int = 0
    detail: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["max_error"] = _finite(self.max_error)
        return d


def _finite(x: float) -> float:
    """JSON cannot encode inf/nan; map them to a sentinel string-safe float."""
    if x is None:
        return 0.0
    if isinstance(x, (int, float)) and (math.isinf(x) or math.isnan(x)):
        return 1e308 if x > 0 else (-1e308 if x < 0 else 0.0)
    return float(x)


def _sanitize(obj: Any) -> Any:
    """Recursively make a structure JSON-safe (handle inf/nan, numpy types)."""
    import numpy as np

    if isinstance(obj, dict):
        return {str(k): _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return _finite(float(obj))
    if isinstance(obj, np.ndarray):
        return _sanitize(obj.tolist())
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, float):
        return _finite(obj)
    return obj


def write_result(result: ExpResult) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / f"{result.id.lower()}.json"
    payload = _sanitize(result.to_dict())
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


def write_master(results: list[ExpResult], elapsed_s: float) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / "master_results.json"
    payload = {
        "suite": "Coordinate Theory of Advertising -- numerical validation",
        "paper": "publications/advertising-coordinate-receivers/"
                 "advertising-coordinate-receiverts.tex",
        "seed": SEED,
        "n_experiments": len(results),
        "n_passed": sum(1 for r in results if r.passed),
        "all_passed": all(r.passed for r in results),
        "elapsed_seconds": round(elapsed_s, 4),
        "experiments": [_sanitize(r.to_dict()) for r in results],
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path
