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
   the list through the module's Port, then renames one entry the same way. The rename's Table
   Change reloads the list, and the count covers everything that redraws for that one changed
   row.

The page reaches a real Data Process without Electron. A stand-in for the desktop bridge hands it
a port, as the preload does, and the script relays that port to a test Data Process in Node
(`scripts/render-data-process.ts`) with `placeholder-alpha` mounted. The Data Process starts empty;
the script creates Studio work and Garden work before the page loads. With a bridge, the app keeps
its address in the hash, as in Electron.

Each scenario reports root commits, committed function-component renders and counts by
component name. The JSON records the commit and complete working-tree hash, including
uncommitted changes. A comparison shows absolute counts and changes per scenario/component.
Keep the reports in `.temp/`; commit neither reports nor generated screenshots.

This is a diagnostic comparison, **not a gate**; the gate for one changed row is the story
described under "The render-count gate" below. Use the same Node/Chromium versions,
viewport and scenarios for both states. Repeat measurements before drawing conclusions:
async loading, React development mode, Strict Mode and Mantine effects influence the counts.
These are not production timings, DOM mutation counts, abandoned render attempts, or counts
of Strict Mode's extra function invocations. Components sharing a name are aggregated.

Instrumentation is installed through the React DevTools hook in the measurement browser
only. It counts `PerformedWork` for function/forward-ref/simple-memo Fibers and tracks the
last committed Fiber to exclude reused subtrees with stale flags. This private React
interface needs checking on React upgrades; a scenario recording no work fails explicitly.
The count itself (`@self-engine/ui/story-render-counts`) is shared with the render-count gate.
Production code does not include the hook.

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
and nothing that is new on every render of the list. An unchanged row only stays undrawn while its
object stays the same across a reload (D250). The rule as built after #224, with Operations in the
list, is in the [renderer guide](port-hooks.md#4-draw-a-list-so-that-one-changed-row-redraws-one-row).

After the move onto the Port (#224), renaming one of 1,000 entries through the Port draws **23
components in 4 commits**. The Table Change marks the list, and it redraws twice: once while it
reloads and once with the new answer, each time `Entries` and its `QueryStateBlock`. `EntryList`
draws once, then the renamed `EntryRow` and its Mantine components, plus the page's scroll bar.
No other row draws, because unchanged rows keep their objects across the reload. Delete with undo
reaches the rows as one `onDelete` from the list, and that is the same function on every render.
It comes from one pair of Operation hooks in the list rather than a pair in every row: per-row
hooks would mean 2,000 mutation observers for 1,000 rows.

### The Query hook keeps unchanged rows

Measured during #219 on Node 26, Apple M3 Pro, median of 50 runs after 10 warm-up runs. After a
reload the Query hook compares the new answer with the old one and keeps every unchanged row as
the same object (structural sharing of the query library), which the rule above relies on. For
note rows of five fields, one of them renamed, the comparison takes **0.03 ms at 100 rows,
0.25 ms at 1,000 and 2.5 ms at 10,000**: linear, a tenth of the spike's 2 ms fetch at 1,000 rows.
A hook test fails if a reload replaces an unchanged row.

Measured again during #225 for the rows the gate draws: `placeholder-alpha` entries (an id and a
name), one renamed, every row a new object as it arrives from the Data Process. Apple M3 Pro, the
query library's `replaceEqualDeep` (5.107.1), each sample a batch of comparisons divided by its
size (Chromium coarsens its clock to 0.1 ms), median of 30 samples after 5 warm-up samples:

| Rows   | Chromium 158 (renderer) | Node 26.13 |
| ------ | ----------------------- | ---------- |
| 100    | 0.016 ms                | 0.02 ms    |
| 1,000  | **0.15 ms**             | 0.20 ms    |
| 10,000 | 1.6 ms                  | 2.0–2.3 ms |

A reload of 1,000 rows therefore spends about 0.15 ms keeping the 999 unchanged rows, and in
return draws one row instead of 1,000.

An answer that no View shows stays in memory for 5 minutes (D250). Held as parsed JSON, 1,000
such rows take about **226 KiB** of heap, and 10,000 about **2.1 MiB**.

The building block (`@self-engine/data-client/react`) bundles to **35,422 bytes** minified
(10,855 gzipped), of which the query library is 33,315. Since #224 the app mounts it at startup;
the startup budget below holds it.

### The render-count gate

The rule is held by a number in `pnpm verify` (D256). The story
`apps/web/src/placeholder-alpha-render-count.stories.tsx` (stage `stories`) draws the whole app with
1,000 `placeholder-alpha` entries through the real `Entries`, `EntryList` and `EntryRow`. Its Port
answers with Fixed Answers; the story then switches the list's answer to the same entries with one
renamed, delivers the Table Change by hand and lets the list reload. It asserts that exactly
**one `EntryRow` and one `EntryList`** drew. The number is fixed, not a share of the rows.

- **How it counts.** The Component Catalog installs the counter as React's DevTools hook before
  React loads: as the first setup file of the story tests and as the first import of the preview.
  If React connected without it, the story fails with that message rather than counting nothing.
- **When it stops counting.** The story waits for the commit that shows the renamed row
  (`commitWhere`, called by React's commit, not asked again and again), then for the work React has
  scheduled by then (`afterTheCommitsNowDue`, a message task behind React's own). No real clock,
  no polling.
- **That it bites.** With `memo` taken off `EntryRow` the story fails with
  `expected { EntryList: 1, EntryRow: 1000 } to deeply equal { EntryList: 1, EntryRow: 1 }`.
- **Cost.** The story takes about 0.45 s (ten runs, 440–495 ms, all passing). The whole `stories`
  stage took a median 14.45 s with it and 14.20 s without it (three runs each, alternating).

## Startup JavaScript budget

Every production web build, including `pnpm verify` and Electron packaging, audits the
emitted chunk graph. Starting at every entry, it follows **static** imports and counts each
shared JavaScript chunk once. Dynamic imports, CSS, fonts and other assets are outside this
JavaScript budget. The report is `apps/web/dist/startup-bundle.json`.

The current baseline is **839,270 raw bytes** across 16 static chunks. The limit is **869 KiB
(889,856 bytes)**: the measured size plus 6 %, rounded up to whole KiB (D258). Raw emitted bytes
avoid a compression-version dependency. A deliberate budget increase must explain the measured
cost in its PR; splitting filenames or moving code to a shared chunk does not evade it.

The last decrease came with #136, which took Zod's full build out of the startup: from
**874,050 bytes** (15 chunks, `main` at `ee7a1d1`) to **839,270 bytes** (16 chunks),
**−34,780 bytes**; the limit went from 905 to 869 KiB. See "Zod at startup" below.

The last increase came with #224, when the app mounted the data building block and with it the
query library. Startup JavaScript went from **832,739 bytes** (14 chunks, at the tip of the
integration branch before the slice) to **872,853 bytes** (15 chunks), **+40,114 bytes**. The old
limit of 851,968 bytes would have failed the build. In the built desktop smoke stage, the first
answer did not take measurably longer (see "Views on the Port" below). The review fixes of #33,
with `main` merged in (#182, #183), measured **873,305 bytes** (+452); by the same rule the limit
went from 904 to 905 KiB.

Independently of size, a workspace module declared as a dynamic-import target must stay
out of static startup chunks. This catches eager imports of contribution Views, Groups,
drawers and commands, as well as other deferred workspace modules. The audit derives the
set from the bundler's module graph, rather than a list of today's module/View filenames.
Shared dependencies of lazy modules can still be eager; the lazy entry itself cannot.
A fixture test builds both lazy and accidentally eager versions and checks the actual
build fails, including when it is below the byte limit.

### The directory of entry pictures

The mark of an entry (`@self-engine/ui/entry-mark`, #260) draws any of the 107 icon names through
the directory of pictures (`@self-engine/icons/directory`). Each Phosphor icon carries all six
weights, so the chunk that holds the directory and the mark measured **343,907 bytes** (88,198
gzipped) in a trial build that loaded the mark on demand, against **46,650 bytes** left below the
limit. The directory therefore never loads at startup (D293): only a View that loads on demand
imports the mark, and the startup check names the directory in `lazyOnly`, so a build fails when
startup code reaches it. Startup JavaScript went from **843,143** to **843,206 bytes** (+63) with
the slice, from the shared name of the Color Set scope. Drawing a mark costs one icon render; the
first View that draws one pays the chunk's load once.

The pickers of an entry's icon and color (`@self-engine/ui/entry-pickers`, #261) load the same
way: an edit drawer, which loads on demand, imports them. Startup JavaScript stayed at **843,206
bytes** (16 chunks) before and after the slice. The 214 icon labels sit in the language catalogs,
which load before the first render outside this budget: the German catalog chunk went from
**7,144 to 10,053 bytes**, the English one from **6,313 to 9,124**.

### The icon field

The icon field (`EntryIconPicker`, #264) holds the icon grid and the Emoji tab, Mantine's
`EmojiPicker` with the emoji list of `emojibase-data`. The tab's code and the list load with a
dynamic import when the Emoji tab first opens, the list as one chunk per language, and the startup
check names `@mantine/emoji` and `emojibase-data` in `lazyOnly`.

**Sizes**, from `pnpm --filter @self-engine/web build` (gzipped as Vite reports it). No app code
imports the field yet, so the sizes of its chunks come from a trial build in which the edit drawer
of `placeholder-alpha`, which loads on demand, imported `@self-engine/ui/entry-pickers` with a
dynamic import; the trial was not committed.

| What                                                          |   Bytes |   Gzipped |
| ------------------------------------------------------------- | ------: | --------: |
| The field's chunk: both pickers and the directory of pictures | 360,350 |  96.95 kB |
| The Emoji tab's code: Mantine's picker and its virtual list   |  52,114 |  17.70 kB |
| The Emoji tab's stylesheet                                    |   4,003 |   0.97 kB |
| The emoji list in English                                     | 785,619 |  97.53 kB |
| The emoji list in German                                      | 800,550 | 103.06 kB |

Startup JavaScript is **843,398 bytes** (16 chunks) both on the commit before the field and with
it, since nothing at startup imports it. In the trial build it is **846,390 bytes** (20 chunks)
before the field and **847,132 bytes** (23 chunks) with it, +742 in three more chunks: the
bundler splits modules that startup code shares with the field's chunks into chunks of their own.
The startup check passes in both, so the directory, the emoji picker and its data stay out. The
catalogs, which load before the first render, are now 10,530 bytes (German) and 9,595 (English).

**Times**, measured with a story written for the measurement and not kept: the stories' runner
(`vp test run --root apps/component-catalog`), Chromium headless shell 158 through Playwright
1.65, React in development mode, on an Apple M3 Pro. The story clicks and types through the DOM,
and each figure runs from the event to the moment the page holds the result (seen by a
`MutationObserver`) and to the next frame drawn after it (`requestAnimationFrame`, then a
timeout). Each figure is the median of 25 runs after 3 warm-up runs, in each of 7 page loads; the
table gives the median of the seven medians, with their range. The first opening of the Emoji tab
happens once per page load, so its figure is the median of the 7 page loads. A production build
is faster.

| What                                                                 |             Page holds it | Next frame |
| -------------------------------------------------------------------- | ------------------------: | ---------: |
| Opening the icon grid with all 107 pictures                          |    33.6 ms (21.8 to 37.5) |    37.6 ms |
| Narrowing it to the 5 pictures matching "ba"                         |                    3.6 ms |     8.9 ms |
| Showing all 107 again                                                |                   16.5 ms |    18.3 ms |
| The first opening of the Emoji tab, until the first emojis are drawn | 310.9 ms (294.6 to 419.3) |   313.9 ms |
| A later opening of the Emoji tab, the list already loaded            |                   20.0 ms |    21.8 ms |
| Filtering the emoji grid by "ba"                                     |                   15.4 ms |    17.3 ms |
| Emptying the search of the emoji grid                                |                   14.5 ms |    16.3 ms |

The parts of the first opening, measured apart in the same browser (median of 25 runs, the
detection of 10): parsing the English or German list (`JSON.parse`, which is how the built chunk
holds it) **1.0 ms**, Mantine's `emojibaseAdapter` **0.3 ms**, cutting the list to what the emoji
rule accepts (`onlyAccepted`) **0.4 ms**, and Mantine's detection of the emojis the device cannot
draw, two drawings on a canvas per emoji for 1,914 emojis, **54 ms**; Mantine keeps that answer
per emoji for the rest of the session, so a later opening does not pay it. The rest of the first
opening, about 250 ms, is loading the tab's code and the list from the development server and the
first render; the built app reads the chunks from local files. In this Chromium (Unicode 17) the
list offers 1,914 emojis in 3,564 characters, of which the detection hid 3. The emoji grid is a
virtual list: it draws the rows in view, not all 1,914 emojis.

Each keystroke in either search also checks whether the term is exactly one emoji (D302), without
the emoji list. That check measured, in Node 26.13 (median of 9 runs of a million calls),
**11 ns** for a word such as "house" or "Glühbirne", **21 ns** for 😀 and **43 ns** for the joined
family emoji 👨‍👩‍👧‍👦.

The color picker and the Accent row of the Settings share one building block, the swatch radio
group (`@self-engine/ui/swatch-radio-group`). It is an entry of its own and not part of `ui`'s main
entry: exported from there, it took Mantine's `Radio.Card`, `Tooltip` and `ColorSwatch` into the
startup bundle (**+19,995 bytes**), although both users load on demand. As its own entry, startup
JavaScript stayed at **843,206 bytes** (16 chunks) before and after the review fixes of #106.

### Zod at startup

The app reads its Settings before the first render, and each Setting checks its stored value
against a Zod schema (D118). Until #136 the declarations imported `zod`, Zod's full build: one
static chunk of **85,453 bytes**, pulled in by `@self-engine/settings-area/settings` (appearance
and App Language) and `apps/web/src/shell-settings.ts` (the Shell's layout). It held every schema
type with its methods, the JSON Schema export and the English error texts, for eleven Settings
that are a text, a number, a yes or no, one of a list, or one small object.

Since #136 a Setting declares its schema with `zod/mini`, and the settings store checks through
Zod's core (`zod/v4/core`), which both builds share (D268, D269). So a schema of the full build
still works for a Setting that only code loaded on demand declares. Startup now holds **about
50 KB of Zod**:
its core in two chunks (33,796 and 15,282 bytes) and about 1.5 KB of `zod/mini`. The full build's
own **33,469 bytes** load with the first Command.

Zod's core is still at startup, for two reasons:

- **Settings are checked before the first render.** A stored value the schema rejects shows its
  default (D118), from the first frame on: the engine throws on an unknown Color Mode. Checking
  after the first paint would draw an unchecked value first, and a check written by hand beside
  Zod is what D118 rejected.
- **A module lands in one chunk, whole.** Commands declare their input with the full build and
  load on demand, and the full build uses nearly all of the core. The core modules that `zod/mini`
  needs at startup therefore arrive complete. With no full build anywhere in the page, the same
  startup measured **802,759 bytes**: 36,511 of the remaining bytes are the price of sharing.

The startup check holds this (`lazyOnly` in `apps/web/startup-rules.ts`): a build fails if a module
of Zod's full build (`zod/v4/classic/`) is in a static startup chunk, and names the startup code
that imports it. The byte limit alone would not catch it: the full build fits under the 6 %.

**First render:** with 60 alternating starts each of the built desktop app (hidden window, fresh
data folder, the smoke stage's launch) against the renderer of `main` (`ee7a1d1`) and of the
branch, the Shell appeared after a median **164.7 ms on main** (range 156–235 ms) and
**164.4 ms on the branch** (range 154–266 ms), and the first answer came after **141.7 ms**
(134–211 ms) and **141.4 ms** (132–236 ms): no measurable change. Times count from the start of
the page load; the Shell's time is read once per frame. A hidden window records no paint entries,
and the first paint itself is the Start Cache's, which an inline script draws before any module
loads.

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

### Views on the Port

Measured during #224, when the Views of `placeholder-alpha` began to read and write through the
building block and the app began to mount it. With 10 alternating runs each of the smoke stage's
command (`node scripts/desktop-smoke.ts`, fresh data folder) on a built `main` (`b34c562`) and the
branch, the **Data Process first answer** had a median of **205 ms on main** (range 161–379 ms) and
**179.5 ms on the branch** (range 149–484 ms): no measurable change. The first answer is the
connection's first `ready`, so it includes loading the larger startup bundle.

## Backups

Measured during #35 on an Apple M3 Pro with Node 26.13.0, on real files in a temporary folder
(SQLite in write-ahead mode, rows of 1,000 bytes; median of 7 runs, of 5 for a restore).
[ADR 0024](../adr/0024-a-backup-is-a-whole-copy-beside-the-database-and-the-next-start-puts-a-restore-in-place.md)
records what a Backup is.

| Database | Take a Backup | Longest pause of the event loop | Restore until its answer | Put in place at the next start |
| -------- | ------------- | ------------------------------- | ------------------------ | ------------------------------ |
| 1 MB     | 8 ms          | 7 ms                            | 15 ms                    | 0.8 ms                         |
| 10 MB    | 18 ms         | 18 ms                           | 44 ms                    | 0.6 ms                         |
| 100 MB   | 165 ms        | 32 ms                           | 295 ms                   | 1.4 ms                         |

- **Taking a Backup** goes through SQLite's backup in steps, so the Data Process keeps answering:
  the event loop never paused longer than 32 ms. The time includes pruning the folder.
- **A restore until its answer** is the check of the Backup's file, its copy beside the database
  and the Backup of the data it replaces. The restart that follows took about 110 ms in the built
  desktop app, from the page losing the connection to being ready again. For that whole span,
  0.13 s at 1 MB to 0.4 s at 100 MB, the database refuses writes: an Operation in it fails and
  says so, and none is lost.
- **The hourly check** of a running Data Process, when no Backup is due, reads the folder's names:
  **0.2 ms**.
- **At start** the daily Backup is taken after the Data Process serves, so it delays no answer.
  With 10 alternating runs each of `node scripts/desktop-smoke.ts` (fresh data folder) on a built
  `main` (`ae1cca2`) and the branch, the **Data Process first answer** had a median of **146 ms on
  main** (range 136–150 ms) and **143.5 ms on the branch** (range 139–162 ms): no measurable
  change. A start with pending
  migrations on a database that has tables waits for one Backup first, the "take" column above; a
  first start has no tables and takes none.
- **Bytes.** Measured on a build of `main` at `ae1cca2` and of the branch with it merged. Startup
  JavaScript went from **839,339 to 839,665 bytes** (+326: the title of the View "Data" and the
  reload hook), far below the limit, which stays; no schema loads at startup. The hint for a
  failed automatic Backup uses the error icon the startup already holds: an icon of its own
  measured +3,266 bytes there. The chunk of the settings area, loaded when the settings are
  first opened, grew from 48,321 to 54,681 bytes. The data-process bundle grew from **746,275 to
  763,456 bytes**, the main-process bundle from 216,394 to 229,969 bytes: it reads the
  protocol's messages, whose package now holds the schemas of `backups`.
- **Disk.** Each Backup has the size of the database. With one Backup a day the folder holds
  eleven; it never holds more than 32, four a day for seven days and four weekly.

## Forms: first opening (#290)

Measured in the built Electron app with Node 26.13.0, five fresh app sessions, each with a new
throwaway data folder. The normal Color Mode and drawer transitions were kept. Each session
navigated to placeholder-alpha’s Overview, then clicked New entry once; no form or Contract
was preloaded by the measurement. All apps were stopped and their data folders removed.

The portable method uses the renderer’s `performance.now()`: a capturing click listener starts
the timer. Each animation frame checks for an input in the dialog with a nonzero rectangle and
`checkVisibility({ opacityProperty: true, visibilityProperty: true })`. The next animation frame
ends the timer, bounding the first paint with that visible input; Node/automation round trips
are outside the timed interval. It measures the visible form, including lazy loads and normal
Shell opening behavior, rather than just importing the helper. It does not wait for the slide
to finish, and is not a check by eye.

Results: **331.0, 328.2, 328.1, 334.5, 331.5 ms**; median **331.0 ms**, range **328.1–334.5 ms**.
This is above D326’s 100 ms threshold: the owner must decide before merging the package.
No threshold or transition was changed to accept it.

Startup JavaScript: **843,398 bytes before** (`4f28e33`) and **843,341 bytes after** (−57).
The before value was reproduced with the integration branch’s drawer. The forms package marks
its modules side-effect-free, letting the build discard unused picker exports; the module
also shares the identical Overview/Archive lazy list loader instead of declaring it twice.
The startup gate still forbids Contracts, full Zod and the form libraries there.
