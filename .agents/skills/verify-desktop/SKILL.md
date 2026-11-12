---
name: verify-desktop
description: Check desktop Layout Steps, every View, reloads and deep links in the built app.
disable-model-invocation: true
---

# Verify desktop

Run only when the user requests an app check. This is a visual inspection aid, never a gate or a CI stage.

1. From the checkout root, run `pnpm verify:desktop`. It builds the dev app and starts a hidden window with a throwaway profile and its own renderer port. If the command reports a running `pnpm dev` in this checkout, stop and let the user decide when to end that session before retrying. `--visible` shows the window; `--executable <path>` checks a packaged app instead of building. Nightly and stable executables always show their window because they ignore the dev-only hidden switch.
2. Read `summary.json` in the absolute output folder printed by the command, under `.temp/verify-desktop/<timestamp>/`. Each step records its route, width, Layout Step, Color Mode, screenshot filename and errors. A failed run keeps earlier screenshots and names the failed step. Old folders stay available for comparison.
3. Inspect the first eight screenshots: wide, medium, narrow and narrowest in light, then dark. Names follow `<nn>-<step>-<layout-step>-<color-mode>.png`; narrowest still has the narrow Layout Step. Look for clipped content, overlaps, unreadable text and contrast problems. The check changes Electron's system theme while the Color Mode setting stays at System.
4. Inspect the remaining wide/light screenshots: every discovered module and View, Settings, Settings after reload, a full View deep link and, when a main action exists, its `?edit=` address reopened with the Edit Drawer visible. Modules and Views are discovered through named navigation landmarks and clicked; replacing placeholder modules requires no script changes. An empty Navbar, a changed route on reload, a wrong deep-link destination or a missing Edit Drawer fails the run. `editDeepLink` in the summary says when that check was skipped because no module had a main action.
5. Read `windowButtons` in the summary. On macOS the script checks Shell content geometry against the Shell's exported window-button strip at each Layout Step. Windows and Linux skip this check while they use the native frame (until #167).
6. Report pass or failure and link the output folder. Show the relevant screenshots, describe what you noticed, and name what remains unchecked. Page screenshots omit the native macOS window buttons: their appearance is unchecked even when the geometry check passes. Name any skipped checks from the summary. A passing script checks objective errors, Layout Steps, routes and the macOS strip; the images still need judgement. OS-protocol links, the phone Layout Step, full-screen window-button behavior and Windows/Linux overlays are outside this flow.
