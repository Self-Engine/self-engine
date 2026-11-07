---
status: accepted
date: 2026-11-08
decisions: D2, D18
---

# AGPL for the app and sync server, MIT for the plugin SDK

## Context

The main reason the project is open source is trust: users can check what happens to their
data. A permissive license would let anyone run a closed, commercial clone of the sync service.
A plugin ecosystem, if it ever comes, needs a license that does not scare plugin authors away.

## Decision

- The app and the sync server are licensed **AGPL-3.0-only** (`LICENSE` at the repo root).
- The plugin SDK and the data format specification will be licensed **MIT** when they exist.
  Each such package carries its own `LICENSE` file and `license` field.

## Consequences

- Anyone who runs a modified sync server for others must publish their changes.
- Code copied from MIT projects (such as t3code) may be used here; code may only flow from
  this repo into MIT packages if its author agrees.

## Considered Options

- **MIT for everything.** Rejected: allows closed commercial clones of the sync service.
- **AGPL for everything.** Rejected: slows down a plugin ecosystem.
