---
status: accepted
date: 2026-11-09
decisions: D62, D113, D114, D115, D116, D117, D118, D119, D351, D352
---

# Settings are single entries behind an asynchronous port

## Context

The first React render needs the stored appearance and App Language, even when the Data
Process is unreachable. Synced Settings also need to be part of the user's data so they
travel with a Backup. Older versions need to preserve entries they do not understand.

## Decision

[ADR 0036](0036-the-app-stores-its-time-zone-and-week-start-as-settings.md) specifies where
owners declare their Settings and how the Time Zone and Week Start use this port and store.

- **Each Setting has one permanent key prefixed by its owner.** On desktop, each Synced Setting
  lives in the Personal Space as a `settings` row with a JSON text value. The partial unique
  index `settings_live_key` covers live rows by `(space_id, key)`. A reset writes the default.
  The Settings Port has no delete entry. Device Settings live in `localStorage`, and the web
  app uses the local adapter for both scopes.
- **The first render can start from the local copy.** The asynchronous adapter contract is
  `load`, `save` and `subscribe`. On desktop the Synced Settings adapter answers `load` from
  the existing `localStorage` entries and asks the Data Process in the background. Before
  rendering, the page awaits the local load and activates the App Language catalog. The Start
  Cache supplies the colors while the page loads. A Data Process that never answers leaves
  the page on the stored copy. The store reads from its in-memory snapshot and applies writes
  there immediately, then saves them in order in the background.
- **The database wins.** The first successful database load reports its values and moves
  entries from the original local copy that the load lacks, one entry per save. This runs on
  the first load of each store instance, so later starts find the keys that already moved and
  leave them alone. If the first database load fails, the next report of the database repeats
  it, the move included: the Port adapter reads and reports the rows on the connection's first
  `ready` after a failed load, as after a refused call to a Data Process that later restarts
  ready. That report is sent even when nothing differs, so a database that holds no Setting
  gets its move too. A first database load that overlaps a save or a report of the database is
  repeated, so it never brings back an older value. The local copy takes the database's loaded
  and reported values and writes local changes to the copy after the database save succeeds.
  When the database reports a row as removed, the adapter forgets it in the copy, also when the
  copy cannot store the other entries of that report, and the store falls back to the default.
  An unreadable value reads as the declared default. A failed local load starts from defaults
  for that scope. A failed database save leaves the change in memory and keeps the stored value. The
  store or local copy reports those failures through `onError`; a failed background refresh
  in the Port adapter leaves the previous answer until another change or reconnect.
- **One Port serves the renderer.** The Data Process mounts `settings-data` as `settings`.
  Its Query loads the live entries of the Personal Space. Its save Operation checks the entry
  shape and writes the batch in one transaction. The renderer store checks values against
  their declarations. The Port accepts unknown keys and leaves unsent keys alone.
  The module maps `settings_live_key` to the Conflict reason `key_taken` for the contract
  kit. The save Operation declares no Conflict for that reason because it replaces the value
  of an existing key.
- **Every connected window follows the Table Change.** The Port adapter asks for current
  entries when a Table Change names a table its load Query reads, on reconnect, and on the
  first `ready` after its `load` failed. It
  reports differences from the entries it last knew. A refresh read that overlaps the
  adapter's own save is dropped and repeated after the save, so a late answer cannot undo
  a finished save. The local copy also repeats its initial read if one of its writes overlaps it.
- **Operations and Queries read through the call's transaction.** Pass the call's `tx` to
  `context.readSetting(tx, setting)`. It reads one indexed row of the Personal Space through
  that transaction, parses and validates the value with the same declaration the page uses,
  and returns its typed default for a missing or broken row without writing. Scope is a type
  parameter of `SettingDeclaration`, so a Device Setting cannot be passed to the read.
  A Query also names `SETTINGS_TABLE` in its declared reads. The contract kit catches a
  missing declaration, and the page reloads the Query through the Table Change (ADR 0021).
  The [Port guide](../development/port-pattern.md#read-a-setting) shows the pattern.
- **The Data Process can supply start values.** Its platform-neutral composition accepts
  a list built with `startSetting`, which pairs a Synced Setting with a value of its declared
  type. Startup runs the migrations, ensures the Personal Space, then inserts any missing
  keys in a transaction of their own before answering calls. Existing rows are left alone,
  including a row another Data Process inserts between the lookup and the insert.
  The migrations, read and start writes live in `settings-rows` below `storage`; the Port
  lives above it, keeping `settings` free of workspace dependencies.

## Consequences

A restore or another window can leave the local copy out of date. The app can briefly show
the old appearance or App Language until the database answers. The Table Change covers the
whole table, so a change to any Setting reloads every visible Query that declares it.
The [performance checks](../development/performance.md) record the cost of startup and of a
Setting read.

Renaming a Setting key requires a migration. Independent Settings can arrive in combinations
the user did not choose together, so each one has to stand on its own. Values that only make
sense together are one Setting with an object value. Window size and position are kept in
the main process's own file because it needs them before any renderer exists.

## Considered Options

- Waiting for the Data Process before first render would put the App Language catalog load
  after the database answer. If the wait timed out, the user would see the defaults.
- Storing one object per area would make writers carry unknown fields and let independent
  changes conflict when sync is added.
- Passing a Setting from the renderer would let a window with an old value write data based
  on it. An in-memory copy in the Data Process could drift from the caller's transaction.
