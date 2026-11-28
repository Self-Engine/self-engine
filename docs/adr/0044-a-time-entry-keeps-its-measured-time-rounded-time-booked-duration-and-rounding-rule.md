---
status: accepted
date: 2026-11-28
decisions: D308, D342, D343, D344, D345, D346, D353, D354
---

# A Time Entry keeps its Measured Time, Rounded Time, Booked Duration and Rounding Rule

## Context

A Time Entry records when work happened and how much of it counts. The owner decided that the
Rounded Time is the time that holds: lists, sums and later money read it. The Measured Time stays
beside it, so another Rounding Rule can be applied later without loss. The Rounded Time cannot be
derived on read: it will depend on what else was stored when the entry was saved (the overlap
rule), and two devices must not compute different numbers for one row.

It changes two recorded decisions: D308 had rejected rounded times because the measurement was
lost, and here the measurement is kept beside them; D345 rounded only the display, and here a rule
rounds the counted duration while the display no longer rounds (ADR 0043).

This replaces [ADR 0038](0038-a-time-entry-keeps-its-instants-booked-duration-and-creation-time-zone.md),
whose entry counted its end minus its start.

## Decision

### What a Time Entry keeps

- **The Measured Time**, `started_at` and `ended_at`: Instants on whole seconds, the end after the
  start, never rounded (D308, D344). The Operation discards the milliseconds; the Contract compares
  the truncated values and requires the end at least one second after the start.
- **The Rounded Time**, `rounded_started_at` and `rounded_ended_at`: both ends or neither. An entry
  that counts 0:00 has none and is stored all the same.
- **The Booked Duration**, `booked_duration`, in seconds; 0 without a Rounded Time.
- **The Rounding Rule** as JSON text, `rounding_rule`, such as
  `{"kind":"ordinary","direction":"up","minutes":1}`, in the form `roundingRuleTextSchema` reads and
  writes. The table checks that the text is readable JSON; the code checks its content, in one
  place. Beside it the mark "rule chosen by hand", `rule_chosen_by_hand`.
- **The creation Time Zone**, `time_zone`: the name the Operation computed with, read from the Time
  Zone Setting or the Device Time Zone ([ADR 0036](0036-the-app-stores-its-time-zone-and-week-start-as-settings.md),
  D342, D353). An edit leaves it unchanged, and no answer exposes it.
- **The breaks** as JSON text, `breaks`: a list in the entry's own row (see [The breaks](#the-breaks)).
- **The note, and at most one project as a column.**
- **One row per entry**, also across midnight.

The format follows one sentence: what has variants or is a list is text in one field; what is a
single value is a column the database checks. A later kind of rule needs no change to tables or
stored data.

Migration `time-tracking/0003` drops the table of the earlier shape and creates this one, with the
stored entries lost; `timers` stays as it is. The merged migrations are untouched (D142), and
startup takes a Backup before a pending migration runs.

### Who computes it

- **The Operation computes on every write**, with `computeTimeEntry` of
  `@self-engine/time-tracking/contracts`, the one pure function the page can load too. Every write
  of an entry takes its columns from `roundedColumns` in `data/rounded-columns.ts`: create, edit,
  and the Timer's stop in the same transaction as the stop. Nothing computed is an input: the
  inputs reject a Rounded Time and a Booked Duration (D346).
- **The rule.** Create takes an optional `ruleByHand`; without one the rule that holds rounds the
  entry and the mark stays off. An edit without `ruleByHand` keeps the entry's own rule and mark; a
  rule marks it chosen by hand; `null` clears the choice, so the rule that holds is taken and the
  mark removed. Every edit rounds again with the entry's rule, also an edit of start or end.
- **The rule that holds** is the default built into the code, "round up to 1 minute"
  (`DEFAULT_ROUNDING_RULE`).
- **The Time Zone of the computation** is the entry's own. A name this runtime does not know counts
  the Blocks of Block Rounding in UTC; the answer then carries the finding `time_zone_unknown`.
- **Reading is lenient.** An entry whose stored rule this version cannot read is answered with its
  stored numbers and `roundingRule: null`. An edit of it is refused with `rounding_rule_unknown` at
  `ruleByHand`; delete and restore change the row only. Findings are computed on read and never
  stored.

### The breaks

- **What a break holds.** Its Time Kind, `short_break` or `rest_break`, its start and end as
  Instants on whole seconds (`startedAt`, `endedAt`, not offsets from the entry's start), and for a
  Rest Break the mark "changed by the limit", `changedByLimit`. The mark is stored and answered;
  nothing sets it yet. In code a break is a union told apart by `timeKind`
  (`breakSchema`), and `breaksTextSchema` reads and writes the stored text. The table checks that
  the text is a readable JSON array; the code checks its content.
- **The rules**, checked by `breakFindings` in `contracts/breaks.ts`, the one place: a break lies
  between Work and touches neither edge of the entry (`break_not_between_work`), overlaps no break
  that starts before it, while touching is allowed (`break_overlaps`), and is at least one second
  long (`break_too_short`). Each finding names the break by its place in the list, `breakIndex`.
- **The computation.** `computeTimeEntry` takes the breaks. The counting time is the measured
  length without the seconds the Rest Breaks cover; Short Breaks count, and no break is rounded on
  its own. Under Ordinary Rounding the end is the start plus the Booked Duration plus the Rest
  Breaks inside, their sum cut down to the whole minute: 9:00:10 – 12:40:20 with a Rest Break of
  20:25 is 9:00 – 12:40 and counts 3:20. Under Block Rounding a Block that holds only a Rest Break
  does not count. The answer carries the findings beside the numbers; it has a result for any list:
  the part of a break outside the entry is ignored, and a second several breaks cover counts once.
- **The Operation refuses, and never repairs.** Every write takes its breaks through
  `roundedColumns`, which stores them on whole seconds and refuses the first finding as an input
  error at `breaks.<index>` with its Reason (ADR 0040). It never cuts, moves or deletes a break.
  Create takes an optional list; an edit replaces it as a whole, and the empty list removes every
  break. An edit without a list keeps the stored one and checks it, so a start or end that leaves a
  break no longer between Work is refused at that break. The field never takes `null`: an answer's
  `null` is a list this version cannot read.
- **Move** is its own Operation, `move`: it takes the new measured start, shifts the end and every
  break by the same amount, and rounds with the entry's own rule in its own Time Zone. It is refused
  like an edit.
- **The Timer's stop** writes an entry without breaks.
- **Reading is lenient.** Findings of stored breaks are computed on read, beside
  `time_zone_unknown`, and never stored; the answer keeps the stored numbers. An edit that keeps
  such a list is refused until it repairs it. A list this version cannot read is answered as
  `breaks: null`; an edit that keeps it, and every move, is refused with `breaks_unknown` at
  `breaks`.

### What the Port answers

Every answer that carries a Time Entry holds its Measured Time (`startedAt`, `endedAt`), its
`roundedTime` or `null`, its `bookedDuration`, its `roundingRule`, the rule chosen by hand as
`ruleByHand` (`null` without the mark), its `breaks` and its `findings`. A list (`DayEntry` of the
Query of a Day Span) leaves out the rule, the mark, the breaks and the findings, so it parses
neither the rule nor the breaks.

### The Day Span

- The Query reads the window on the measured columns, widened by the reach of any rule (the longest
  step or Block, an hour), so it stays a walk of the end index; `groupDays` then cuts it exactly.
- An entry stands where its Rounded Time lies, sorted by its rounded start. One without a Rounded
  Time stands on the day of its measured start with 0:00.
- Overlaps are judged on the Rounded Times; touching is no overlap, and an entry without a Rounded
  Time overlaps nothing (D311).
- An entry on one Calendar Day has its Booked Duration as its Day Share. `dayShares` cuts the
  Rounded Time of an entry across midnight at the Calendar Days of the Time Zone of the call;
  without Rest Breaks its pieces add up to the Booked Duration.

### The display

The week shows the Rounded Time of an entry as its times of day, in minutes; an entry without one
shows its Measured Time. The fields of the Edit Drawer hold the Measured Time, and the duration
beneath them is the measured one. Durations follow
[ADR 0043](0043-a-duration-shows-seconds-exactly-when-it-has-some.md).

## Consequences

- A Timer stopped after 44:10 counts 0:45 and the week shows its Rounded Time.
- Under the default rule a minute counts twice at every switch of the Timer, and both entries are
  marked as overlapping, until the overlap rule takes away Occupied Time.
- A change of Time Zone can move past work to different Calendar Days. A changed rule never
  changes a stored entry on its own.
- An entry written by a later version with a kind of rule this one does not know stays readable
  and cannot be edited until the app is current.
- Every edit and every move costs one lookup of the row before its write. A sum of breaks over a
  period reads the entries and adds in code.
- Until [Day Shares without the Rest Breaks of a day](https://github.com/Self-Engine/self-engine/issues/444)
  is built, an entry across midnight with a Rest Break shares its Rounded Time, not its Booked
  Duration, between its days.

## Considered Options

- **Store only the Measured Time and round on read** (ADR 0038's shape). The Rounded Time will
  depend on what else was stored, and a read could not tell which rule held.
- **The breaks as rows of a table of their own.** Delete, restore and undo would have to take
  them along, and a second device that changed one could leave the entry's Booked Duration stale
  (the stretches resolution, point 4).
- **Store the rule as columns** for kind, direction and minutes. A later kind would need new
  columns and, since SQLite cannot change a check, a rebuild of the table.
- **Rewrite the merged migrations.** A database that ran them would never run the rewritten file
  and would fail at the first query on a new column.
- **"Look up again" as `null` on the answer's `roundingRule`.** `null` clears a field in every
  edit (ADR 0032), and the answer would carry the looked-up rule where `null` was sent; the rule
  chosen by hand is the field that `null` clears.
