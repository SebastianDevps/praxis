# Hook-Owned Approval — Decisions

## ADR-001: The approval record is written by a hook, never by the model

### Context
`spec-driven-workflow` ADR-006 chose the host's `ask` as the approval stop; the matrix showed the
model advancing `stage:` itself once the `ask` was refused.

### Options Considered
1. Reword the `ask` so it does not name the field — hides the bypass, does not remove it.
2. Require the person to type `/praxis:approve` always — works on every host, but on Claude Code
   the permission prompt is already an approval; asking twice is ceremony.
3. `PostToolUse` writes `.praxis/approved/<change>` when the approved edit ran; `pre-tool-use`
   gates on the marker and denies Edit/Write to it. `/praxis:approve` covers hosts without `ask`
   and unattended runs.

### Decision
Option 3. The one thing the model cannot do is answer its own permission prompt; the marker is
the durable trace of that answer.

### Consequences
- Bash writes to the marker remain possible (documented gap).
- An unattended run must ship the marker, written by a person or by CI — that is the point.
