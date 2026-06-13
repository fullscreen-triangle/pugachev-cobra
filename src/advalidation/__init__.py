"""Numerical validation suite for the Coordinate Theory of Advertising.

Each module ``e0X_*`` verifies one theorem/corollary of the paper
``publications/advertising-coordinate-receivers/advertising-coordinate-receiverts.tex``
against an explicit numerical realisation, and returns a structured record
that is persisted as JSON by :mod:`advalidation.run_all`.

The models here are intentionally minimal, faithful realisations of the
paper's definitions:

* an outcome/percept space is a finite metric space (points in R^n with the
  Euclidean pseudometric, capped at Sigma);
* a receiver R = (K, D, Pi, beta) is realised by a finite codebook K, a
  nearest-codeword decoder D, a candidate projection Pi returning the
  beta-ball preimage of a codeword, and the induced floor beta;
* an action-cell is a positive-tolerance ball;
* an effect is a carrier (a map on percepts) bound to a decoder-shift, with
  a catalytic power measured as fraction of above-floor distance closed.

Everything is ordinal-friendly: the cardinal numbers we compute (floors,
powers) are used only to verify the *structural* identities the theory
asserts (S >= beta, kappa = 1 - prod(1-kappa_i), etc.).
"""

from .model import (
    SIGMA,
    PerceptSpace,
    Receiver,
    Cell,
    s_functional,
    make_codebook_receiver,
)

__all__ = [
    "SIGMA",
    "PerceptSpace",
    "Receiver",
    "Cell",
    "s_functional",
    "make_codebook_receiver",
]
