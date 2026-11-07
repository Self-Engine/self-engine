---
status: accepted
date: 2026-11-08
decisions: D28, D29, D30, D34, D35
---

# Vite+ and pnpm, without Turborepo

## Context

Self-Engine used Bun, Turborepo, ESLint and Prettier. The new repo needs Electron packaging,
native modules and strict package isolation for module boundaries. `pingdotgg/t3code` shows a
working Electron monorepo on Vite+ and pnpm.

## Decision

- **Vite+ (`vp`)** is the toolchain: `vp check` (Oxfmt, Oxlint with type-aware rules, type
  check), `vp test` (Vitest), `vp run` (tasks with cache) and `vp pack` (library and Electron
  main/preload builds). The pnpm catalog points `vite` at `@voidzero-dev/vite-plus-core`.
- **pnpm with Node 26** is the package manager and runtime for tools and tests.
- **`@types/node` is pinned to Electron's Node version** (24), so the type checker flags
  Node 26 APIs that Electron does not have yet.
- **No Turborepo.** `vp run` orchestrates tasks over the package graph and caches them; two
  task runners would mean two caches.
- Custom lint rules live in our own Oxlint plugin.

## Consequences

- Vite+ is young; the repo works around known issues (for example `peerDependencyRules` for
  `vite`) and tracks upstream fixes.
- Turborepo stays the fallback if `vp run` does not hold up.

## Considered Options

- **Bun.** Rejected: Electron Forge does not support it, electron-builder has Bun bugs, and
  its test runner has subtly different semantics from Vitest.
- **ESLint + Prettier, Biome.** Rejected in favour of the Oxc tools Vite+ ships.
