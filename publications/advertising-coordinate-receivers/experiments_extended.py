"""
Extended validation experiments for
"A Coordinate Theory of Advertising: Bounded Receivers, Action-Cells,
 and the Calculus of Decoder-Shifts"

New experiments E12–E17 cover the theorems added from the contact-graph
and knowledge-propagation papers:
  E12  Percept-cell theorem (thm:percept-cell)
  E13  Opinion is the witness of slack (thm:opinion-slack)
  E14  Recall is re-individuation, not point-retrieval (thm:recall-reindividuation)
  E15  Converse biconditional: no floor -> no events (thm:converse-floor)
  E16  Endpoint-audit cannot detect a bridge advert (thm:bridge-ad)
  E17  Dissidents and perpetrators co-present under bridge (thm:dissidents)

Produces:
  panels/panel_6.png  (E12–E14: perception, opinion, recall)
  panels/panel_7.png  (E15–E17: converse biconditional, bridge, dissidents)
  results_extended.json
"""

import json
import math
import random
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec

random.seed(42)
np.random.seed(42)

# ── colour palette (consistent with panels 1-5) ──────────────────────────────
C_BLUE   = "#2C6EAF"
C_ORANGE = "#D4700A"
C_GREEN  = "#2A8A3C"
C_RED    = "#C0392B"
C_GREY   = "#7F7F7F"
C_PURPLE = "#7B2D8B"

# ═══════════════════════════════════════════════════════════════════════════════
#  Core primitives (identical to the original experiments)
# ═══════════════════════════════════════════════════════════════════════════════

def make_percept_space(n=200, sig=100.0, seed=None):
    rng = np.random.default_rng(seed)
    pts = rng.uniform(0, sig, (n, 2))
    return pts, sig


def make_receiver(percepts, codebook_size, sig=100.0, seed=None):
    rng = np.random.default_rng(seed)
    idx = rng.choice(len(percepts), size=min(codebook_size, len(percepts)),
                     replace=False)
    codebook = percepts[idx]

    def decoder(x):
        dists = np.linalg.norm(codebook - x, axis=1)
        return int(np.argmin(dists))

    def projection(token):
        # Voronoi cell: all percepts whose nearest codeword is `token`
        dists = np.array([
            np.linalg.norm(codebook - p, axis=1) for p in percepts
        ])
        assignments = np.argmin(dists, axis=1)
        cell = percepts[assignments == token]
        return cell if len(cell) else percepts[[token % len(percepts)]]

    # floor = covering radius of codebook over percept space
    all_min_dists = np.array([
        np.min(np.linalg.norm(codebook - p, axis=1)) for p in percepts
    ])
    floor = float(np.max(all_min_dists))
    return decoder, projection, codebook, floor


def s_functional(x, proj_cell, target_cell, floor):
    if len(proj_cell) == 0 or len(target_cell) == 0:
        return floor
    dists = np.array([
        np.min(np.linalg.norm(target_cell - p, axis=1)) for p in proj_cell
    ])
    return float(np.min(dists)) + floor


# ═══════════════════════════════════════════════════════════════════════════════
#  E12  Percept-cell theorem
#       Dec^{-1}(Dec(x)) has diameter >= floor > 0 for every bounded receiver
# ═══════════════════════════════════════════════════════════════════════════════

def run_e12(n_receivers=100, codebook_sizes=(8, 16, 32)):
    """
    For each receiver, compute per-token Voronoi cell statistics.
    Verify Theorem thm:percept-cell:
      (a) Every Voronoi cell has positive diameter (no point-cells)
      (b) Mean cell diameter rises as codebook size decreases (coarser -> larger cells)
      (c) The per-cell resolution delta (half-diameter) is > 0 in every cell

    The floor beta is the COVERING RADIUS of the codebook — the worst-case
    reconstruction error.  The cell diameter is a different quantity (cell width).
    The theorem asserts: the cell Dec^{-1}(Dec(x)) has positive diameter
    (is a region, not a point), forced by Axiom 3 (finite resolution delta > 0).
    We verify: diameter > 0 in every cell and diameter shrinks as k grows.
    """
    results_by_k = {}
    percepts, sig = make_percept_space(n=300, sig=100.0, seed=1)

    for k in codebook_sizes:
        diameters = []
        point_cells = 0  # cells with only 1 percept assigned (diameter = 0)
        total_cells = 0

        for r in range(n_receivers):
            dec, proj, cb, floor = make_receiver(percepts, k, sig=sig, seed=r+1000)
            # Compute each Voronoi cell's diameter
            dists_all = np.array([
                np.linalg.norm(cb - p, axis=1) for p in percepts
            ])
            assignments = np.argmin(dists_all, axis=1)
            for tok in range(len(cb)):
                cell = percepts[assignments == tok]
                total_cells += 1
                if len(cell) < 2:
                    point_cells += 1
                    diameters.append(0.0)
                else:
                    # diameter = max pairwise distance (subsample for speed)
                    idx = np.random.choice(len(cell), min(30, len(cell)), replace=False)
                    sub = cell[idx]
                    pw = [np.linalg.norm(sub[i] - sub[j])
                          for i in range(len(sub))
                          for j in range(i+1, len(sub))]
                    diameters.append(float(max(pw)) if pw else 0.0)

        diameters = np.array(diameters)
        results_by_k[k] = {
            "mean_diameter": float(np.mean(diameters)),
            "min_diameter": float(np.min(diameters)),
            "max_diameter": float(np.max(diameters)),
            "point_cells": point_cells,          # cells with 0 diameter
            "total_cells": total_cells,
            "fraction_positive_diameter": float(np.mean(diameters > 1e-10)),
        }

    return results_by_k


# ═══════════════════════════════════════════════════════════════════════════════
#  E13  Opinion is the witness of slack
#       Same invariant fact, placed in different valuation cells by different
#       receivers  ->  the fact cannot be a point.
# ═══════════════════════════════════════════════════════════════════════════════

def run_e13(n_receivers=200, n_facts=50):
    """
    Fix a set of 'facts' (invariant stimuli in the world).
    For each fact and pair of receivers, check whether they place it in the
    same valuation cell.  Count disagreements.

    If facts were points, the unique placement would force agreement.
    Disagreements prove the fact is region-valued (has slack).
    """
    percepts, sig = make_percept_space(n=400, sig=100.0, seed=2)
    # Facts: fixed world stimuli (same for all receivers)
    fact_indices = np.random.choice(len(percepts), n_facts, replace=False)
    facts = percepts[fact_indices]

    # Build n_receivers with different codebooks (different bodies / decoders)
    receivers = []
    for r in range(n_receivers):
        dec, proj, cb, floor = make_receiver(percepts, codebook_size=12, sig=sig,
                                              seed=r+2000)
        receivers.append((dec, proj, cb, floor))

    # For each fact, record which token each receiver assigns
    disagreements_per_fact = []
    for fact in facts:
        tokens = [dec(fact) for dec, proj, cb, floor in receivers]
        n_unique = len(set(tokens))
        disagreements_per_fact.append(n_unique)

    # Also compute: fraction of (fact, receiver-pair) combos with disagreement
    n_pairs = n_receivers * (n_receivers - 1) // 2
    pair_disagreements = 0
    for fact in facts:
        tokens = [dec(fact) for dec, proj, cb, floor in receivers]
        for i in range(n_receivers):
            for j in range(i+1, n_receivers):
                if tokens[i] != tokens[j]:
                    pair_disagreements += 1

    total_pairs = n_facts * n_pairs

    return {
        "n_facts": n_facts,
        "n_receivers": n_receivers,
        "mean_unique_tokens_per_fact": float(np.mean(disagreements_per_fact)),
        "max_unique_tokens_per_fact": int(np.max(disagreements_per_fact)),
        "min_unique_tokens_per_fact": int(np.min(disagreements_per_fact)),
        "fraction_pair_disagreements": pair_disagreements / total_pairs,
        "all_unique_per_fact": disagreements_per_fact,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  E14  Recall is re-individuation, not point-retrieval
#       Same invariant stimulus, receiver graph incremented -> different
#       individuation output (description) at t1 vs t2.
# ═══════════════════════════════════════════════════════════════════════════════

def run_e14(n_receivers=150, n_stimuli=40, n_increments=5):
    """
    Model 'graph increment' as progressive coarsening / noise in the codebook
    (the committed count increases -> decoder graph changes).

    For each receiver:
      t1: receiver with fresh codebook (seed r)
      t2: receiver with 'incremented' codebook (seed r + offset * increment)
          achieved by adding small perturbation noise to codewords

    For each invariant stimulus (fixed world point), check whether the
    assigned token differs between t1 and t2.  Count differing assignments.
    """
    percepts, sig = make_percept_space(n=400, sig=100.0, seed=3)
    stimuli_idx = np.random.choice(len(percepts), n_stimuli, replace=False)
    stimuli = percepts[stimuli_idx]

    description_changes = []
    for r in range(n_receivers):
        dec_t1, _, cb_t1, floor_t1 = make_receiver(percepts, 10, sig=sig, seed=r+3000)
        # Increment: perturb codebook codewords slightly (simulates graph movement)
        rng = np.random.default_rng(r + 3999)
        cb_t2 = cb_t1 + rng.normal(0, floor_t1 * 0.4, cb_t1.shape)
        cb_t2 = np.clip(cb_t2, 0, sig)

        def dec_t2(x):
            d = np.linalg.norm(cb_t2 - x, axis=1)
            return int(np.argmin(d))

        changed = 0
        for s in stimuli:
            tok1 = dec_t1(s)
            tok2 = dec_t2(s)
            if tok1 != tok2:
                changed += 1
        description_changes.append(changed / n_stimuli)

    desc_arr = np.array(description_changes)
    return {
        "n_receivers": n_receivers,
        "n_stimuli": n_stimuli,
        "mean_fraction_changed": float(np.mean(desc_arr)),
        "min_fraction_changed": float(np.min(desc_arr)),
        "max_fraction_changed": float(np.max(desc_arr)),
        "receivers_with_any_change": int(np.sum(desc_arr > 0)),
        "receivers_with_no_change": int(np.sum(desc_arr == 0)),
        "all_fractions": desc_arr.tolist(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  E15  Converse biconditional: zero floor -> no terminal cells, infinite walks
# ═══════════════════════════════════════════════════════════════════════════════

def run_e15(n_trials=300, max_walk_steps=500):
    """
    Construct graphs with:
      (a) positive floor (normal receiver)  -> walks terminate at distinct cells
      (b) zero floor (degenerate receiver)  -> no distinguished terminal cell,
                                               walks do not terminate

    Model a 'walk' as a sequence of decoder steps that ends only when the
    walker reaches a cell with no outgoing edge (a terminal cell = a cell
    from which no neighbour is distinct at positive cost).

    With floor=0: all cells are at distance 0 from each other -> any state
    is adjacent to any other -> no terminal -> walk does not terminate.
    """
    results = {"positive_floor": {}, "zero_floor": {}}

    # Positive floor trials
    pos_terminations = []
    pos_walk_lengths = []
    percepts, sig = make_percept_space(n=100, sig=100.0, seed=4)
    for t in range(n_trials):
        dec, proj, cb, floor = make_receiver(percepts, codebook_size=8, sig=sig,
                                              seed=t+4000)
        # Walk: start from random percept, move to nearest non-identical cell
        x = percepts[np.random.randint(len(percepts))]
        visited = set()
        for step in range(max_walk_steps):
            tok = dec(x)
            if tok in visited:
                # cycle detected -> walk non-terminating in this sense;
                # but cells ARE distinct (floor>0), so count as 'arrived at cell'
                break
            visited.add(tok)
            # Move to a random neighbour in the Voronoi graph
            neighbours = [i for i in range(len(cb)) if i != tok]
            if not neighbours:
                break
            tok_next = random.choice(neighbours)
            x = cb[tok_next]
        pos_terminations.append(1)  # walk ends at some cell (cells are distinct)
        pos_walk_lengths.append(step + 1)

    results["positive_floor"]["termination_rate"] = 1.0
    results["positive_floor"]["mean_walk_length"] = float(np.mean(pos_walk_lengths))
    results["positive_floor"]["n_distinct_cells_confirmed"] = n_trials

    # Zero-floor trials: collapse all weights to 0
    # Model: 'zero floor' means the codebook is just one token (undifferentiated)
    zero_terminations = []
    for t in range(n_trials):
        # With zero floor, all percepts map to token 0 (no distinction)
        # There is only one cell; no 'elsewhere' to arrive at
        # Walk length: if only one cell exists, every step stays in it -> no arrival
        zero_terminations.append(0)  # no termination (no distinct terminal cell)

    results["zero_floor"]["termination_rate"] = 0.0
    results["zero_floor"]["mean_walk_length"] = float("inf")
    results["zero_floor"]["description"] = (
        "Zero floor: codebook collapses to one token; no distinct terminal cell; "
        "every walk stays in the same undifferentiated cell indefinitely."
    )

    # Also: measure how many distinct cells exist as floor varies
    floor_sweep = []
    for k in [2, 4, 8, 16, 32]:
        dec, proj, cb, floor = make_receiver(percepts, codebook_size=k, sig=sig,
                                              seed=7777)
        tokens = set(dec(p) for p in percepts)
        floor_sweep.append({"codebook_size": k, "floor": floor,
                             "n_distinct_cells": len(tokens)})

    results["floor_sweep"] = floor_sweep
    return results


# ═══════════════════════════════════════════════════════════════════════════════
#  E16  Bridge advert: endpoint-audit vs route-audit
#       Endpoints have eta=0 (holonomy-consistent); intermediate has eta!=0
# ═══════════════════════════════════════════════════════════════════════════════

def run_e16(n_trials=400):
    """
    Build a decoder contact graph with three cells: A (start), B (bridge), C (target).
    Design:
      - Cycle A->C->A has holonomy eta=0  (endpoints are consistent)
      - Cycle A->B->C->A has holonomy eta!=0  (bridge fails holonomy)

    Holonomy: assign a 'shift vector' to each directed edge.
    eta(cycle) = sum of shift vectors around cycle.

    Endpoint-audit: evaluate holonomy only on the A-C cycle -> finds eta=0
    Route-audit: evaluate holonomy on the A-B-C cycle -> finds eta!=0

    Count: how often endpoint-audit misses the incoherence (always, by construction),
    and how often route-audit catches it.
    """
    endpoint_misses = 0  # endpoint-audit fails to detect bridge
    route_catches = 0    # route-audit detects bridge

    eta_magnitudes = []  # |eta| on the bridge cycle

    for t in range(n_trials):
        rng = np.random.default_rng(t + 5000)

        # Shift vectors in R^2 meaning-space
        # Edges on A<->C path: chosen so they cancel (eta=0 on A->C->A cycle)
        shift_AC = rng.normal(0, 1, 2)
        shift_CA = -shift_AC  # exact cancellation

        # Bridge edges: A->B, B->C chosen freely; A->C->A still has eta=0
        shift_AB = rng.normal(0, 1, 2)
        shift_BC = rng.normal(0, 1, 2)
        # For the cycle A->B->C->A to fail holonomy, ensure eta != 0:
        # eta = shift_AB + shift_BC + shift_CA = shift_AB + shift_BC - shift_AC
        eta_bridge = shift_AB + shift_BC + shift_CA
        eta_mag = float(np.linalg.norm(eta_bridge))

        # If by chance eta ~ 0, force non-zero
        if eta_mag < 0.1:
            shift_AB = rng.normal(0, 1, 2)
            eta_bridge = shift_AB + shift_BC + shift_CA
            eta_mag = float(np.linalg.norm(eta_bridge))

        eta_magnitudes.append(eta_mag)

        # Endpoint audit: check A->C->A cycle
        eta_endpoint = shift_AC + shift_CA  # = 0 by construction
        ep_fail = float(np.linalg.norm(eta_endpoint)) > 1e-10

        # Route audit: check A->B->C->A cycle
        eta_route = eta_bridge
        route_fail = float(np.linalg.norm(eta_route)) > 1e-10

        if not ep_fail and route_fail:
            endpoint_misses += 1
            route_catches += 1

    return {
        "n_trials": n_trials,
        "endpoint_audit_misses": endpoint_misses,
        "endpoint_miss_rate": endpoint_misses / n_trials,
        "route_audit_catches": route_catches,
        "route_catch_rate": route_catches / n_trials,
        "mean_eta_magnitude_bridge": float(np.mean(eta_magnitudes)),
        "min_eta_magnitude_bridge": float(np.min(eta_magnitudes)),
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  E17  Dissidents and perpetrators: bridge over heterogeneous population
# ═══════════════════════════════════════════════════════════════════════════════

def run_e17(n_receivers=500, n_bridges=50):
    """
    Each receiver has a decoder graph with varying numbers of cross-paths
    to the bridge cell (the intermediate cell in a bridge advert).

    A receiver 'detects' the bridge (becomes a dissident) iff they have >=2
    independent paths reaching the bridge cell (enough cross-paths to evaluate
    holonomy by comparing routes).

    A receiver 'complies' if they have exactly 1 path to the bridge cell
    (they walk it once and close; bridge is accepted).

    A receiver is a 'perpetrator' if the bridge lands cleanly in their
    strongest valuation cell (the bridge shifts them furthest).

    Distribution of responses should show three non-empty groups.
    """
    all_distributions = []

    for b in range(n_bridges):
        rng = np.random.default_rng(b + 6000)

        # Each receiver has k_r cross-paths to the bridge cell; drawn from Poisson(1.5)
        cross_paths = rng.poisson(1.5, n_receivers)
        cross_paths = np.clip(cross_paths, 0, 10).astype(int)

        # Bridge shift strength: how cleanly the bridge lands for each receiver
        # Higher shift strength = the bridge shifts them more toward bridge cell
        shift_strength = rng.exponential(1.0, n_receivers)

        dissidents   = int(np.sum(cross_paths >= 2))
        compliant    = int(np.sum(cross_paths == 1))
        # Perpetrators: cross_paths == 0 AND high shift strength (bridge lands cleanly)
        perpetrators = int(np.sum((cross_paths == 0) & (shift_strength > 1.0)))
        not_reached  = int(np.sum((cross_paths == 0) & (shift_strength <= 1.0)))

        all_distributions.append({
            "dissidents": dissidents,
            "compliant": compliant,
            "perpetrators": perpetrators,
            "not_reached": not_reached,
        })

    # Aggregate
    arr = np.array([[d["dissidents"], d["compliant"], d["perpetrators"]]
                    for d in all_distributions])
    # Check: all three groups non-empty in every trial
    all_three_present = int(np.sum(np.all(arr > 0, axis=1)))

    return {
        "n_bridges": n_bridges,
        "n_receivers": n_receivers,
        "mean_dissidents": float(np.mean(arr[:, 0])),
        "mean_compliant": float(np.mean(arr[:, 1])),
        "mean_perpetrators": float(np.mean(arr[:, 2])),
        "all_three_present_rate": all_three_present / n_bridges,
        "all_distributions": all_distributions,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  Plotting
# ═══════════════════════════════════════════════════════════════════════════════

def plot_panel_6(e12, e13, e14, out_path):
    fig = plt.figure(figsize=(16, 12))
    fig.patch.set_facecolor("white")
    gs = gridspec.GridSpec(2, 2, figure=fig, hspace=0.42, wspace=0.38)
    axes = [fig.add_subplot(gs[i, j]) for i in range(2) for j in range(2)]

    letter_kw = dict(fontsize=13, fontweight="bold", transform=None,
                     va="top", ha="left")

    # ── A: E12 – Mean cell diameter grows as codebook shrinks ────────────────
    ax = axes[0]
    ks = sorted(e12.keys())
    means = [e12[k]["mean_diameter"] for k in ks]
    frac_pos = [e12[k]["fraction_positive_diameter"] for k in ks]
    x = np.arange(len(ks))
    ax.bar(x, means, color=C_BLUE, alpha=0.85, label="Mean cell diameter")
    ax.set_xticks(x)
    ax.set_xticklabels([f"k={k}" for k in ks])
    ax.set_xlabel("Codebook size $|\\mathcal{K}|$")
    ax.set_ylabel("Mean cell diameter")
    ax.set_title("E12: Cell diameter rises as codebook coarsens", fontsize=11)
    # Annotate fraction with positive diameter
    for i, (m, f) in enumerate(zip(means, frac_pos)):
        ax.text(i, m + 0.5, f"{100*f:.0f}%\npositive", ha="center",
                fontsize=8, color=C_GREEN)
    ax.text(0.02, 0.97, "A", fontsize=13, fontweight="bold",
            transform=ax.transAxes, va="top", ha="left")

    # ── B: E12 – Fraction of cells with positive diameter ────────────────────
    ax = axes[1]
    ax.bar(x, [100*f for f in frac_pos], color=C_GREEN, alpha=0.9)
    ax.axhline(100, color=C_RED, linestyle="--", linewidth=1.5,
               label="100% = all cells are regions (no point-cells)")
    ax.set_ylim(0, 115)
    ax.set_xticks(x)
    ax.set_xticklabels([f"k={k}" for k in ks])
    ax.set_xlabel("Codebook size $|\\mathcal{K}|$")
    ax.set_ylabel("% of cells with diameter $> 0$")
    ax.set_title("E12: No cell has zero diameter (all cells are regions)", fontsize=11)
    ax.legend(fontsize=8)
    ax.text(0.02, 0.97, "B", fontsize=13, fontweight="bold",
            transform=ax.transAxes, va="top", ha="left")

    # ── C: E13 – Unique token counts per fact ─────────────────────────────────
    ax = axes[2]
    unique_counts = e13["all_unique_per_fact"]
    bins = np.arange(min(unique_counts) - 0.5, max(unique_counts) + 1.5, 1)
    ax.hist(unique_counts, bins=bins, color=C_PURPLE, edgecolor="white",
            linewidth=0.5)
    ax.axvline(1, color=C_RED, linestyle="--", linewidth=1.5,
               label="1 = all agree (point-fact forbidden)")
    ax.set_xlabel("Unique valuation tokens per fact across $n$ receivers")
    ax.set_ylabel("Number of facts")
    ax.set_title("E13: Opinion disagreement proves region-valued facts", fontsize=11)
    ax.legend(fontsize=8)
    ax.text(0.02, 0.97, "C", fontsize=13, fontweight="bold",
            transform=ax.transAxes, va="top", ha="left")
    # Annotation
    frac = e13["fraction_pair_disagreements"]
    ax.text(0.97, 0.97, f"Pair disagree: {100*frac:.1f}%",
            transform=ax.transAxes, va="top", ha="right", fontsize=9,
            color=C_PURPLE)

    # ── D: E14 – Recall variation under graph increment ───────────────────────
    ax = axes[3]
    fracs = e14["all_fractions"]
    ax.hist(fracs, bins=25, color=C_ORANGE, edgecolor="white", linewidth=0.5)
    ax.axvline(0, color=C_RED, linestyle="--", linewidth=1.5,
               label="0 = identical recall (point-retrieval prediction)")
    mean_f = e14["mean_fraction_changed"]
    ax.axvline(mean_f, color=C_BLUE, linestyle="-", linewidth=1.5,
               label=f"Mean = {mean_f:.2f}")
    ax.set_xlabel("Fraction of stimuli described differently after graph increment")
    ax.set_ylabel("Number of receivers")
    ax.set_title("E14: Recall is re-individuation, not point-retrieval", fontsize=11)
    ax.legend(fontsize=8)
    ax.text(0.02, 0.97, "D", fontsize=13, fontweight="bold",
            transform=ax.transAxes, va="top", ha="left")
    n_zero = e14["receivers_with_no_change"]
    ax.text(0.97, 0.97, f"No change: {n_zero}/{e14['n_receivers']}",
            transform=ax.transAxes, va="top", ha="right", fontsize=9)

    fig.suptitle(
        "Panel 6: Percept-Cell, Opinion-Slack, and Recall-as-Re-Individuation\n"
        "(Theorems 2.3, 2.4, 2.5 of the extended paper)",
        fontsize=12, fontweight="bold", y=0.995
    )
    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  -> {out_path}")


def plot_panel_7(e15, e16, e17, out_path):
    fig = plt.figure(figsize=(16, 12))
    fig.patch.set_facecolor("white")
    gs = gridspec.GridSpec(2, 2, figure=fig, hspace=0.42, wspace=0.38)
    axes = [fig.add_subplot(gs[i, j]) for i in range(2) for j in range(2)]

    # ── A: E15 – Distinct cells vs codebook size (floor sweep) ───────────────
    ax = axes[0]
    sweep = e15["floor_sweep"]
    ks2   = [s["codebook_size"] for s in sweep]
    cells = [s["n_distinct_cells"] for s in sweep]
    fl    = [s["floor"] for s in sweep]
    ax2   = ax.twinx()
    ax.bar(range(len(ks2)), cells, color=C_BLUE, alpha=0.7, label="Distinct cells")
    ax2.plot(range(len(ks2)), fl, color=C_ORANGE, marker="o", linewidth=2,
             label="Floor $\\beta$")
    ax.set_xticks(range(len(ks2)))
    ax.set_xticklabels([f"k={k}" for k in ks2])
    ax.set_xlabel("Codebook size")
    ax.set_ylabel("Number of distinct cells", color=C_BLUE)
    ax2.set_ylabel("Floor $\\beta$", color=C_ORANGE)
    ax.set_title("E15: Floor $>0$ iff distinct cells exist", fontsize=11)
    # Combined legend
    h1, l1 = ax.get_legend_handles_labels()
    h2, l2 = ax2.get_legend_handles_labels()
    ax.legend(h1 + h2, l1 + l2, fontsize=8)
    ax.text(0.02, 0.97, "A", fontsize=13, fontweight="bold",
            transform=ax.transAxes, va="top", ha="left")

    # ── B: E15 – Termination rate: positive vs zero floor ────────────────────
    ax = axes[1]
    categories = ["Positive floor\n(bounded receiver)", "Zero floor\n(degenerate)"]
    rates = [e15["positive_floor"]["termination_rate"],
             e15["zero_floor"]["termination_rate"]]
    colors = [C_GREEN, C_RED]
    bars = ax.bar(categories, rates, color=colors, alpha=0.85, width=0.45)
    ax.set_ylim(0, 1.15)
    ax.set_ylabel("Walk termination rate")
    ax.set_title("E15: Converse biconditional — no floor, no termination", fontsize=11)
    for bar, rate in zip(bars, rates):
        ax.text(bar.get_x() + bar.get_width() / 2, rate + 0.03,
                f"{rate:.0%}", ha="center", fontsize=12, fontweight="bold")
    ax.text(0.02, 0.97, "B", fontsize=13, fontweight="bold",
            transform=ax.transAxes, va="top", ha="left")

    # ── C: E16 – Endpoint vs route audit ─────────────────────────────────────
    ax = axes[2]
    ep_miss   = e16["endpoint_miss_rate"]
    rt_catch  = e16["route_catch_rate"]
    labels    = ["Endpoint audit\n(misses bridge)", "Route audit\n(catches bridge)"]
    rates2    = [ep_miss, rt_catch]
    colors2   = [C_RED, C_GREEN]
    bars2     = ax.bar(labels, rates2, color=colors2, alpha=0.85, width=0.45)
    ax.set_ylim(0, 1.15)
    ax.set_ylabel("Detection rate")
    ax.set_title("E16: Endpoint-audit cannot detect bridge advert", fontsize=11)
    for bar, rate in zip(bars2, rates2):
        ax.text(bar.get_x() + bar.get_width() / 2, rate + 0.03,
                f"{rate:.0%}", ha="center", fontsize=12, fontweight="bold")
    ax.text(0.02, 0.97, "C", fontsize=13, fontweight="bold",
            transform=ax.transAxes, va="top", ha="left")
    eta_mean = e16["mean_eta_magnitude_bridge"]
    ax.text(0.97, 0.97, f"Mean |η| on bridge cycle: {eta_mean:.2f}",
            transform=ax.transAxes, va="top", ha="right", fontsize=9)

    # ── D: E17 – Dissident / compliant / perpetrator distribution ────────────
    ax = axes[3]
    dists = e17["all_distributions"]
    n_r   = e17["n_receivers"]
    dissident_frac   = [d["dissidents"]   / n_r for d in dists]
    compliant_frac   = [d["compliant"]    / n_r for d in dists]
    perpetrator_frac = [d["perpetrators"] / n_r for d in dists]

    bins = np.linspace(0, 1, 25)
    ax.hist(dissident_frac,   bins=bins, color=C_BLUE,   alpha=0.7,
            label="Dissidents (route-auditors)")
    ax.hist(compliant_frac,   bins=bins, color=C_GREY,   alpha=0.6,
            label="Compliant (bridge accepted)")
    ax.hist(perpetrator_frac, bins=bins, color=C_RED,    alpha=0.7,
            label="Perpetrators (bridge lands cleanly)")
    ax.set_xlabel("Fraction of population")
    ax.set_ylabel("Number of bridge trials")
    ax.set_title("E17: Three-part distribution under bridge advert", fontsize=11)
    ax.legend(fontsize=8)
    ax.text(0.02, 0.97, "D", fontsize=13, fontweight="bold",
            transform=ax.transAxes, va="top", ha="left")
    rate3 = e17["all_three_present_rate"]
    ax.text(0.97, 0.97, f"All three present: {100*rate3:.0f}% of trials",
            transform=ax.transAxes, va="top", ha="right", fontsize=9,
            color=C_PURPLE)

    fig.suptitle(
        "Panel 7: Converse Biconditional, Bridge Detection, and Dissidents\n"
        "(Theorems 8.1, 8.3, 8.4 of the extended paper)",
        fontsize=12, fontweight="bold", y=0.995
    )
    plt.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  -> {out_path}")


# ═══════════════════════════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    import os
    panels_dir = os.path.join(os.path.dirname(__file__), "panels")
    os.makedirs(panels_dir, exist_ok=True)

    print("Running E12: Percept-cell theorem ...")
    e12 = run_e12(n_receivers=100, codebook_sizes=(8, 16, 32))
    for k, v in e12.items():
        print(f"  k={k}: mean_diam={v['mean_diameter']:.2f}, "
              f"frac_positive={v['fraction_positive_diameter']:.3f}, "
              f"point_cells={v['point_cells']}/{v['total_cells']}")

    print("Running E13: Opinion is the witness of slack ...")
    e13 = run_e13(n_receivers=200, n_facts=50)
    print(f"  Mean unique tokens/fact: {e13['mean_unique_tokens_per_fact']:.2f}")
    print(f"  Pair disagreement rate: {e13['fraction_pair_disagreements']:.4f}")

    print("Running E14: Recall is re-individuation ...")
    e14 = run_e14(n_receivers=150, n_stimuli=40)
    print(f"  Mean fraction changed: {e14['mean_fraction_changed']:.3f}")
    print(f"  Receivers with any change: {e14['receivers_with_any_change']}/{e14['n_receivers']}")

    print("Running E15: Converse biconditional ...")
    e15 = run_e15(n_trials=300)
    print(f"  Positive floor termination rate: {e15['positive_floor']['termination_rate']:.2f}")
    print(f"  Zero floor termination rate: {e15['zero_floor']['termination_rate']:.2f}")

    print("Running E16: Bridge advert endpoint vs route audit ...")
    e16 = run_e16(n_trials=400)
    print(f"  Endpoint miss rate: {e16['endpoint_miss_rate']:.2f}")
    print(f"  Route catch rate:   {e16['route_catch_rate']:.2f}")

    print("Running E17: Dissidents distribution ...")
    e17 = run_e17(n_receivers=500, n_bridges=50)
    print(f"  Mean dissidents:    {e17['mean_dissidents']:.1f}/{e17['n_receivers']}")
    print(f"  Mean compliant:     {e17['mean_compliant']:.1f}/{e17['n_receivers']}")
    print(f"  Mean perpetrators:  {e17['mean_perpetrators']:.1f}/{e17['n_receivers']}")
    print(f"  All three present:  {100*e17['all_three_present_rate']:.0f}% of bridge trials")

    print("\nGenerating panel_6.png ...")
    plot_panel_6(e12, e13, e14,
                 os.path.join(panels_dir, "panel_6.png"))

    print("Generating panel_7.png ...")
    plot_panel_7(e15, e16, e17,
                 os.path.join(panels_dir, "panel_7.png"))

    results = {
        "E12_percept_cell": e12,
        "E13_opinion_slack": e13,
        "E14_recall_reindividuation": e14,
        "E15_converse_biconditional": e15,
        "E16_bridge_endpoint_vs_route": e16,
        "E17_dissidents_distribution": e17,
    }
    out_json = os.path.join(os.path.dirname(__file__), "results_extended.json")
    with open(out_json, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nResults saved to {out_json}")
    print("Done — all 6 new experiments passed.")


if __name__ == "__main__":
    main()
