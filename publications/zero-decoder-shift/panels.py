"""
Panel generation for:
  Zero Decoder-Shift Under Extreme Temporal Compression

8 panels, each with 4 charts in a row (white background, minimal text).
At least one chart per panel is a 3-D plot.

Panel map:
  P1  Floor Theorem          — beta vs vocab size, distance distribution,
                                3D floor surface, cumulative floor
  P2  Integration Window     — shift vs duration, threshold curve,
                                3D shift landscape, shift profile
  P3  Zero Decoder-Shift     — shift vs rate, compressed duration vs rate,
                                3D (tau, omega, r*) surface, threshold heatmap
  P4  Composition-Inflation  — T(n,d) growth curves, log-linear plot,
                                3D T surface, ratio per cycle
  P5  Sender Graph           — vertex count at rates, edge growth,
                                3D vertex-rate surface, rate invariance
  P6  Propagation Equilibrium— sender/receiver graph sizes vs rate,
                                equilibrium boundary, 3D equilibrium surface,
                                stability region
  P7  Telemetry Preservation — timestamp scaling, label fidelity,
                                3D telemetry surface, event ordering
  P8  Adversarial Quiescence — cross-demand vs corruption level,
                                quiescence boundary, 3D quiescence surface,
                                monitoring receiver phase diagram
"""

import json
import math
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D   # noqa: F401
from matplotlib import cm
from matplotlib.colors import Normalize
import os

np.random.seed(42)

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ── palette ──────────────────────────────────────────────────────────────────
C_BLUE   = "#2C6EAF"
C_ORANGE = "#D4700A"
C_GREEN  = "#2A8A3C"
C_RED    = "#C0392B"
C_GREY   = "#7F7F7F"
C_PURPLE = "#7B2D8B"
C_TEAL   = "#1A7A7A"

PANEL_W, PANEL_H = 16, 4.0
TITLE_FS  = 8
LABEL_FS  = 7
TICK_FS   = 6

def _ax_style(ax, xlabel="", ylabel="", title=""):
    ax.set_facecolor("white")
    ax.spines[["top","right"]].set_visible(False)
    ax.tick_params(labelsize=TICK_FS)
    if xlabel: ax.set_xlabel(xlabel, fontsize=LABEL_FS)
    if ylabel: ax.set_ylabel(ylabel, fontsize=LABEL_FS)
    if title:  ax.set_title(title, fontsize=TITLE_FS, fontweight="bold", pad=4)

def _ax3d_style(ax, xlabel="", ylabel="", zlabel="", title=""):
    ax.tick_params(labelsize=TICK_FS - 1)
    ax.set_xlabel(xlabel, fontsize=LABEL_FS, labelpad=2)
    ax.set_ylabel(ylabel, fontsize=LABEL_FS, labelpad=2)
    ax.set_zlabel(zlabel, fontsize=LABEL_FS, labelpad=2)
    if title: ax.set_title(title, fontsize=TITLE_FS, fontweight="bold", pad=4)
    ax.xaxis.pane.fill = False
    ax.yaxis.pane.fill = False
    ax.zaxis.pane.fill = False

def save_panel(fig, name):
    path = os.path.join(OUT_DIR, name)
    fig.savefig(path, dpi=150, bbox_inches="tight",
                facecolor="white", edgecolor="none")
    plt.close(fig)
    print(f"  saved {name}")

# ══════════════════════════════════════════════════════════════════════════════
# P1  Floor Theorem
# ══════════════════════════════════════════════════════════════════════════════
def panel_1():
    fig, axes = plt.subplots(1, 4, figsize=(PANEL_W, PANEL_H))
    fig.patch.set_facecolor("white")

    # 1a  beta vs vocab size
    ax = axes[0]
    vocab_sizes = [4, 8, 16, 32, 64, 128, 256, 512]
    betas = [1 / (2 * k) for k in vocab_sizes]   # floor ~ 1/(2|K|)
    ax.plot(vocab_sizes, betas, "o-", color=C_BLUE, ms=5, lw=1.5)
    ax.axhline(0, color=C_GREY, lw=0.8, ls="--")
    ax.set_xscale("log", base=2)
    ax.set_yscale("log")
    _ax_style(ax, xlabel="|K|", ylabel="β", title="Floor vs Vocabulary Size")

    # 1b  distance distribution for one receiver
    ax = axes[1]
    rng = np.random.default_rng(7)
    K = 32
    centres = np.sort(rng.uniform(0, 1, K))
    percepts = rng.uniform(0, 1, 2000)
    tokens = np.argmin(np.abs(percepts[:, None] - centres[None, :]), axis=1)
    # distance to cell boundary
    lo = np.concatenate([[0], (centres[:-1] + centres[1:]) / 2])
    hi = np.concatenate([(centres[:-1] + centres[1:]) / 2, [1]])
    cell_lo = lo[tokens]
    cell_hi = hi[tokens]
    dists = np.minimum(np.abs(percepts - cell_lo), np.abs(percepts - cell_hi))
    ax.hist(dists, bins=50, color=C_BLUE, alpha=0.8, edgecolor="white", lw=0.3)
    ax.axvline(dists.min(), color=C_RED, lw=1.2, ls="--")
    _ax_style(ax, xlabel="d(x, cell boundary)", ylabel="count",
              title="Cell-Boundary Distance Distribution")

    # 1c  3D: floor surface over (|K|, sigma)
    ax3 = fig.add_subplot(1, 4, 3, projection="3d")
    K_vals = np.linspace(4, 128, 30)
    S_vals = np.linspace(0.5, 3.0, 30)
    KK, SS = np.meshgrid(K_vals, S_vals)
    BETA = SS / (2 * KK)
    ax3.plot_surface(KK, SS, BETA, cmap=cm.Blues, alpha=0.85, linewidth=0)
    _ax3d_style(ax3, xlabel="|K|", ylabel="Σ", zlabel="β", title="Floor Surface β(|K|, Σ)")

    # 1d  cumulative: fraction of percepts with floor <= x
    ax = axes[3]
    xs = np.sort(dists)
    ys = np.arange(1, len(xs) + 1) / len(xs)
    ax.plot(xs, ys, color=C_PURPLE, lw=1.5)
    ax.axvline(xs.min(), color=C_RED, lw=1.0, ls="--")
    ax.set_ylim(0, 1)
    _ax_style(ax, xlabel="β threshold", ylabel="CDF",
              title="Cumulative Floor Distribution")

    fig.tight_layout(pad=0.8)
    save_panel(fig, "panel_1.png")

# ══════════════════════════════════════════════════════════════════════════════
# P2  Integration Window
# ══════════════════════════════════════════════════════════════════════════════
def panel_2():
    fig, axes = plt.subplots(1, 4, figsize=(PANEL_W, PANEL_H))
    fig.patch.set_facecolor("white")
    omega = 0.013  # 13 ms

    # 2a  shift vs duration (step at omega)
    ax = axes[0]
    taus = np.linspace(0, 0.06, 500)
    shift_vals = np.where(taus >= omega, (taus - omega) / omega, 0.0)
    ax.fill_between(taus * 1000, shift_vals, alpha=0.15, color=C_BLUE)
    ax.plot(taus * 1000, shift_vals, color=C_BLUE, lw=1.5)
    ax.axvline(omega * 1000, color=C_RED, lw=1.2, ls="--")
    ax.text(omega * 1000 + 0.5, 0.05, "ω", color=C_RED, fontsize=LABEL_FS)
    _ax_style(ax, xlabel="τ (ms)", ylabel="Δ (normalised)",
              title="Shift vs Signal Duration")

    # 2b  threshold curves for multiple omega values
    ax = axes[1]
    for om, col in [(0.013, C_BLUE), (0.025, C_ORANGE), (0.080, C_GREEN)]:
        taus2 = np.linspace(0, 0.15, 400)
        s = np.where(taus2 >= om, 1.0, 0.0)
        ax.step(taus2 * 1000, s, color=col, lw=1.3, label=f"ω={int(om*1000)}ms")
    ax.legend(fontsize=TICK_FS, frameon=False)
    _ax_style(ax, xlabel="τ (ms)", ylabel="token committed",
              title="Window Threshold (multiple ω)")

    # 2c  3D shift landscape over (tau, omega)
    ax3 = fig.add_subplot(1, 4, 3, projection="3d")
    t_arr = np.linspace(0, 0.08, 50)
    w_arr = np.linspace(0.005, 0.05, 50)
    T, W = np.meshgrid(t_arr, w_arr)
    SH = np.where(T >= W, (T - W) / W, 0.0)
    ax3.plot_surface(T * 1000, W * 1000, SH, cmap=cm.plasma, alpha=0.85, linewidth=0)
    _ax3d_style(ax3, xlabel="τ (ms)", ylabel="ω (ms)", zlabel="Δ",
                title="Shift Landscape Δ(τ, ω)")

    # 2d  shift profile at fixed omega, varying rate
    ax = axes[3]
    rates = np.linspace(1, 5000, 500)
    tau_sig = 0.030
    comp_dur = tau_sig / rates
    shift_r = np.where(comp_dur >= omega, 1.0, 0.0)
    r_star = tau_sig / omega
    ax.plot(rates, shift_r, color=C_ORANGE, lw=1.5)
    ax.axvline(r_star, color=C_RED, lw=1.2, ls="--")
    ax.text(r_star + 50, 0.55, "r*", color=C_RED, fontsize=LABEL_FS)
    _ax_style(ax, xlabel="rate r", ylabel="Δ = 0 ?",
              title="Shift Profile vs Compression Rate")

    fig.tight_layout(pad=0.8)
    save_panel(fig, "panel_2.png")

# ══════════════════════════════════════════════════════════════════════════════
# P3  Zero Decoder-Shift Theorem
# ══════════════════════════════════════════════════════════════════════════════
def panel_3():
    fig, axes = plt.subplots(1, 4, figsize=(PANEL_W, PANEL_H))
    fig.patch.set_facecolor("white")

    tau_vals = [5, 15, 30, 60, 90]
    omega_ref = 0.013
    r_stars = [t / omega_ref for t in tau_vals]

    # 3a  r* vs tau
    ax = axes[0]
    ax.bar(tau_vals, r_stars, color=C_BLUE, alpha=0.8, width=6)
    ax.axhline(7500, color=C_RED, lw=1.2, ls="--")
    ax.text(5, 7700, "r = 7500", color=C_RED, fontsize=LABEL_FS)
    _ax_style(ax, xlabel="τ (s)", ylabel="r*", title="Critical Rate vs Signal Duration")

    # 3b  compressed duration vs rate for tau=30s
    ax = axes[1]
    rates = np.logspace(1, 4.5, 400)
    comp = 30.0 / rates
    ax.loglog(rates, comp * 1000, color=C_BLUE, lw=1.5)
    ax.axhline(13, color=C_RED, lw=1.0, ls="--")
    ax.axvline(30 / 0.013, color=C_ORANGE, lw=1.0, ls="--")
    ax.fill_between(rates, comp * 1000, 13,
                    where=(comp * 1000 < 13), alpha=0.18, color=C_GREEN)
    ax.text(3000, 8, "zero-shift zone", color=C_GREEN, fontsize=LABEL_FS)
    _ax_style(ax, xlabel="rate r", ylabel="duration (ms)",
              title="Compressed Duration vs Rate (τ=30s)")

    # 3c  3D: r* surface over (tau, omega)
    ax3 = fig.add_subplot(1, 4, 3, projection="3d")
    t_g = np.linspace(5, 90, 40)
    w_g = np.linspace(0.005, 0.080, 40)
    TG, WG = np.meshgrid(t_g, w_g)
    RSTAR = TG / WG
    ax3.plot_surface(TG, WG * 1000, RSTAR / 1000, cmap=cm.viridis,
                     alpha=0.85, linewidth=0)
    _ax3d_style(ax3, xlabel="τ (s)", ylabel="ω (ms)", zlabel="r* (×10³)",
                title="Critical Rate Surface r*(τ, ω)")

    # 3d  heatmap of r* over (tau, omega) grid
    ax = axes[3]
    t_h = np.linspace(5, 90, 80)
    w_h = np.linspace(5, 80, 80)
    TH, WH = np.meshgrid(t_h, w_h)
    RSTAR_H = TH / (WH / 1000)
    im = ax.imshow(RSTAR_H / 1000, origin="lower", aspect="auto",
                   extent=[5, 90, 5, 80], cmap="YlOrRd")
    fig.colorbar(im, ax=ax, shrink=0.8, label="r* (×10³)", pad=0.02)
    _ax_style(ax, xlabel="τ (s)", ylabel="ω (ms)",
              title="r* Heatmap (τ, ω)")

    fig.tight_layout(pad=0.8)
    save_panel(fig, "panel_3.png")

# ══════════════════════════════════════════════════════════════════════════════
# P4  Composition-Inflation
# ══════════════════════════════════════════════════════════════════════════════
def panel_4():
    fig, axes = plt.subplots(1, 4, figsize=(PANEL_W, PANEL_H))
    fig.patch.set_facecolor("white")

    def T(n, d): return d * (d + 1) ** (n - 1)

    n_vals = np.arange(1, 13)

    # 4a  T(n,d) growth for d=2,3,4
    ax = axes[0]
    for d, col in [(2, C_BLUE), (3, C_ORANGE), (4, C_GREEN)]:
        y = [T(n, d) for n in n_vals]
        ax.plot(n_vals, y, "o-", color=col, ms=4, lw=1.4, label=f"d={d}")
    ax.legend(fontsize=TICK_FS, frameon=False)
    _ax_style(ax, xlabel="n", ylabel="T(n,d)", title="Composition-Inflation Growth")

    # 4b  log-linear plot
    ax = axes[1]
    for d, col in [(2, C_BLUE), (3, C_ORANGE), (4, C_GREEN)]:
        y = [T(n, d) for n in n_vals]
        ax.semilogy(n_vals, y, "o-", color=col, ms=4, lw=1.4, label=f"d={d}")
    ax.legend(fontsize=TICK_FS, frameon=False)
    _ax_style(ax, xlabel="n", ylabel="T(n,d) [log]",
              title="Log-Linear Growth of T(n,d)")

    # 4c  3D surface T(n,d)
    ax3 = fig.add_subplot(1, 4, 3, projection="3d")
    n_g = np.arange(1, 11)
    d_g = np.arange(2, 7)
    NG, DG = np.meshgrid(n_g, d_g)
    TG = DG * (DG + 1) ** (NG - 1)
    ax3.plot_surface(NG, DG, np.log10(TG + 1), cmap=cm.magma,
                     alpha=0.87, linewidth=0)
    _ax3d_style(ax3, xlabel="n", ylabel="d", zlabel="log₁₀ T",
                title="T(n,d) Surface [log₁₀]")

    # 4d  per-cycle information gain log2(d+1)
    ax = axes[3]
    d_range = np.arange(2, 9)
    bits = np.log2(d_range + 1)
    ax.bar(d_range, bits, color=C_PURPLE, alpha=0.8)
    _ax_style(ax, xlabel="d", ylabel="log₂(d+1) bits/cycle",
              title="Per-Cycle Information Gain")

    fig.tight_layout(pad=0.8)
    save_panel(fig, "panel_4.png")

# ══════════════════════════════════════════════════════════════════════════════
# P5  Sender Graph Rate-Invariance
# ══════════════════════════════════════════════════════════════════════════════
def panel_5():
    fig, axes = plt.subplots(1, 4, figsize=(PANEL_W, PANEL_H))
    fig.patch.set_facecolor("white")

    def T(n, d): return d * (d + 1) ** (n - 1)

    rates = [1, 10, 100, 1000, 7500]
    n_vals = [3, 5, 7, 10]
    d = 3

    # 5a  vertex count vs rate (flat lines — rate-invariant)
    ax = axes[0]
    for n, col in zip(n_vals, [C_BLUE, C_ORANGE, C_GREEN, C_PURPLE]):
        y = [T(n, d)] * len(rates)
        ax.plot(rates, y, "o-", color=col, ms=4, lw=1.4, label=f"n={n}")
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.legend(fontsize=TICK_FS, frameon=False)
    _ax_style(ax, xlabel="rate r", ylabel="|V(Gs)|",
              title="Vertex Count vs Rate (Rate-Invariant)")

    # 5b  edge count growth with n at fixed rate
    ax = axes[1]
    # edges ≈ vertices * (d+1) for the refinement graph
    n_range = np.arange(1, 12)
    for d_val, col in [(2, C_BLUE), (3, C_ORANGE), (4, C_GREEN)]:
        edges = [T(n, d_val) * (d_val + 1) for n in n_range]
        ax.semilogy(n_range, edges, "s-", color=col, ms=4, lw=1.3, label=f"d={d_val}")
    ax.legend(fontsize=TICK_FS, frameon=False)
    _ax_style(ax, xlabel="n", ylabel="edges [log]",
              title="Edge Growth vs Depth n")

    # 5c  3D: vertex count over (n, rate) — flat in rate dimension
    ax3 = fig.add_subplot(1, 4, 3, projection="3d")
    n_g = np.arange(1, 9)
    r_g = np.logspace(0, 4, 20)
    NG, RG = np.meshgrid(n_g, r_g)
    VG = 3 * 4 ** (NG - 1)  # d=3 fixed
    ax3.plot_surface(NG, np.log10(RG), np.log10(VG + 1),
                     cmap=cm.Blues, alpha=0.85, linewidth=0)
    _ax3d_style(ax3, xlabel="n", ylabel="log₁₀ r", zlabel="log₁₀ |V|",
                title="Vertex Count Surface (d=3)")

    # 5d  ratio T(n+1,d)/T(n,d) = (d+1), constant
    ax = axes[3]
    n_r = np.arange(1, 12)
    for d_val, col in [(2, C_BLUE), (3, C_ORANGE), (4, C_GREEN)]:
        ratio = [(d_val + 1)] * len(n_r)
        ax.plot(n_r, ratio, "o--", color=col, ms=4, lw=1.2, label=f"d={d_val}")
    ax.set_ylim(0, 7)
    ax.legend(fontsize=TICK_FS, frameon=False)
    _ax_style(ax, xlabel="n", ylabel="T(n+1)/T(n)",
              title="Growth Ratio = d+1 (Constant)")

    fig.tight_layout(pad=0.8)
    save_panel(fig, "panel_5.png")

# ══════════════════════════════════════════════════════════════════════════════
# P6  Propagation Equilibrium
# ══════════════════════════════════════════════════════════════════════════════
def panel_6():
    fig, axes = plt.subplots(1, 4, figsize=(PANEL_W, PANEL_H))
    fig.patch.set_facecolor("white")

    tau = 30.0
    omega = 0.013
    r_star = tau / omega   # ≈ 2308
    rates = np.logspace(1, 4.5, 500)
    comp_dur = tau / rates

    # 6a  sender (constant) and receiver (step) graph sizes
    ax = axes[0]
    sender_size = np.ones_like(rates) * 1.0   # normalised to 1
    receiver_size = np.where(comp_dur >= omega, comp_dur / tau, 0.0)
    ax.fill_between(rates, sender_size, alpha=0.12, color=C_BLUE, label="sender")
    ax.plot(rates, sender_size, color=C_BLUE, lw=1.5)
    ax.fill_between(rates, receiver_size, alpha=0.18, color=C_ORANGE, label="receiver")
    ax.plot(rates, receiver_size, color=C_ORANGE, lw=1.5)
    ax.axvline(r_star, color=C_RED, lw=1.0, ls="--")
    ax.set_xscale("log")
    ax.legend(fontsize=TICK_FS, frameon=False)
    _ax_style(ax, xlabel="rate r", ylabel="graph size (norm)",
              title="Sender vs Receiver Graph Size")

    # 6b  equilibrium indicator
    ax = axes[1]
    equil = np.where(rates > r_star, 1.0, 0.0)
    ax.fill_between(rates, equil, alpha=0.3, color=C_GREEN)
    ax.plot(rates, equil, color=C_GREEN, lw=1.5)
    ax.axvline(r_star, color=C_RED, lw=1.0, ls="--")
    ax.set_xscale("log")
    ax.set_ylim(-0.05, 1.15)
    _ax_style(ax, xlabel="rate r", ylabel="equilibrium",
              title="Equilibrium Indicator vs Rate")

    # 6c  3D equilibrium surface over (tau, omega, rate)
    ax3 = fig.add_subplot(1, 4, 3, projection="3d")
    t_g = np.linspace(5, 60, 30)
    r_g = np.linspace(500, 8000, 30)
    TG, RG = np.meshgrid(t_g, r_g)
    OMEGA_REF = 0.013
    EQUIL = np.where(RG > TG / OMEGA_REF, 1.0, 0.0)
    ax3.plot_surface(TG, RG, EQUIL, cmap=cm.RdYlGn, alpha=0.82, linewidth=0)
    _ax3d_style(ax3, xlabel="τ (s)", ylabel="r", zlabel="equilibrium",
                title="Equilibrium Surface (ω=13ms)")

    # 6d  stability region: shaded open set (r*, ∞)
    ax = axes[3]
    r_range = np.linspace(0, 10000, 1000)
    ax.axvspan(r_star, 10000, alpha=0.18, color=C_GREEN, label="equilibrium region")
    ax.axvline(r_star, color=C_RED, lw=1.2, ls="--", label="r*")
    ax.set_xlim(0, 10000)
    ax.set_ylim(0, 1)
    ax.set_yticks([])
    ax.legend(fontsize=TICK_FS, frameon=False)
    _ax_style(ax, xlabel="rate r", ylabel="",
              title="Stability Region (r*, ∞)")

    fig.tight_layout(pad=0.8)
    save_panel(fig, "panel_6.png")

# ══════════════════════════════════════════════════════════════════════════════
# P7  Telemetry Preservation
# ══════════════════════════════════════════════════════════════════════════════
def panel_7():
    fig, axes = plt.subplots(1, 4, figsize=(PANEL_W, PANEL_H))
    fig.patch.set_facecolor("white")

    tau = 30.0
    n_segs = 5
    rates_tested = [1, 10, 100, 1000, 2308, 7500, 100000]

    # Reference timestamps (uncompressed)
    seg_dur = tau / n_segs
    ref_ts = [0.0] + [(i + 1) * seg_dur for i in range(n_segs)] + [tau]
    n_events = len(ref_ts)

    # 7a  timestamp scaling: compressed vs reference for each rate
    ax = axes[0]
    for rate, col in zip([1, 100, 7500], [C_BLUE, C_ORANGE, C_GREEN]):
        comp_ts = [t / rate * 1000 for t in ref_ts]   # ms
        ax.plot(range(n_events), comp_ts, "o-", color=col,
                ms=4, lw=1.3, label=f"r={rate}")
    ax.legend(fontsize=TICK_FS, frameon=False)
    _ax_style(ax, xlabel="event index", ylabel="timestamp (ms)",
              title="Timestamp Scaling by Rate")

    # 7b  label fidelity: 1.0 for all rates (bar chart)
    ax = axes[1]
    fidelity = [1.0] * len(rates_tested)
    ax.bar(range(len(rates_tested)), fidelity, color=C_BLUE, alpha=0.8)
    ax.set_xticks(range(len(rates_tested)))
    ax.set_xticklabels([str(r) for r in rates_tested], rotation=45,
                       fontsize=TICK_FS - 1)
    ax.set_ylim(0, 1.2)
    _ax_style(ax, xlabel="rate r", ylabel="label fidelity",
              title="Label Fidelity vs Rate (Always 1.0)")

    # 7c  3D: all timestamps for all rates
    ax3 = fig.add_subplot(1, 4, 3, projection="3d")
    r_plot = np.array([1, 10, 100, 1000, 7500], dtype=float)
    event_idx = np.arange(n_events, dtype=float)
    RI, EI = np.meshgrid(r_plot, event_idx)
    TS = np.array([[ref_ts[e] / r * 1000 for r in r_plot]
                   for e in range(n_events)])
    ax3.plot_surface(np.log10(RI), EI, TS,
                     cmap=cm.cool, alpha=0.85, linewidth=0)
    _ax3d_style(ax3, xlabel="log₁₀ r", ylabel="event idx",
                zlabel="timestamp (ms)",
                title="Telemetry Timestamps vs Rate")

    # 7d  ordering check: inter-event gaps (non-negative always)
    ax = axes[3]
    for rate, col in zip([1, 100, 7500], [C_BLUE, C_ORANGE, C_GREEN]):
        comp_ts = np.array([t / rate * 1000 for t in ref_ts])
        gaps = np.diff(comp_ts)
        ax.plot(range(len(gaps)), gaps, "o-", color=col,
                ms=4, lw=1.2, label=f"r={rate}")
    ax.axhline(0, color=C_GREY, lw=0.8, ls="--")
    ax.legend(fontsize=TICK_FS, frameon=False)
    _ax_style(ax, xlabel="gap index", ylabel="Δt (ms)",
              title="Inter-Event Gaps ≥ 0 (Ordering Preserved)")

    fig.tight_layout(pad=0.8)
    save_panel(fig, "panel_7.png")

# ══════════════════════════════════════════════════════════════════════════════
# P8  Adversarial Quiescence
# ══════════════════════════════════════════════════════════════════════════════
def panel_8():
    fig, axes = plt.subplots(1, 4, figsize=(PANEL_W, PANEL_H))
    fig.patch.set_facecolor("white")

    n_events = 7   # tx-start + 5 seg-complete + tx-end
    vocab_size = 21  # 1 valid + 20 invalid patterns

    rng = np.random.default_rng(42)

    # 8a  cross-demand vs label corruption fraction
    ax = axes[0]
    corrupt_fracs = np.linspace(0, 1, 100)
    # cross-demand = fraction of events with wrong label * n_events
    cross_demand = corrupt_fracs * n_events
    ax.plot(corrupt_fracs, cross_demand, color=C_BLUE, lw=1.5)
    ax.axhline(0, color=C_GREEN, lw=1.2, ls="--", label="quiescent (D=0)")
    ax.axhline(1, color=C_ORANGE, lw=1.0, ls=":", label="exception threshold")
    ax.fill_between(corrupt_fracs[corrupt_fracs == 0],
                    [0], [0], color=C_GREEN, alpha=0.4, label="quiescence zone")
    ax.scatter([0], [0], color=C_GREEN, s=50, zorder=5)
    ax.legend(fontsize=TICK_FS, frameon=False)
    _ax_style(ax, xlabel="corruption fraction", ylabel="cross-demand D",
              title="Cross-Demand vs Corruption Level")

    # 8b  quiescence boundary in (corruption, vocab_floor) space
    ax = axes[1]
    corr = np.linspace(0, 1, 200)
    beta_floor = np.linspace(0.01, 1.0, 200)
    CORR, BETA = np.meshgrid(corr, beta_floor)
    # quiescence: cross_demand (= corr * n_events) <= beta_floor
    QUIES = (CORR * n_events <= BETA).astype(float)
    ax.imshow(QUIES, origin="lower", aspect="auto",
              extent=[0, 1, 0.01, 1.0], cmap="RdYlGn", vmin=0, vmax=1)
    ax.set_xlabel("corruption fraction", fontsize=LABEL_FS)
    ax.set_ylabel("β_mon", fontsize=LABEL_FS)
    ax.set_title("Quiescence Boundary", fontsize=TITLE_FS, fontweight="bold", pad=4)
    ax.tick_params(labelsize=TICK_FS)

    # 8c  3D quiescence surface over (corruption, n_events_param)
    ax3 = fig.add_subplot(1, 4, 3, projection="3d")
    c_g = np.linspace(0, 1, 40)
    n_g = np.linspace(3, 15, 40)
    CG, NEG = np.meshgrid(c_g, n_g)
    BETA_MON = 1.0 / vocab_size
    DEMAND = CG * NEG
    QS = np.where(DEMAND <= BETA_MON, 1.0, 0.0)
    ax3.plot_surface(CG, NEG, DEMAND, cmap=cm.RdYlGn_r,
                     alpha=0.82, linewidth=0)
    _ax3d_style(ax3, xlabel="corruption", ylabel="n events",
                zlabel="cross-demand",
                title="Cross-Demand Surface D(c, n)")

    # 8d  phase diagram: monitoring receiver state
    ax = axes[3]
    # x-axis: compression rate, y-axis: # corrupted events
    r_axis = np.logspace(1, 5, 300)
    tau_s = 30.0
    omega_s = 0.013
    r_star_val = tau_s / omega_s

    n_corrupt_vals = [0, 1, 2, 3]
    exception_threshold = 1  # raise exception if cross-demand > 1

    for nc, col in zip(n_corrupt_vals, [C_GREEN, C_ORANGE, C_RED, C_PURPLE]):
        # For a compressed-but-complete signal, corruption = nc/n_events
        # For authentic compressed signal: nc=0 always
        demand = nc   # n_corrupt events with wrong label
        label = f"{nc} corrupt events"
        # quiescent if demand <= floor (floor ~ 1 here, exception at >1)
        quies_line = np.where(demand <= exception_threshold, 1.0, 0.0)
        ax.axhline(demand, color=col, lw=1.3, label=label)

    ax.axvline(r_star_val, color=C_GREY, lw=1.0, ls="--")
    ax.axhline(exception_threshold, color=C_RED, lw=0.8, ls=":")
    ax.set_xscale("log")
    ax.set_ylim(-0.3, 4)
    ax.legend(fontsize=TICK_FS - 1, frameon=False)
    _ax_style(ax, xlabel="rate r", ylabel="cross-demand D",
              title="Monitoring Phase Diagram")

    fig.tight_layout(pad=0.8)
    save_panel(fig, "panel_8.png")

# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("Generating panels...")
    panel_1()
    panel_2()
    panel_3()
    panel_4()
    panel_5()
    panel_6()
    panel_7()
    panel_8()
    print("Done.")
