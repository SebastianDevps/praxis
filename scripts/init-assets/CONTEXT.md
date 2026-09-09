# {Project Name} — domain language

{One or two sentences: what this context is and why it exists.}

This file is a glossary and nothing else: no implementation details, no decisions, no notes.
Decisions go in `specs/<change>/decisions.md`; facts about the code go in
`agents/knowledge-base.md`.

When output names a domain concept — a task title, a test name, a hypothesis, a proposal — use
the term as defined here, never a synonym listed under `Avoid`. A concept that is not in the
glossary is a signal: either the language is invented (reconsider), or the gap is real (add the
term here, one line, with its `Avoid` list).

Only terms specific to this project belong. General programming concepts (timeout, retry,
handler, DTO) do not, however often the code uses them.

## Language

**{Term}**:
{One sentence: what it is, not what it does.}
Avoid: {synonym}, {synonym}

**{Term}**:
{One sentence: what it is, not what it does.}
Avoid: {synonym}

Adapted from `domain-modeling` in [mattpocock/skills](https://github.com/mattpocock/skills) and
the `CONTEXT.md` in [mattpocock/slopwatch](https://github.com/mattpocock/slopwatch).
