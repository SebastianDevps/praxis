# Why the ATAM phase model is not imported

Loaded when someone asks which ATAM phase a run is in, or where "Phase 0" went. The short version is
in `SKILL.md`; this is the sourcing.

## Two primary sources, two different answers

**Source A — CMU/SEI-2000-TR-004 §9, "The Two Phases of ATAM"**
(https://www.sei.cmu.edu/documents/629/2000_005_001_13706.pdf)

The section title is itself the claim. Its division:

> *"The first phase is architecture-centric… The second phase is stakeholder-centric"*

**Source B — Clements, Kazman & Klein, _Evaluating Software Architectures: Methods and Case Studies_
(Addison-Wesley, 2002), Table 11.2**

Four phases numbered 0–3 — partnership and preparation, evaluation, evaluation continued, follow-up.
This is the model most secondary write-ups reproduce, and it is the one a model is most likely to
recall from training. It is verifiable only through a university-hosted reproduction of the table,
not through a publisher- or SEI-hosted copy.

## The decision

Import the unambiguous part; state the disagreement; do not resolve it.

- **Imported:** the nine steps (§8) and the five output types (§7). One source, one wording, no
  competing version.
- **Not imported:** any phase count. Encoding "four phases" contradicts SEI's own report; encoding
  "two phases" contradicts the book that most readers have met. Encoding either as settled teaches a
  fact a reader can disprove in one click.

The steps do the work the phases were carrying anyway: step 5 is the architecture-centric pass, step
7 is the stakeholder-centric one, and step 8 is the join. Nothing in the method is lost by declining
to number them.

## The general rule this instances

When two primary sources disagree, report the disagreement and name which side was implemented.
A skill that silently picks one side is indistinguishable from a skill that made it up. See
`specs/investigation-suite/decisions.md` ADR-004, which applies the same rule to the bus-factor
definitions, the OpenSSF Scorecard check count, and MADR's optional sections.
