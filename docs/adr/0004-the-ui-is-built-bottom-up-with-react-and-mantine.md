---
status: accepted
date: 2026-11-08
decisions: D23, D24, D25
---

# The UI is built bottom-up with React and Mantine

## Context

The old UI grew feature by feature, and the shared parts (navigation, sidebar, page frame)
were reshaped many times after modules already depended on them.

## Decision

- The UI is written from scratch in **React with Mantine**, with its own revised look.
- It is built **bottom-up**: the app shell (navbar, sidebar, page frame, theme, base
  components) is designed and finished first, and only then do modules move in.
- The same principle holds for the whole project: each layer (repo foundation → design system
  and app shell → data layer → shared core → projects and time → import) is finished and
  tested before the next one builds on it. No feature comes before its foundation.
- The app ships in **German and English** from the first screen; code and documentation are
  English.

## Consequences

- There is no separate UI layer for plugins.
- A module never works around a missing shell feature locally; the feature goes into the shell.
