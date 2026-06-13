# Advertising Theory — Numerical Validation Suite

Numerical validation of every theorem and corollary in the paper
[`publications/advertising-coordinate-receivers/advertising-coordinate-receiverts.tex`](../../publications/advertising-coordinate-receivers/advertising-coordinate-receiverts.tex).

Each experiment builds an explicit numerical realisation of the paper's
primitives (bounded receivers, action-cells, effects, catalysts) and checks the
**structural identity** the theory asserts. Results are written to JSON.

## Run

```bash
# from the repository root
python src/advalidation/run_all.py
```

Output: one `data/eNN.json` per experiment plus `data/master_results.json`.
The suite is **deterministic** (fixed seed `20260613`) and runs in a few seconds.

## Experiments

| ID  | Theorem (paper) | What is checked | Kind |
|-----|-----------------|-----------------|------|
| E01 | Thm 2.2 / Cor 2.3 | every bounded receiver has `beta > 0`; `S >= beta > 0` always; `S` never reaches 0 | bound |
| E02 | Thm 3.5 | projection `Pi(D(x))` is never a singleton; coarser codebooks raise `beta` and cell size (granular, not point, meaning) | structural |
| E03 | Thm 3.2 | all in-cell percepts give `S = beta` exactly; out-of-cell percepts are strictly above the floor | identity |
| E04 | Thm 3.7 | isometric re-encoding (rotation/translation/reflection) preserves `S` to machine precision | identity |
| E05 | Thm 4.2 | the three decoder mechanisms (re-perception, re-inference, re-framing) each move the response; with all fixed, `S` is invariant | structural |
| E06 | Thm 5.4 | carrier–shift decoupling: multiple realisability, receiver-relativity, and carrier↔shift binding under the decoder | structural |
| E07 | Lem 6.2 / Thm 6.4 | catalytic power lies in `[0,1]`; stacked power equals `1 - prod(1 - kappa_i)` | identity |
| E08 | Cor 6.5 / 6.6 | repetition gives `1-(1-kappa)^n`: monotone, strictly decaying marginal gains, never reaches 1 | identity |
| E09 | Thm 6.8 | campaign saturates iff `sum kappa_i` diverges (Borel–Cantelli dichotomy, by asymptotic shrink) | boundary |
| E10 | Thm 7.2 / 7.4 | linear/acyclic support is ungrounded; 1- and 2-cycles fail the majority test; the 3-cycle grounds and is robust | structural |
| E11 | Cor 7.5 | coherence is decidable from the **signs** of pairwise support alone — no magnitudes, no meaning dictionary | structural |

All experiments report `PASS`; identity checks match to machine precision
(`<= 5.3e-15`).

## Layout

```
src/advalidation/
  model.py        primitives: PerceptSpace, Receiver (K,D,Pi,beta), Cell,
                  s_functional, catalyst algebra
  harness.py      ExpResult record + JSON persistence (seed, sanitisation)
  e01..e11_*.py   one module per theorem cluster, each exposing run(rng)
  run_all.py      orchestrator -> data/*.json + data/master_results.json
  data/           JSON outputs (regenerated each run)
```

## Notes on faithfulness

- A **receiver** `(K, D, Pi, beta)` is realised by a finite codebook `K`
  (a strict subset of percepts, so `|K| < |X|` — boundedness), a
  nearest-codeword decoder `D`, a Voronoi-cell projection `Pi`, and the induced
  covering-radius floor `beta`. Finite point clouds make all sup/inf exact.
- An **effect** is a carrier (a map on percepts) bound to a decoder-shift (the
  map it induces on decoded meanings); **catalytic power** is the fraction of
  above-floor distance it closes, and stacks multiply residual distance.
- The suite is **ordinal-friendly**: cardinal numbers (floors, powers) are
  computed only to verify the *structural* identities (`S >= beta`,
  `1 - prod(1-kappa_i)`, the coherence-cycle length, sign-only detectability) —
  never to assert an absolute persuasive magnitude, which the Floor Theorem
  forbids.
```
