# Economics Foundations — Agents, Value, and Price

> The two economics papers in `docs/economics/` apply the S-entropy framework
> ([00-foundations.md](00-foundations.md)) directly to markets. They are the bridge
> from the abstract calculus to a **theory of advertising**, because they already
> formalise *value*, *price*, *the consumer as a bounded agent*, and *what it means
> to move a transaction toward completion*. This note captures them; the advertising
> theorem is built on top in [04-theory-of-advertising.md](04-theory-of-advertising.md).

**Sources**

| Tag | Paper | File |
|-----|-------|------|
| [ECON] | *A Mathematical Theory of Economic Agents* | `docs/economics/economic-agent-theory.tex` |
| [PRICE] | *Mathematical Foundation for Price* | `docs/economics/foundations-of-price.tex` |

---

## 1. The economic agent IS the receiver [ECON]

The whole of standard micro is rebuilt from one primitive: the **receiver**
`R = (K, D, Π, β)` — knowledge framework, decoder (perception), candidate-projection
(inference), strictly positive noise floor β. An **agent** is `A = (R, M, G)`:
receiver + methodology + goal-set. Key results, all *derived* not assumed:

- **Floor Theorem** — `S♭(R) = β > 0`. No bounded agent reaches a target exactly.
  *Bounded rationality (Simon's satisficing) becomes a theorem, not a patch.*
- **Cell-Truth** — all states in one action-cell are S-indistinguishable (= β).
  Two states producing the same practical action are operationally equal.
- **Mode Non-Privilege / Selective Rationality** — a layered receiver should use the
  *cheapest* layer whose floor beats the cell tolerance. Derives Kahneman System 1 /
  System 2: fast reflex layers fire first *because it is optimal*, not heuristic.
- **Methodology Banach floor** — `S♭(M) = σκ/(1−κ)`; iterating one methodology
  converges to it geometrically and can't beat it (replication is catalytic, not
  foundational). Methodologies compose multiplicatively in dimensionless floor.
- **Agent floor** — `S♭(A) = β · σκ/((1−κ)Σ)`.
- **Receiver Uncertainty Principle** — `σ_K · σ_Y ≥ β·τ(C)`: you cannot
  simultaneously hold full representational flexibility and commit to an action.
  Construction (σ>0, generate options) and completion (σ=0, commit) are mutually
  exclusive per iteration (**Incompatibility / exploration-exploitation**).
- **Gödelian residue = private information = β** — the "why this and not that"
  behind any chosen state is irreducible below β. *No disclosure mechanism removes
  it.* Grossman–Stiglitz and Akerlof asymmetry are corollaries.

### Value is a cell, not a point [ECON §Cell-Value]

- **Point-meaning is forbidden** (β>0 ⇒ `Π(D(x))` is never a singleton). Labour,
  utility, and exchange theories of value all presuppose point-meaning ⇒ each
  requires β=0 ⇒ all forbidden ("eleven-fold collapse").
- **Cell-value**: `V(x) := C_Act(x)` — an outcome's value *is its action-cell*. Two
  states are value-equivalent iff they trigger the same action. *Value is defined by
  the action it produces, not by an intrinsic number.*

---

## 2. Price is a cell, and value splits in two [PRICE]

- **Price-Cell Theorem** — a price is a ball `C(p, τ)` in outcome space, not a point
  `p∈ℝ`. Point prices need β=0 (forbidden). The half-spread τ is *irreducible* — a
  structural feature of bounded agents, not a friction to be optimised away. (A
  stock tick of 0.01 literally *is* a price cell of radius half a tick.)
- The minimum tolerance an agent can resolve is its own floor: `τ_min(A) = S♭(A)`.

**Cell-value decomposition** — every cell has two values to an ensemble `E`:

| Value | Formula | Set by | Meaning |
|-------|---------|--------|---------|
| **Trading value** `Vᵀ(C)` | `τ(C) − S♭ᵀ(E)`, `S♭ᵀ = minᵢ βᵢ` | the single **best** agent | how attainable / how much margin to transact |
| **Informational value** `Vᴵ(C)` | `τ(C) − S♭ᴵ(E)`, `S♭ᴵ = Πβᵢ/Σⁿ⁻¹` | **all** agents jointly | how much the market collectively *knows* |

- **Two-Value Theorem** (main): `Vᴵ ≥ Vᵀ`; the gap `Π = S♭ᵀ − S♭ᴵ ≥ 0` is the
  **information premium**, strictly positive for n≥2 and rising with ensemble size
  and heterogeneity. *Diverse independent agents make the market know more.*
- **Dual spreads**: trading spread `Δᵀ = 2 minᵢβᵢ` (set by best agent alone);
  information spread `Δᴵ = 2 S♭ᴵ` (set by everyone). A market can have a tight
  trading spread yet be informationally poor, and vice-versa.
- **Equilibrium / price discovery**: the equilibrium price `p*` is the centre of the
  **purpose cell** `C*` (unique Banach fixed point). Discovery converges at spectral
  radius `ρ = S♭ᵀ/Σ`. Better agents accelerate discovery; diverse agents sharpen the
  informational value.
- **Fundamental value** `V* = lim p*_n` exists only if `infᵢ βᵢ = 0`; otherwise even
  infinitely many agents leave a residual cell of width `2 S♭_∞`. *There is no point
  "true price" for bounded participants.*
- **No-Arbitrage / Transaction**: equilibrium exists iff some cell has `τ(C) > S♭ᵀ`.
  Buyer and seller transact iff `S♭(A_B) + S♭(A_S) ≤ 2τ(C*)` — both reachability
  sets must overlap the cell.
- **Law of One Price**: agents sharing a knowledge framework K who attain the same
  cell agree on decoded value; price differences *within* a cell are just
  floor-bounded measurement noise, not violations.

---

## 3. Why this matters for advertising (the bridge)

These papers hand us, already proven, every object an advertising theory needs:

1. **The consumer is a receiver/agent** `A = (R, M, G)` with a positive floor.
2. **"Wanting the product" is an action-cell** `C_buy` in the consumer's outcome
   space (cell-value: value = the action it triggers).
3. **Reaching the sale is attaining the cell**: the consumer transacts iff their
   S-distance to `C_buy` drops below the cell tolerance — i.e. iff the trading value
   `Vᵀ = τ(C_buy) − S♭` is positive and their reachability set covers the cell.
4. **An advert is a methodology / catalyst** the advertiser applies to lower the
   consumer's S-distance to `C_buy` — with catalytic power composing multiplicatively
   and a floor it cannot beat by mere repetition.
5. **Price is a cell**; willingness-to-pay is the trading value; the bid/ask geometry
   `p* ± S♭` gives the band within which the ad must place the consumer.
6. **The Gödelian residue β** is why persuasion is never total and why the consumer
   always retains private "why" — the irreducible limit on what an advert can do.

This is the substrate for the **Theory of Advertising** developed next.
