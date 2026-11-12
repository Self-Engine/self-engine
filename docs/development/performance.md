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

The current compiler-enabled baseline is **799,595 raw bytes** across 25 static chunks.
The limit is **832 KiB (851,968 bytes)**, about 6% headroom. Raw emitted bytes avoid a
compression-version dependency. A deliberate budget increase must explain the measured
cost in its PR; splitting filenames or moving code to a shared chunk does not evade it.

Independently of size, a workspace module declared as a dynamic-import target must stay
out of static startup chunks. This catches eager imports of contribution Views, Groups,
drawers and commands, as well as other deferred workspace modules. The audit derives the
set from the bundler's module graph, rather than a list of today's module/View filenames.
Shared dependencies of lazy modules can still be eager; the lazy entry itself cannot.
A fixture test builds both lazy and accidentally eager versions and checks the actual
build fails, including when it is below the byte limit.

## Storage port pattern

Measured during #32 on **in-memory SQLite, Node 26, arm64, without the hop between
processes**. That environment applies to every row below. These are diagnostic measurements,
not timing gates; costs measured independently should not be added into an end-to-end estimate.

| Measurement                                        | Result                              |
| -------------------------------------------------- | ----------------------------------- |
| Frame beyond the transaction                       | About 3.5 µs per call               |
| Shared entry lookup                                | 0.21 µs                             |
| Shared entry insert                                | 1.14 µs                             |
| Shared entry update                                | 0.79 µs                             |
| Shared entry soft delete plus restore              | 2.10 µs                             |
| Table-write plugin                                 | 0.41 µs per write                   |
| Conflict translation, read                         | 0.82 µs per read                    |
| Conflict translation, write                        | 0.52 µs per write                   |
| Conflict translation when a conflict occurs        | 34 µs                               |
| Page list, 100,000 rows, 100-row pages, first page | 0.072 ms median                     |
| Page list, 100,000 rows, 100-row pages, row 90,000 | 0.094 ms median                     |
| Large-result check                                 | About 7 ns per call                 |
| 10,000-row list without join                       | 5.152 ms median                     |
| 10,000-row list with released read-piece join      | 7.911 ms median; +2.759 ms (+53.6%) |

The join comparison was re-measured for #209 on 2026-11-12 with Node 26.13.0, arm64,
in-memory SQLite and no process hop. The database contained 10,000 notes and 10,000 links,
one link per note, all live in one Space. Both paths read, scope, sort and map all 10,000 links
inside a transaction. The baseline sorts by link id; the joined path runs the note-links
module’s list, left-joining the owner’s `noteTitles` read piece and sorting by title then link
id. This measures the complete list shape including the changed ordering and extra mapped
columns, rather than isolating the SQL join alone. After 10 warm-up calls per path, 51 samples
per path alternated execution order; the table gives their medians. It replaces the earlier
+2.3 ms (+48%) figure, whose row count could not be established from the #207 commit or
`packages/storage/src/testing/read-pieces.test.ts`.

Separately, the built desktop smoke stage’s **Data Process first answer** was **175 ms before**
and **269 ms after**, against a **2,000 ms limit**. These are **single samples**, not medians or
an established regression. Unlike the in-memory microbenchmarks above, this is a real app
startup measurement including the process hop. The reported build environment was Node 26,
arm64; no in-memory-only claim applies to the smoke measurement.
