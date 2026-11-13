---
status: accepted
date: 2026-11-13
decisions: D94, D79, D249, D250, D251
---

# A Backup is a whole copy beside the database, and the next start puts a restore in place

## Context

All of a user's data is one SQLite file that the _Data Process_ holds open in write-ahead mode
([ADR 0018](0018-the-database-runs-in-a-data-process-the-page-reaches-directly.md)). A migration
that goes wrong, a bug or a mistake of the user can damage it, and until sync exists there is no
second copy anywhere. Copying the file of an open database can catch it between two writes. A
database also cannot be replaced while a process has it open: Windows refuses, and elsewhere the
process would go on writing the file that was replaced.

## Decision

1. **A _Backup_ is a whole copy of the database, taken through SQLite's backup, not by copying the
   file.** Calls and writes go on while it is taken. The copy is one file without side files, in
   `backups/` beside the database, in the data folder of the channel. Its name states the instant
   and the reason it was taken, and the folder is the only record: there is no table of Backups.
2. **A Backup is taken for one of four reasons.** Daily: once the Data Process serves, unless a
   Backup of any kind was taken that UTC day, and it asks again every hour, so an app that stays
   open is still backed up every day. Before a migration: before pending migrations run on a
   database that has tables; when this Backup fails, the start fails and no migration runs. By
   hand, from the settings. Before a restore, of the data the restore replaces.
3. **After every new Backup the folder is pruned to seven daily and four weekly Backups.** Kept
   are every Backup of the newest seven days that have one, and before those the newest Backup
   of each of the newest four weeks that have one. Days and weeks are UTC, weeks begin on Monday.
   The rule counts Backups, not the calendar, so a device that was off for months loses none.
4. **A restore is staged by the running Data Process and put in place by the next one.** The
   running process checks that the Backup is a sound database, copies it beside the database,
   backs up the current data, and only then gives the copy the name the next start looks for.
   After its answer is on the way to the page it asks the main process to start it anew. The
   main process tells the pages that the Data Process is gone, ends it, and starts the next one
   only after the exit, without counting a crash. Before the next process opens the database, it
   removes the old write-ahead log and moves the staged file into the database's place. A crash
   at any point leaves either the old database or a staged file that the next start applies.
5. **The Backups belong to no module.** The Data Process answers them as `backups` beside
   `health`, in the protocol of `@self-engine/data-protocol`
   ([ADR 0022](0022-the-desktop-app-owns-the-module-list-and-the-data-protocol-what-crosses-modules.md)).
   Its core takes the Backups from its platform and stays free of files and of the SQLite driver;
   `@self-engine/backup` is the desktop's side.
6. **The page uses the same building block as for a module's Port**
   ([ADR 0021](0021-the-page-reloads-a-query-after-a-table-change-through-one-building-block.md)):
   an _Operation_ hook to take and to restore a Backup, a _Query_ hook for the list. The list
   reads no table, so no _Table Change_ answers it again. The _Settings Row_ that takes a Backup
   reloads it through the building block's reload hook, which exists for a Query that no table
   backs. After a restore the reconnect reloads it with every other answer.
7. **A restore is not confirmed first.** What it replaces is a Backup, so the _Notice_ offers to
   undo it, which restores that Backup (D79).

## Consequences

- The _Settings Rows_ for the Backups are the first rows of the View "Data" of the settings area
  ([ADR 0016](0016-settings-rows-are-data-and-pages-and-search-are-drawn-from-one-list.md)).
- A Backup costs the size of the database on disk, up to eleven times with one Backup a day, and
  more while Backups taken by hand are younger than seven days. Taking one of a 100 MB database
  took 165 ms; the numbers are in [performance](../development/performance.md#backups).
- The daily Backup is taken after the Data Process serves and delays no answer. The Backup
  before a migration delays that one start by the time it takes.
- A Backup lies on the same disk as the database, unencrypted like it (D96). It protects against
  a bad migration, a bug or a mistake, not against a lost device.
- When a migration failed or the database comes from a newer version, the Data Process answers
  only `health`, so the settings cannot offer a restore there. The Backup from before the
  migration is in the folder; offering it on that page is not built.
- A write that arrives between the Backup of the replaced data and the restart is lost with the
  database it went to. That window is the copy's rename and the answer, a few milliseconds.
- Another platform brings its own Backups behind the same `backups` entries, or none: then every
  call to them fails.

## Considered Options

- **Copying the database file:** rejected (D94). The copy can hold half a transaction, and it
  needs the write-ahead log beside it.
- **Replacing the database inside the running Data Process:** rejected. The file is open there,
  and every answer on the page would have to be marked by hand; a restart does both through the
  path a crash already takes.
- **The Data Process exits by itself after a restore:** rejected. The main process would count a
  crash, and three restores within a minute would stop the Data Process.
- **A table that lists the Backups:** rejected. The table would be part of every Backup and
  restored with it, and it would disagree with the folder after a file was removed by hand.
- **A Table Change with an invented table name for the list:** rejected with the grilling of #33.
  The list is no table; the row that changes it reloads it.
- **Keeping only the newest Backup of each day:** rejected. The Backup from before a migration
  would be deleted by the next Backup taken that day.
- **Counting the last seven calendar days:** rejected. After a long pause the first start would
  delete every Backup but its own.
- **Asking before a restore:** rejected. D79 keeps questions for what cannot be taken back.
