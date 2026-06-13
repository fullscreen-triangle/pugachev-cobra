"""Shared, faithful realisations of the paper's primitives.

Definitions implemented here (paper section in brackets):

* PerceptSpace                    [Def 2.1]  bounded pseudometric (X, d, Sigma)
* Cell                            [Def 3.1]  positive-tolerance region (a ball)
* Receiver = (K, D, Pi, beta)     [Def 2.4]  codebook decoder + beta-ball projection
* s_functional(R, x, C)           [Def 2.5]  S(R,x;C) = inf_{x' in Pi(D(x))} d(x',C) + beta
* catalytic power                 [Def 6.1]  fraction of above-floor distance closed
* multiplicative composition      [Thm 6.4]  residual above-floor distances multiply

The decoder D is nearest-codeword quantisation onto a finite codebook K.
The candidate projection Pi(k) is the set of percepts whose nearest codeword
is k -- i.e. the Voronoi cell of k. The floor beta is the worst-case
quantisation residual sup_x inf_{x' in Pi(D(x))} d(x, x'); for a codebook it
is the covering radius (the largest distance from any percept to its codeword's
Voronoi cell representative). We realise percept spaces by finite point clouds
so all suprema/infima are exact finite computations.
"""
from __future__ import annotations

import numpy as np

SIGMA = 100.0  # maximal semantic distance (canonical normalisation, Def 2.1)


def _cap(d: np.ndarray | float) -> np.ndarray | float:
    """Cap a Euclidean distance at the maximal semantic distance Sigma."""
    return np.minimum(d, SIGMA)


class PerceptSpace:
    """A finite percept space (X, d, Sigma): a point cloud in R^n.

    The pseudometric is the Euclidean distance capped at Sigma.
    """

    def __init__(self, points: np.ndarray):
        self.points = np.asarray(points, dtype=float)
        if self.points.ndim != 2:
            raise ValueError("points must be a 2D array (n_points, dim)")
        self.n, self.dim = self.points.shape

    def d(self, a: np.ndarray, b: np.ndarray) -> float:
        return float(_cap(np.linalg.norm(np.asarray(a) - np.asarray(b))))

    def dist_to_set(self, x: np.ndarray, members: np.ndarray) -> float:
        """d(x, C) = inf_{c in C} d(x, c) for a finite set C (array of points)."""
        if len(members) == 0:
            return SIGMA
        diffs = members - np.asarray(x)
        return float(_cap(np.min(np.linalg.norm(diffs, axis=1))))


class Cell:
    """An action-cell C = B(center, radius) with positive tolerance [Def 3.1].

    Realised as a ball; ``tolerance`` is supplied explicitly (the worst-case
    distance from any percept in the ambient space to the cell), and
    ``contains`` tests membership.
    """

    def __init__(self, center: np.ndarray, radius: float, tolerance: float):
        self.center = np.asarray(center, dtype=float)
        self.radius = float(radius)
        self.tolerance = float(tolerance)

    def contains(self, x: np.ndarray) -> bool:
        return bool(np.linalg.norm(np.asarray(x) - self.center) <= self.radius + 1e-12)

    def distance(self, x: np.ndarray) -> float:
        """d(x, C): zero inside the ball, else distance to the boundary."""
        r = float(np.linalg.norm(np.asarray(x) - self.center))
        return float(_cap(max(0.0, r - self.radius)))


class Receiver:
    """A bounded receiver R = (K, D, Pi, beta) [Def 2.4].

    * ``codebook`` is K (a finite array of codewords in percept space);
    * ``decode(x)`` is D: index of the nearest codeword;
    * ``project(k_idx)`` is Pi: the percepts whose nearest codeword is k
      (the Voronoi cell of codeword k), as an array of points;
    * ``beta`` is the floor, the covering radius of the codebook over the
      ambient percepts (worst-case decode-project residual, Def 2.4(iv)).
    """

    def __init__(self, space: PerceptSpace, codebook: np.ndarray):
        self.space = space
        self.codebook = np.asarray(codebook, dtype=float)
        self.m = len(self.codebook)
        # assign each ambient percept to its nearest codeword (Voronoi label)
        self._labels = self._nearest_codeword(space.points)
        self.beta = self._compute_floor()

    def _nearest_codeword(self, pts: np.ndarray) -> np.ndarray:
        # (n_pts, m) distance matrix to codewords
        dmat = np.linalg.norm(pts[:, None, :] - self.codebook[None, :, :], axis=2)
        return np.argmin(dmat, axis=1)

    def decode(self, x: np.ndarray) -> int:
        x = np.asarray(x, dtype=float).reshape(1, -1)
        return int(self._nearest_codeword(x)[0])

    def project(self, k_idx: int) -> np.ndarray:
        """Pi(k): ambient percepts in the Voronoi cell of codeword k."""
        return self.space.points[self._labels == k_idx]

    def _compute_floor(self) -> float:
        """beta = sup_x inf_{x' in Pi(D(x))} d(x, x').

        For each ambient percept x, Pi(D(x)) is the Voronoi cell of its own
        codeword, which contains x, so the inner inf would be 0 if we allowed
        x itself. The floor is the *reconstruction* residual: the receiver
        represents x by its codeword, and the nearest *distinct* candidate it
        can offer is at distance up to the cell radius. We therefore take the
        covering radius -- the max over x of the distance to its codeword --
        which is the worst-case irreducible gap and is strictly positive for
        any bona-fide (non-trivial) quantiser.
        """
        residuals = np.linalg.norm(
            self.space.points - self.codebook[self._labels], axis=1
        )
        return float(_cap(np.max(residuals)))


def s_functional(receiver: Receiver, x: np.ndarray, cell: Cell) -> float:
    """S(R, x; C) = inf_{x' in Pi(D(x))} d(x', C) + beta   [Def 2.5]."""
    k = receiver.decode(x)
    candidates = receiver.project(k)
    if len(candidates) == 0:
        inner = SIGMA
    else:
        inner = min(cell.distance(c) for c in candidates)
    return float(_cap(inner + receiver.beta))


def make_codebook_receiver(
    rng: np.random.Generator,
    n_points: int = 400,
    dim: int = 2,
    m_codewords: int = 16,
    spread: float = 10.0,
) -> tuple[PerceptSpace, Receiver]:
    """Construct a percept space + a bounded codebook receiver over it.

    The codebook is a strict subset of the percepts (m << n), guaranteeing
    boundedness |K| < |X| (Axiom: bounded representation).
    """
    pts = rng.uniform(-spread, spread, size=(n_points, dim))
    space = PerceptSpace(pts)
    # codewords = a random subset of percepts (bounded, |K| < |X|)
    idx = rng.choice(n_points, size=m_codewords, replace=False)
    receiver = Receiver(space, pts[idx])
    return space, receiver


# --------------------------------------------------------------------------
# Catalyst algebra [Sec 6]
# --------------------------------------------------------------------------

def composite_power(powers: list[float] | np.ndarray) -> float:
    """kappa(stack) = 1 - prod_i (1 - kappa_i)   [Thm 6.4]."""
    powers = np.asarray(powers, dtype=float)
    return float(1.0 - np.prod(1.0 - powers))


def apply_catalyst(above_floor: float, power: float) -> float:
    """One catalytic step: residual above-floor distance scales by (1 - power)."""
    return float(above_floor * (1.0 - power))
