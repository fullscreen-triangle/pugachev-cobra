# Computing Foundations — Backward Trajectory Completion & Temporal Programming

> The final two `docs/philosophy/` papers formalise the framework *as computer
> science*: one gives a complete theorem-forced **operating-system architecture with
> a frozen interface** (the closest thing to an implementation spec we have); the
> other gives a complete **programming language with grammar + semantics** whose
> surface (`cell / bounds / action / when / do / compose`) is uncannily close to an
> advert-effects DSL. Together they close the loop from theory to a buildable system.

**Sources**

| Tag | Paper | File |
|-----|-------|------|
| [BTC] | *Receiver-Internal Backward Trajectory Completion: Foundations of a Categorical Operating System* | `docs/philosophy/unconstrained-subtasks-computing.tex` |
| [TMP] | *Temporal Programming: A Cell-Based Paradigm for Oscillator-Relative Computation* | `docs/philosophy/temporal-programming.tex` |

---

## 1. Poincaré Computing, formalised [BTC]

The [04-neuroscience] "declare the terminus, derive the trajectory backward" idea is
here made rigorous and given a complexity proof.

- **Trajectory-completion problem**: in a ternary refinement hierarchy of `N = 3^k`
  leaves, given a known endpoint, recover the path to the root.
- **Backward navigation cost = `log₃ N` steps** (drop the last base-3 digit of the
  S-entropy coordinate to get the parent — `O(1)` per step). Forward enumeration is
  `Θ(N)`. The exponential speedup is the whole point.
- **The speedup *requires* virtual sub-states**: backward completion restricted to
  *physically realisable* intermediate states collapses back to `Θ(N)`
  (Collapse Theorem). The shortcut only exists because the receiver may pass through
  **virtual sub-states** — intermediate decompositions outside the physical unit cube
  whose *mean* recovers the real coordinate (Unconstrained Subtask / Local-Global
  Decoupling applied per step). Virtual decompositions occupy >99% of the admissible
  space as magnitude grows.
- **Forward asymmetry**: forward construction *cannot* use virtual sub-states (each
  step must land on a real partition block); only backward completion can. → *Knowing
  the destination is what licenses the miraculous shortcut.*
- **Path Opacity**: two backward trajectories with the same endpoint but different
  intermediate decompositions are indistinguishable by any endpoint metric. The
  receiver's internal route is private and free. (Same as [SAC] trajectory
  non-identity, but here it's a *feature*: internal freedom with identical output.)

### Five names, one object [BTC §Five Names]

A unification theorem worth keeping: these are **the same mathematical object** —
1. geometric aperture, 2. virtual sub-state, 3. miracle subtask, 4. information
catalyst, 5. (corrected) Maxwell demon. All four share: enable a transition; not
consumed; transfer zero info about themselves to the outcome; necessary for speedup.
*For us: an effect, a constraint, a "creative leap", and a catalyst are one thing.*

---

## 2. The vaHera expression language & type system [BTC]

This is a worked **typed, composable expression language** — the formal core of the DSL.

- **vaHera AST**: four constructors — `Lit(v)`, `Call(op, args)`,
  `Compose(ξ₁,…,ξₙ)` (pipes output of each step into the next), `Hole(h)`
  (type-checked away before execution).
- **Operation registry** `ρ: Ops → Sig × Provider` — each op has a typed
  input/output **signature** and a **provider** implementing it. (Registry + provider
  = exactly the SBS/SCOPE op-table pattern, now with a theorem behind it.)
- **Receiver evaluation is a homomorphism** → **Compositionality Lemma**: replacing a
  subexpression with an evaluation-equal one preserves the whole. This is what makes
  effect substitution/refactoring safe.
- **Typecheck soundness**: if a fully-resolved fragment type-checks, evaluation is
  defined and the runtime value matches the declared output type. Linear-time, total.
  → basis of the **Proof Validation Engine** (run the checker on every fragment
  before dispatch). *This is the "assess usefulness"/safety system again, as types.*
- **Refinement-type lattice** with subtyping `⊑` (base types, `List`, named-type
  isos, type vars).

---

## 3. The catalyst algebra, restated for cascades [BTC]

The same multiplicative law as everywhere, now with a cascade-design corollary:

- `κ(γ₁ ◇ γ₂) = 1 − (1−κ₁)(1−κ₂)`; cascade `κ(Γ) = 1 − Π(1−κᵢ)`.
- **Geometric decay**: applying one catalyst n times leaves residual `(1−κ)ⁿ`.
- **Cascade Saturation (Borel–Cantelli)**: a cascade reaches the floor iff
  `Σ κᵢ = ∞`. Constant-power stages saturate; geometrically-decaying ones don't.
  → *design rule for stacking effects: enough independent effects of bounded power
  drive S to the floor; diminishing-power effects stall short of it.*

---

## 4. Theorem-forced architecture: six subsystems + frozen interface [BTC]

The single most implementation-relevant result in the whole corpus. A **categorical
operating system** has six subsystems, each *forced by a specific theorem* (not a
design choice):

| Subsystem | Forced by | Role |
|-----------|-----------|------|
| **CMM** (Categorical Memory Manager) | Floor + Info Bound | coordinate-indexed store; address resolution ≥ floor |
| **PSS** (Penultimate State Scheduler) | Optimal Representation | pick cheapest of osc/cat/part representation per op |
| **DIC** (Demon I/O Controller) | Five Names | fetch only relevant bits by address-prefix (zero-cost sort) |
| **PVE** (Proof Validation Engine) | Typecheck Soundness | type-check every fragment before dispatch |
| **TEM** (Triple Equivalence Monitor) | Circular Validity | sample state in 3 reps, check pairwise consistency |
| **Cascade Router** | No Privileged Level | k-ary tree of identical Resolvers; accuracy via cascade law |

**Frozen Interface Contract** (forced by No-Privileged-Level self-similarity): the
system must expose exactly four stable abstractions —
1. a **typed AST** (`Expr`),
2. a **Resolver trait** (signature invariant across cascade depths),
3. a **Provider trait** (signature invariant across operation kinds),
4. an **Operation registry** (well-formedness preserved under additions).

> This *is* a plugin architecture spec: a stable AST + a Resolver interface +
> a Provider interface + an extensible registry. The advert-effects DSL's plugin
> surface (new effects added without breaking existing ones) is this contract.

Plus a **Categorical Complexity Hierarchy** `C₀ ⊊ C₁ ⊊ C_poly ⊊ C_nav ⊊ C_hard`
ordered by number of backward traversals; and **floor-bounded undecidability** — a
distinction finer than the receiver's floor is undecidable *to that receiver*.

---

## 5. Tempus — a complete language with grammar + semantics [TMP]

A different, leaner instantiation: programs are **timing cells** and the only datum
is a scalar deviation `ΔP`. But the surface syntax is strikingly DSL-shaped:

```tempus
sync coolant_sensor at 10.0e6 freq

cell NOMINAL  bounds (-1.0e-7, 1.0e-7) action 0
cell WARM     bounds ( 1.0e-7, 5.0e-7) action 1
cell HOT      bounds ( 5.0e-7, 2.0e-6) action 2

compose d=1 channels coolant_sensor into coolant_traj

when NOMINAL do emit status_ok
when HOT     do begin emit status_hot; fire reduce_power(0.8) end
```

What's reusable:
- **Formal BNF grammar** (`cell-decl`, `sync-decl`, `compose-decl`, `when-decl`,
  `ensemble-decl`; expr/stmt/bexpr) — a clean, small grammar to model ours on.
  Note this is the *same* `cell / bounds / action / when … do` shape as SCOPE's
  channels/dispatch — three of the user's DSLs converge on it.
- **Small-step operational semantics** over configurations
  `⟨phase, registry Γ, trajectory τ, statement-queue φ⟩`, with rules
  Receive → Assign → Fire → Reset → Idle.
- **COMPILE / EXECUTE phase mutual-exclusion** (proved two ways): you accumulate the
  trajectory (open, cell unknown) *or* you fire actions (closed, cell known) — never
  both. This is the **Receiver Uncertainty Principle** `σ_K·σ_Y ≥ β·τ` from
  [03-economics] made into a runtime state machine (construction vs completion).
- **Cell registry = compile-time, ROM, immutable at runtime** → finite, enumerable,
  auditable attack surface. *The advert analogue: the effect set is fixed at compile
  time; rendering can't invent new effects.*
- **Cell Action-Equivalence Theorem**: what matters is *which cell* a value lands in,
  not its exact value — cell-truth, one more time, now as language semantics.
- **Implementation pseudocode**: cell-registry lookup (`O(log m)` interval tree),
  trajectory engine (accumulate-then-dispatch), phase FSM, dispatcher (ROM function
  table — no JIT, no codegen at runtime).

### Composition Inflation Theorem [TMP]

`T(n,d) = d·(1+d)^{n-1}` distinguishable labelled trajectories for `n` events over
`d` channels (`d=1 → 2^{n-1}`). *For us: with `d` effect-tracks and `n` beats, the
number of distinguishable edits explodes combinatorially — the expressive space of a
short effect pipeline is large.*

---

## 6. What these two papers settle for the advert DSL

The corpus now closes from theory to architecture. The implementation shape is no
longer open — it is **forced**:

1. **Surface syntax**: a small BNF grammar in the `cell / bounds / action`,
   `compose … into`, `when … do` family (Tempus = SCOPE = the converged shape),
   adapted so cells are **action-cells (intended responses)** and statements are
   **effects applied to footage**.
2. **Core IR**: the **vaHera AST** — `Lit / Call(op,args) / Compose(pipe)` — with an
   **Operation registry** of typed effects (signature + provider). `clip |> e₁ |> e₂`
   is `Compose`.
3. **Type system**: refinement-type lattice + **typecheck soundness** ⇒ a fragment
   that checks is safe to render. The **PVE** is the assessment system as a type
   checker (matches the SCOPE finding exactly).
4. **Composition law**: effects are catalysts; pipeline power follows
   `1 − Π(1−κᵢ)`; saturation needs `Σκ = ∞`. Gives a *quantitative* answer to "is
   this stack of effects enough to land the action-cell?"
5. **Backward/goal-first evaluation**: declare the intended response (terminus);
   the effect chain is the derived trajectory; intermediate "miracle"/virtual states
   (surreal, locally-wrong effects) are allowed because only the global result is
   asserted. Path opacity ⇒ many effect routes, same outcome.
6. **Plugin architecture**: the **frozen interface** (typed AST + Resolver trait +
   Provider trait + extensible registry) is exactly how new effects/backends plug in
   without breaking the core — and it's theorem-forced, not taste.
7. **Phase machine**: a COMPILE (build/plan the effect graph) vs EXECUTE (render)
   separation, with the registry immutable at render time.

The remaining creative decision — *what an advert fundamentally does to the consumer*
(catalyst / cell-mover / decoder-shaper) and *what the theory should optimise* — is
still open per the user; the machinery to express any of those answers is now in hand.
