# Deepening

How to deepen a cluster of shallow modules safely, given its dependencies. Uses the vocabulary in
`../SKILL.md`: **module**, **interface**, **seam**, **adapter**.

## Dependency categories

When assessing a candidate for deepening, classify its dependencies. The category decides how the
deepened module is tested across its seam.

### 1. In-process

Pure computation, in-memory state, no I/O. Always deepenable: merge the modules and test through
the new interface directly. No adapter needed.

### 2. Local-substitutable

Dependencies with a local test stand-in (PGLite for Postgres, an in-memory filesystem).
Deepenable when the stand-in exists. The deepened module is tested with the stand-in running in
the suite. The seam is internal; no port at the module's external interface.

### 3. Remote but owned (ports and adapters)

Your own services across a network (internal APIs, microservices). Define a **port** (an
interface) at the seam. The deep module owns the logic; the transport is injected as an
**adapter**. Tests use an in-memory adapter; production uses an HTTP, gRPC, or queue adapter.

Recommendation shape: "Define a port at the seam, implement an HTTP adapter for production and an
in-memory adapter for testing, so the logic sits in one deep module even though it is deployed
across a network."

### 4. True external (mock)

Third-party services you do not control (Stripe, Twilio, ...). The deepened module takes the
external dependency as an injected port; tests provide a mock adapter. See `tdd` —
`references/mocking.md` — for the shape of that mock.

## Seam discipline

- **One adapter means a hypothetical seam. Two adapters means a real one.** Introduce a port only
  when at least two adapters are justified (typically production + test). A single-adapter seam is
  indirection.
- **Internal seams vs external seams.** A deep module can have internal seams (private to its
  implementation, used by its own tests) as well as the external seam at its interface. Never
  expose an internal seam through the interface because a test uses it.

## Testing strategy: replace, don't layer

- Old unit tests on the shallow modules become waste once tests exist at the deepened module's
  interface; delete them.
- Write the new tests at the deepened module's interface. The **interface is the test surface**.
- Tests assert on observable outcomes through the interface, not internal state.
- Tests survive internal refactors because they describe behavior, not implementation. A test that
  has to change when the implementation changes is testing past the interface.

Adapted from `codebase-design/DEEPENING.md` in mattpocock/skills (3cca18b).
