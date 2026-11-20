---
status: accepted
date: 2026-11-14
decisions: D281, D282, D283
---

# Five time values, each with one stored form, and every conversion takes the time zone

## Context

The old app stored days as midnight UTC, so a day moved by one when it was read in a zone west
of UTC, and three places disagreed about "today". Its zone was unchecked text. Money is rate
times seconds divided by 3600 (D145): at 13 € an hour a second is 0.36 cents, and durations
rounded one by one could lose 3.61 € over 1,000 entries. A clock change makes a wall-clock time
skipped or repeated, and a day can start at 01:00. A user who corrects an entry in the second
02:40 of 25 October 2026 in Berlin would silently lose an hour if the app always picked the
first.

## Decision

[ADR 0036](0036-the-app-stores-its-time-zone-and-week-start-as-settings.md) specifies how
the app supplies the Time Zone.

1. **Five values cover every date a module stores.** Each is a branded type with a Zod schema
   that accepts only its stored form, and each holds years 1000 to 9999.

   | Value             | Type            | Stored form                                                     |
   | ----------------- | --------------- | --------------------------------------------------------------- |
   | _Instant_         | `Instant`       | UTC text with milliseconds, `2026-11-14T07:30:27.297Z`          |
   | _Calendar Day_    | `CalendarDay`   | text `2026-11-14`, without time or zone                         |
   | _Wall-Clock Time_ | `WallClockTime` | text `14:30`, minutes only                                      |
   | _Day Span_        | `DaySpan`       | `{ first, last }`, both days included, in two day columns       |
   | _Duration_        | `Duration`      | whole seconds, never negative, in a column ending in `_seconds` |

   A value enters through its schema, at a border, or as the result of a function of `time`.
   Instants and calendar days sort as text in time order. A _Day Span_ whose last day comes
   before its first fails its schema.

2. **Calendar arithmetic counts on calendar days only.** `addDays` and `addMonths` take whole
   numbers; a month end is constrained, so 31 January plus one month is 28 February. `daysBetween`
   counts whole days. `weekOf` returns the _Day Span_ of a day's week and takes the first day of
   the week as an argument ([ADR 0035](0035-calendar-weeks-start-on-a-named-day.md)).
   `isoWeekNumber` gives the ISO week. No function
   adds days to an _Instant_, because a day lasts 23, 24 or 25 hours.
3. **A _Duration_ cuts both Instants to the whole second, then subtracts.** `durationBetween`
   throws when the end comes before the start. Adjoining entries then add up to exactly the time
   from the first start to the last end.
4. **Every conversion takes the _Time Zone_ as an argument; `time` knows no current zone.**
   - `calendarDayOf` and `wallClockTimeOf` give the day and the wall-clock time of an Instant in a
     zone, the time cut to the minute.
   - `instantAt` gives the Instant of a day and wall-clock time in a zone, and the case:
     `unambiguous`; `skipped`, where the Instant lies the length of the gap after the given time
     (02:30 in a one-hour gap becomes 03:30); or `repeated`, where `instant` is the first
     occurrence and `later` the second. A minute that a change with an offset in seconds skips
     only in part, such as Monrovia's in 1972, counts as skipped (see Consequences). `time` never asks: a form
     decides what to do with the case.
   - `startOfCalendarDay` gives a day's first moment, which is not always 00:00.
   - `instantRangeOf` gives the Instants of a _Calendar Day_ or a _Day Span_, half-open: from the
     first moment of the first day up to, and excluding, the first moment of the day after the
     last. An Instant at midnight belongs to exactly one day.
   - `today` gives the calendar day of a _Clock_ in a zone.
   - `resolveWallClockTime` gives the Instant a form uses for a day and wall-clock time: no
     Instant for a skipped time, and for a repeated one the occurrence nearest the previous
     value on an edit, else the earlier one unless it lies at or before a lower bound.
     `moveToDay` moves an Instant to another day at the same wall-clock time, with its seconds,
     and resolves a clock change on that day the same way.
5. **A _Time Zone_ is a name the runtime knows, and `resolveTimeZone` is the only way to the
   type.** It returns the name in its official spelling (`europe/berlin` becomes
   `Europe/Berlin`) and keeps an alias as given (`Asia/Calcutta` stays `Asia/Calcutta`). It throws
   on an offset such as `+02:00` and on text that is no zone name. A well-formed name the runtime
   does not know yields the device's zone with `deviceFallback: true`; `time` logs nothing and
   leaves telling the user to the caller. The stored form is the name as text, which passes
   through the resolver when it is read. There is no zone list or alias table of our own.
6. **`sameTimeZone` is the only comparison of zones.** `Asia/Calcutta` and `Asia/Kolkata` are the
   same zone; zone names are never compared as text.
7. **`deviceTimeZone` is the only place the device's zone enters the program.** A device set to a
   bare offset instead of a zone name yields `UTC`.
8. **An Instant is shown through a named display format**, with the language and the zone as
   arguments and no free options; 12 or 24 hours follows the language. `formatInstant` knows
   two: `dateTime` (`13.11.2026, 13:30` in German) and `time`, the time of day alone (`13:30`).
   The list of _Backups_ shows its Instants in the Time Zone supplied by the page's
   `useTimeZone` hook (ADR 0036). `repeatedTimeOffset` names the UTC offset of an Instant, as
   `UTC+1`, when its zone shows its wall-clock minute twice that day, so a form can say which of
   the two is meant; the Time Zone picker writes offsets the same way.
9. **A _Calendar Day_ and a _Duration_ are shown through named formats** with the language as an
   argument. `formatCalendarDay` knows eight:

   | Format        | Shows                                             | English example              |
   | ------------- | ------------------------------------------------- | ---------------------------- |
   | `weekdayDate` | abbreviated weekday and date, no year (week View) | `Fri, Nov 13`                |
   | `shortDate`   | numeric month and day, no year (week View)        | `11/13`                      |
   | `fieldDate`   | what a date field shows and reads back            | `11/05/2026`                 |
   | `monthYear`   | the heading of a month in a calendar              | `November 2026`              |
   | `weekday`     | the head of a weekday column                      | `Thu`                        |
   | `month`       | a month in a calendar's list of a year            | `Nov`                        |
   | `year`        | a year                                            | `2026`                       |
   | `fullDate`    | a day read out in full, for a screen reader       | `Thursday, November 5, 2026` |

   `formatDuration` knows two: `hoursMinutes` rounds up to a whole minute for display, after any
   sum, and `hoursMinutesSeconds` shows the running timer with seconds. Both show the full hours
   when a duration exceeds 24 hours.

10. **A date or time field reads what `time` gives it.** `calendarDayFromText` reads a typed
    day in the order of day, month and year that the language's `fieldDate` shows, or as
    `YYYY-MM-DD`, and gives `null` for text that is no whole, existing day; a two-digit year
    lies in 2000–2099. `calendarLabels` gives a calendar picker its month, weekday and day names
    from the formats above, and `clockFormatOf` whether a time picker counts 12 or 24 hours, as
    `formatInstant` does. No date library supplies a name.

## Consequences

- Passing a calendar day where an Instant is expected is a type error, and a _Contract_ or a
  _Row Map_ that uses a schema accepts only the stored form. `data-protocol` uses the Instant
  schema for a _Backup_, so it depends on `time`.
- A wall-clock time has no seconds. A form that writes back an unchanged time would cut a
  timer's seconds; the time entry decides how to avoid that.
- Two spellings of one zone can stand in the database, such as `Asia/Calcutta` from one device
  and `Asia/Kolkata` from another. `sameTimeZone` treats them as one.
- A name a newer device stored and an older runtime does not know falls back to the device's zone
  on the older one, and the caller is told.
- Every function of `time` whose answer lies outside the supported years throws a `RangeError`:
  the first Instant of year 1000 has no day in New York, and 31 December 9999 plus one day is no
  day. A skipped day, such as 30 December 2011 in Apia, has an empty range.
- Three known limits follow from the decision and stay as they are:
  - **A day that is not one continuous range.** Until 2010 four zones turned the clock back
    across midnight: St. Johns, Goose Bay and Moncton from 00:01 to 23:01 of the day before, and
    Casey in March 2010. There an Instant's day can have a range that does not hold it: in St.
    Johns, `1987-10-25T03:00:00.000Z` is 24 October, 23:30, yet the range of 24 October ends at
    `1987-10-25T02:30:00.000Z`. Each day keeps one range. From 2011 on no zone does this, and the
    check program of `time` fails in a runtime whose zone data breaks a day again.
  - **A wall-clock minute that is only partly skipped** does not survive the way there and back.
    Monrovia skipped from 00:00 to 00:44:30 on 7 January 1972, so 00:44 counts as skipped and
    `instantAt` moves it on by the gap.
  - **31 December 9999 has no range**, because the day after it lies outside the supported years.
- Whether a past entry is shown in the zone it was made in or in the current one is the time
  entry's decision (D147). `time` carries both answers, because every function takes the zone.

## Considered Options

- **A duration in milliseconds:** rejected (D281). Unreadable, and it moves the rounding into the
  money arithmetic.
- **A duration in minutes:** rejected (D281). A 40-second timer would be zero or one minute.
- **Instants of one day as a closed range:** rejected (D281). An entry at midnight would belong
  to two days.
- **Silently applying the usual rule at a clock change:** rejected (D283). The correction in the
  repeated hour would lose an hour.
- **Throwing at a skipped or repeated time:** rejected (D283). Every caller would have to handle
  the error.
- **Our own list of zone names with an alias table:** rejected (D282). It answered an `Intl` error
  that `Temporal` does not have.
- **Accepting offsets as zones:** rejected (D282). An offset has no clock changes, so a day in it
  is wrong for half the year.
