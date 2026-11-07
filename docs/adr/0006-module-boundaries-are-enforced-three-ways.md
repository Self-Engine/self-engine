---
status: accepted
date: 2026-11-08
decisions: D10, D21, D36
---

# Module boundaries are enforced three ways

## Context

Modules (projects, time, finance, calendar, habits) must stay separable from day one: it keeps
the code maintainable with agents writing much of it, and it is the only door we keep open
for plugins. A convention alone erodes; agents take the shortest import path.

## Decision

Each boundary is enforced by three independent mechanisms:

1. **One workspace package per module.** pnpm's strict isolation means a package can only
   import what it declares as a dependency.
2. **The `exports` field is the public interface.** Anything not exported is internal, and deep
   imports into another package fail to resolve.
3. **dependency-cruiser in CI** checks the allowed directions between packages and forbids
   cycles.

A formal module manifest follows only once the third module exists.

## Consequences

- Shared logic moves into a shared package instead of being imported sideways.
- Adding a dependency between two modules is a visible change in `package.json` and the
  dependency-cruiser rules, and reviewers can question it.
