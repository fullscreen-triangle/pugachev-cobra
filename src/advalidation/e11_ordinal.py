"""E11 -- Ordinal Detectability of Incoherence [Cor 7.5].

Claim: coherence is decidable from ordinal data alone -- only the SIGN of each
pairwise support relation (does effect j reinforce or undercut effect i's
shift toward the target cell?), never a magnitude. An automated critic can flag
an incoherent advert (effects pulling toward different cells, or lacking a
supporting triangle) without estimating any catalytic power.

This is the resolution adopted for the DSL assessor: a chain is valid iff its
effects cohere onto a single implied terminus, checkable from signs only.

Model: each effect has a shift *direction* in meaning-space (a unit vector
toward the cell it serves). Two effects support each other iff their
directions agree (positive dot product => same implied terminus). The critic
sees only sign(dot) per pair and must (i) match the magnitude-based verdict,
and (ii) flag chains whose effects imply contradictory termini.
"""
from __future__ import annotations

import numpy as np

from .harness import ExpResult


def _support_sign(u: np.ndarray, v: np.ndarray) -> int:
    return 1 if float(np.dot(u, v)) > 0 else -1


def run(rng: np.random.Generator) -> ExpResult:
    n_cases = 2000
    sign_matches_magnitude = 0
    coherent_detected = 0
    incoherent_detected = 0
    n_coherent = 0
    n_incoherent = 0

    for _ in range(n_cases):
        n_eff = int(rng.integers(3, 6))
        # ground truth: is this a coherent chain (all effects share a terminus)
        coherent = bool(rng.random() < 0.5)
        if coherent:
            base = rng.normal(size=2)
            base /= np.linalg.norm(base) + 1e-12
            dirs = []
            for _ in range(n_eff):
                jitter = base + 0.15 * rng.normal(size=2)
                dirs.append(jitter / (np.linalg.norm(jitter) + 1e-12))
            n_coherent += 1
        else:
            # split effects between two opposing termini
            d1 = rng.normal(size=2); d1 /= np.linalg.norm(d1) + 1e-12
            d2 = -d1 + 0.1 * rng.normal(size=2); d2 /= np.linalg.norm(d2) + 1e-12
            dirs = []
            for k in range(n_eff):
                base = d1 if k % 2 == 0 else d2
                jitter = base + 0.1 * rng.normal(size=2)
                dirs.append(jitter / (np.linalg.norm(jitter) + 1e-12))
            n_incoherent += 1
        dirs = np.array(dirs)

        # ----- magnitude verdict (uses real dot products) -----
        # coherent iff the mean resultant length is high (all point one way)
        resultant = np.linalg.norm(dirs.mean(axis=0))
        mag_verdict = resultant > 0.8

        # ----- ordinal verdict (signs only) -----
        # coherent iff *every* pair has positive support sign (no contradiction)
        signs_all_positive = True
        for a in range(n_eff):
            for b in range(a + 1, n_eff):
                if _support_sign(dirs[a], dirs[b]) < 0:
                    signs_all_positive = False
        ord_verdict = signs_all_positive

        if ord_verdict == mag_verdict:
            sign_matches_magnitude += 1
        # detection accuracy against ground truth
        if coherent and ord_verdict:
            coherent_detected += 1
        if (not coherent) and (not ord_verdict):
            incoherent_detected += 1

    agreement = sign_matches_magnitude / n_cases
    coh_rate = coherent_detected / max(1, n_coherent)
    incoh_rate = incoherent_detected / max(1, n_incoherent)

    # ordinal critic should match the magnitude verdict almost always and
    # reliably flag incoherent chains from signs alone.
    passed = bool(agreement >= 0.95 and incoh_rate >= 0.95)
    return ExpResult(
        id="E11",
        name="Ordinal Detectability of Incoherence",
        claim="Cor 7.5 (incoherence detectable from signs alone)",
        kind="structural",
        passed=passed,
        max_error=float(1.0 - agreement),
        n_trials=n_cases,
        detail={
            "sign_vs_magnitude_agreement_rate": float(agreement),
            "coherent_detection_rate": float(coh_rate),
            "incoherent_detection_rate": float(incoh_rate),
            "n_coherent": n_coherent,
            "n_incoherent": n_incoherent,
            "note": "Sign-only support relations reproduce the magnitude-based "
                    "coherence verdict and reliably flag chains whose effects "
                    "imply contradictory termini -- the DSL assessor needs no "
                    "magnitudes and no meaning dictionary.",
        },
    )
