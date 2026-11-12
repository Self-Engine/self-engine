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
3. Renaming one of 1,000 `placeholder-alpha` entries (`rename-one-of-1000`). The scenario fills
   the list through the module's store in the page, then renames one entry the same way, so it
   counts only what the list draws for one changed row.

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

## One changed row redraws one row

The data layer spike (D194) counted about 4,150 component renders when one of 1,000 rows was
renamed. Reproduced on `main` with `rename-one-of-1000`, before any query hook existed: renaming
one entry drew **10,003 components in 1 commit**: `Entries` once, and for each of the 1,000 rows
its `Group`, two `Button`s, two `UnstyledButton`s and five `Box`es. Nothing outside the list drew:
no Shell component, provider or route. The spike's rows are not on `main`; it had fewer
components per row, the same cause.

**Cause:** the list wrote its rows inline in its `map`. Every render of the list renders every
row's subtree, and the React Compiler does not memoize JSX built per item inside a loop. A row
component alone is not enough: with `EntryRow` as a plain component the count fell to **1,013**,
because the compiler skipped each row's Mantine subtree but every `EntryRow` function still ran.
With `EntryRow` wrapped in `memo` and receiving its entry whole, the count is **14 in 1 commit**:
the list once, the renamed row once, and that row's Mantine components.

The same rename through the edit drawer, as a user does it, drew 10,144 components in 7 commits
before and 155 in 7 commits after; the Shell's share (routes, drawer) does not grow with the list.
Measured with `pnpm renders` in the web dev server, headless Chromium, React development mode.

The rule that follows: a row is its own component wrapped in `memo`, receives its row object whole
and nothing that is new on every render of the list, and gets callbacks from its own hooks. An
unchanged row only stays undrawn while its object stays the same across a reload (D250).

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
or process hop. Each group has ten rows sharing one `created_at` value and distinct titles and
ids. Each order has its own matching partial live-row index beginning with
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

### Declared reads

Measured during #216 on the same setup (in-memory SQLite, Node 26.13.0, Apple M3 Pro, no
process hop). The contract kit records a Query's tables with a plugin that walks each
statement's tree. The walk over the joined `note-links` list query takes **about 1.3 µs per
statement**. A whole call through the frame with and without the plugin (`notes.list`,
`notes.get`, `note-links.list` over 100 rows, 10,000 calls each) differed by less than the
spread between two runs without it (±15 µs on 30–500 µs calls). Only the kit installs the
plugin; the frame never does, so the packaged app pays nothing. The declaration itself is one
array per Query entry.

### Query-to-tables list

Measured during #218 on the same setup. The Data Process builds the list once at start and
sends it with the opening event of every Table Change stream, so it costs once per connection.
For the test modules `notes` and `note-links` (5 Queries in 2 modules) the list is **121 bytes**
as JSON, about 24 bytes per Query, and the opening event **149 bytes**, up from 2. A hundred
Queries would send about 3 KB once per port. Building it takes **about 1.2 µs** at start. Each
later Table Change carries a `{ kind: "changed", tables }` envelope, **28 bytes** more per
commit than the bare table array before.

### First module on a real Port

Measured during #223 (`placeholder-alpha` mounted with one table and its migration, D252). The
built desktop smoke stage starts with a fresh data folder, so its **Data Process first answer**
includes creating the table. With 10 alternating runs each on `main` and the branch, the median
was **185 ms on main** (range 167–223 ms) and **181.5 ms on the branch** (range 164–208 ms): no
measurable change. The data-process bundle is **745,996 bytes**, up from **727,817** on `main`;
that difference also holds the earlier slices of #33.
