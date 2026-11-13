---
status: accepted
date: 2026-11-13
decisions: D266
---

# The desktop app owns the module list, and the data protocol what crosses modules

## Context

[ADR 0018](0018-the-database-runs-in-a-data-process-the-page-reaches-directly.md) let
`@self-engine/contracts` own `health` and the `tablesChanged` stream beside the composed app
contract, and [ADR 0020](0020-modules-implement-their-ports-through-one-shared-frame.md) put the
one data-side module list in `data-process`. Both made a package below the modules depend on
every module: `data-client` and the `data-process` core needed `health` and the stream, so they
reached the modules through `contracts`. A module's tests that start the real Data Process then
close a cycle between packages through their devDependencies, which dependency-cruiser does not
see, since it only finds cycles between files.

## Decision

- **`@self-engine/data-protocol` owns what crosses modules**: `health` and the `tablesChanged`
  stream. It knows no module. `data-client`, the `data-process` core and the desktop bridge take
  them from there. `@self-engine/contracts` still composes the one app contract, from the
  protocol and the modules' contracts.
- **The desktop app owns the module list** (`apps/desktop/src/data-modules.ts`), checked against
  the app contract, and hands it to the `data-process` core, which knows no module. The list
  builds migrations and router together, as ADR 0020 decided for its old place.
- **No package below a module depends on one.** `data-client` builds the client on the page from
  the protocol alone; a module's entries are typed by its hooks from its own contract.
- **No cycle between packages, devDependencies included.** A test over every `package.json`
  fails on one ([ADR 0006](0006-module-boundaries-are-enforced-three-ways.md)). An import only
  tests and stories use stands in `TEST_ONLY_IMPORTS`, never in `ALLOWED_IMPORTS`.

This replaces the ownership of `health` and the stream in ADR 0018 (decision 2) and the place of
the module list in ADR 0020. Their other decisions stand.

## Consequences

- One package more, `data-protocol`.
- A module's tests may start the real Data Process without a cycle, and they stay next to the
  code they test.
- Registering a module means one entry in the desktop app's list; the
  [module-author guide](../development/port-pattern.md) gives the steps.

## Considered Options

- Moving the tests over the real Data Process out of `data-client` and the module into a package
  above both: the tests would sit far from their code, and the cycle through `contracts` would
  remain.
