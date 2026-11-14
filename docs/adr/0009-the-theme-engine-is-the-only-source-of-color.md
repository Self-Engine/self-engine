---
status: accepted
date: 2026-11-09
decisions: D57, D58, D61, D68, D69, D70, D71, D81, D109, D110, D111, D112
---

# The theme engine is the only source of color

## Context

Every screen needs colors, and nothing may contradict the readability the app promises. The
throwaway shell prototype showed the look we want, but part of its final color only existed in
the browser (CSS mixing, translucent containers), so no test could see what the user sees. Muted
text failed WCAG AA on tinted backgrounds. Mantine also kept its own copy of the light/dark
choice, and users will later bring Themes from other tools.

## Decision

1. **The theme engine is the only source of color.** The new package `@self-engine/theme` turns
   the appearance settings and the Theme catalog into final sRGB values as plain data. Those same
   values feed the `--se-*` CSS variables and Mantine, and the contrast test checks exactly them.
   Components use Color Roles only.
2. **Themes are complete role tables.** A Theme fills every Color Role for at least one Color
   Mode, so adding a role fails the typecheck of every table. A role added after the first release
   comes with a derivation rule and a Theme version bump, so stored Themes can be upgraded.
3. **Foreign formats are converted on import.** A VS Code theme, for example, is converted once
   into this format and joins the same open catalog. The engine never reads a foreign format.
4. **The engine owns the Color Mode.** It resolves "system" itself and gives Mantine only light or
   dark. Mantine's color scheme storage is not used.
5. **The core stays pure.** The core entry point has no React, Mantine or DOM, so the calculation
   and the contrast check can run in tests, in an importer and later in React Native. The Mantine
   binding is a separate entry point, and dependency-cruiser enforces the split.

## Consequences

- Wide-gamut colors are given up, because the output is sRGB hex.
- A new Theme or Color Set is data, and the contrast test covers it without new test code.
- The text on a fill comes from its Color Set, never from Mantine's automatic contrast, and may
  be dark, as on yellow
  ([ADR 0029](0029-an-entrys-icon-and-color-are-names-written-strictly-read-unchanged-and-drawn-by-one-mark.md)).
- Exact per-component tuning of Mantine stays a separate step, since generated palettes only
  approximate a Theme.
