---
status: accepted
date: 2026-11-13
decisions: D94, D79, D249, D250, D251, D270–D277
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
3. **After every new Backup the folder is pruned to seven daily and four weekly Backups.** Of
   each of the newest seven days that have a Backup, the newest Backup of each of the four
   reasons is kept, so a day holds at most four. Before those days the newest Backup of each of
   the newest four weeks that have one is kept. Days and weeks are UTC, weeks begin on Monday.
   The rule counts Backups, not the calendar, so a device that was off for months loses none.
4. **A restore is staged by the running Data Process and put in place by the next one.** The
   running process checks that the Backup is a sound database, copies it beside the database,
   backs up the current data, and only then gives the copy the name the next start looks for.
   After its answer is on the way to the page it asks the main process to start it anew. The
   main process tells the pages that the Data Process is gone, ends it, and starts the next one
   only after the exit, without counting a crash. Before the next process opens the database, it
   removes the old write-ahead log and moves the staged file into the database's place. A crash
   at any point leaves either the old database or a staged file that the next start applies.
5. **From the moment a restore begins, the database refuses every write**, and after a restore
   that was staged it does so until the process ends. A write that came after the Backup of the
   replaced data would vanish with the database it went to; refused, its Operation fails and
   says so. A restore that fails lets writes through again. Reads and Backups go on.
6. **A failed automatic Backup is shown, not only logged.** The Data Process remembers in memory
   that the last attempt at a daily Backup or one before migrations failed, until any Backup
   succeeds. The list of Backups carries that, and the View "Data" shows a hint while it holds.
   The next Data Process starts without the memory and tries again.
7. **The core gets the Backups and the restart together or not at all.** A restore that is staged
   without a restart would leave the replaced database answering.
8. **The Backups belong to no module.** The Data Process answers them as `backups` beside
   `health`, in the protocol of `@self-engine/data-protocol`
   ([ADR 0022](0022-the-desktop-app-owns-the-module-list-and-the-data-protocol-what-crosses-modules.md)).
   Its core takes the Backups from its platform and stays free of files and of the SQLite driver;
   `@self-engine/backup` is the desktop's side.
9. **The page uses the same building block as for a module's Port**
   ([ADR 0021](0021-the-page-reloads-a-query-after-a-table-change-through-one-building-block.md)):
   an _Operation_ hook to take and to restore a Backup, a _Query_ hook for the list. The list
   reads no table, so no _Table Change_ answers it again. The _Settings Row_ that takes a Backup
   reloads it through the building block's reload hook, which exists for a Query that no table
   backs. After a restore the reconnect reloads it with every other answer. A row that shows an
   answer kept from an earlier visit reads it again, because the Data Process takes Backups
   while nobody looks.
10. **A restore is not confirmed first.** What it replaces is a Backup, so the _Notice_ offers to
    undo it, which restores that Backup (D79). A later restore withdraws that offer: its own
    Backup of the replaced data took the earlier one's place.

## Consequences

- The _Settings Rows_ for the Backups are the first rows of the View "Data" of the settings area
  ([ADR 0016](0016-settings-rows-are-data-and-pages-and-search-are-drawn-from-one-list.md)).
- A Backup costs the size of the database on disk: eleven times with one Backup a day, and never
  more than 32 times, four a day for seven days and four weekly. Taking one of a 100 MB database
  took 165 ms; the numbers are in [performance](../development/performance.md#backups).
- With the app used daily, the oldest Backup is 22 to 28 days old, depending on the weekday: the
  first of the four weeks is the one the seven days already reach into.
- A second Backup of one reason on one day replaces the first. Two restores in a row on one day
  therefore keep only the Backup of what the second one replaced; the data from before the first
  restore is then only in older Backups, unless the first restore was undone in between. A
  second migration on one day likewise replaces the Backup from before the first.
- The day is the UTC day. In UTC+7 it turns at 07:00 local time: the daily Backup is taken at
  the first start or hourly check after that, and two Backups of one reason at 06:30 and 07:30
  are both kept.
- A new Backup is not checked for soundness when it is taken, only opened once. A Backup is
  checked when it is restored, and one that fails the check is refused.
- The daily Backup is taken after the Data Process serves and delays no answer. The Backup
  before a migration delays that one start by the time it takes.
- A Backup lies on the same disk as the database, unencrypted like it (D96). It protects against
  a bad migration, a bug or a mistake, not against a lost device.
- When a migration failed or the database comes from a newer version, the Data Process answers
  only `health`, so the settings cannot offer a restore there. The Backup from before the
  migration is in the folder; offering it on that page is not built.
- When the Backup before a migration fails, the Data Process exits before it serves. The main
  process starts it three times and then stops it, and the page says that the data cannot be
  reached, without the reason; the database is untouched. Saying why belongs to the error log.
- No write is lost around a restore, at the price that the app cannot write between the start of
  a restore and the restart: the Backup's check and copy, the Backup of the replaced data, the
  pruning, the answer and the restart, about 0.1 to 0.4 s for databases of 1 to 100 MB.
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
- **Keeping every Backup of the newest seven days:** rejected. Every restore, undo and press of
  the button would add a full copy of the database without a limit.
- **Leaving writes open during a restore:** rejected. A write between the Backup of the replaced
  data and the restart would be gone without anyone being told.
- **Counting the last seven calendar days:** rejected. After a long pause the first start would
  delete every Backup but its own.
- **Asking before a restore:** rejected. D79 keeps questions for what cannot be taken back.
