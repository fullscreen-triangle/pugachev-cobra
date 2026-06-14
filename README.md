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

## Companion paper

The theoretical basis is documented in
`publications/advertising-coordinate-receivers/advertising-coordinate-receiverts.tex`.
That paper develops the receiver model, the Floor Theorem, carrier-shift
decoupling, the catalyst composition law, campaign saturation conditions, and
the coherence triangle, each with a corresponding numerical experiment in
`src/advalidation/`.
