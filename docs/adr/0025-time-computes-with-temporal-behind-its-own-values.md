---
status: accepted
date: 2026-11-14
decisions: D279, D280, D285
---

# `time` computes with Temporal behind its own values

## Context

A freelancer bills by the hour, so the app must not be wrong about which day an entry falls on,
how long it lasted or when a day starts. The old app computed offsets, clock changes and
calendars in about 500 lines of its own code over `Intl`, kept its own list of 438 zone names
because `Intl` turns `Asia/Kolkata` into `Asia/Calcutta`, and still disagreed with itself in
known ways. Electron's Node, its page and the test runner all carry the runtime's built-in
`Temporal`, but they do not share one ICU: the tests run on Node 26 with ICU 79.1, the app on
Electron's Node 24 with ICU 78.2.

## Decision

1. **`@self-engine/time` is the one package that computes with time, cut for this app.** It
   imports no package of this repo and has one dependency, `zod`. Every function it exports has a
   user in sight: the code moved onto it in the same work package, projects, the time module or
   the time zone Setting. The old app's package was a template, not a starting point; its test
   cases for clock changes and date boundaries run against the new one.
2. **All zone and calendar arithmetic calls `Temporal`, and no `Temporal` object leaves the
   package.** The exports take and return the package's own values: branded text and numbers
   with a Zod schema each ([ADR 0026](0026-five-time-values-each-with-one-stored-form-and-every-conversion-takes-the-time-zone.md)).
   A type test pins every exported function's signature and the list of exports. Outside
   `time`, `Temporal` is rejected by a lint rule
   ([ADR 0027](0027-date-and-temporal-exist-only-inside-time-and-no-clock-has-a-default.md)).
   Conversions keep no cache. Only the display formats keep one `Intl.DateTimeFormat` per
   format, language and zone, because building one costs far more than using it.
3. **The package has four entries.** The main entry holds the values, the arithmetic, the
   conversions, the zones and the display formats. `./testing` holds `requireInstant`, which
   writes an Instant as text, `fixedClock`, and `advanceInstantByMilliseconds` for test sources
   that move their clock. `./system-clock` holds the system clock alone. `./check` holds the
   check program.
4. **Four kinds of checks prove the arithmetic on every `pnpm verify`.**
   - Fixed cases with written-out results, ported from the old package and extended: clock
     changes in both directions, the date line, month ends, leap days, the year limits, the
     skipped hour in Berlin on 29 March 2026, the repeated hour there on 25 October 2026 with
     both Instants, and Cairo on 24 April 2026, whose day starts at 01:00.
   - Properties with `fast-check` and a fixed seed: an Instant to day and wall-clock time and
     back gives its minute again, the range of one day ends where the next day's starts, Instants
     sorted as text are in time order, and the durations of adjoining entries add up to the whole.
   - A comparison with `Intl` around every clock change of every zone the runtime lists, from
     1970 to 2040: at each change, a second and an hour on either side, the day and wall-clock
     time `time` computes must equal what `Intl` shows, and the way back must hold the Instant.
     It asserts no counts, because they change with the zone data.
   - The check program (`./check`): the fixed cases, the zone-name table and the `Intl`
     comparison without the test runner. The smoke stage bundles it and runs it in Electron's
     `utilityProcess`, which is the runtime of the _Data Process_, and in the page. A failure in
     either fails the stage. The smoke stage's cache includes the lockfile, so a new Electron
     version runs it again. The same program is the proof a later runtime must pass, on web or
     mobile, before the app ships there.
5. **Every test runs in the process time zone `Pacific/Chatham`**, and the tests of `time` pass
   zones east and west of UTC as arguments. There is no second test run in another process zone.

## Consequences

- One conversion costs about a microsecond, parsing included: in Electron 45 the day of an
  Instant took 39 ms for 50,000 Instants with `Temporal`, against 103 ms through `Intl`.
- Changing the engine is a change inside `time` only. Callers see text and numbers.
- `time` grows by pull request with its next user. Date words such as "tomorrow 15:00", a
  bridge to native date pickers, a lenient parser for imports, splitting by day, a relative
  display and a page clock that turns at midnight are not built.
- `Temporal` and `Intl` read the same zone data. When a country changes its clock rules at short
  notice, the app learns the rule with the next Electron update; stored Instants stay correct.
- Safari 27.2 and Hermes have no `Temporal`. Web and mobile need a replacement loaded at start,
  and that runtime must pass the check program first; the check program is runtime-neutral for
  that reason.
- The smoke stage bundles and runs the check program twice, which adds about a second to it.
- The process time zone cannot leak into a result, because no function of `time` reads it except
  `deviceTimeZone`, and no other code can reach `Date` or `Temporal`. A second test run in a
  second zone would catch nothing more.

## Considered Options

- **Own arithmetic over `Intl`, as in the old app:** rejected (D280). More of our own logic at the
  most delicate point, and `Intl` renames zones silently. It would be as unproven on Hermes as
  `Temporal`.
- **`Temporal` directly in every module:** rejected (D280). The values travel as text through
  SQLite and between processes, so every module would convert and depend on `Temporal`.
- **Carrying the old package over file by file:** rejected (D279). It brings a clock with a
  default, Postgres forms, grid rounding and the leftovers of old Views, and it lacks a duration.
- **A second test run in another process zone:** rejected (D285). It needs a second start of the
  test runner and catches nothing the rules of ADR 0027 do not.
- **All tests in Electron as well:** rejected (D285). The test runner needs Node 26, Electron
  brings Node 24.
- **Coverage thresholds and mutation tests:** rejected (D285). Cost without a source of errors of
  their own.
