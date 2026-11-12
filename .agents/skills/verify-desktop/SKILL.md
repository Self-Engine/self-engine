---
name: verify-desktop
description: Check the built desktop app at the desktop reference widths in light and dark.
disable-model-invocation: true
---

# Verify desktop

Run only when the user requests an app check. This is a visual inspection aid, never a gate or a CI stage.

1. From the checkout root, run `pnpm verify:desktop`. It builds the dev app and starts a hidden window with a throwaway profile and its own renderer port. If the command reports a running `pnpm dev` in this checkout, stop and let the user decide when to end that session before retrying. `--visible` shows the window; `--executable <path>` checks a packaged app instead of building. Nightly and stable executables always show their window because they ignore the dev-only hidden switch.
2. Read `summary.json` in the absolute output folder printed by the command, under `.temp/verify-desktop/<timestamp>/`. Each step records its route, width, Layout Step, Color Mode, screenshot filename and errors. A failed run keeps earlier screenshots and names the failed step. Old folders stay available for comparison.
3. Inspect the eight screenshots: wide, medium, narrow and narrowest in light, then dark. Names follow `<nn>-<step>-<layout-step>-<color-mode>.png`; narrowest still has the narrow Layout Step. Look for clipped content, overlaps, unreadable text and contrast problems. The check changes Electron's system theme while the Color Mode setting stays at System.
4. Report pass or failure and link the output folder. Show the relevant screenshots, describe what you noticed, and name what remains unchecked. Page screenshots omit the native macOS window buttons, so their appearance and overlap are not proven. This slice covers the first View at eight sizes and colors; module navigation, reloads, deep links and window-button geometry are added separately in #189. A passing script checks objective errors and Layout Steps; the images still need judgement.
