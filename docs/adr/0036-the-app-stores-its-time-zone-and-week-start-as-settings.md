---
status: accepted
date: 2026-11-20
decisions: D147, D153, D353, D354, D356
---

# The app stores its Time Zone and Week Start as Settings

## Context

A traveler may want the app to keep counting days in their home Time Zone. A Data Process
call needs the user's choice even before a page opens. The Week Start can follow the
App Language, which the page resolves.

## Decision

**The package that owns a value declares its Settings.** Both the Data Process and the
page load `@self-engine/time/settings`. It holds the declarations, small schemas and pure
resolution and offer logic. The entries for Settings and React may import `settings`.
`time-imports-no-package` keeps the rest of `time` free of workspace imports.
`time-settings-entry-is-small` keeps React, Mantine and the full Zod build out of the
Settings entry's dependency tree.

| Setting                   | Key                       | Scope  | Value                                                                               | Default     |
| ------------------------- | ------------------------- | ------ | ----------------------------------------------------------------------------------- | ----------- |
| Time Zone                 | `time.zone`               | Synced | Zone name or `null`                                                                 | `null`      |
| Follow Device             | `time.followDevice`       | Synced | On or off                                                                           | Off         |
| Week Start                | `time.weekStart`          | Synced | `automatic` or a day name ([ADR 0035](0035-calendar-weeks-start-on-a-named-day.md)) | `automatic` |
| Time Zone Offer dismissed | `time.zoneOfferDismissed` | Device | On or off                                                                           | Off         |

**On desktop, the Data Process seeds a missing Time Zone row before serving calls.**
Desktop composition supplies the Device Time Zone as the start value and as a source,
like the Clock. Startup leaves existing rows alone, including an existing `null` value.
The standalone web app uses the local Settings adapter and starts with an unset Time Zone
until the user chooses one. See [ADR 0010](0010-settings-are-single-entries-behind-an-asynchronous-port.md)
for storage and start values.

**Both sides resolve the stored name through `resolveTimeZoneSetting`.** A known name
gives the resolved Time Zone (`none`). An unset value (`notSet`) or a name the runtime
does not know (`unknownName`) uses the Device Time Zone. A fallback leaves the Setting
as it was. The Data Process reports each unknown name once per start. The page reports
each once per provider lifetime when a View reads it.

- An Operation or Query that needs the Time Zone calls `context.readTimeZone(tx)`. It reads
  the Setting in the call's transaction and resolves it with the injected Device Time Zone.
  A Query declares `SETTINGS_TABLE` in its reads so the Table Change reloads it.
- The page supplies `TimeSettingsProvider` with the loaded settings store, the Device Time
  Zone at page start and the active App Language's Region. Views read `useTimeZone` and
  `useFirstDayOfWeek`. Both follow the store. Only the page reads the Week Start Setting.
  With `automatic`, the first day follows the Region from `regionForAppLanguage`, using the
  mapping in [ADR 0035](0035-calendar-weeks-start-on-a-named-day.md). The caller can use
  that day to compute a Day Span for a Query.

**The page checks for a Time Zone Offer at startup and when it becomes visible.**
`decideZoneOffer` compares zones through `time`, so aliases of the same zone agree.
An unset or unknown name also produces no offer or write. For a different known zone,
Follow Device writes the Device Time Zone without asking. Otherwise, the Device Setting
controls whether a Notice names both zones and offers “Switch” and “Don't ask again”.
“Switch” saves the Device Time Zone and shows a confirmation with “Undo”.
“Don't ask again” saves the dismissal on this device. An open offer follows Settings
changes, so an answer in another window can withdraw it.
The startup check uses the store's current snapshot. If the database answers later and no
offer is open, the next visibility check picks up the new value.

**The Settings Rows live in “Language and region” at the existing Language address.**
The Time Zone picker searches by place and UTC offset and is disabled while Follow Device
is on. It builds its choices from the runtime's names plus `UTC`, keeping the displayed
zone's spelling. The startup check keeps `@self-engine/time/zone-list` out of the startup
bundle. The Week Start row offers Automatic, Monday, Sunday and Saturday and also displays
another day when one is stored.

## Consequences

- A device with older zone data can still show days and times and keep the user's choice.
- A change of Time Zone can move an Instant to another Calendar Day when displayed.
  A stored Calendar Day keeps its value.
- Tests can inject a Device Time Zone into the Data Process. Stories can set the Time Zone
  and Week Start in their own store.

## Considered Options

- A declaration in `contracts` would create a cycle when a module imports its own Setting
  through the aggregate that imports the module's Contract.
- Seeding from the page would let a Data Process call run before the first write.
- Resolving Automatic in the Data Process would require it to resolve the App Language
  and carry the page's system language inputs.
