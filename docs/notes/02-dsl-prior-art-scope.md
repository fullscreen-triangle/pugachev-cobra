# DSL Prior Art — SCOPE / Microscopy Image Calculus (MIC)

> Second reference DSL from the user, `helicopter/hieronymus/src/lib` + paper
> *Microscopy Image Calculus*. Richer and closer to the advert DSL than
> [SBS](01-dsl-prior-art-sbs.md): it has a **goal block**, **rule/invariant
> catalysts with tolerances**, a **pipeline-of-morphisms** model, **cell-dispatch**,
> a real **type-checker that proves goals reachable**, and an explicit
> **four-phase runtime (compile → measure → execute → emit)**. This phase split is
> exactly the user's "two systems" idea — *make* vs *assess usefulness* — realised
> as compile-time + runtime machinery.

Source mirror: `c:/tmp/helicopter/` (`scope-compiler_*.ts`, `scope-runtime_*.ts`,
`scope-examples.ts`).

---

## 1. The language surface

A SCOPE program (`scope NAME { … }`) has six block types, then named **morphisms**
written as **pipelines**, then a **dispatch** table. From `scope-examples.ts`:

```scope
scope nuclear_separation_dynamics {
  channels {
    sync dapi at 0.1 µm/pixel
    cell PROPHASE  bounds (-2.0e-6, -0.8e-6) action nucleus_pair_measurement
    cell METAPHASE bounds (-0.8e-6,  0.8e-6) action membrane_boundary
    cell ANAPHASE  bounds ( 0.8e-6,  2.0e-6) action nucleus_pair_measurement
  }

  coordinate_space { field 100 x 100 µm  depth 10  lambda_s 0.10  lambda_t 0.05 }

  goal {                                  // ← measurable success criteria
    distance_uncertainty < 0.5 µm
    s_entropy_conservation < 1e-12
    snr > 8.0
  }

  rule conservation(dna_mass) {           // ← named invariant + tolerance
    invariant: "total DAPI-stained area is conserved ±5%"
    epsilon: 0.008
  }

  nucleus_pair_measurement =              // ← a morphism = observe |> steps…
    observe(load(db="BBBC", dataset="BBBC007", image="A9 p10d.tif"), n = 10)
      |> visualise(scale_field)
      |> catalyze(conservation(dna_mass))
      |> catalyze(phase_lock(chromatin), confidence = 0.9)
      |> access(nucleus_a)
      |> access(nucleus_b)
      |> measure_distance(nucleus_a, nucleus_b)
      |> visualise(geodesic)

  dispatch {                              // ← action-cell → which morphism runs
    when PROPHASE  do execute(nucleus_pair_measurement)
    when METAPHASE do execute(membrane_boundary)
    when ANAPHASE  do execute(nucleus_pair_measurement)
  }
}
```

**This is structurally what an advert DSL wants.** Read the analogy:
`channels.cell` = **action-cells** (the [00-foundations] root primitive!),
`goal` = the advert's intended effect stated measurably, `rule` = brand/creative
invariants, a `morphism` = a **scene/shot built as a pipeline of catalysts**, and
`dispatch when CELL do` = pick the creative path per audience-cell.

---

## 2. Constructs and the AST (`scope-compiler/ast.ts`)

| Block | Fields | Advert analogue |
|-------|--------|-----------------|
| `channels` | `sync NAME at V unit`; `cell NAME bounds(lo,hi) action M` | the **action-cells** + which morphism each triggers |
| `coordinate_space` | `field X×Y`, `depth`, `lambda_s`, `lambda_t` | the resolution/“budget” knobs; depth governs attainable precision |
| `goal` *(ext)* | list of `metric op threshold unit` | **success criteria, machine-checkable** |
| `rule` *(ext)* | `name(arg)`, `invariant: "…"`, `epsilon` | named constraint + tolerance, referenced by catalysts |
| `morphism` | `observe(frame, n) \|> step \|> …` | a scene as a catalyst pipeline |
| `dispatch` | `when CELL do execute(M) / emit / block` | per-cell routing |

**Pipeline steps** (the `|>` chain): `catalyze(rule, confidence?)`,
`access(target, threshold?)`, `measure_distance(a,b)`, `fuse(otherMorphism, rho)`,
`visualise(mode)`. Note `catalyze` carries a **confidence ∈ [0,1]** and `access` a
**threshold** — fuzzy, weighted operations, not hard calls.

Catalysts are the framework's information catalysts [USR §1.4] made concrete: each
`catalyze` step applies a named invariant that tightens the measurement, discounted
by its confidence. `fuse(m, rho)` combines two morphisms' estimates at correlation
ρ — the multi-path convergence of [EM, mode non-privilege].

---

## 3. The type-checker = the "assess usefulness" system, at compile time

`scope-compiler/type-checker.ts` is the standout artifact. **Before anything runs**,
it proves five invariants and can declare a goal *unreachable*:

1. **Depth compatibility** — every morphism's `observe(n)` must match
   `coordinate_space.depth` (else `DepthMismatch`).
2. **Cell partition consistency** — action-cells may not overlap (`CellOverlap`),
   computed by interval intersection. (Cells must partition cleanly — [EM] cell-truth.)
3. **Entropy budget** — Σ (catalyst ε × confidence-weight) + access-cost must stay
   under a fixed budget `1 − S_t_initial − S_e_min = 0.4` (else
   `EntropyBudgetExceeded`). **You cannot spend more certainty than you have.**
4. **Coordinate grounding** — `measure_distance(a,b)` requires `a` and `b` to have
   been `access`-ed (or be channels) first (else `UngroundedDistance`).
5. **Goal reachability** *(ext)* — predicts the best attainable
   `distance_uncertainty` from `field / 2^depth · (1 + Σε)` and, if the goal asks
   for tighter than physically possible, emits `GoalUnreachableAtDepth` **with the
   depth you'd need**. This is the assessor telling you, statically, whether the
   spec can succeed and how to fix it.

Plus reference checks (unknown morphism/cell/rule) and a `ConfidenceDiscountLarge`
warning when a catalyst's confidence < 0.5 (you're leaning on a weak signal).

**Takeaway for the advert DSL:** the "collect information & assess its usefulness"
system can largely be a **type-checker / static analyzer over the same IR**: given
the action-cell (goal) and the catalysts (scene elements with confidence), prove —
before rendering — whether the advert can plausibly land the cell, flag wasted
elements (vacuous constraints), and warn when the budget is blown.

---

## 4. The four-phase runtime (`scope-runtime/`)

`runtime.ts` orchestrates one program over one input through four phases, threading
the S-entropy triple `(Sk, St, Se)` the whole way and **conserving its sum = 1**:

```
COMPILE → MEASURE → EXECUTE → EMIT
  │         │          │         └ assemble Result, evaluate goal criteria (✓/✗),
  │         │          │           verify Sk+St+Se = 1, build chart + visual data
  │         │          └ run the dispatched morphism's pipeline (+ any it fuses);
  │         │            each step mutates the entropy triple, logged per phase
  │         └ deterministic measurement (spectral pipeline → scale field); entropy
  │           unchanged (a "bijection" — MEASURE moves no entropy)
  └ derive initial (Sk,St,Se) from the input; pick the matching action-cell
```

Design notes worth copying:
- **Entropy conservation as a runtime invariant.** Every phase logs `(Sk,St,Se)`
  and EMIT asserts the sum is 1 to 1e-10. A global checkable invariant across the
  pipeline — analogue for video could be a conserved "attention/time budget".
- **Goal evaluation at EMIT** mirrors the type-checker's static prediction:
  `evaluateMetric` computes each metric for real and marks ✓/✗ against thresholds.
  Static *prediction* + runtime *verification* of the same goals = the two-system
  loop closing on itself.
- **Only run what's needed.** EXECUTE runs the dispatched morphism plus exactly the
  morphisms it `fuse`s — dead morphisms are skipped. (Tree-shaking by dataflow.)
- **Entropy trajectory is a first-class output** (`COMPILE→MEASURE→…→EMIT` points),
  dr/visualised. The pipeline's *path* is reported, not just its result — echoing
  [SAC] trajectory non-identity.

---

## 5. Compiler architecture (vs SBS)

Same hand-written shape as SBS but with a dedicated **type-checking stage**:

```
source ─lexer─▶ tokens ─parser─▶ AST ─type-checker─▶ {errors, warnings, resolved AST}
                                                              │ (ε resolved from rules)
                                                       runtime: 4 phases ▶ Result
```

- `lexer.ts` — handles units (`µm`, `µm/pixel`), scientific notation in bounds.
- `parser.ts` — recursive descent producing the block/morphism/dispatch AST.
- `type-checker.ts` — the five invariants above; **resolves each catalyst's ε from
  the rule table** (rule decl overrides a `DEFAULT_EPSILON` per family), so the AST
  handed to the runtime is fully grounded.
- `index.ts` — single entry composing lex → parse → typecheck.
- Separate `scope-runtime` package — clean **compiler/runtime split**.

---

## 6. What to take for the advert DSL (delta over the SBS notes)

SBS gave us the *skeleton* (tokenize/parse/IR/codegen, triple+catalyst+convert).
SCOPE adds the parts an advert DSL specifically needs:

1. **`goal` block, machine-checkable.** The advert states its intended effect as
   metrics (e.g. `comprehension > x`, `brand_recall`, `runtime < 30s`,
   `message_density`). The compiler can then *prove reachability* — the heart of
   the "assess usefulness" system.
2. **`rule`/invariant catalysts with ε + confidence.** Brand guidelines and
   creative constraints as named, tolerance-bearing, confidence-weighted catalysts
   — composing by the same multiplicative law.
3. **Morphism = pipeline (`observe |> … |> render`).** A scene/shot authored as a
   left-to-right pipeline of catalysts is a natural, readable surface for video and
   maps cleanly to Remotion `<Sequence>` composition.
4. **`channels.cell` + `dispatch when CELL do`.** First-class **action-cells** and
   per-cell routing — directly the [00-foundations §6] decision to make the
   action-cell the root noun, plus multi-audience variants from one source.
5. **Type-checker as the assessor.** Build the "collect & assess usefulness" system
   as a static analyzer over the IR: goal-reachability prediction, budget checks,
   dead-element detection, weak-signal warnings — *before* a single frame renders.
6. **Phase pipeline with a conserved invariant.** A `compile → plan → render →
   evaluate` runtime that threads (and conserves) a budget triple, then verifies the
   goals at the end against the same metrics the type-checker predicted.

**Differences to keep in mind:** SCOPE is still measurement-oriented (input image →
measurement), so its "render" is `visualise(mode)` of analysis artifacts. The
advert DSL inverts the data flow — there is no input image to measure; the goal +
catalysts *generate* a temporal composition. So we keep SCOPE's **front half**
(blocks, goal, rules, morphism-pipelines, dispatch, type-checker) and replace its
**back half** (measurement phases) with a **temporal IR → Remotion** emitter
(the delta already flagged in the [SBS notes §5]).

---

## 7. Synthesis across both priors → the advert DSL shape (draft)

```
advert NAME {
  audiences   { cell NAME bounds(…) intent ACTION }      // SCOPE channels.cell
  format      { aspect 9:16, 1:1, 16:9   duration 20s   fps 30 }  // coordinate_space
  goal        { comprehension > …   brand_recall > …   runtime < 30s }  // SCOPE goal
  brand RULE  { invariant: "…"  epsilon: … }             // SCOPE rule
  scene NAME =                                            // SCOPE morphism pipeline
      open(hook)
        |> catalyze(brand_palette, confidence=…)
        |> beat(…)  |> beat(…)
        |> cta(…)
        |> render(motion)                                 // replaces visualise()
  dispatch    { when AUDIENCE do play(scene) }            // SCOPE dispatch
}
```
Compiles: `tokenize → parse → type-check (assess: goal reachable? budget ok?) →
temporal IR → emit Remotion TSX`. The **two systems** the user named are then:
the **emitter** (makes the video) and the **type-checker + EMIT-phase evaluator**
(collects the spec's information and assesses whether it usefully reaches the cell).
