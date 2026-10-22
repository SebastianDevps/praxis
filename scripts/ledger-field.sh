#!/usr/bin/env bash
# ledger-field.sh — the one frontmatter WRITER the person's scripts share.
#
# Source it, never execute it:  . "${SCRIPT_DIR}/ledger-field.sh"
#
# `hooks/lib.sh` reads frontmatter (praxis_frontmatter_field) and never writes it: the ledger is
# the orchestrator's, and a hook that edits it would be a second writer. The design appendix
# (specs/factory-cycle) makes one exception — the scripts a PERSON runs: `rework.sh` resets
# `round:` and `stage:`, `approve.sh` sets `stage: implemented` after the human override.
# Both go through this function, so the ledger is rewritten one way.
#
#   praxis_set_frontmatter_field <file> <key> <value>
#
# Replaces the value of `<key>:` inside the leading `---` block, keeping a trailing `# comment`
# and every other line byte for byte. A missing key is added before the closing `---`; a file
# without a block gets one; an empty file becomes a block. Temp file plus `mv`, so a ledger is
# never left half-written.
praxis_set_frontmatter_field() {
  local file="$1" key="$2" value="$3" tmp="$1.tmp.$$"
  awk -v KEY="$key" -v VAL="$value" '
    NR == 1 {
      fm = ($0 ~ /^---[ \t]*$/)
      if (fm) { print; next }
      print "---"; print KEY ": " VAL; print "---"; done = 1
    }
    fm && !done && /^---[ \t]*$/ { if (!seen) print KEY ": " VAL; done = 1; print; next }
    fm && !done && index($0, KEY ":") == 1 {
      rest = $0; sub(/^[^:]*:[ \t]*/, "", rest)
      comment = ""; if (match(rest, /[ \t]*#.*$/)) comment = substr(rest, RSTART)
      print KEY ": " VAL comment; seen = 1; next
    }
    { print }
    END { if (NR == 0) { print "---"; print KEY ": " VAL; print "---" } }
  ' "$file" > "$tmp" && mv "$tmp" "$file"
}
