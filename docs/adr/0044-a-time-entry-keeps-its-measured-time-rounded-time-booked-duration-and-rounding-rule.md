---
status: accepted
date: 2026-11-28
decisions: D306, D308, D309, D342, D343, D344, D345, D346, D353, D354
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

- **The Time Kind**, `time_kind`: `work`, `short_break`, `rest_break` or `leisure`, which the table
  checks (see [The Time Kind](#the-time-kind-and-the-two-shapes)).
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
- **The mark "changed by the limit"** of a Rest Break entry, `changed_by_limit`.
- **The note.** Its projects are rows of their own, the Project Shares (below).
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
  move, and the Timer's stop in the same transaction as the stop. Nothing computed is an input: the
  inputs reject a Rounded Time and a Booked Duration (D346).
- **The rule.** Create takes an optional `ruleByHand`; without one the rule that holds rounds the
  entry and the mark stays off. An edit without `ruleByHand` keeps the entry's own rule and mark; a
  rule marks it chosen by hand; `null` clears the choice, so the rule that holds is taken and the
  mark removed. Every edit rounds again with the entry's rule, also an edit of start or end.
- **The rule that holds** is looked up in one read per write (`ruleThatHolds`), on create, on the
  Timer's stop, on "look up again" and when an entry stops being Work: the rule of the entry's Lead Project with the latest "holds
  from" at or before the measured start, else the app-wide rule by the same reading, else the
  default built into the code, "round up to 1 minute" (`DEFAULT_ROUNDING_RULE`). An entry without
  a project takes the app-wide rule. "Look up again" asks with the Lead Project and start the edit
  leaves. Of two rules with the same "holds from", or two first rules of one project, the one
  changed last holds (`updated_at`), then the one with the larger id. A stored rule this version
  cannot read counts as absent there. So a forgotten entry entered weeks later gets the rule of
  its time, and an edit of start or end never looks up.
- **The Time Zone of the computation** is the entry's own. A name this runtime does not know counts
  the Blocks of Block Rounding in UTC; the answer then carries the finding `time_zone_unknown`.

### Where a Rounding Rule stands

The Rounding Rules are rows of `rounding_rules` in `time-tracking`, not of `projects` (D309): the
project it belongs to in `project_id`, or none for the app-wide rule; `holds_from`, an Instant on the
whole second, which the table checks as it does the entry's start and end, from which it holds for every entry that starts at or after it, or none for a rule that holds from the
beginning, as a project's first rule does; and the rule as JSON text in the entry's form. A
project's rules are Part Rows of their project
([ADR 0042](0042-a-part-row-is-a-live-row-only-while-its-owner-is-one.md)): they never block
deleting it, do not hold while it is deleted, and hold again once it is restored. The app-wide
rule names no project and is an ordinary row. No row exists until a rule is set, so two devices
never each create a first app-wide rule. No Operation writes the table yet.


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

### The Time Kind and the two shapes

- **A Time Entry is a Work Entry, a Break Entry or a Leisure Entry.** Its `time_kind` is one of
  `TIME_KINDS` in `contracts/time-kinds.ts`, the values a break uses for Short Break and Rest Break
  and `work` and `leisure` beside them. The table checks the value, and that only a Work Entry
  holds a non-empty list of breaks and the mark "rule chosen by hand", and only a Rest Break entry
  the mark "changed by the limit". The projects stand in their own table, so the Operation alone
  keeps an entry that is not work without them.
- **The Port answers a union of two shapes**, told apart by `timeKind`: `workEntrySchema` carries
  `roundingRule`, `ruleByHand`, `breaks` and `projects`; `notWorkEntrySchema` carries none of
  them, and only its Rest Break carries `changedByLimit`. So the compiler stops a caller from
  reading the projects or the breaks of an entry before it checked that it is work. A list
  (`listedTimeEntrySchema`, `dayEntrySchema`) is the same union without the parts a list does not
  show.
- **Create takes either shape.** Without a `timeKind` it makes a Work Entry. An entry that is not
  work takes `startedAt`, `endedAt` and `note`; `projects` and `breaks` on it are refused at their
  field with `not_work_has_projects` and `not_work_has_breaks` (the empty list says "none"), and a
  rule chosen by hand is no field of that shape.
- **The computation.** `computeTimeEntry` takes the Time Kind. An entry that is not work is
  rounded by its rule as a whole, without breaks: the Rounded Time is what the rule makes of its
  length, the Booked Duration that length for a Short Break and 0 for a Rest Break and for Leisure,
  and a length of 0:00 gives no Rounded Time. Breaks or projects on it are findings, which the
  result ignores. The rule is the app-wide rule that held at its measured start: such an entry
  never takes a project's rule and never a rule chosen by hand. The Leisure Entry 14:00:10 –
  16:44:20 counts as 14:00 – 16:45.
- **Changing the Time Kind** is the field `timeKind` of an edit: free between Short Break, Rest
  Break and Leisure and from those to Work; from Work to one of those only once the entry keeps no
  projects and no breaks, else it is refused at `projects` or `breaks` with the Reason of create.
  An edit may clear both in the same call. A rule chosen by hand for an entry that is not work is
  refused with `not_work_has_rule_by_hand` at `ruleByHand`. Every edit rounds with the entry's own
  rule, and only "look up again" (`ruleByHand: null`) takes another: an entry that stops being Work
  takes the app-wide rule that held at its start and loses the mark "chosen by hand", since every
  entry that is not work takes the app-wide rule; one that becomes Work keeps its rule, and the same
  edit sends `ruleByHand: null` to take its Lead Project's. Between kinds that are not work the
  entry keeps its rule. A change of kind removes the mark
  "changed by the limit"; an edit of other fields keeps it. Nothing sets the mark yet.
- **The Timer's stop** writes a Work Entry. The Edit Drawer has no field for the Time Kind yet
  ([#421](https://github.com/Self-Engine/self-engine/issues/421)): it never sends it, so saving
  other fields leaves it as it is, and its create form makes a Work Entry.
- **Reading is lenient.** Project Shares on an entry that is not work, which a sync could bring,
  are answered as the finding `not_work_has_projects` beside the shape without projects; the Day
  Span counts the entry without them.

### The projects of an entry: Project Shares

- **One row per project of an entry** in `project_shares`: the entry (`time_entry_id`, never
  empty), the project, its `place` in the entry's list (the Lead Project at 0), its `weight`, a
  whole number from 1 to 10,000, and its `project_share` in seconds. An entry with one project has
  one row, an entry without a project none. The entry's column for a project is gone (D308).
- **A share is a Part Row of its entry**
  ([ADR 0042](0042-a-part-row-is-a-live-row-only-while-its-owner-is-one.md)): delete and restore
  of an entry change only its row; a share of a deleted entry counts nothing and protects nothing.
  A project cannot be deleted while a live entry has a share in it, and the refusal counts the
  entries; it can be deleted once those entries are deleted, and restoring such an entry is
  refused with `target_deleted` at the entry, field `project_shares`, while its project is deleted.
  It can always be archived (D306).
- **The Operation divides** on every write, create, edit, move and the Timer's stop, with
  `computeTimeEntry`: every project after the Lead Project gets its part of the Booked Duration by
  Weight, cut down to the whole minute (to the whole second under Exact), and the Lead Project the
  rest, so the shares add up to the Booked Duration exactly; a share can be 0:00. A share is never
  an input (D346), and shares never change the Rounded Time or the Booked Duration.
- **The input** `projects` is the ordered list of `{ projectId, weight? }`, never `null`; a
  project without a Weight has the Weight 1, so equal parts. Create may leave it out (no project),
  and an edit replaces the list as a whole. A project named twice is refused with
  `project_named_twice` at its second place, a Weight outside its range with
  `weight_out_of_range`.
- **An edit keeps the rows it can**: a project already in the list keeps its row, a new one gets
  a new row, and a removed one is soft-deleted, so adding it again makes a new row. An edit of
  other fields divides again with the stored Weights and order.
- **The Timer's stop** writes one share that holds the whole Booked Duration, in the same
  transaction. "Undo stop" removes the entry's shares while it lives, then deletes it, so the stop
  that saves it again gives it the project the Timer has then (D371): a restore is judged with the
  entry's live shares, and the earlier project may have been deleted meanwhile. This is the one
  exception ADR 0042 names; an entry taken back this way and restored by another route comes back
  without projects.
- **Reads.** The shares of a span's entries come in one more read, not one per entry, through
  `projectsOfEntries`, the one place a Query reads shares; it goes through the shared entry, so
  only shares of Live Rows count. A Query that reads them names `project_shares` and
  `time_entries`.

### What the Port answers

Every answer that carries a Time Entry holds its `timeKind`, its Measured Time (`startedAt`,
`endedAt`), its `roundedTime` or `null`, its `bookedDuration`, its `findings` and its `note`. A
Work Entry also holds its `roundingRule`, the rule chosen by hand as `ruleByHand` (`null` without
the mark), its `breaks` and its `projects`, the Lead Project first, each with its `weight` and its
`projectShare`; a Query adds each project's Project Reference as `project`. A Rest Break entry
holds `changedByLimit`. The answer carries each project as it was sent, with the computed parts
beside it (ADR 0032). A list (`DayEntry` of the Query of a Day Span) leaves out the rule, the
mark, the breaks, the findings and `changedByLimit`, so it parses neither the rule nor the breaks.

**Reading is lenient.** An entry whose stored rule this version cannot read is answered with its
stored numbers and `roundingRule: null`. An edit of it is refused with `rounding_rule_unknown` at
`ruleByHand`; delete and restore change the row only. Findings are computed on read and never
stored.

### The Day Span

- The Query reads the window on the measured columns, widened by the reach of any rule (the longest
  step or Block, an hour), so it stays a walk of the end index; `groupDays` then cuts it exactly.
- An entry stands where its Rounded Time lies, sorted by its rounded start. One without a Rounded
  Time stands on the day of its measured start with 0:00.
- Overlaps are judged on the Rounded Times of the entries whose Rounded Time touches the span: the
  wider read is cut to the span first, so an entry just outside it marks nothing. Touching is no
  overlap, and an entry without a Rounded Time overlaps nothing (D311).
- The sums per project read the Project Shares and add up to the total of the entries that have a
  project. A filter by project holds the entries with a share in it, and every sum counts that
  share, while each entry's `dayShare` stays the whole entry's; "no project" holds the entries
  without a share.
- An entry that is not work stands like any other, with its Rounded Time and its Booked Duration,
  and the week shows it without a project until
  [its surface](https://github.com/Self-Engine/self-engine/issues/421) is built. A day's total adds
  Booked Durations: a Short Break entry counts toward the day and toward "no project", a Rest Break
  entry and a Leisure Entry add nothing to any sum, across midnight too.

### The Day Shares

A Day Share stays computed on read (D343), in `data/day-shares.ts`, the one place that divides an
entry over its days.

- **An entry on one Calendar Day** has its Booked Duration as its Day Share and each project its
  Project Share. Nothing else is read or computed for it.
- **An entry whose Rounded Time crosses midnight** in the Time Zone of the call gets a Day Share on
  each day it touches: the part of its Rounded Time on that day without the Rest Breaks on that
  day. `countedRanges` in `contracts/computation.ts` says where the Booked Duration lies, reusing
  `restCover`: the Rounded Time without the Rest Breaks in it; under Block Rounding, where a Rest
  Break inside a counted Block counts, the Blocks that count; for a Short Break entry its Rounded
  Time; for a Rest Break entry and Leisure nothing. The Work Entry 22:00 – 02:00 with a Rest Break
  of 23:30 – 00:30 counts 1:30 on each day.
- **The Day Shares add up.** Every day but the last gets its part cut down to the unit of the
  shares, a minute or a second under Exact, never more than is left, and the last day gets the
  rest (`divideOverDays`). So they add up to the Booked Duration exactly under every rule, also
  where Ordinary Rounding counts a few seconds more or less than lie in the Rounded Time, and none
  is below zero.
- **Each Project Share is divided over the days** (`divideProjectShares`): every day but the last
  gives each project its part of the day by its share, cut down to the unit; what is left of the
  day goes to the projects in their order, the Lead Project first, as far as their shares reach;
  the last day gets what is left of each share. Per day the parts add up to the Day Share, per
  project to the Project Share, and none is below zero.
- **The division covers every day the entry touches,** inside the span or not, and the span keeps
  its own days. So the sums per day, per project and of the span count only the parts inside it,
  and two adjacent spans add up to the entry.
- **The read.** Only the entries across midnight (`entriesAcrossMidnight`) need their rule, their
  breaks and their own Time Zone; the Query reads and parses them in one more read for all of
  them, and none when no entry crosses midnight. A rule or list this version cannot read counts
  the Rounded Time on whole seconds.

### The display

The week shows the Rounded Time of an entry as its times of day, in minutes; an entry without one
shows its Measured Time. It shows the mark of the Lead Project. The Edit Drawer's project field
changes the Lead Project and leaves the other projects alone: a new project takes the place and
the Weight of the first, a further project moves to the front, and clearing removes the first
only. An edit of other fields sends no projects. The fields of the Edit Drawer hold the Measured Time, and the duration
beneath them is the measured one. Durations follow
[ADR 0043](0043-a-duration-shows-seconds-exactly-when-it-has-some.md).

## Consequences

- A Timer stopped after 44:10 counts 0:45 and the week shows its Rounded Time.
- Every function that handles entries says what it does with an entry that is not work: in code
  it has to check the shape before it reads the projects, the breaks or the rule.
- Under the default rule a minute counts twice at every switch of the Timer, and both entries are
  marked as overlapping, until the overlap rule takes away Occupied Time.
- A change of Time Zone can move past work to different Calendar Days. A changed rule never
  changes a stored entry on its own.
- An entry written by a later version with a kind of rule this one does not know stays readable
  and cannot be edited until the app is current.
- Every edit and every move costs one lookup of the row and one of its shares before its write. A sum of breaks over a
  period reads the entries and adds in code.
- A Day Share across midnight is computed on every read of a span, from the entry's breaks and
  rule; it is never stored, so a change of the Time Zone divides past entries anew.

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
- **Under Block Rounding, the Rounded Time of a day less its Rest Breaks.** A Rest Break inside a
  counted Block counts, so the days would add up to less than the Booked Duration and the last day
  would get the difference: 22:10 – 00:10 with a Rest Break of 22:20 – 23:50 in Blocks of an hour
  would count 0:30 on the first day and 2:30 on the second, instead of 2:00 and 1:00.
- **"Look up again" as `null` on the answer's `roundingRule`.** `null` clears a field in every
  edit (ADR 0032), and the answer would carry the looked-up rule where `null` was sent; the rule
  chosen by hand is the field that `null` clears.
