---
name: codebase-design
description: Use when designing a module's interface — where the seam goes, how deep the module is, whether an extraction earns its keep — the shared vocabulary (module, interface, depth, seam, adapter, leverage, locality) and the four principles of deep modules. NOT scoring approaches you already hold (that is `strategy-compare`), NOT the visual layer of a page (that is `frontend-design`).
kind: skill
od:
  category: engineering
  triggers:
    - "deep module"
    - seam
    - "interface design"
    - "module design"
    - "deletion test"
---

# Codebase design — the vocabulary of deep modules

A reference, not a session. It fixes the words and the principles, then stops. Whatever is driving
the work — `tdd`, `brainstorming`, the refactor pipeline, a dispatched engineer — uses this
language wherever code is being designed or restructured. Invoked on its own it reads no files and
proposes no refactor.

## Glossary

Use these terms exactly. Each carries the loose substitutes to avoid, because consistent language
is the whole point.

- **Module** — anything with an interface and an implementation. Scale-agnostic: a function, a
  class, a package, a slice spanning tiers. _Avoid_: unit, component, service.
- **Interface** — everything a caller must know to use the module correctly: the type signature,
  plus invariants, ordering constraints, error modes, required configuration, performance
  characteristics. _Avoid_: API, signature — both name only the type-level surface.
- **Implementation** — what is inside a module, its body of code. Say "adapter" when the seam is
  the topic, "implementation" otherwise: a Postgres repo is a small adapter with a large
  implementation; an in-memory fake is a large adapter with a small one.
- **Depth** — leverage at the interface: how much behavior a caller or a test can exercise per
  unit of interface they have to learn. Deep: a lot of behavior behind a small interface.
  Shallow: the interface is nearly as complex as the implementation.
- **Seam** (Michael Feathers) — a place where you can alter behavior without editing in that
  place; the location at which a module's interface lives. Where to put it is its own decision,
  separate from what goes behind it. _Avoid_: boundary.
- **Adapter** — a concrete thing that satisfies an interface at a seam. Names a role (which slot
  it fills), not a substance (what is inside).
- **Leverage / Locality** — what callers get from depth (more capability per unit of interface
  learned; one implementation pays back across N call sites and M tests) and what maintainers get
  (change, bugs, knowledge and verification concentrate in one place — fix once, fixed
  everywhere).

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be
  composed internally of small, swappable parts; they are not part of the interface. Internal
  seams (used by its own tests) stay private; the external seam is the interface.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a
  pass-through. If complexity reappears across N callers, it was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam. If you want to
  test past the interface, the module is the wrong shape.
- **One adapter means a hypothetical seam. Two adapters means a real one.** Cut a seam only when
  something actually varies across it; a single-adapter seam is indirection.

Ask of any interface: fewer methods? simpler parameters? more complexity hidden inside? Accept
dependencies instead of creating them; return results instead of producing side effects.

## Rejected framings

- Depth as the ratio of implementation lines to interface lines (Ousterhout's own definition):
  it rewards padding the implementation. Depth is leverage.
- "Interface" as the language keyword or a class's public methods: too narrow — it includes every
  fact a caller must know.
- "Boundary": overloaded with DDD's bounded context. Say seam or interface.
- Module as a file-system convention (folders, barrel files, feature slices): orthogonal. A deep
  module is access through a strict interface, whatever the tree looks like.

## Going deeper

- `references/DEEPENING.md` — deepening a cluster of shallow modules given the category of its
  dependencies, seam discipline, and replace-don't-layer testing.
- `references/DESIGN-IT-TWICE.md` — dispatch parallel specialists to design the interface in
  radically different ways, then compare on depth, locality, and seam placement.
- `references/COMMENTS.md` — what a comment must add beyond the code, interface documentation kept
  clear of implementation, and the comment you cannot write as a finding about the design.

## It's working if

- The design conversation stops producing "component", "service" and "boundary" and starts
  producing "module", "interface" and "seam".
- A proposed extraction is judged against the deletion test without hedging.
- A proposed seam comes with its second adapter named, not just the first.
- Discussion of an interface covers invariants, ordering and error modes, not only the type
  signature.
- Invoking it starts no session: off the back of this skill alone, no files are read and no
  refactor is proposed.

Adapted from `codebase-design` in mattpocock/skills (3cca18b).
