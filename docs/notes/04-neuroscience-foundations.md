# Neuroscience Foundations — Partition Dynamics, Apertures, and pNPL

> The three `docs/neuroscience/` papers ground the S-entropy framework in physical
> brain dynamics, and — crucially for us — the third paper gives a **complete typed
> operator algebra (pNPL)** that is the most directly DSL-relevant artifact in the
> whole corpus. Captured here for the foundation; the operator-algebra ideas feed
> straight into the effects-DSL design.

**Sources**

| Tag | Paper | File |
|-----|-------|------|
| [EUL] | *Variational Neural Partition Lagrangian* | `docs/neuroscience/euler-lagrangian-mechanics.tex` |
| [APE] | *Categorical Apertures on Biological Transport* | `docs/neuroscience/semantic-categorical-aperture.tex` |
| [pNPL] | *Operator Trajectories in Neural Partition Space* | `docs/neuroscience/neuropartitioning-calculus.tex` |

---

## 1. The three axioms (shared substrate)

All three papers derive everything from the same three axioms — the same ones in
[SAC §3.1](00-foundations.md):

1. **Bounded phase space** `μ(Ω) < ∞` — finite energy in finite geometry.
2. **No null state** `ẋ ≠ 0` — the system always occupies exactly one category;
   *oscillation arises from categorical necessity, not from forces*.
3. **Finite observational resolution** `δ > 0` — states closer than δ are
   indistinguishable.

**Forced partitioning** (consequence): `Ω` splits into `M = ⌊μ(Ω)/δᵈ⌋` finite
distinguishable states. Boundedness → discretisation → counting → navigation.
*Boundedness is a computational resource, not a limitation.*

---

## 2. Triple Equivalence, derived physically [APE, pNPL]

The same triple-equivalence from [USR §1.2], here proven as a counting theorem:

```
S_osc = S_cat = S_part = k_B · M · ln n
```

Oscillatory configurations, categorical assignments, and partition distributions
are *the same combinatorial problem* (distribute M distinguishable items into n
bins → nᴹ microstates). Plus:

- **Temperature factorisation**: every observable `O = (k_B T) · F(M, n)` — a
  thermal *scale* times a temperature-independent *structure*. Categorical
  operations are temperature-independent. (For us: an effect's *structure* is
  separable from its *intensity* — a reusable design idea.)
- **Ternary (base-3) is optimal**: `ln b / b` is maximised at integer `b = 3`;
  ternary trisection navigates `[0,1]³` in `O(log₃ N)` — 37% fewer steps than
  binary. *Why the triple `(S_k, S_t, S_e)` is three-valued.*

---

## 3. Categorical apertures = zero-work filtering [APE]

- An **aperture** is a topological constraint on phase space that selects by
  *position*, not by measuring dynamical variables. Its potential is `0` inside the
  allowed domain, `+∞` outside.
- **Zero-Work Theorem**: `W_aperture = 0`. The aperture is a *boundary condition*,
  not a force — so it does no thermodynamic work and (corollary) **Landauer's
  erasure cost does not apply**: no measurement, no information acquired, no erasure.
  Resolves Maxwell's demon by making it *inapplicable*.
- **Multipole taxonomy**: monopole (1 binding direction / target), dipole (2),
  quadrupole (4). In the Lagrangian, each aperture is a **holonomic constraint with
  a Lagrange multiplier**; each constraint removes one degree of freedom
  (5D → 4D → … → 1D). Drug "breadth" = number of constraints = Hill coefficient.
- **Aperture catalytic factor**: restricting phase space `Ω → Ω/α` gives effective
  catalysis `k_eff = α · k_uncat` (α ~ 10⁵). *Constraint = catalysis*: narrowing the
  space the receiver must search is what makes a catalyst powerful.

---

## 4. The variational principle [EUL]

A single **Onsager–Machlup action** on the 5-D manifold
`q = (R, σ², S_k, S_t, S_e)` generates all neural dynamics. The **neural partition
potential** has four terms:

```
Φ = V_sync + V_var + V_SF + V_ent
```

- `V_sync = (K_c−K)/2·R² + K/4·R⁴` — Landau double-well; pitchfork bifurcation at
  the critical coupling `K_c = 2σ_ω/π`. Generates the five regimes as basins/saddles.
- `V_var = k_B T·σ² + k_B T/(K σ²)` — variance-floor; minimised at
  `σ²_min = k_B T/K` (the thermodynamic floor; `σ² ∝ K⁻¹`, slope −1 exact).
- `V_SF = −α R·exp(−σ²/2π²)` — couples coherence and variance (favours high-R,
  low-σ²: the coherent/locked regimes).
- `V_ent` — soft-wall keeping `S ∈ [0,1]³`, with a binary-entropy term pulling
  toward the cube centre `(0.5,0.5,0.5)`.

Euler–Lagrange ⇒ **gradient flow** `q̇ = −g⁻¹∇Φ` (overdamped/dissipative, *not*
conservative — neural state changes are relaxational). **Noether** ⇒ two conserved
quantities: total partition number `C(n)=2n²` and the S-entropy flow norm.
Regime transitions are **second-order phase transitions** of Φ (curvature changes
sign at `R ∈ {0.3,0.5,0.8,0.95}`); Kramers escape gives transition rates.

---

## 5. Trajectory–Terminus–Memory + Poincaré Computing [pNPL, APE]

- **State triple** `M = (γ, Γ_f, M)`: trajectory through S-space, terminus (current
  config), and **memory** `M = ∫ Ḣ⁺ dt` (accumulated context, path-encoded).
- **Trajectory Non-Identity**: same terminus via different paths ⇒ *different states*
  (different memory). The path matters as much as the destination. (Two drugs hitting
  the same receptor state by different routes ≠ same system state.)
- **Poincaré Computing** — the inversion that matters most for a DSL:
  > Specify the **completion condition** (terminus Γ_f) + constraints; the runtime
  > derives the trajectory *backward*. "Declare WHERE it must end; the constraints
  > determine HOW." Complexity `O(log₃ N)` via trisection.

  This is **declarative, goal-first computation** — exactly the SCOPE `goal {}` block
  and the [00-foundations §6] decision to make the action-cell the root. The ad's
  intended response is the terminus; effects are the backward-derived trajectory.

---

## 6. pNPL — a typed operator algebra (the DSL blueprint) [pNPL]

The third paper defines **pNPL**, a typed formal language for computations on
partition systems. This is essentially a worked example of the DSL we are building,
in a different domain. Structure to mirror:

**Type system** (three kinds):
- *Circuit types*: `PartitionCoord (n,ℓ,m,s)`, `SCoord (S_k,S_t,S_e)∈[0,1]³`,
  `Regime {turbulent,cascade,aperture,coherent,sync}`, `StructuralFactor ∈ ℝ⁺`.
- *Pharmacological types*: `Aperture (A,type,α)`, `CouplingMod ΔK`,
  `DrugTrajectory Φ: M→M`, `TransitionPath [Regime]`.
- *Observable types*: `OrderParam R∈[0,1]`, `PhaseVariance σ²`, `PLV∈[0,1]`,
  `OnsetTime τ`.

**Operators** (grouped, each with a typed signature):
Aperture (`Install_Aperture`, `Classify_Aperture`, `Catalytic_Factor`), Regime
(`Regime_Classify`, `Structural_Factor`, `Delta_S`), Transition (`Transition_Path`,
`Onset_Time`, `Cross_Modal_Test`), Coupling (`Modulate_K`, `Critical_K`,
`Phase_Lock`), Frequency (`Freq_Match`, `Gear_Activate`), Trajectory
(`Drug_Modify`, `Variance_Minimize`, `Complete`), Measurement (`PLV_Measure`,
`Regime_Map`, `Categorical_Therm`).

**Operator algebra** — the part that maps straight onto the effects pipeline:
- **Composition** `O₂ ∘ O₁` with **type safety**: a chain of operators provably
  keeps the state inside `[0,1]³` (the bounds are invariant under every operator).
  *This is exactly what an effects DSL needs: each effect is a typed endomorphism on
  the clip-state, and a pipeline `clip |> e₁ |> e₂` is type-checked composition.*
- **Non-commutativity**: `Modulate_K ∘ Install_Aperture ≠ Install_Aperture ∘
  Modulate_K`. *Effect order matters* — colour-grade-then-blur ≠ blur-then-colour.
- Worked **algorithms** (treatment protocol, Poincaré drug design) read like
  programs in the language: measure → classify → install aperture → modulate →
  verify terminus. The same shape as an advert: measure audience → classify →
  apply effects → verify intended response.

---

## 7. What carries into the advert DSL

| pNPL / neuroscience concept | Advert-DSL counterpart |
|------------------------------|------------------------|
| Typed operators `O: State → State` | **effects as typed endomorphisms on clip-state** |
| Composition with type-safety invariant | **`clip \|> effect \|> effect` provably stays valid** |
| Non-commutativity of operators | **effect order is semantically significant** |
| Aperture = zero-work, position-based filter | an effect that **constrains/selects** without "doing work" (mask, crop, focus) — and *constraint = catalysis* |
| Multipole order = #constraints = potency | effect "strength" graded by how much it narrows the space |
| Poincaré Computing (declare terminus, derive path) | **declare intended response (action-cell); derive the effect chain** |
| Trajectory non-identity (path ≠ just endpoint) | two ad edits reaching the same end-state are *not* equivalent — the **sequence of effects is part of the artifact** |
| Temperature factorisation (scale × structure) | an effect's **intensity** separable from its **structure/kind** |
| Onsager–Machlup gradient flow toward a potential min | an advert as **relaxation toward the action-cell** under an effect-induced potential |

The standout: **pNPL is a typed, composable, non-commutative operator algebra over
a bounded state space** — which is precisely the formal shape of an effects-over-
footage DSL. The advert DSL's effects are pNPL's operators; the clip-state is its
`SCoord`; the `|>` pipeline is its typed composition; the intended viewer response
is its Poincaré terminus.
