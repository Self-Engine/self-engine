# Projects and time tracking in this app on 2026-11-23: what exists, what is planned, what is missing

Inventory date: 2026-11-23, at commit `08320f3e` of `main`. It is a snapshot and is not kept current: for what the code does today, read the code and the ADRs.

Written for [the map of time tracking beyond layer 4](https://github.com/Self-Engine/self-engine/issues/396).

**Short version:** the code covers plan layer 4 (Schicht 4) as decided and nothing beyond it. Projects have a title, description, icon and colour, plus archive and delete. Time entries are entered by hand or come from one timer, and there is one Week View. There is no money, no rounding, no reports, no project page, no list of all entries and no export. No open issue covers importing the old app's data; that work exists only as layer 5 in `docs/plan/roadmap.json`.

## 1. Data model today

Three module tables. All are STRICT and soft-deleted through `deleted_at`. Every one has `space_id` pointing at `spaces(id)` (DEFERRABLE INITIALLY DEFERRED). Foreign keys never use CASCADE or SET NULL (D306, #272).

**`projects`** (`packages/projects/src/data/migrations/0001.sql:2-13`)

- `id`, `created_at`, `updated_at`, `deleted_at`, `space_id`.
- `archived_at`: when it was archived; empty means active. Archived and deleted are independent states, and archiving locks nothing (D327, ADR 0031).
- `title TEXT NOT NULL`: 1–200 characters after trimming (`contracts/index.ts:14,24`). It is **not unique**, so two projects may share a title (D328, `0001.sql:1`).
- `description`: up to 10,000 characters; an empty one is stored as no value (`contracts/index.ts:16,25-30`).
- `icon`: an icon name or one emoji. `color`: a colour set name. Both are checked strictly on write and read back as stored text (ADR 0029).
- No rate, type, client, folder, favourite, tags, `custom` column or status field (D305).

**`time_entries`** (`packages/time-tracking/src/data/migrations/0001.sql:4-26`)

- `started_at`, `ended_at`: exact moments on whole seconds (CHECK `.000Z`), never rounded (D308, D344). CHECK `ended_at > started_at`.
- `duration_seconds INTEGER >= 0`: the Booked Duration, the time that counts. Today it is always end minus start, computed by the Operation in `storedTimes()` (`data/rows.ts:74-78`). It is never an input (D346). Rounding and pauses are meant to change only this number later (D308, D309).
- `project_id`: optional reference to `projects`.
- `note`: optional, up to 10,000 characters (`contracts/note.ts:4`).
- `time_zone TEXT NOT NULL`: the name of the zone in effect when the row was created. No answer returns it and nothing reads it (D342, D353, ADR 0038; not in `TIME_ENTRY_COLUMNS`, `rows.ts:55-62`).
- Indexes: by Space; by project for live rows (used by the reference check); `(space_id, ended_at)` for live rows (used by the week window).
- No paid flag, payout, category, tags, billable flag, or "made by a timer" column. Timer origin is only the shared id (D349 point 4).

**`timers`** (`packages/time-tracking/src/data/migrations/0002.sql:4-18`)

- `started_at` on whole seconds, optional `project_id`, optional `note`.
- Only the start is stored, so nothing is written while a timer runs.
- A stopped or discarded timer becomes a soft-deleted row. There is deliberately no unique index, so after a sync several timers may run (D310).

**Constraints across tables**

- The reference check in the storage frame (`packages/storage/src/core/reference-check.ts:11-18`, D337, D338):
  - It refuses to delete a project while a live entry or running timer points to it.
  - It refuses to create, edit or restore an entry or timer that points to a deleted or unknown project.
  - An archived project is a valid target (D330 rule 3).
- The entry created by a stop gets the timer's id (`timeEntryIdOfTimer`, D349).
- No "categories" table or other table exists. The only modules mounted are `projects`, `settings` and `timeTracking` (`apps/desktop/src/data-modules.ts:22`).

## 2. What a user can do with projects today

**Views**

- "Active" (`packages/projects/src/active.tsx`) and "Archive" (`archive.tsx`), registered in `projects/src/index.ts:34-45`.
- Each is a plain list: entry mark (icon and colour) plus title, nothing else (`project-list.tsx:37-50`). No hours, dates or counts.

**Sorting, search and filter**

- Only sorting by title, using the app language's collation with numeric order (`sorted-by-title.ts`). The database returns rows in creation order (`data/index.ts:21-22`).
- No search, filter or manual order in the lists.

**Empty states**

- Active: "No projects yet", with a "New project" button (`active.tsx:24-29`).
- Archive: "No archived projects" (`archive.tsx:20-24`).

**Create**

- Through the "New project" command (Mod+N), the primary action, or the empty-state button. It opens the Edit Drawer at `edit=new`.
- An "input" command `create-project` exists for a later assistant (`index.ts:8-21`).

**Form fields** (`edit-drawer.tsx:279-282`): Title, Description, Icon (icon or emoji picker), Color.

**Edit**

- In the Edit Drawer. It sends only changed fields (D323, D329).
- An archived project can be edited like an active one.

**Archive / Unarchive**

- Named actions in the drawer, each with a Notice offering Undo (`with-undo.tsx`). Archiving twice changes nothing (D327).

**Delete / Restore**

- Delete is a soft delete with a Notice offering Undo, which calls `restore` and brings the project back as it was, archived or not.
- When time entries or a running timer refer to the project:
  - The drawer shows Delete as blocked when it opens (`ClearanceAction`, `edit-drawer.tsx:236-251`).
  - The refusal Notice offers "Archive" instead (`edit-drawer.tsx:151-158`, D306, D336).

**Detail view**

- None. There is no project page (D313). The only way into a project is the Edit Drawer.
- A project's time is visible only by filtering the Week View through the "Projects" group in the time module's sidebar (D313).

**Project picker** (`packages/projects/src/picker/index.tsx`)

- Shows active projects only, searchable, with mark and title.
- A stored choice that is archived or deleted shows as "Title (archived)" or "Title (deleted)".
- It cannot create a new project (deferred, D327–D330 "Vorgemerkt").

## 3. What a user can do with time entries today

**Views**

- Only "Week" (`packages/time-tracking/src/week.tsx`): seven days stacked, with a sums panel beside them that moves below on narrow windows.
- Previous week, "Today" and next week buttons.
- The address holds `week=<first day>` except for the current week (D367), plus `project=<id|none>` when filtered.
- No day, month or list View, no calendar grid ("kein Zeitraster" was chosen in round 45), and no reports.

**Grouping in the week** (`week-day.tsx`, `data/group-days.ts`)

- Each day shows its date, a "Today" badge, a "New" button that creates an entry on that day, and the day total.
- Each entry row shows start–end in the app's time zone, a "Crosses midnight" icon, an "Overlaps another entry" icon, the project mark and title (or "No project"), the note truncated to one line, and its Day Share.
- Entries are sorted by start.

**Totals**

- A day total per day.
- Week totals per project, largest first with "No project" last, and a week total (`week-sums.tsx`, `contracts/days.ts:53-70`).
- All totals are added in seconds and rounded **up** to the full minute only for display (`time/src/format.ts:87-113`, D345). Displayed parts can add up to a different displayed total.

**Filter**

- The sidebar group "Projects" lists All, the active projects, and No project (`projects-group.tsx`).
- The View's own filter adds an "Archived projects" section (`week-project-filter.tsx`).
- The filter applies to both the list and all sums. Overlap marks still take hidden entries into account (`group-days.ts:57-66`).

**Form** (`edit-drawer.tsx:226-261`)

- **Time:** one date, a start time and an end time, with the duration shown below.
  - An end time not after the start lands on the next day ("+1"). An end date can be opened for longer ranges.
  - Time zone handling: a repeated hour is resolved automatically and labelled at the field; a skipped time blocks the save (D347, D361, D366; `forms/src/time-range-field.tsx:111-119`).
  - Fields work in minutes. A part the user does not touch keeps its seconds.
- **Project:** the picker, clearable.
- **Note:** long text.
- A new entry starts on the clicked day or today, with empty times.
- No maximum length; future entries are allowed (round 45 proposals).

**Validation rules**

- The end must be at least one second after the start: `END_BEFORE_START`, "The end must lie after the start." (`contracts/index.ts:45-64`).
- An edit must send start and end together (`start_and_end_together`).
- Overlaps are valid data and only marked (D311).
- Saving with a project deleted meanwhile shows "The linked project is no longer available." at the project field (D368).

**Edit / Delete**

- Edit happens in the drawer. **Edits have no undo**; only delete does.
- Delete shows a Notice with Undo. The undo is refused if the project was deleted meanwhile, and the Notice names the entry as "Project, start" (`edit-drawer.tsx:89-150`).
- An entry that crosses midnight is always edited or deleted as a whole.

**Midnight and time zones**

- An entry stays one row and appears on every day it touches, each with its Day Share. The shares add up to the duration (`data/day-shares.ts`, D343).
- Days and weeks follow the current Time Zone setting. Changing the zone can move past entries to other days (D342, ADR 0038).
- The week query accepts at most 42 days (`contracts/days.ts:9`).

**Commands**

- "New time entry" (Mod+N, primary action), opening the drawer on today.
- `create-time-entry`, an input command for an assistant.

## 4. The timer today

**Where it is visible**

- A Module Indicator in the header on every page, including Settings (D314, D357, ADR 0037, header from #394).
- Full form: project mark and title, running time as h:mm:ss, Stop button.
- Short form (narrow window or phone): time and Stop.
- With no timer running it shows "Start timer" (`indicator/index.tsx`).
- The running timer does not appear in the Week View.

**Start**

- From the indicator or the palette's "Start timer". Both start **without a project or note**.
- "Toggle timer" with Mod+Shift+K.
- Starting with a project exists only as the assistant input command `start-timer-for-project` (`index.ts:25-57`). **No UI starts a timer directly on a project**; the user starts one, then sets the project in the panel.
- The start time comes from the Data Process's clock, cut to the whole second (D348).

**Stop**

- One click on the indicator, the "Stop timer" command, or "Toggle".
- The stop creates the entry and soft-deletes the timer in one transaction. The Notice "Time entry saved" offers Undo, which lets the timer run again as its own Operation (D349, ADR 0039).
- Stopping in the same second the timer started discards it: "nothing was saved" (D344).
- If the clock lies before the start, the timer keeps running and the Notice offers "Edit timer" (D372).

**Editable while it runs** (Indicator Panel, `indicator/panel.tsx`)

- Project, note and start. A start in the future is refused (`START_IN_FUTURE`).
- "Stop at …" takes an end after the start and not after now. This is the fix for a forgotten timer.
- "Discard" removes the timer, with Undo.

**One timer or several**

- One timer at a time, enforced by the flow, not a rule: start, undo-stop and undo-discard all stop every other running timer first and report it (D310, D349).
- After a sync several may run. The indicator then shows the most recently started one with a count badge (D310).

**Restart**

- Only the start is stored, so the timer keeps running while the app is closed and reappears after a restart.

**Rounding**

- None. Only the running timer shows seconds; stored entries keep whole seconds and are displayed rounded up to the minute.

**Not present**

- No pause or phases, no Pomodoro, no idle detection, no reminder for a timer left running, no OS menu-bar or tray presence, and no shortcut that works when the app is not focused.

## 5. Money

- **There is none.** No hourly rate, currency, earnings, billable flag, paid state or payouts anywhere in `packages/` or `apps/`.
- There is no `money` package (#105 is open).
- Decided on purpose: D305 (a project has neither type nor rate in layer 4), D308 (no rate and no paid state on an entry), D22 (payouts go into a link table later, not `paid`/`payout_id` on the entry).

## 6. Decided or planned but not built

- **D309:** rounding per project lives in a `time-tracking` table and applies to private projects too. It changes only `duration_seconds`.
- **D345 and round 45 "Vorgemerkt":** a rounding setting like the old app's (interval; up, down or nearest; time slices; priority timer > project > settings), default "round up to 1 minute".
- **D343:** a setting for whether an entry over midnight is split across days or counts entirely for its start day. The rounding work package also has to decide how a rounded duration splits across days.
- **D346:** a duration set by hand, together with pauses.
- **D342:** showing, computing with or changing an entry's stored Time Zone.
- **D311:** a setting for whether overlaps are allowed, app-wide and per project (stored with the rounding rule). Also flows to resolve overlaps (record only the free time, split an entry) and a "covered time" figure.
- **D303 / plan "Nach Schicht 4":** pauses and phases, time classes and categories, shared time, Pomodoro, parallel timers, series, a daily limit, a heatmap and statistics.
- **D313 / #201:** a project page where other modules contribute sections. Known cases: a recorded-time card, an hours column in the project list, "start timer" in a project row's menu, per-project time rules inside the project form.
- **Plan, projects:** folders, favourites, manual order, tags (#111), clients as a module below `projects`, tasks as a module above it, and the `custom` column for user fields (D22).
- **D328:** a non-blocking hint "Another project already has this name".
- **D327–D330 "Vorgemerkt":** creating a new project from inside the picker.
- **D305 / plan "Abrechnung":** rate, currency, fixed price and employment as billing terms, the paid state and payouts, with `money` (#105) and finance.
- **D331:** a protection rule registered by a bridge, "a paid-out time entry cannot be deleted". It first needs the release mechanism from D341.
- **D306 / D316 / D338:** a trash with final deletion, retention periods and a "Deleted" View. The owner decides there whether a project's entries are deleted with it ("geht mit", with a warning). The trash would also clean up the soft-deleted timer rows (D310), which removes the timer origin of entries (D349 price).
- **Round 45 / #137:** a list of all time entries, ordered by start.
- **Layer 5 import (D12, D84, D316, roadmap):** a repeatable import from the old app, starting with projects and time entries. It reads the old app's current schema and aborts on a version mismatch. Open: it must write through the same Operations or be checked afterwards (D307).
- **Sync phase:** a data check that finds broken rules after a merge (D307, D331), and what happens when two devices have different clocks (round 45).
- **D357–D360:** what happens when several indicators do not fit (decided with the second user).

## 7. Open issues in these areas

| #   | Title                                                                                                             | Labels                   | Content                                                                                                                                                                                                                         | Blocked?                                        |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 377 | Popovers of the date and time fields cover the message after a blocked save, and Escape leaves the time list open | needs-grilling, layer:4  | After a blocked save the focus opens a calendar or time list over the error; Escape does not close Mantine's TimePicker list. The issue says no form used these fields yet, but the time entry form and the timer panel now do. | Not blocked; needs grilling                     |
| 392 | Show a Module Indicator as soon as its code has arrived, without the 300 ms wait                                  | ready-for-agent, layer:4 | The timer indicator appears about 300 ms after its code arrives, probably held back by Suspense.                                                                                                                                | No                                              |
| 201 | Extension points between modules in the UI                                                                        | needs-grilling           | The project page and contributions from other modules (time card, hours column, start-timer action, per-project rules). Deferred until a second module shows project data (D313).                                               | Waits for a second module (tasks or billing)    |
| 137 | Virtualized list for page queries                                                                                 | layer:2, needs-grilling  | Shared long-list building block. Its first user is the list of all time entries.                                                                                                                                                | Not blocked; needs grilling                     |
| 111 | `tags` package with module bridges                                                                                | layer:3, needs-grilling  | Tags attached to entries through per-module link tables; builds the "stays" kind of reference (D338).                                                                                                                           | Lists #108 and #33 as blockers; both are closed |
| 105 | `money` package                                                                                                   | layer:3, needs-grilling  | Currency catalogue, amounts in minor units, one earnings formula (rate × seconds / 3600), default currency setting. Needed for billing.                                                                                         | No                                              |
| 103 | Shared core: time, money, spaces and tags                                                                         | layer:3                  | Parent spec for #105 and #111.                                                                                                                                                                                                  | —                                               |
| 214 | Remove a module together with its tables                                                                          | needs-grilling           | Needed once a real module with user data is retired. Until then databases may be set up again (D315).                                                                                                                           | No                                              |

Generic Edit Drawer and command issues that also touch these modules: #132, #297, #308 (drawer behaviour) and #149, #150, #153 (commands and agents).

**Import from the old app:** no open issue. It exists only as layer 5 in `roadmap.json` and in plan `07` ("Import", "Offen").

## 8. Deferred or rejected ideas (do not re-propose without knowing)

**Rejected**

- A second stage of layer 4 with rate, rounding and earnings (D303).
- One package `work` for both modules; the timer as its own package (D304).
- An optional rate and currency on the project now; the old app's fixed project "type" (D305).
- Deleting a project any time without a lock; a lock written in each module separately (D306).
- Storing rounded times; storing only start and end and rounding when displaying (D308).
- An app-wide rounding rule in layer 4; rounding as part of the billing terms (D309).
- An open time entry without an end as the timer; permanent timer slots per project like the old app (D310).
- Refusing overlapping entries in the database or Operation (D311).
- A project page with an extension point already in layer 4 (D313).
- Unique project titles, either among all projects or among active ones (D328).
- A separate query for "active projects plus this one id" for the picker (D330).
- Computing day, time and week in the entry's own time zone; storing only the calendar day (D342).
- Counting an entry over midnight entirely for its start day or end day; splitting the row on save; making the choice configurable in layer 4 (D343).
- Keeping milliseconds; storing whole minutes (D344).
- Rounding the counted duration up in layer 4; truncating durations in the display (D345).
- A duration field in the form (D346).
- Asking the user at a clock change; silently shifting a skipped time (D347).
- A column marking that an entry came from a timer; a new id for that entry; refusing undo while another timer runs (D349).
- "Stop at …" accepting an end after now when the clock jumped back (D372).
- Indicator in the navbar or a status bar (D357); the module opening its own popover (D358).

**Deferred, with a decision number**

- Rounding settings (D309, D345); the midnight setting (D343); manual duration with pauses (D346); showing or editing the entry's time zone (D342).
- The overlap setting and resolution flows (D311).
- Billing terms, paid state and payouts (D305, D331, D341).
- The trash, a "Deleted" View, and deleting entries together with their project (D306, D316, D338).
- The project page and extension points (D313, #201).
- The duplicate-title hint (D328); creating a project from the picker (D327–D330).
- Clients, tasks, folders, favourites, manual order, tags, `custom` fields (D303, plan, D22).
- Shared time, Pomodoro, parallel timers, series, daily limit, heatmap and statistics, appointment linking (D303).
- Configurable order or hiding of indicators (D314, D357–D360).

## 9. Gaps nobody has written down

None of these appear in the code, the plan or any issue:

1. **Reports and export.** No CSV or PDF export of time, no report over a month, year or custom range, no timesheet for a client. Statistics and heatmap are planned (D303); export and timesheets are not.
2. **Other time ranges.** No day, month or custom-range totals; the query allows up to 42 days, but only the week is used. There are no all-time totals per project, and no hours in the project list (the cost of D313).
3. **Starting a timer on a project from the UI.** It only works through the assistant command or by editing the timer afterwards. Also missing: "start again" from an existing entry, recent projects for one-click start, duplicating an entry.
4. **Search.** No search over notes or entries, and no project search in the list.
5. **Bulk actions.** Nothing selects several entries to move to another project, delete, or (later) mark as paid.
6. **Undo for edits.** Only deletes, stops and discards can be undone; an edit to an entry or project cannot.
7. **Help with a forgotten timer.** Only "Stop at …" exists. No idle detection, no reminder after N hours, no warning on quit while a timer runs.
8. **OS presence.** No macOS menu-bar or Dock display of the running timer, no shortcut that works when the app is in the background, no OS notifications.
9. **Goals and targets.** No daily or weekly target hours or overtime. The planned "daily limit" is close, but there are no targets.
10. **Project budgets and lifecycle.** No estimated hours or budget, no start, end or deadline dates, and no status beyond active/archived.
11. **Billable versus paid.** The plan has a paid state through billing, but no "billable / non-billable" mark per entry or project, which a freelancer needs before invoicing.
12. **Locking past periods.** Nothing locks entries once a period has been invoiced, apart from the planned "paid-out entry cannot be deleted" rule.
13. **Faster entry.** No quick add or natural-language entry ("2h design yesterday"), no copying the previous day or week, no templates.
14. **Import details.**
    - The old app stores already-rounded periods (D303 research), so the import cannot recover measured times; nothing says how those rows map onto `duration_seconds` and the stored times.
    - Old categories, paid flags and payouts, per-project rounding, up to ten per-project timers, folders, favourites and contacts have no target yet.
    - Old timers running at import time have no stated handling.
    - The old app's interface for agents still exposes time categories, a time entry created from an appointment, and work summaries. These are features the new app has no place for yet.
