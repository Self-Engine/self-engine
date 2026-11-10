# Performance checks

## React Compiler

The web build (also shipped in Electron) compiles app and workspace React code with
`babel-plugin-react-compiler` through `@vitejs/plugin-react`'s Babel preset. Dependencies
under `node_modules` are excluded by the preset. Lingui runs before the compiler. Compiler
adoption is a separate commit so a regression can be bisected independently of these tools.

## Compare component redraws

```sh
pnpm ensure:chromium
pnpm renders --output .temp/renders/before.json
# Switch to the other code state, retaining the measurement tool and scenarios.
pnpm renders --output .temp/renders/after.json --compare .temp/renders/before.json
```

The command starts its own local web dev server on a free port, opens isolated headless
Chromium, runs the real app, and closes both on completion or failure. It measures:

1. Alpha Overview → Archive, including pending routing work.
2. Opening the Studio entry's edit drawer, including its first lazy load.

Each scenario reports root commits, committed function-component renders and counts by
component name. The JSON records the commit and complete working-tree hash, including
uncommitted changes. A comparison shows absolute counts and changes per scenario/component.
Keep the reports in `.temp/`; commit neither reports nor generated screenshots.

This is a diagnostic comparison, **not a gate**. Use the same Node/Chromium versions,
viewport and scenarios for both states. Repeat measurements before drawing conclusions:
async loading, React development mode, Strict Mode and Mantine effects influence the counts.
These are not production timings, DOM mutation counts, abandoned render attempts, or counts
of Strict Mode's extra function invocations. Components sharing a name are aggregated.

Instrumentation is installed through the React DevTools hook in the measurement browser
only. It counts `PerformedWork` for function/forward-ref/simple-memo Fibers and tracks the
last committed Fiber to exclude reused subtrees with stale flags. This private React
interface needs checking on React upgrades; a scenario recording no work fails explicitly.
Storybook and production code do not include the hook.

## Startup JavaScript budget

Every production web build, including `pnpm verify` and Electron packaging, audits the
emitted chunk graph. Starting at every entry, it follows **static** imports and counts each
shared JavaScript chunk once. Dynamic imports, CSS, fonts and other assets are outside this
JavaScript budget. The report is `apps/web/dist/startup-bundle.json`.

The current compiler-enabled baseline is **793,601 raw bytes** across 22 static chunks.
The limit is **832 KiB (851,968 bytes)**, about 7% headroom. Raw emitted bytes avoid a
compression-version dependency. A deliberate budget increase must explain the measured
cost in its PR; splitting filenames or moving code to a shared chunk does not evade it.

Independently of size, a workspace module declared as a dynamic-import target must stay
out of static startup chunks. This catches eager imports of contribution Views, Groups,
drawers and commands, as well as other deferred workspace modules. The audit derives the
set from the bundler's module graph, rather than a list of today's module/View filenames.
Shared dependencies of lazy modules can still be eager; the lazy entry itself cannot.
A fixture test builds both lazy and accidentally eager versions and checks the actual
build fails, including when it is below the byte limit.
