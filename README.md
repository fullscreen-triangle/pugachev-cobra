<h1 align="center">Pugachev Cobra</h1>
<p align="center"><em>An Equivalence Calculus for Bounded Cognition: The S-Entropy Framework</em></p>

<p align="center">
  <img src="assets/img/SAAB_35_Draken_performing_the_Cobra_maneuver.gif" alt="Logo" width="300"/>
</p>

Pugachev-cobra is a domain-specific language for composing video advertisements
from behavioural effect chains. The language targets the Remotion rendering
framework and is grounded in a formal theory of bounded receivers, information
catalysts, and decoder-shift mechanics developed across companion papers on
S-entropy, agent coordination, and epistemological floors.

## Motivation

Existing video-production tools operate at the level of named presets or
parameter surfaces: a user selects a colour grade, a transition, a sound
design. This representation conflates two distinct concerns — what a scene
should *do* (its behavioural intent) and how that behaviour is realised as a
composition of rendering operations. The conflation forces users to reason in
terms of implementation details rather than perceptual outcomes.

The central claim of pugachev-cobra is that a video advertisement is an
isomorphism chain: given a footage clip as input state and a behavioural
description as target state, the effect chain is the minimal sequence of
incremental transformations connecting them. Each transformation is a catalyst
in the sense of the S-entropy framework — it closes a fraction of the
above-floor distance between the current receiver state and the target cell,
composes multiplicatively with adjacent steps, and is expressible without
reference to magnitude, only to direction and structure.

Under this model, users author *descriptions of physical behaviour* rather than
lists of parameters. The compiler derives the isomorphism chain, verifies
structural coherence of the chain against the stated goal, and emits Remotion
TypeScript. The compiler is the implementation language; Rust is the production
runtime.

## Architecture

The system has two components:

**Compiler and type-checker.** A hand-written pipeline — tokeniser, parser,
intermediate representation, type-checker, emitter — implemented in TypeScript
for the web playground and in Rust for production. The type-checker operates
on the intermediate representation before any rendering occurs. It verifies
that the effect chain forms a grounded coherence structure (minimum three
mutually supporting effects), that the chain is consistent with the declared
goal cell, and that no step introduces a logical contradiction with an adjacent
step. A chain that fails these checks is rejected at compile time with a
diagnostic indicating which step breaks coherence and why.

**Remotion emitter.** The intermediate representation is lowered to a Remotion
composition: sequences, interpolations, and layered components. The emitter is
a pure function from IR to TypeScript source and has no knowledge of
behavioural semantics — those are resolved entirely by the type-checker.

## Web playground

The `web/` directory contains an online playground implemented as a Next.js
application. It exposes a code editor, a compiled-output panel, and a
diagnostic panel. The playground uses a TypeScript port of the compiler. It
is intended as a limited demonstration of the language surface; production
rendering requires the Rust compiler.

## Repository layout

```
docs/notes/          theoretical foundations and DSL design notes
docs/philosophy/     source papers (S-entropy, epistemology, computing)
docs/neuroscience/   source papers (Lagrangian agents, neuropartitioning)
publications/        output papers with numerical validation panels
src/advalidation/    Python validation suite for the advertising theory paper
web/                 Next.js playground (template + playground implementation)
```

## Signature effect: Interstitial Drift

The library ships one effect that is not a grading preset and not a degradation
filter: `chromatic.interstitialDrift`. It encodes content for a colour pipeline
that does not exist.

Consumer displays converge on two colour management philosophies. Apple's path
applies ICC profile correction, EDR tone-mapping, and a Display P3 gamut that
is roughly 35% wider than sRGB in the green/cyan region. Microsoft's path
applies no mandatory gamut transform, passes content through at the sRGB clamp,
and leaves highlight roll-off to the application. The two pipelines handle the
same encoded frame differently — most visibly in saturated greens, highlight
shoulders, and neutral white balance.

Interstitial Drift targets the gap between them. It applies three coupled
transforms parameterised by a single `drift` value in [0, 1]:

**Gamut push.** Green and cyan channel values are nudged toward P3-adjacent
primaries. On an sRGB display the pushed values are clipped, reading as
slightly desaturated. On a P3-managed display they are delivered in full,
reading as fractionally over-saturated. Neither reading is wrong; neither is
the encoded intent.

**Highlight roll-off.** A log shoulder is applied between gamma 2.2 and a
PQ-adjacent curve. The knee sits above the midtones, in the region where the
two pipelines diverge most in their interpretation of encoded luminance. Apple's
tone-mapping opens the shoulder; Windows' pass-through compresses it. The same
highlight reads differently on each.

**White point drift.** The neutral axis is shifted from D65 (~6504 K) toward
~6000 K. Apple's colorsync corrects toward D65, so the shifted content reads
cooler than encoded. Windows passes the shift through, so it reads warmer. The
same frame cannot have the same white balance on both.

The result is content with a resting cut that no available decoder graph fully
resolves — receiver-relative meaning with no privileged receiver. At `drift=0`
the effect is a no-op. At `drift=0.6` (the default) the characteristic look
is present but not legible as a technical artefact. At `drift=1.0` the
displacement is maximal: correct nowhere, broken nowhere, recognisable as a
deliberate position.

In the compositions in this repository the effect is applied only at the single
colour moment of each scene — the cobra peak in *Leave Before You Arrive*, the
keyhole light in *Be The One We Need* — so the B&W acts are untouched and the
drift surfaces only where colour exists to carry it.

The effect is implemented in `web/src/effects/video/chromatic/interstitialDrift.ts`
with both a CPU `transform(ImageData)` path and a GLSL shader string for
GPU-accelerated rendering.

## Companion paper

The theoretical basis is documented in
`publications/advertising-coordinate-receivers/advertising-coordinate-receiverts.tex`.
That paper develops the receiver model, the Floor Theorem, carrier-shift
decoupling, the catalyst composition law, campaign saturation conditions, and
the coherence triangle, each with a corresponding numerical experiment in
`src/advalidation/`.
