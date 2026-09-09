# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Architecture (architecture)

**Impact:** CRITICAL
**Description:** How the codebase is organized — module boundaries, layering, where a concern lives
and where it must not.

## 2. Code Quality (quality)

**Impact:** CRITICAL
**Description:** Standards for maintainable code — reviews, PR size, comments, imports, error
handling.

## 3. Data Layer (data)

**Impact:** HIGH
**Description:** Persistence patterns — repositories, DTO boundaries, migrations, query shape —
that keep storage technology isolated from business logic.

## 4. API Design (api)

**Impact:** HIGH
**Description:** Public surface stability, thin controllers, and the separation of transport
concerns from business logic.

## 5. Performance (performance)

**Impact:** HIGH
**Description:** Algorithmic complexity, data-structure choices, and the patterns that hold up at
scale.

## 6. Testing (testing)

**Impact:** MEDIUM-HIGH
**Description:** Coverage requirements, test levels, mocking, and the conditions under which a
test is trusted.

## 7. Design Patterns (patterns)

**Impact:** MEDIUM
**Description:** Dependency injection, factories, and the other patterns this codebase uses on
purpose — with the cases where they do not apply.

## 8. Team Culture (culture)

**Impact:** MEDIUM
**Description:** Accountability, collaboration, and how the team works with tooling and agents.

## 9. CI/CD (ci)

**Impact:** HIGH
**Description:** Continuous integration practice — what runs before a push, how failures are
handled, git workflow.

## 10. Reference (reference)

**Impact:** LOW
**Description:** Informational lookups — key file locations, local development setup.
