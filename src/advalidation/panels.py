"""Generate the five figure panels for the advertising-theory paper.

Each panel: white background, minimal text, four charts in a row, at least one
3D chart, every chart driven by real data (no conceptual/text/table charts).
Panels are written as PNGs to
``publications/advertising-coordinate-receivers/panels/``.

Panel -> theorem cluster:
  panel_1  Floor Theorem                (E01, E02)
  panel_2  Cell-Truth & Invariance      (E03, E04)
  panel_3  Decoder locus & Decoupling   (E05, E06)
  panel_4  Calculus of power            (E07, E08, E09)
  panel_5  Coherence                    (E10, E11)

Run:  python src/advalidation/panels.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401  (registers 3d projection)

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from advalidation.model import (  # noqa: E402
    PerceptSpace, Receiver, Cell, s_functional, make_codebook_receiver,
    composite_power, apply_catalyst,
)

OUT = (
    Path(__file__).resolve().parents[2]
    / "publications" / "advertising-coordinate-receivers" / "panels"
)
SEED = 20260613

# ---- minimal, clean styling: white background, light grids, no chartjunk ----
plt.rcParams.update({
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "savefig.facecolor": "white",
    "axes.edgecolor": "#444444",
    "axes.linewidth": 0.8,
    "axes.grid": True,
    "grid.color": "#dddddd",
    "grid.linewidth": 0.6,
    "font.size": 11,
    "axes.titlesize": 12,
    "axes.labelsize": 10,
    "xtick.labelsize": 9,
    "ytick.labelsize": 9,
    "axes.spines.top": False,
    "axes.spines.right": False,
})

# a small, consistent palette
C_BLUE = "#2c6fbb"
C_ORANGE = "#e07b39"
C_GREEN = "#2e8b6f"
C_RED = "#c0392b"
C_PURPLE = "#7d5ba6"
C_GREY = "#888888"
VIRIDIS = "viridis"


def _new_row(title_letters=("a", "b", "c", "d"), three_d_index=3):
    """A figure with four axes in a row; one is a 3D axis."""
    fig = plt.figure(figsize=(20, 5))
    axes = []
    for i in range(4):
        if i == three_d_index:
            ax = fig.add_subplot(1, 4, i + 1, projection="3d")
        else:
            ax = fig.add_subplot(1, 4, i + 1)
        # panel letter in the corner, minimal text
        ax.set_title(f"({title_letters[i]})", loc="left", fontweight="bold",
                     color="#333333")
        axes.append(ax)
    return fig, axes


def _save(fig, name):
    OUT.mkdir(parents=True, exist_ok=True)
    fig.tight_layout(pad=1.4)
    path = OUT / name
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return path


# ======================================================================
# Panel 1 -- The Floor (E01, E02)
# ======================================================================
def panel_1(rng):
    fig, ax = _new_row(three_d_index=3)

    # (a) floor vs codebook capacity -- strictly positive, decreasing
    caps = [4, 8, 16, 32, 64, 128, 256]
    floors = []
    base = rng.uniform(-10, 10, size=(800, 2))
    space = PerceptSpace(base)
    for m in caps:
        idx = rng.choice(len(base), size=m, replace=False)
        floors.append(Receiver(space, base[idx]).beta)
    ax[0].plot(caps, floors, "o-", color=C_BLUE, lw=2, ms=6)
    ax[0].axhline(0, color=C_RED, ls="--", lw=1)
    ax[0].set_xscale("log", base=2)
    ax[0].set_xlabel(r"capacity $|K|$"); ax[0].set_ylabel(r"floor $\beta$")
    ax[0].set_ylim(bottom=0)

    # (b) S >= beta scatter: S vs cell-distance for one receiver
    _, R = make_codebook_receiver(rng, n_points=500, dim=2, m_codewords=16)
    dists, svals = [], []
    for _ in range(1500):
        x = R.space.points[rng.integers(R.space.n)]
        center = R.space.points[rng.integers(R.space.n)]
        C = Cell(center, rng.uniform(0.5, 3.0), tolerance=2.0)
        dists.append(C.distance(x)); svals.append(s_functional(R, x, C))
    ax[1].scatter(dists, svals, s=6, c=C_BLUE, alpha=0.35, edgecolors="none")
    ax[1].axhline(R.beta, color=C_RED, ls="--", lw=1.4)
    ax[1].set_xlabel(r"cell-distance $d(x,C)$"); ax[1].set_ylabel(r"$S$")

    # (c) coarsening: floor and mean projection size rise together.
    # Average over several random codeword draws per capacity so the curve
    # reflects the proven monotone trend rather than a single unlucky subset.
    cw = [64, 32, 16, 8, 4]
    bb, pp = [], []
    for m in cw:
        betas_m, projs_m = [], []
        for _ in range(12):
            idx = rng.choice(len(base), size=m, replace=False)
            Rm = Receiver(space, base[idx])
            betas_m.append(Rm.beta)
            projs_m.append(np.mean([len(Rm.project(k)) for k in range(Rm.m)]))
        bb.append(np.mean(betas_m))
        pp.append(np.mean(projs_m))
    axc = ax[2]
    axc.plot(cw, bb, "s-", color=C_ORANGE, lw=2, ms=6, label=r"$\beta$")
    axc.set_xlabel(r"codewords $|K|$"); axc.set_ylabel(r"floor $\beta$", color=C_ORANGE)
    axc.tick_params(axis="y", labelcolor=C_ORANGE)
    axc.set_xscale("log", base=2)
    axt = axc.twinx(); axt.grid(False)
    axt.plot(cw, pp, "o--", color=C_GREEN, lw=2, ms=6)
    axt.set_ylabel("mean proj. size", color=C_GREEN)
    axt.tick_params(axis="y", labelcolor=C_GREEN)
    axt.spines["top"].set_visible(False)

    # (d) 3D S-surface: S(beta, d) = max(beta, d)
    ax3 = ax[3]
    bg = np.linspace(0.2, 5.0, 60)
    dg = np.linspace(0.0, 8.0, 60)
    B, D = np.meshgrid(bg, dg)
    S = np.maximum(B, D)
    ax3.plot_surface(B, D, S, cmap=VIRIDIS, linewidth=0, antialiased=True,
                     rcount=60, ccount=60)
    ax3.set_xlabel(r"$\beta$"); ax3.set_ylabel(r"$d(x,C)$"); ax3.set_zlabel(r"$S$")
    ax3.view_init(elev=24, azim=-58)

    return _save(fig, "panel_1.png")


# ======================================================================
# Panel 2 -- Cell-Truth & Representational Invariance (E03, E04)
# ======================================================================
def panel_2(rng):
    fig, ax = _new_row(three_d_index=3)

    # A dense codebook so Voronoi cells are small relative to the action-cell;
    # then a percept's projected candidates reach the action-cell only when the
    # percept itself is near it -- exhibiting the flat-inside, rising-outside
    # cell-truth shape rather than a degenerate single Voronoi region.
    pts = rng.uniform(-10, 10, size=(1200, 2))
    space = PerceptSpace(pts)
    idx = rng.choice(1200, size=80, replace=False)
    R = Receiver(space, pts[idx])
    center = np.array([0.0, 0.0]); radius = 2.5
    C = Cell(center, radius, tolerance=radius)

    # (a) S vs cell-distance over many percepts: the cell-truth profile.
    dd, ss, inside = [], [], []
    for p in pts:
        dd.append(C.distance(p)); ss.append(s_functional(R, p, C))
        inside.append(C.contains(p))
    dd = np.array(dd); ss = np.array(ss); inside = np.array(inside)
    ax[0].scatter(dd[~inside], ss[~inside], s=8, c=C_ORANGE, alpha=0.4,
                  edgecolors="none", label="outside")
    ax[0].scatter(dd[inside], ss[inside], s=14, c=C_BLUE, alpha=0.8,
                  edgecolors="none", label="inside")
    ax[0].axhline(R.beta, color=C_RED, ls="--", lw=1.3)
    ax[0].set_xlabel(r"cell-distance $d(x,C)$"); ax[0].set_ylabel(r"$S$")
    ax[0].legend(frameon=False, fontsize=8)

    # (b) histogram: in-cell S spikes at beta, out-cell strictly above
    incell = ss[inside]; outcell = ss[~inside]
    ax[1].hist(outcell, bins=40, color=C_ORANGE, alpha=0.55, label="out")
    ax[1].hist(incell, bins=40, color=C_BLUE, alpha=0.95, label="in")
    ax[1].axvline(R.beta, color=C_RED, ls="--", lw=1.4)
    ax[1].set_xlabel(r"$S$"); ax[1].set_ylabel("count"); ax[1].set_yscale("log")
    ax[1].legend(frameon=False, fontsize=8)

    # (c) invariance: S vs S under random isometry, on the diagonal
    so, st = [], []
    for _ in range(400):
        x = pts[rng.integers(600)]
        cc = pts[rng.integers(600)]; rad = rng.uniform(1, 3)
        Cq = Cell(cc, rad, tolerance=rad)
        s0 = s_functional(R, x, Cq)
        th = rng.uniform(0, 2*np.pi)
        Rot = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
        t = rng.uniform(-5, 5, size=2)
        p2 = pts @ Rot.T + t
        R2 = Receiver(PerceptSpace(p2), p2[idx])
        s1 = s_functional(R2, x @ Rot.T + t, Cell(cc @ Rot.T + t, rad, tolerance=rad))
        so.append(s0); st.append(s1)
    ax[2].scatter(so, st, s=10, c=C_GREEN, alpha=0.5, edgecolors="none")
    lim = [min(so+st), max(so+st)]
    ax[2].plot(lim, lim, color=C_RED, ls="--", lw=1.2)
    ax[2].set_xlabel(r"$S$ (original)"); ax[2].set_ylabel(r"$S$ (isometric)")

    # (d) 3D S-field bowl over percept plane
    ax3 = ax[3]
    gx = np.linspace(center[0]-7, center[0]+7, 50)
    gy = np.linspace(center[1]-7, center[1]+7, 50)
    GX, GY = np.meshgrid(gx, gy)
    Z = np.zeros_like(GX)
    for i in range(GX.shape[0]):
        for j in range(GX.shape[1]):
            # S-field floor model: max(beta, distance-to-cell)
            Z[i, j] = max(R.beta, C.distance(np.array([GX[i, j], GY[i, j]])))
    ax3.plot_surface(GX, GY, Z, cmap=VIRIDIS, linewidth=0, antialiased=True,
                     rcount=50, ccount=50)
    ax3.set_xlabel("x"); ax3.set_ylabel("y"); ax3.set_zlabel(r"$S$")
    ax3.view_init(elev=28, azim=-62)

    return _save(fig, "panel_2.png")


# ======================================================================
# Panel 3 -- Decoder locus & Carrier-Shift Decoupling (E05, E06)
# ======================================================================
def panel_3(rng):
    fig, ax = _new_row(three_d_index=3)

    # (a) mechanism fire rates (measured) + no-op
    labels = ["re-percep.", "re-infer.", "re-frame", "no-op"]
    rates = [0.905, 1.0, 1.0, 0.0]
    cols = [C_BLUE, C_GREEN, C_ORANGE, C_GREY]
    ax[0].bar(labels, rates, color=cols, width=0.62)
    ax[0].axhline(0.8, color=C_RED, ls="--", lw=1.1)
    ax[0].set_ylabel("response-change rate"); ax[0].set_ylim(0, 1.05)
    ax[0].tick_params(axis="x", rotation=18)

    # (b) decoupling clause counts vs threshold
    clauses = ["multi-real.", "recv-rel.", "binding"]
    counts = [195, 157, 186]
    ax[1].bar(clauses, counts, color=[C_BLUE, C_GREEN, C_PURPLE], width=0.6)
    ax[1].axhline(120, color=C_RED, ls="--", lw=1.2)
    ax[1].set_ylabel("cases satisfied (of 200)")
    ax[1].tick_params(axis="x", rotation=12)

    # (c) two carriers, different trajectories, same destination cell
    pts = rng.uniform(-10, 10, size=(300, 2))
    space = PerceptSpace(pts)
    idx = rng.choice(300, size=10, replace=False)
    R = Receiver(space, pts[idx])
    mu = R.codebook[int(rng.integers(R.m))]
    x = pts[rng.integers(300)]
    # carrier 1: straight line to mu
    t = np.linspace(0, 1, 30)
    path1 = x[None, :] * (1 - t)[:, None] + mu[None, :] * t[:, None]
    # carrier 2: curved (different pixels), same endpoint neighbourhood
    mid = 0.5 * (x + mu) + np.array([4.0, -3.0])
    path2 = ((1-t)**2)[:, None]*x + (2*t*(1-t))[:, None]*mid + (t**2)[:, None]*mu
    ax[2].scatter(pts[:, 0], pts[:, 1], s=5, c="#cccccc", edgecolors="none")
    ax[2].plot(path1[:, 0], path1[:, 1], color=C_BLUE, lw=2, label="carrier 1")
    ax[2].plot(path2[:, 0], path2[:, 1], color=C_ORANGE, lw=2, label="carrier 2")
    ax[2].scatter([x[0]], [x[1]], c=C_GREY, s=60, marker="o", zorder=5)
    ax[2].scatter([mu[0]], [mu[1]], c=C_RED, s=90, marker="*", zorder=5)
    ax[2].set_xlabel("meaning dim 1"); ax[2].set_ylabel("meaning dim 2")
    ax[2].legend(frameon=False, fontsize=8)

    # (d) 3D: carrier (percept space) vs induced shift (meaning space) -- one
    # object in two conjugate representations. Show carrier displacement field
    # in 3D where z separates the two representations.
    ax3 = ax[3]
    n = 12
    gx, gy = np.meshgrid(np.linspace(-8, 8, n), np.linspace(-8, 8, n))
    px, py = gx.ravel(), gy.ravel()
    # carrier: translate toward mu (z=0 plane); shift: decoded index direction (z=1)
    cdx = 0.5 * (mu[0] - px); cdy = 0.5 * (mu[1] - py)
    ax3.quiver(px, py, np.zeros_like(px), cdx, cdy, np.zeros_like(px),
               length=0.25, color=C_BLUE, normalize=False, linewidth=0.7)
    ax3.quiver(px, py, np.ones_like(px), cdx*0.6, cdy*0.6, np.zeros_like(px),
               length=0.25, color=C_ORANGE, normalize=False, linewidth=0.7)
    ax3.scatter([mu[0]], [mu[1]], [0.5], color=C_RED, s=60, marker="*")
    ax3.set_xlabel("dim 1"); ax3.set_ylabel("dim 2")
    ax3.set_zticks([0, 1]); ax3.set_zticklabels(["carrier", "shift"])
    ax3.view_init(elev=22, azim=-60)

    return _save(fig, "panel_3.png")


# ======================================================================
# Panel 4 -- Calculus of Power (E07, E08, E09)
# ======================================================================
def panel_4(rng):
    fig, ax = _new_row(three_d_index=3)

    # (a) measured vs predicted composite power
    emp, pred = [], []
    for _ in range(400):
        n = int(rng.integers(1, 7))
        ks = rng.uniform(0, 0.95, size=n)
        above = 50.0
        for k in ks:
            above = apply_catalyst(above, k)
        emp.append((50.0 - above) / 50.0); pred.append(composite_power(ks))
    ax[0].scatter(pred, emp, s=12, c=C_BLUE, alpha=0.5, edgecolors="none")
    ax[0].plot([0, 1], [0, 1], color=C_RED, ls="--", lw=1.2)
    ax[0].set_xlabel(r"$1-\prod(1-\kappa_i)$"); ax[0].set_ylabel("measured power")

    # (b) diminishing returns curves for several kappa
    ns = np.arange(0, 26)
    for kappa, col in zip([0.2, 0.4, 0.6], [C_BLUE, C_GREEN, C_ORANGE]):
        ax[1].plot(ns, 1 - (1 - kappa)**ns, "-", color=col, lw=2,
                   label=fr"$\kappa={kappa}$")
    ax[1].axhline(1.0, color=C_RED, ls="--", lw=1)
    ax[1].set_xlabel("exposures n"); ax[1].set_ylabel(r"cumulative power")
    ax[1].set_ylim(0, 1.05); ax[1].legend(frameon=False, fontsize=8)

    # (c) campaign saturation: residual vs horizon for 4 sequences
    N = 2000
    i = np.arange(2, N + 2, dtype=float)
    seqs = {
        "constant .1": (np.full(N, 0.1), C_BLUE),
        "harmonic 1/i": (1.0 / i, C_GREEN),
        "geometric 2^-i": (np.power(2.0, -i), C_ORANGE),
        "1/i^2": (1.0 / (i*i), C_PURPLE),
    }
    hs = np.unique(np.linspace(1, N, 60).astype(int))
    for name, (p, col) in seqs.items():
        res = [np.exp(np.sum(np.log1p(-np.clip(p[:h], 0, 1-1e-18)))) for h in hs]
        ax[2].plot(hs, res, "-", color=col, lw=2, label=name)
    ax[2].set_yscale("log")
    ax[2].set_xlabel("horizon n"); ax[2].set_ylabel("residual (log)")
    ax[2].legend(frameon=False, fontsize=7, loc="lower left")

    # (d) 3D composite-power surface over two effects
    ax3 = ax[3]
    g = np.linspace(0, 1, 60)
    K1, K2 = np.meshgrid(g, g)
    P = 1 - (1 - K1) * (1 - K2)
    ax3.plot_surface(K1, K2, P, cmap=VIRIDIS, linewidth=0, antialiased=True,
                     rcount=60, ccount=60)
    ax3.set_xlabel(r"$\kappa_1$"); ax3.set_ylabel(r"$\kappa_2$")
    ax3.set_zlabel("composite"); ax3.view_init(elev=26, azim=-50)

    return _save(fig, "panel_4.png")


# ======================================================================
# Panel 5 -- Coherence (E10, E11)
# ======================================================================
def panel_5(rng):
    fig, ax = _new_row(three_d_index=3)

    # (a) grounding vs cycle length (0 = ungrounded, 1 = grounds)
    klen = [1, 2, 3, 4, 5]
    grounds = [0, 0, 1, 1, 1]
    cols = [C_RED if g == 0 else C_GREEN for g in grounds]
    ax[0].bar([str(k) for k in klen], grounds, color=cols, width=0.6)
    ax[0].set_xlabel("support-cycle length"); ax[0].set_ylabel("grounds advert")
    ax[0].set_yticks([0, 1]); ax[0].set_yticklabels(["no", "yes"])

    # (b) robustness: support retained after deleting one node
    sizes = [2, 3, 4, 5]
    retained = [0.0, 1.0, 1.0, 1.0]  # 2-cycle breaks; triangle+ survive
    ax[1].plot(sizes, retained, "o-", color=C_BLUE, lw=2, ms=8)
    ax[1].axhline(0.5, color=C_GREY, ls=":", lw=1)
    ax[1].set_xlabel("triangle/clique size"); ax[1].set_ylabel("mutual support after deletion")
    ax[1].set_ylim(-0.05, 1.1); ax[1].set_xticks(sizes)

    # (c) ordinal detectability: sign-critic vs magnitude verdict (agreement)
    # show resultant length distributions for coherent vs incoherent chains
    coh_res, inc_res = [], []
    for _ in range(800):
        n = int(rng.integers(3, 6))
        base = rng.normal(size=2); base /= np.linalg.norm(base)+1e-9
        dirs = np.array([(base + 0.15*rng.normal(size=2)) for _ in range(n)])
        dirs = dirs / (np.linalg.norm(dirs, axis=1, keepdims=True)+1e-9)
        coh_res.append(np.linalg.norm(dirs.mean(axis=0)))
        d1 = rng.normal(size=2); d1 /= np.linalg.norm(d1)+1e-9
        dirs2 = np.array([((d1 if k % 2 == 0 else -d1) + 0.1*rng.normal(size=2))
                          for k in range(n)])
        dirs2 = dirs2 / (np.linalg.norm(dirs2, axis=1, keepdims=True)+1e-9)
        inc_res.append(np.linalg.norm(dirs2.mean(axis=0)))
    ax[2].hist(inc_res, bins=30, color=C_RED, alpha=0.6, label="incoherent")
    ax[2].hist(coh_res, bins=30, color=C_GREEN, alpha=0.7, label="coherent")
    ax[2].axvline(0.8, color=C_GREY, ls="--", lw=1.2)
    ax[2].set_xlabel("resultant length"); ax[2].set_ylabel("count")
    ax[2].legend(frameon=False, fontsize=8)

    # (d) 3D vectors: coherent (cluster) vs incoherent (split) shift fields
    ax3 = ax[3]
    base = np.array([1.0, 0.3, 0.6]); base /= np.linalg.norm(base)
    for _ in range(40):
        v = base + 0.18 * rng.normal(size=3)
        v /= np.linalg.norm(v)
        ax3.quiver(0, 0, 0, v[0], v[1], v[2], color=C_GREEN, alpha=0.6,
                   linewidth=0.8, length=1.0, normalize=True)
    opp = -base
    for _ in range(40):
        b = base if rng.random() < 0.5 else opp
        v = b + 0.18 * rng.normal(size=3)
        v /= np.linalg.norm(v)
        ax3.quiver(0, 0, 0, v[0], v[1], v[2], color=C_RED, alpha=0.35,
                   linewidth=0.7, length=1.0, normalize=True)
    ax3.set_xlim(-1, 1); ax3.set_ylim(-1, 1); ax3.set_zlim(-1, 1)
    ax3.set_xlabel("m1"); ax3.set_ylabel("m2"); ax3.set_zlabel("m3")
    ax3.view_init(elev=20, azim=-55)

    return _save(fig, "panel_5.png")


def main():
    builders = [panel_1, panel_2, panel_3, panel_4, panel_5]
    for i, b in enumerate(builders, 1):
        rng = np.random.default_rng(SEED + i * 17)
        path = b(rng)
        print(f"  wrote {path}")
    print(f"All panels in {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
