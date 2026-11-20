---
status: accepted
date: 2026-11-20
decisions: D355
---

# Calendar weeks start on a named day

## Context

`Temporal` numbers Sunday as 7, while Mantine's date picker uses 0. The Week Start
needs one representation shared by the calendar and its
[Setting](0036-the-app-stores-its-time-zone-and-week-start-as-settings.md).

## Decision

- `weekOf` takes a lowercase English day name from `"monday"` through `"sunday"`.
  This replaces the numeric week-start argument in
  [ADR 0026](0026-five-time-values-each-with-one-stored-form-and-every-conversion-takes-the-time-zone.md).
- `time` converts the name to Mantine's Sunday-zero number at the date-picker boundary.
  The named-day schema has a standalone `@self-engine/time/first-day-of-week` entry
  built with Zod Mini so a Setting can validate the name without loading calendar
  arithmetic or the full Zod build.
- `i18n` derives the region from the App Language. German uses `de-DE` and English
  uses `en-US`. `time` takes the region explicitly and gives Monday and Sunday,
  respectively.

## Consequences

- Backup retention names Monday explicitly. It counts the same weeks on every device.
- The compiler rejects numeric week starts and unsupported region tags at the calendar API.
