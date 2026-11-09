---
status: accepted
date: 2026-11-09
decisions: D37, D74, D77, D127
---

# Modules declare their Views as data and one route renders them

## Context

Each module is its own package and brings a Shell Contribution (D74) that lists its Views for the Module Sidebar. The contribution type lives in `@self-engine/shell`, which stays free of the router (D127). Routing is file-based and lives in `apps/web` (D37), which no package may import. Addresses have exactly two parts, `/<module>/<view>` (D77). The app has to stay fluid as modules are added.

## Decision

1. **A module declares its Views as data:** an id, a title and a function that loads the View's code. It knows nothing about the router.
2. **The app has one route for all modules, `/$module/$view`.** It looks up the contribution and renders the View, or shows that nothing was found. `/$module` redirects to the module's default View.
3. **A View's code only arrives through its load function, which the route's loader awaits.** The startup bundle therefore holds names and icons however many modules exist, and the previous View stays on screen until the next one is ready. The type requires the function, so the fast path is the default.

This narrows D37: file-based routing stays for the app's own pages, but module Views get no route file each.

## Consequences

- A new module is a new package plus one line in the app's module list.
- Link targets are not checked at compile time, so `/projects/actve` compiles. A test over all contributions requires unique, URL-safe ids, and an unknown address ends in the not-found path.
- The router validates no search parameters of a View. Filters live in the address as search parameters whose meaning the module defines and checks in its own loaded code. Views and Groups reach them through a hook from `@self-engine/shell` that takes a selector, so a change to another parameter, such as opening the edit drawer, does not redraw them.
- A deeper address than two parts would need a splat on the generic route. The contract would not change.

## Considered Options

- **One route file per View in the app,** the way t3code does it: rejected. It is the standard TanStack path and just as fast, but t3code has fixed pages in one app, while our modules already list their Views. Every View would be declared twice, about 17 files for 5 modules, and the two lists could drift.
- **Modules export real TanStack routes:** rejected. Every module would depend on the router, file-based routing would go or be mixed with code-based routes, and typed links would still be out of reach, because the router's `Register` lives in the app that modules cannot see.
