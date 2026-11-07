---
status: accepted
date: 2026-11-08
decisions: D17, D26, D32
---

# Electron is the desktop shell, built like t3code

## Context

Desktop is the main product and ships first; web and mobile follow. The shell needs native
SQLite in Node, support from the sync SDKs we may adopt later, and the tray, popover and
updater features Self-Engine already has. Tauri's SQLite story for those SDKs is still alpha.

## Decision

- The desktop app is an **Electron** app.
- It is built the way `pingdotgg/t3code` builds its app: main and preload are bundled with
  `vp pack` as CommonJS, the renderer is a plain Vite app, `electron-builder` packages it and
  `electron-updater` updates it.
- `electron` is never bundled into the preload (`deps.neverBundle`).

The spike in `prototypes/layer-0-spikes/` (path A) proves this setup and lists the pitfalls it
solved.

## Consequences

- The web build of the renderer compiles in CI from the start but does not ship until sync.
- Electron's Node version lags behind the tooling's Node 26, so `@types/node` is pinned to
  Electron's Node version (see ADR 0005).

## Considered Options

- **Tauri.** Rejected: SQLite for the sync SDKs is alpha, and the existing Electron features
  would have to be rewritten.
- **electron-vite.** Works under Vite+ (spike path B) and stays the fallback, but adds a layer
  t3code shows we do not need.
- **Electron Forge.** Rejected: requires `node-linker=hoisted`, which breaks the strict pnpm
  isolation the module boundaries rely on (ADR 0006).
