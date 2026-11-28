---
status: accepted
date: 2026-11-28
decisions: D345
---

# A duration shows seconds exactly when it has some

## Context

D345 rounded each displayed Duration up to a whole minute. Two Time Entries of 44 minutes
10 seconds and 20 minutes 10 seconds could then show `0:45` and `0:21` beside a total of
`1:05`.

## Decision

- The `hoursMinutes` format of `formatDuration` shows the supplied Duration without rounding.
  It displays whole minutes as `0:45` and adds a seconds part when the value has one, as in
  `0:44:10`. Hours can exceed 24, and the digits follow the App Language.
- The week uses this format for each Day Share and for the sums by day, project and week.
  The Edit Drawer uses it for the Duration between its Instants.
- The running Timer uses `hoursMinutesSeconds`, which always includes the seconds part. The
  week continues to display times of day in minutes.

This replaces D345 and the display rounding described in
[ADR 0038](0038-a-time-entry-keeps-its-instants-booked-duration-and-creation-time-zone.md).
Point 9 of
[ADR 0026](0026-five-time-values-each-with-one-stored-form-and-every-conversion-takes-the-time-zone.md)
names the two formats and now states this rule; that ADR stays in force as a whole.

## Consequences

The two entries in the example show `0:44:10` and `0:20:10`, which add up to the displayed
total of `1:04:20`. Display precision follows the value even in a sum that combines durations
with different precision.
