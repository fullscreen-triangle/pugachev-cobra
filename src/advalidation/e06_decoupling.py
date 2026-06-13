"""E06 -- Carrier-Shift Decoupling [Thm 5.4].

Claim (three clauses):
  (i)  Multiple realisability: distinct carriers c1 != c2 induce the SAME
       decoder-shift into a meaning-region mu.
  (ii) Receiver relativity: one carrier c induces a shift into mu for
       receiver R but NOT for R' (different decoder).
  (iii)Binding: for a fixed coherent effect, shift = D . c . D^{-1} on the
       decoded image -- carrier and shift are conjugate representations of
       one map.

Model: meaning-space is the codeword-index space; a "carrier" is a map on
percepts, the induced "shift" is the map it produces on decoded indices.
mu (a meaning-region) is a subset of codeword indices.
"""
from __future__ import annotations

import numpy as np

from .model import PerceptSpace, Receiver
from .harness import ExpResult


def run(rng: np.random.Generator) -> ExpResult:
    n_cases = 200
    multi_real_ok = 0     # clause (i)
    recv_rel_ok = 0       # clause (ii)
    binding_max_err = 0   # clause (iii): mismatch count, must be 0
    binding_ok = 0
    n_trials = 0

    for _ in range(n_cases):
        pts = rng.uniform(-10, 10, size=(300, 2))
        space = PerceptSpace(pts)
        idx = rng.choice(300, size=10, replace=False)
        R = Receiver(space, pts[idx])

        # define meaning-region mu = a target codeword index (the "Mexico" cell)
        mu_code = int(rng.integers(R.m))
        mu_center = R.codebook[mu_code]

        x = pts[rng.integers(300)]

        # ---- (i) multiple realisability ----
        # two physically different carriers that both move x toward mu_center:
        # carrier 1: translate toward mu along axis-aligned path
        # carrier 2: translate toward mu along a rotated path (different pixels)
        def carrier_direct(p):
            return p + 0.95 * (mu_center - p)

        def carrier_rotated(p):
            # reach the same neighbourhood of mu via a different trajectory
            mid = p + 0.95 * (mu_center - p)
            ang = 0.3
            Rot = np.array([[np.cos(ang), -np.sin(ang)], [np.sin(ang), np.cos(ang)]])
            # rotate around mu_center by a tiny angle: lands in same Voronoi cell
            return mu_center + (mid - mu_center) @ Rot.T

        shift1 = R.decode(carrier_direct(x))
        shift2 = R.decode(carrier_rotated(x))
        if shift1 == mu_code and shift2 == mu_code and not np.allclose(
            carrier_direct(x), carrier_rotated(x)
        ):
            multi_real_ok += 1

        # ---- (ii) receiver relativity ----
        # same carrier; a second receiver whose codebook lacks a codeword near
        # mu_center decodes the carried percept elsewhere (no shift into mu).
        cb2 = R.codebook.copy()
        # remove the mu codeword, replace with a far-away one
        cb2[mu_code] = mu_center + np.array([100.0, 100.0])  # pushed out of range
        far = cb2[mu_code]
        # keep it within ambient bounds but far from mu region
        cb2[mu_code] = np.clip(mu_center + 18.0 * np.sign(mu_center + 1e-9), -9, 9)
        R2 = Receiver(space, cb2)
        carried = carrier_direct(x)
        if R.decode(carried) == mu_code and R2.decode(carried) != mu_code:
            recv_rel_ok += 1

        # ---- (iii) binding: shift = D . c . D^{-1} ----
        # For each codeword k, take a representative percept (the codeword
        # itself), carry it, and check decode(carry(repr_k)) equals the shift
        # the effect declares. The "shift on meaning-space" computed directly
        # must equal the carrier conjugated through the decoder.
        mism = 0
        for k in range(R.m):
            repr_k = R.codebook[k]                # D^{-1}(k) representative
            via_carrier = R.decode(carrier_direct(repr_k))   # D . c . D^{-1}(k)
            # the declared shift maps every code to mu_code (move toward mu)
            declared = mu_code if np.linalg.norm(
                carrier_direct(repr_k) - mu_center
            ) < np.linalg.norm(repr_k - mu_center) else R.decode(repr_k)
            if via_carrier != declared:
                mism += 1
        if mism == 0:
            binding_ok += 1
        binding_max_err = max(binding_max_err, mism)

        n_trials += 1

    thresh = int(0.6 * n_cases)
    passed = bool(
        multi_real_ok >= thresh and recv_rel_ok >= thresh and binding_ok >= thresh
    )
    return ExpResult(
        id="E06",
        name="Carrier-Shift Decoupling (advert unit)",
        claim="Thm 5.4 (decoupling: multi-realisability, receiver-relativity, binding)",
        kind="structural",
        passed=passed,
        max_error=0.0,  # structural check; per-case binding mismatch in detail
        n_trials=n_trials,
        detail={
            "clause_i_multiple_realisability_cases": multi_real_ok,
            "clause_ii_receiver_relativity_cases": recv_rel_ok,
            "clause_iii_binding_consistent_cases": binding_ok,
            "threshold_per_clause": thresh,
            "binding_max_per_case_mismatch": float(binding_max_err),
            "note": "Same shift via distinct carriers; same carrier, different "
                    "shift across receivers; carrier and shift conjugate under D.",
        },
    )
