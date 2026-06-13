# DSL Prior Art — Systems Biology Shaders (SBS)

> Reference study of the user's own prior DSL, `hegel/consequences/src/lib/sbs`, and
> its paper *Systems Biology Shaders*. SBS is the **same S-entropy framework**
> ([00-foundations.md](00-foundations.md)) instantiated for a different domain
> (metabolic pathways → GPU shaders). It is the closest existing template for the
> advert DSL: study what transfers, what is domain-specific, and what to change.

Source mirror: `c:/tmp/hegel-sbs/` (compiler `*.ts`, `registry.js`, `glycolysis.sbs`).

---

## 1. What SBS is

**Thesis:** "The biological model *is* the shader. The observation *is* the render
call. The result *is* the texture." A metabolic pathway is written as a declarative
`circuit` of `node`s (metabolites, carrying chemical potential μ) and `edge`s
(reactions, carrying conductance). The compiler lowers it to a **GLSL fragment
shader** whose output texture encodes the S-entropy triple `(Sk, St, Se)` in RGB —
so rendering the shader *is* measuring the system. No ODE integration, no time
stepping: a single-shot observation via constraint propagation (Kirchhoff-style
current/voltage laws on the graph).

The triple-equivalence shows up as a stated identity:
**Oscillation ≡ Categorical Distinction ≡ Partition Operation** — three notations
for one structure, exactly as in [USR §1.2].

---

## 2. The language surface (concrete syntax)

From `glycolysis.sbs`:

```sbs
circuit glycolysis {
  node Glucose  { mu: -917.0, concentration: 5.0, compartment: "cytoplasm" }
  node G6P      { mu: -1760.0, concentration: 0.083 }
  ...
  edge Glucose -> G6P { rate: 230.0, conductance: 464.1 }
  edge G6P     -> F6P { rate: 100.0, conductance: 3.35 }
}

observe glycolysis                  // measure healthy baseline
perturb glycolysis { factor: 0.1 }  // disease: 90% enzyme reduction
navigate from Pyruvate              // walk backward to rate-limiting step
```

**Design reading:** a *noun* layer (`circuit/node/edge` with property blocks) that
declares structure, and a *verb* layer (`observe/perturb/restore/navigate`) that
acts on it. Declarative structure, imperative-looking but side-effect-light verbs.

---

## 3. Full keyword / construct inventory

| Category | Keywords | Notes |
|----------|----------|-------|
| Structure | `circuit`, `node`, `edge` | graph with `{ prop: expr }` blocks; `->` and `<-` edges |
| Verbs | `observe`, `perturb`, `restore`, `navigate` (`navigate from X` = backward) | the action model |
| S-entropy | `Se`, `Sk`, `St`, `R`, `V`, `floor`, `coherence`, `visibility` | builtins (metrics) |
| Triples / catalysis | `triple(k,t,e)`, `catalyst`, `compose`, `cascade(...)` | catalysts have `power ∈ [0,1]` |
| Representation | `osc`, `cat`, `part`, `convert … from … to …` | the triple-equivalence conversion |
| General-purpose | `let`, `fn`/`return`, `for … in`, `if/else`, `import … as … from`, `export` | a real little language |
| Literals | numbers, strings, bools, arrays `[..]`, `#(se, sk, st)` S-entropy literal | `#(...)` is sugar |
| Operators | `+ - * / % **`, comparisons, `&& ||`, pipe `\|>`, member `.`, index `[]` | precedence-climbing |

**Catalyst semantics in code** (`emitter.ts`, `Cascade`): the multiplicative law
from [USR §1.4] is *implemented* —
`cascade` returns `1 − Π(1 − k_i)`, exactly `κ(γ₁◇γ₂)=1−(1−κ₁)(1−κ₂)`.
Catalyst `power` is validated to lie in `[0,1]` at compile time.

---

## 4. Compiler architecture (the part that transfers wholesale)

Hand-written, no parser-generator. Clean five-stage pipeline in
`dsl/compiler/`:

```
source ──tokenize──▶ Token[] ──parse──▶ AST (Program) ──emit──▶ Circuit (IR)
                                                          │
                                          ┌───────────────┴───────────────┐
                                    emitGLSL(circuit)              emitJS(circuit)
                                    → fragment shader              → runnable JS
```

- **`types.ts`** — token + AST node interfaces, and the IR (`Circuit`,
  `CircuitNode`, `CircuitEdge`), plus `CompileResult` (success, ast, ir, errors,
  warnings, **both** codegen outputs). One discriminated union per AST node.
- **`tokenizer.ts`** — hand-rolled scanner; keyword set; two-char ops; `->`/`<-`/`|>`
  special-cased; line/col tracked on every token for good errors.
- **`parser.ts`** — recursive descent + **precedence climbing** for expressions
  (`parsePipe → parseOr → … → parsePower → parseUnary → parsePostfix → parsePrimary`).
  Has **error recovery**: on a parse error it records it and skips to the next
  recovery keyword or `}`, so one bad statement doesn't kill the whole compile.
- **`emitter.ts`** — walks the AST, builds the IR, runs a small **tree-walking
  interpreter** for `let`/`fn`/`for`/`if`/expressions (so the DSL can compute values
  at compile time). Collects `perturbations`/`observations` as side outputs.
- **`codegen.ts`** — pure IR → text. `emitGLSL` templates a shader; `emitJS`
  templates a script that calls the runtime solver. **Two backends from one IR.**
- **`index.ts`** — `compileSBS(source): CompileResult` and `validateSBS(source)`
  (validate-only, for editor squiggles). Top-level try/catch → structured errors.

**`registry.js`** — `import X from "reactome/R-HSA-70171"` resolves against bundled
datasets (Reactome/KEGG/HMDB/UniProt/HuggingFace/AllenCell/GLB models). The DSL can
pull a real pathway by ID instead of hand-typing nodes. HuggingFace entries even
carry a `kappa` (catalytic factor) — external ML models as methodologies [EM §2.3].

---

## 5. What to steal for the advert DSL

**Architecture — take almost all of it:**
- The exact pipeline: `tokenize → parse → emit(IR) → codegen`. Hand-written,
  no dependencies, full control, great errors.
- **IR in the middle.** SBS targets *two* backends (GLSL + JS) from one `Circuit`
  IR. The advert DSL should compile to an IR, then emit **Remotion** from it —
  and keep the door open for other backends (e.g. a JSON timeline, a preview).
  This is the triple-equivalence principle made concrete: one IR, cheapest backend.
- Error recovery + line/col tracking + a `validate()` entry point → editor support.
- A `CompileResult` that carries ast + ir + errors + warnings + all outputs.
- Compile-time interpreter (`let/fn/for/if`) so adverts can be *parametric*
  (loop over products, compute timings) without a runtime.
- Registry pattern: `import logo from "brand/acme"` / stock assets by ID.

**Surface — adapt the noun/verb split:**
- SBS nouns are `circuit/node/edge`. The advert analogue is the open design
  question — but per [00-foundations §6], the *root noun should be the action-cell*
  (intended viewer response), not a scene. Scenes/shots/elements are the catalysts
  and paths toward it.
- SBS verbs `observe/perturb/navigate` are a genuinely novel model. The advert
  analogue might be: declare the cell, then `compose`/`cascade` catalysts (elements)
  toward it, and `render` to a format. `navigate` ≈ "find the rate-limiting step"
  could map to "find the weakest beat in the ad".

**Primitives that carry over unchanged** (they are framework-level, not biology):
- `triple(k,t,e)` and `#(se,sk,st)` — the recursive S-coordinate, [USR §1.5].
- `catalyst { power }` + `cascade(...)` with the `1 − Π(1−kᵢ)` law — ad elements
  compose exactly like this.
- `convert … from osc to cat` etc. — representation conversion; for video this is
  literally "express this beat as a time-curve vs. a layout vs. a label."

**What is different for video (must add):**
- **Time is first-class.** SBS abolished time ("single-shot observation"). Adverts
  are inherently temporal — the IR needs a timeline / duration / frame model that
  SBS's `Circuit` does not have. This is the biggest delta.
- **Backend is Remotion (React/TSX), not GLSL.** Codegen emits compositions,
  `<Sequence>`s, interpolations — not fragment shaders.
- **Multi-format output** (9:16 / 1:1 / 16:9): one IR, several rendered aspect
  ratios — again the "one IR, many backends/targets" pattern.

---

## 6. One-line takeaway

SBS proves the framework already compiles cleanly to a real DSL with a real
compiler and real codegen. The advert DSL is **the same skeleton** —
tokenize/parse/IR/codegen, triple + catalyst + convert primitives intact — with
two substitutions: **action-cell replaces circuit** as the root noun, and a
**temporal IR → Remotion** backend replaces the **graph IR → GLSL** backend.
