---
status: accepted
date: 2026-11-14
decisions: D284, D195
---

# `Date` and `Temporal` exist only inside `time`, and no clock has a default

## Context

The old app read the system clock in 278 places, so its behaviour could not be tested. In this
repo the clock used to live in `db`, returned a `Date` and fell back to the system clock in three
places when a caller passed none: the timestamp helper, the opening of the data files and the
start of the _Data Process_. The lint rules planned in D148 and D149 forbade six narrow forms
and still allowed `new Date(ms)`, and `.getDate()` on that gives the day in the device's zone.

## Decision

1. **A _Clock_ is a function that returns an _Instant_, and its type belongs to `time`.** No
   function has a default for it: forgetting the clock is a type error. `db` and `storage` take
   the type from `time`; `newTimestamp` in `db` returns what its clock returns, and `newId` takes
   the milliseconds of a UUIDv7 from the clock's Instant through `epochMsOf`.
2. **The system clock has an entry of its own, `@self-engine/time/system-clock`, and only code in
   `apps/` loads it.** The dependency-cruiser rule `system-clock-only-in-apps` rejects an import
   of that entry from anywhere else; the tests of `time` reach it by relative path. Today the
   desktop app assembles it twice: at the start of the _Data Process_, which hands it to the data
   files, the _Backups_ and the _Storage_ context, and in `pnpm nightly:local`, which stamps
   the version of a Nightly built on the owner's machine.
3. **A test uses `fixedClock` and writes Instants as text with `requireInstant`**, both from
   `@self-engine/time/testing`. `createTestSources` in `db` moves its clock by whole milliseconds
   with `advanceInstantByMilliseconds`, never by days.
4. **_Storage_ reads the clock once per transaction** (D195). The context holds that Instant as
   `now` and hands its _Operations_ a clock that returns it, so every row and id written in one
   transaction carries the same Instant.
5. **The repo lint plugin's rule `no-time-outside-time` rejects every way around `time`** in
   `packages/` and `apps/`, tests and stories included, and nowhere in `packages/time/`: `new Date`
   in every form, `Date.now`, `Date.parse`, `Date.UTC`, the global `Temporal`,
   `Intl.DateTimeFormat`, `toLocaleDateString` and `toLocaleTimeString`, reached directly, through
   `globalThis` or by destructuring, and any import of `date-fns`, `dayjs` or `luxon`. A local
   binding of the same name is not reported, and Mantine's own use of `dayjs` is not affected.
   Each report names the function of `time` to use instead.
6. **A `Date` from a foreign interface, such as a file time, becomes an Instant at once through
   `instantFromDate`.** An invalid date or one outside the supported years throws.

## Consequences

- Every function that needs the time can be tested with a fixed one, and no test reads the real
  clock.
- Where real time enters the program is visible: the two imports of `system-clock` in
  `apps/desktop`.
- The rule fits in one sentence: outside `time`, nothing touches `Date`, `Temporal` or the date
  parts of `Intl`. A reviewer checks a change against that sentence alone.
- `scripts/` is outside the rule; the repo's tools measure durations and stamp logs with the
  runtime's own clock.
- A Mantine date field that hands out a `Date` gets one conversion in `time` with the first date
  field.
- The page has no clock yet. Where a View gets "now" and "today" from is decided with the first
  View that needs them.

## Considered Options

- **The six narrower lint rules of D148 and D149:** rejected (D284). They allowed `new Date(ms)`,
  and the device's zone leaked in through its getters.
- **A clock with the system clock as its default:** rejected (D284). A forgotten clock compiles
  and reads the real time in a test.
- **The system clock in the main entry of `time`:** rejected. Any package could load it; an entry
  of its own lets the boundary rules keep it in `apps/`.
