---
status: accepted
date: 2026-11-21
decisions: D310, D349, D371
---

# An Operation over two tables shares one id, and its undo is its own Operation

## Context

Stopping a Timer is the first Operation that changes two tables. It writes a Time Entry and
soft-deletes the Timer. A double click, or two devices that stop the same Timer offline, must
not create two entries. Undoing the stop also changes both tables. If the page built the undo
from two calls and the second call failed, the entry would be gone and no Timer would run.

## Decision

- **The row the Operation creates takes the id of the row it consumes.** The Time Entry that a
  stop writes has its Timer's id. The two id types stay branded apart (`TimerId`,
  `TimeEntryId`), and `timeEntryIdOfTimer` in `time-tracking/src/contracts/ids.ts` is the only
  function that turns one into the other. No column records where the entry came from.
- **Stopping twice writes once.** `stopTimer` on a Timer that is already stopped finds the Live
  entry with the Timer's id, answers with it and writes nothing. When a stop finds a deleted
  entry with that id, left by an earlier "undo stop", it restores that row with the Timer's
  note and the new end, Booked Duration and Time Zone in one write (D371), and writes the
  Timer's project as the entry's one Project Share
  ([ADR 0044](0044-a-time-entry-keeps-its-measured-time-rounded-time-booked-duration-and-rounding-rule.md)),
  so the reference check judges the project the Timer has now. Every stop of a Timer therefore leaves
  at most one Live entry with the Timer's id.
- **The Operation and its undo are each one Operation in one transaction, with one Table
  Change.** `stopTimer` writes the entry and soft-deletes the Timer. `undoStopTimer`
  removes the entry's Project Shares, then soft-deletes the entry as it currently is, including
  any edits, and restores the Timer with its own start, project and note (the one exception of
  [ADR 0042](0042-a-part-row-is-a-live-row-only-while-its-owner-is-one.md)). `undoDiscardTimer` restores the Timer. The page never builds
  an undo from two calls.
- **A refused undo writes nothing.** The frame's reference check guards the restore. When it
  refuses, for example because the Timer's project was deleted after the entry moved to
  another project, the Refusal rolls back the whole transaction. The entry stays live, the Timer
  stays stopped, and no other Timer is stopped.
- **An undo does not write twice.** An undo of a Timer that already runs answers
  `alreadyRunning` and writes nothing. An undo with nothing to undo answers "not found":
  "undo stop" without a Live entry with the Timer's id, and "undo discard" of a Timer whose
  entry is live. The answer of an undo is a union discriminated by `kind`, so a caller handles
  each case.
- **Every Operation that makes a Timer run first stops every other running Timer** by the rules
  of stop, in the same transaction: start, "undo stop" and "undo discard". Each answer lists what
  those stops did in `others`, so a Notice can name the saved entries.
- **This is the pattern for every later Operation over two tables**, such as a transfer between
  accounts: the created row shares the consumed row's id through a single conversion function,
  repeating the Operation writes once, and the undo is its own Operation in one transaction.

## Consequences

- The origin of an entry shows only in the shared id. When the trash later removes the
  soft-deleted Timer rows, the origin is lost.
- A click on "Undo" can end a Timer that was just started. That Timer becomes an entry, or is
  discarded if it ran for less than a second.
- A Timer whose start lies after the Data Process's "now", after the computer's clock was set
  back, is not stopped by another Timer's start: its stop writes nothing. Two Timers then run.
  The Module Indicator and its panel show the one with the later start, which is the older
  Timer, beside the count, and the Notice of that stop leads to this Timer's form, where its
  start can be corrected or the Timer discarded (D372).
- Every stop costs one more lookup by primary key, which also finds deleted rows. Measured
  through the Port of the test Data Process, the median stop rose from 0.139 ms to 0.152 ms. One
  "undo stop" takes 0.18 ms, and a stop after an undo 0.20 ms; since the restore writes the
  values itself (D371), 0.17 ms.

## Considered Options

- Give the entry a new id and record its origin in a column. A second stop, or a stop on a
  second device, would need its own lookup to avoid a duplicate, and two devices offline would
  still create two rows.
- Let the page undo a stop with "restore Timer" followed by "delete entry". A failure between
  the two calls would leave a half-undone state.
- Refuse an undo while another Timer runs. The button would be visible and would do nothing.
