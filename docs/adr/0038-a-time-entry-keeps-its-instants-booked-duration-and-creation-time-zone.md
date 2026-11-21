---
status: accepted
date: 2026-11-21
decisions: D308, D342, D343, D344, D345, D346, D353, D354
---

# A Time Entry keeps its Instants, Booked Duration and creation Time Zone

## Context

A Time Entry records when work happened and how much time counts. Rounding the start or end
would lose the measured time. Deriving the creation Time Zone later would require guessing
where the entry was made. An entry that crosses midnight still needs to be edited and deleted
as a whole.

## Decision

- **Start and end are Instants on whole seconds.** On create and on an edit that changes the
  range, the Operation discards the milliseconds from both Instants. The Contract compares
  the truncated values and requires the end to be at least one second after the start. The
  `time_entries` table checks that both values end in `.000Z` and that the end sorts after the
  start. The stored Instant format sorts chronologically for the supported years
  ([ADR 0026](0026-five-time-values-each-with-one-stored-form-and-every-conversion-takes-the-time-zone.md)).
- **The Booked Duration sits beside the Instants in `duration_seconds`.** Create and edit
  compute it as end minus start whenever they write the range. An edit of other fields retains
  it. The table checks that it is nonnegative. Every answer carrying a Time Entry includes
  the Booked Duration. The write inputs take start and end for the range and reject a
  duration field.
- **Creation stores the Time Zone of the call in `time_zone`.** The Operation gets the name
  from the Time Zone Setting or uses the Device Time Zone when the stored name is absent or
  unknown, as described in [ADR 0036](0036-the-app-stores-its-time-zone-and-week-start-as-settings.md).
  Editing leaves the stored name unchanged. The Queries leave it in storage and no answer
  exposes it. Layer 4 uses the current Time Zone to place and display entries.
- **A Time Entry stays one row.** The `timeTracking.days` Query fetches the Live Rows that
  overlap the requested Day Span. The `dayShares` function computes the Day Shares at read
  time by cutting the range at Calendar Day boundaries in the current Time Zone. It also
  determines whether the entry crosses midnight, including a crossing outside the requested
  span. Across all days the shares add up to the Booked Duration. The Query sums only the
  shares inside the requested span.

## Consequences

- A change of Time Zone can move past work to different Calendar Days and change week totals.
- Edit, Delete and Undo act on the whole Time Entry from any day where it appears.
- The View rounds durations up to whole minutes for display after summing the underlying
  seconds. Individual displayed values can add up to a different number from the displayed
  total.

## Considered Options

- Store two rows for an entry across midnight. Editing or deleting the original entry would
  then require finding and updating all of its rows, and a change of Time Zone could move
  the boundary.
- Store rounded Instants. This would lose the measured time and could create apparent overlaps.
- Accept a Booked Duration as input. This would require a rule for allocating the entered
  amount across days and for deciding what happens to it on a later range edit.
