---
status: accepted
date: 2026-11-09
decisions: D42, D73, D121
---

# A story test proves that a component renders, not how it looks

## Context

Every story in the Component Catalog is also a test in `pnpm verify` (D73). What a green story means decides what every future story has to be and what the gate can be trusted for. The built-in appearances alone come to 3 Themes × 2 Color Modes × 2 Densities × 5 font scales × 2 Background Tints × 2 languages, which is 240 combinations before any Accent, and the gate runs both on macOS and on an Ubuntu runner.

## Decision

1. **A green story means it renders in Chromium without an error and without a `console.error`, and that its `play` function passes.** It says nothing about how the component looks.
2. **Story tests run in one fixed appearance:** the default appearance with the Color Mode forced to light, in English. A story fixes a different appearance only when its statement depends on it.
3. **Color correctness stays with the theme engine's contrast audit,** which covers every Theme and Accent as plain data, without a browser.
4. **Screenshots are not part of the gate.**

## Consequences

- A visual error that appears only in dark or in German does not fail the gate. It remains a check by eye in the Component Catalog.
- A color assertion in a story must fix an appearance where the colors differ. In the fixed light appearance of the Neutral Theme, `canvas`, `surface` and `surfaceRaised` are the same white, so a comparison there proves nothing.
- `console.error` has to be collected and raised after the story. Throwing from it directly stayed green in a prototype, because React recovered.
- The cost of a story stays small, measured at about 80 ms per file after about 2.4 s of startup.

## Considered Options

- **Screenshot comparison in the gate:** rejected. macOS and Ubuntu rasterize text differently, so a baseline holds on one platform only, and a local `pnpm verify` would either always fail or compare nothing.
- **Running every story across several appearances:** rejected. Crashes rarely depend on the appearance, so it would multiply the run time without a visual assertion to justify it.
