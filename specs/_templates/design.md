# {Change Name} — Design

<!-- Legacy name — new changes use spec.md (specs/_templates/spec.md). Existing changes keep this
     file: the floor accepts either, and the person reviews it before any source file is edited. -->

## Overview
{What this change does, in 2-3 sentences.}

## Problem Statement
{What is wrong or missing today, in the terms of someone affected by it — not in terms of the fix.}

## User Stories
- As a {who}, I want {what} so that {why}.

## Scope
### In
- {…}
### Out
- {What this change explicitly does NOT include.}

## Technical Design
{Approach. Pseudocode and shapes, not production code. Sub-sections as the change needs them:
 data / API / UI / hooks / files touched.}

## Edge Cases
- {…}

## Acceptance (EAG)
Runnable checks. Each must be green before `stage: implemented`. Four states: PASS · FAIL · SKIP · GAP.

- [ ] `{command}` → {expected output}
