---
status: accepted
date: 2026-11-14
decisions: D284, D195, D348, D363
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
   the type from `time`; a timestamp is what the clock returns, and `newId` in `db` takes
   the milliseconds of a UUIDv7 from the clock's Instant through `epochMsOf`.
2. **The system clock has an entry of its own, `@self-engine/time/system-clock`, and only code in
   `apps/` loads it.** The dependency-cruiser rule `system-clock-only-in-apps` rejects an import
   of that entry from anywhere else; the tests of `time` reach it by relative path. It builds its
   Instant without the schemas of `time`, so the page can load it at its start, and throws a
   `RangeError` for a system time outside the supported years. It enters the program in three
   places:
   - **The desktop app** assembles it in one place, `systemSources`, together with the random
     source of ids. The _Data Process_ takes both from there and hands them to the data files,
     the _Backups_ and the _Storage_ context.
   - **The page** loads it in one file, `apps/web/src/page-clock.ts`, as `pageClock`; the rule
     `page-clock-in-one-place` rejects it in any other file of the page. The page hands that one
     Clock to the settings area in its module list and to `PageClockProvider` of
     `@self-engine/time/react`, mounted once beside the other providers (D348). A _View_ reads
     the time only through two hooks of that entry: `useNow(step)`, read again at every full
     second or minute, and `useToday(timeZone)`, the Calendar Day in the zone the caller passes.
     One ticker serves every reading with a single timeout, set to the earliest moment one of
     them shows something new: the next full second or minute, or the start of the next day
     (`nextTick` and `startOfNextDay` of `time`). It runs only while a reading is rendered and
     the window is visible; the app supplies the window's visibility, watched once for the page.
     A timeout waits at most a minute, because a timer may not count the time the computer
     slept. A reading takes the Clock's time and never counts ticks, so after a sleep it is right
     at the next tick, at most a minute after waking. A hook without a provider above it throws at its first render; nothing falls back to
     the system clock. The page clock displays and prefills only: every stored Instant comes
     from the Data Process's clock. The rule `data-process-stays-off-the-page-clock` keeps the
     React entry out of everything the desktop app starts.
   - **`pnpm nightly:local`** takes the clock to stamp the version of a Nightly built on the
     owner's machine.
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
- Where real time enters the program is visible in the app imports of `system-clock`.
- The rule fits in one sentence: outside `time`, nothing touches `Date`, `Temporal` or the date
  parts of `Intl`. A reviewer checks a change against that sentence alone.
- `scripts/` is outside the rule; the repo's tools measure durations and stamp logs with the
  runtime's own clock.
- A Mantine date field that hands out a `Date` gets one conversion in `time` with the first date
  field.
- A story or a test renders a View with "now" and "today" the same every time: it hands
  `PageClockProvider` a `fixedClock` and `alwaysVisible` from `@self-engine/time/testing`. The
  app's stories hand the same fixed Clock to their settings area.
- While nothing reads "now" or "today", or the window is hidden, no timeout runs. A reading per
  second costs one timeout per second and redraws only the components that read per second; one
  per minute wakes once a minute, and "today" once a day.
- The settings area still reads the Clock itself, when its Time Zone list opens, instead of
  through a hook: the list wants the offsets of that moment, not one that moves while it is
  open.

## Considered Options

- **The six narrower lint rules of D148 and D149:** rejected (D284). They allowed `new Date(ms)`,
  and the device's zone leaked in through its getters.
- **A clock with the system clock as its default:** rejected (D284). A forgotten clock compiles
  and reads the real time in a test.
- **The system clock in the main entry of `time`:** rejected. Any package could load it; an entry
  of its own lets the boundary rules keep it in `apps/`.
- **A timeout per reading of "now":** rejected (D348). Ten timers on a page would each wake the
  page, and none of them stops while the window is hidden.
- **One alarm set for the start of the next day, for "today":** rejected (D363). A timer may not
  count the time the computer slept, so "today" could stay on yesterday for hours after waking.
- **The ticker and the hooks in a package above `time`:** rejected (D348). Everything that reads,
  computes or ticks time stays in `time`, so the rule of the lint plugin keeps one sentence.
