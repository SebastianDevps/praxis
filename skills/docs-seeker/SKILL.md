---
name: docs-seeker
description: Use when coding against an unfamiliar or fast-moving library and you need its current docs or API reference — resolves the exact installed version and fetches topic-scoped docs instead of trusting stale training memory.
kind: skill
od:
  category: research
  triggers:
    - docs
    - library docs
    - how to use
    - api reference
    - context7
---

## When to use

Unfamiliar library, fast-moving API (anything released or updated in the last 12 months), or any time version matters — seek docs first.

## Steps

1. **Resolve library + version.** Check `package.json`, `go.mod`, `Cargo.toml`, or equivalent. Pin to the exact installed version before fetching.
2. **Check `llms.txt`.** Try `<root-url>/llms.txt` — many modern libraries publish a token-efficient doc index. If present, use it to scope the fetch.
3. **Fetch topic-scoped docs (Context7-style).** Don't dump the full reference. Resolve the specific API surface you need (e.g. `useQuery` not all of React Query), then fetch that section. Smaller context = higher signal.
4. **Prefer official sources.** Docs from the library's own site or repo outrank blog posts, Stack Overflow answers, or third-party tutorials. Secondary sources are acceptable only when official docs are absent or incomplete.
5. **Note what changed.** If the docs differ from your training knowledge, call it out explicitly before writing any code.

## Anti-patterns

- Writing code from memory for any library you haven't checked docs for in this session.
- Fetching the entire docs index when only one function's signature is needed.
- Treating a blog post from 2022 as ground truth for a library on v3.

> Curated from vibecode vc-docs-seeker.
