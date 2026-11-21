---
name: verify-desktop
description: Check desktop Layout Steps, every View, reloads and deep links in the built app when the user requests or accepts an app check.
---

# Verify desktop

Run when the user requests or accepts an app check. This is a visual inspection aid; `pnpm verify` remains the completion gate.

1. From the checkout root, run `pnpm verify:desktop`. It builds the dev app and starts it with a throwaway profile and its own renderer port. Started by an agent, the window stays hidden: it never takes the user's focus. Pass `--visible` only when the user asks to watch; a script of your own that starts the app through `launchElectron` (`scripts/desktop-app.ts`) stays hidden the same way, and only `window: "visible"` shows it. If it reports a running `pnpm dev` in this checkout, let the user decide when to end that session before retrying. `--executable <path>` checks a packaged app instead. Nightly and stable executables always show their window.
2. A failed run exits with code 1 and prints the failing step and its errors; screenshots up to that step stay in the folder. Read `summary.json` in the absolute output folder printed by the command. Use its steps, screenshots and skipped checks to guide the inspection.
3. Inspect the first eight screenshots: wide, medium, narrow and narrowest in light, then dark. The narrowest width shows the narrow Layout Step. Look for clipped content, overlaps, unreadable text and contrast problems.
4. Inspect the remaining wide/light screenshots for the Views, Settings, reload and deep links.
5. Report pass or failure and link the output folder. Show the relevant screenshots, describe what you noticed, and name skipped checks and the limits below. A passing script covers objective checks; the images still need judgement.

## What the check cannot see

- Page screenshots omit the native macOS window buttons. The geometry check covers their reserved strip; their appearance and full-screen behavior need a separate inspection.
- Windows and Linux use the native frame. Their window-button strip check follows the overlay in #167.
- The desktop window's minimum width keeps the phone Layout Step unreachable.
- Main-process errors are recorded only in a hidden run; with `--visible`, only page errors fail the check.
- Deep links exercise page addresses. OS-protocol links need a separate check.
