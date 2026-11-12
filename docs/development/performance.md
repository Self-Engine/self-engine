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
The shared-entry, table-write plugin, frame and conflict figures are added cost per call on
top of the SQLite call, not absolute call times.

| Measurement                                        | Result                |
| -------------------------------------------------- | --------------------- |
| Frame beyond the transaction                       | About 3.5 µs per call |
| Shared entry lookup                                | 0.21 µs               |
| Shared entry insert                                | 1.14 µs               |
| Shared entry update                                | 0.79 µs               |
| Shared entry soft delete plus restore              | 2.10 µs               |
| Table-write plugin                                 | 0.41 µs per write     |
| Conflict translation, read                         | 0.82 µs per read      |
| Conflict translation, write                        | 0.52 µs per write     |
| Conflict translation when a conflict occurs        | 34 µs                 |
| Page list, 100,000 rows, 100-row pages, first page | 0.072 ms median       |
| Page list, 100,000 rows, 100-row pages, row 90,000 | 0.094 ms median       |
| Large-result check                                 | About 7 ns per call   |
| 10,000-row list without join                       | 5.0 ms median         |
| 10,000-row list with released read-piece join      | 8.0 ms median         |

The existing **0.072/0.094 ms** page measurements above apply to the notes template's
two-column order `(created_at ASC, id ASC)`, with a matching live-row index beginning in
`space_id`; the later measurement is at row 90,000. They do not describe other orders.

After the cursor-seek fixes, the following measurements use **100,000 rows**, **100-row
pages**, **31 warm-up calls** and the median of **101 measured calls** per case, on in-memory
SQLite **3.53.4**, Node **26.13.0**, arm64. They time `pageList.run` (query building, cursor
handling, SQLite execution and row mapping) inside one existing transaction, without the frame
or process hop. Rows have ten repeated `created_at` values per group and distinct titles and
ids within each group. Each order has its own matching partial live-row index beginning with
`space_id`. The later page starts after the row at offset 79,999 (page at row 80,000).

| Fixed order                          | First page | Page at row 80,000 |
| ------------------------------------ | ---------- | ------------------ |
| `created_at ASC, title ASC, id ASC`  | 0.0549 ms  | 0.0812 ms          |
| `created_at ASC, title DESC, id ASC` | 0.0583 ms  | 0.0957 ms          |

`EXPLAIN QUERY PLAN` shows `(created_at,title,id)>(?,?,?)` for the same-direction cursor
and `created_at>?` for the mixed-direction cursor, both in addition to `space_id=?`.
A mixed order can still scan rows sharing its first sort value; the bound avoids scanning
all earlier first-column values. The diagnostic script stays in `.temp/`, outside version control.

The read-piece join comparison uses 10,000 notes and 10,000 links, one link per note,
and the median of 61 warm samples. The query plan uses the primary key; adding a covering
index changed nothing. The difference is 10,000 primary-key lookups. A page list sorted by a
joined column sorts the full set on every page: no index can serve a sort on the far side
of a left join.

The built desktop smoke stage’s **Data Process first answer** was re-measured with 10
alternating runs each on `main` and the branch. The median was **145.5 ms on main**
(range 135–185 ms) and **146.5 ms on the branch** (range 140–150 ms): no measurable change.
Unlike the in-memory microbenchmarks, this includes the process hop. The data-process bundle
grew from **703,842 to 726,220 bytes**.
