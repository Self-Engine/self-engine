# The old app's projects and time tracking: data model, features, rules and loose ends

Inventory date: 2026-11-23. Source: the old Self-Engine app's repository, read only. It describes that code at that date and is not kept current.

Written for [the map of time tracking beyond layer 4](https://github.com/Self-Engine/self-engine/issues/396). The old app is one option among several there, never the starting proposal.

Paths below are relative to the root of the old app's repository. **W** means reachable in the web UI (the Electron desktop app runs the same web app), **M** reachable in the mobile (Expo) UI, **D** desktop-only. "Schema only" means present in the schema or code but not reachable by a user. The schema, the project form and the settings were read directly. Three parallel read-only passes covered the timer, the time-entry forms, and the views and payouts; their surprising claims were spot-checked, but not every line reference was verified again.

Short forms: `T` = `packages/db/src/core/supabase.types.ts`, `db/work/` = `packages/db/src/entities/work/`, `TE/` = `db/work/time-entry/`, `TT/` = `db/work/time-tracker/`, `ST/` = `db/work/shared-time/`, `web/tt/` = `apps/web/src/features/time-tracker/`, `WTE/` = `apps/web/src/features/projects/work-time-entry/`.

---

## 1. Data model

Stack: Supabase Postgres, synced to local SQLite with PowerSync. `GLOSSARY.md` ("Work tracking", "Finance") defines every term used here.

### `work_project` (T:2828)

- **`title`**, **`description`**: name and description.
- **`type`** (`hobby | hourly | project | employment`, T:3754). It cannot be changed after creation (`apps/web/src/features/projects/project/form/ProjectFinanceSection.tsx:130,200`).
- **`salary`** (money): the hourly rate. It is set only for `hourly`. A DB check ties the type to its money fields: hourly → `salary` set; project → `finance_project_id` set; hobby → nothing; employment → `recurring_cashflow_id` (`supabase/migrations/20260725000200_work_project_salary_cashflow.sql:36-42`).
- **No currency column.** The project's currency is the currency of its bank account (`bank_account_id`, money). Bank-account currency is fixed. When editing, the form only offers accounts of the same currency (`apps/web/src/features/projects/project/form/ProjectForm.tsx:356-364`).
- **`finance_project_id`** (money): the fixed-price link to `finance_project`.
- **`recurring_cashflow_id`** (money): the salary cashflow of an employment project.
- **`contact_id`**: the client (`contact` table).
- **`color`**, **`icon`**: Phosphor slug or emoji.
- **`work_folder_id`** and **`order_index`**: position in the folder tree.
- **`is_favorite`**, **`favorite_order`**: favourites, used only in the timer picker.
- **`is_private`**: privacy mode.
- **`archived_at`**: archived when set.
- **`default_time_category_id`**: required.
- **Rounding override:** `rounding_interval`, `rounding_direction` (up/down/nearest), `round_in_time_fragments`, `time_fragment_interval`. All NULL means "use the global settings".
- **`work_project_tag`** (T:2952) links projects to `tag` (T:2328). A tag has title, description, and `modules` (empty means every module).

### `work_folder` (T:2790)

- `title`, `description`, `parent_folder` (nested folders), `order_index`.
- No archive state of its own.

### `work_time_entry` (T:3020)

- **`start_time`**, **`end_time`**: Instants, i.e. exact moments.
- **`active_seconds`**: the stored **Booked duration**, after rounding and minus Rest breaks. Every total, earning and payout is computed from it.
- **`work_project_id`**: optional. A project-less entry books 0, has no rounding or pay, and the DB enforces this (`supabase/migrations/20261013002000_project_less_time_entry.sql:14-27`).
- **`time_category_id`**: required.
- **`memo`**.
- **`task_id`**: set only when a timer submits; no form edits it.
- **Pay snapshot** (money): `hourly_payment`, `salary`, `currency`, copied from the project when the entry is created. A DB check: `hourly_payment=true` requires salary and currency, `false` requires both to be NULL (`supabase/migrations/20260331000200_harden_work_project_type.sql:26-31`).
- **Payment state** (money): `paid` and `payout_id`. The entry counts as paid when either is set (`TE/time-entry.payment-state.ts:25-32`).
- **`shared_time_id`**, **`time_share`**: membership in a Shared time.
- **`time_fragments_interval`**: the fragment size that was applied.

### Related time tables

- **`work_time_entry_phase`** (T:3119): `time_entry_id`, `time_category_id`, `start_time`, `end_time`. Phases split an entry into stretches, e.g. breaks. A DB check and deferred triggers keep phases inside the entry and non-overlapping (`supabase/migrations/20261013001000_time_entry_phase.sql`).
- **`work_shared_time`** (T:2991): `lead_project_id` only. Its members are the entries pointing to it.
- **`time_category`** (T:2536): `title`, `time_class`, `position`, `archived_at`.
  - The Time classes are fixed: `focus | active | short_break | rest_break | leisure` (T:3751).
  - There is no colour or icon field; the colour comes from the class.
- **`calendar_event_time_entry`** (T:661): link between an entry and an appointment, with `relation_type` (`derived_from | tracked_during | manually_linked`).
  - An entry has at most one appointment (ADR 0022).
  - `calendar_event.linked_work_project_id` (T:498) attaches an appointment to a project.

### Timer tables

- **`time_tracker`** (T:2569):
  - `work_project_id` (optional), `state` (`running | stopped`), `start_time`.
  - `delta_start_time` / `delta_end_time` (seconds, manual adjustments).
  - `memo`, `task_id`, `calendar_event_id`, `time_category_id`, `order_index`.
  - Per-timer rounding override: the same four fields as on the project.
  - `time_share` (the lead project's share in a Shared Timer).
  - `submission_block_reason` (`pending-overlap-resolution | daily-booking-limit`).
  - `pomodoro_*` session overrides. The legacy Pomodoro state columns are written but never read (`TT/time-tracker.executors.ts:635`).
- **`time_tracker_member`** (T:2694): the further projects of a Shared Timer, with `time_share`.
- **`time_tracker_phase`** (T:2739): `time_category_id`, `start_time`, `end_time` (empty while open), `planned_duration_seconds`, `pomodoro_step`.

### Money tables

- **`payout`** (T:1686): `work_project_id`, `source_value`, `source_currency` (the frozen value of the work), `revision`, `adjustment_reason`. It owns exactly one cashflow, the amount actually received (ADR 0016).
- **`finance_project`** (T:1042): the fixed-price counterpart. Fields: `start_amount`, `bank_account_id`, `contact_id`, `paid`, `is_linked`, due date or day range, `single_cashflow_id`.
- **`finance_project_adjustment`** (T:1118): `amount`, `paid`, `is_already_included`, `single_cashflow_id`.

### Other related tables

- **`contact`** (T:937): person or company, with address, `tax_id`, `vat_id`, `currency`.
- **`habit_project_integration`** (T:1384): links a habit to a project, with `quantity_mode` (minutes | count).

### Unused enums (schema only)

- `roundingAmount`, `timeSectionInterval` and the old `appointment-type` (T:3744-3752).
- `projectType` (`hourly | project | hobby`) still types `settings.default_project_type`, so "employment" cannot be the default type.

---

## 2. Project features

### Create and edit (W modal and drawer; M screen)

Form: `apps/web/src/features/projects/project/form/ProjectForm.tsx`; mobile: `apps/mobile/src/features/work/schemas/ProjectForm.schema.ts:18-48`.

- **Details:** name (required) and description.
- **Finance:**
  - Project type with explanations: Hourly / Fixed price ("project") / Employment / Hobby (`ProjectFinanceSection.tsx:134-188`).
  - Hourly: "Hourly payment" (required, > 0) plus bank account (required) plus contact.
  - Fixed price: either link an existing unlinked finance project, or enter a "Project salary". That amount creates a new `finance_project` with `start_amount` = the amount (`db/work/project/project.executors.ts:64-90`).
  - Employment: "New salary" (monthly amount, payday 1–31, start date, bank account, employer contact) creates a recurring cashflow; "Existing salary" picks one. A past start date backfills earlier payments (`ProjectFinanceSection.tsx:390-601`; `db/work/project/project.employment.ts`).
- **Configuration:** colour swatch, icon picker, tags (multi-select with "add new"), default Time category (`ProjectConfigurationSection.tsx:75-170`).
- **Rounding:** "Use rounding from settings" switch. When off, the user sets interval in minutes, mode, and "Round in time fragments" plus fragment interval (`ProjectRoundingSection.tsx:22-69`). Leaving it on stores NULLs (`project.form-model.ts:354-359`).
- **Defaults for a new project:** type, rate and bank account come from settings (`project.form-model.ts:214-316`).
- **Folder:** mobile can pick a folder in the form. Web always creates at the top level (there is a TODO at `ProjectForm.tsx:314`); the user then drags the project into place.
- **Rate change on an hourly project** shows a dialog with three choices (`db/work/project/project.workflows.ts:108-148`; `actions/use-project-update-action.ts:245-268`):
  - "Do not update existing time entries" (the default);
  - "Update all unpaid time entries";
  - "Update from date and time".
  - Paid entries are never changed. Without the sync, an edit keeps the rate an entry was booked at (commit `891dd1dec`).

### Archive, restore, delete (W tree menu, detail menu; M swipe and detail)

- **Archive** sets `archived_at`. The project then leaves the tree and the overview and becomes frozen: no edit, no new entries, appointments, payouts or mark-paid, and the entry list is read-only. A timer that is already running can still be submitted. Restore is in the "Archived" section at the bottom of the sidebar (`apps/web/src/features/projects/shell/ArchivedProjectsNavbarSection.tsx:28-71`).
- **Delete is blocked** by a running timer, a pending timer, tasks, time entries or payouts. In those cases the dialog offers "Archive" instead (`db/work/project/project.guards.ts:182-200`; `actions/project-delete.ts:45`). The server checks again.
- Deleting an employment project asks whether to deactivate or keep its salary cashflow (`project-delete.ts:85-131`).

### Folders

- W: create (title, description, top level), rename inline, drag and drop to reorder or nest. Deleting a folder moves its contents up one level (`db/work/folder/folder.guards.ts:21-52`).
- M: create, edit (including the parent folder) and swipe-delete (`apps/mobile/src/features/work/components/ProjectsTab.tsx:117-172`).

### Sidebar tree (W) — `apps/web/src/features/projects/shell/ProjectTree.tsx`

- Fuzzy search (`?q=`); folders expand while searching.
- Drag to reorder.
- Context menu: Edit, Rename, Move to…, Archive, Open in workspace tab, Delete.
- Keyboard shortcuts.
- **No user sort and no filters.** Favourites are not shown in the tree; they appear only in the timer project picker as Favourites / Recent / All (`db/work/project/project-picker.ts:29`).

### Overview page (W, "Review" or "List") — `apps/web/src/features/projects/overview/`

- **Toolbar:** This week and This month (hours and earnings), Open amount, number of active projects (`db/work/project/use-project-overview-query.ts:119-156`).
  - Earnings = Σ snapshot salary × booked hours. Each entry counts on the day it starts.
- **List:** cards sorted by last activity.
  - A card shows icon, title, type badge, rate, description, up to 2 tags, open amount per currency (hourly projects) or salary and next payday (employment), total time, entry count and last activity (`ProjectCard.tsx`).
- **Auto-hide rule:** a project is hidden when it has been inactive for more than 3 months AND it is a hobby project or a fully paid hourly project. Only the hidden count is shown, and the user cannot reveal them (`use-project-overview-query.ts:90-111`).
- **Review:** heatmap, typical working hours, and last 30 days across all projects.

### Project detail

Files: `apps/web/src/features/projects/detail/`; mobile `apps/mobile/src/features/work/screens/ProjectDetailScreen.tsx`.

- **W views:** Review (the default), List, Appointments, Tasks.
- **Period filter** with presets: 7 days, this week, previous week, this month, previous month, last 3 months (`shell/ProjectFilterPanel.tsx:18-32`).
- **Hero card:** rate badge, timer row, and Total time / Active days / Avg per day / Best streak (`ProjectDetailCard.tsx:184-201`).
- **There are no earnings on the hero card.** Money appears only in the list totals and in the header.
- **Header** (`apps/web/src/components/app-shell/header/WorkHeader.tsx:65-106`):
  - Hourly: the rate.
  - Fixed price: total value plus an implied rate = total value ÷ booked hours.
  - Employment: the salary.
- **Analysis** (`packages/core/src/helper/workHelper/projectAnalysis.ts`):
  - A heatmap per year. Clicking a day opens a create dialog for that day.
  - An "hourly work" chart: average minutes per hour of the day.
  - Last 30 days compared with the previous 30.
  - Entries are split at midnight in the Account timezone, with booked seconds divided in proportion.
- **M:** tabs Detail, Entries, Appointments, Review. **Appointments and Review are "coming soon" placeholders** (`ProjectDetailScreen.tsx:125-137`).

---

## 3. Time-entry features

### Where entries are created and edited

- **W full form** (`WTE/form/TimeEntryForm.tsx`): opened from the project list, the `n` hotkey or the command palette, and the calendar. Edits open in `WTE/EditTimeEntryDrawer.tsx`.
- **W quick capture** (`apps/web/src/features/capture/TimeEntryCaptureForm.tsx`): global capture and the desktop tray.
  - Fields: project, date, start, end, memo. One day only; defaults to the last hour.
  - Always rounds; no Time category and no phases.
- **W calendar:** selecting a past range creates an entry. Dragging or resizing an entry saves it with project rounding.
- **M** (`apps/mobile/src/features/work/screens/TimeEntryFormScreen.tsx`, `TimeEntryDetailScreen.tsx`):
  - Fields: start, end, duration presets 15–120 min, project or a "without project" switch, category, phases, memo, Shared time.
  - Always rounds. No series, no appointment field, no exact saving.

### Fields and rules

- **Start, end, and "Active time":** the duration is editable and moves the start (or the end). Values snap to whole minutes (`WTE/form/time-entry.form-model.ts:218-285`).
- **Validation:** start may not be in the future; active time ≥ 1 s. There is no minimum duration and no maximum length.
  - An edit that would round to 0 minutes is rejected (`TE/time-entry.executors.ts:1221-1227`).
  - **Gaps:** the web form and the create path have no explicit end-after-start check, and a create that rounds to 0 is not rejected. Mobile, the calendar and the AI tools do check end after start.
- **Phases** (`WTE/form/TimeEntryPhasesSection.tsx`): rows with category, From and To. Rest-break phases do not count toward Booked duration.
- **Memo**, and a **Time category** that follows the project's default until the user picks one.
- **Project-less entries** (W, M): for lunch or leisure. They book nothing.
- **Move to another project** (single entry only): if rounding would change the interval, a dialog offers "apply rounding / keep exact / cancel". The entry takes the new project's pay snapshot. Not allowed for archived projects, Shared-time members or paid entries.
- **Appointment link** (W): a combobox with ranked "Matching" suggestions. Choosing another project's appointment switches the entry's project.
- **Rate and currency:** shown read-only (`WTE/form/TimeEntryFinanceSection.tsx`). **There is no per-entry rate override** (`TE/time-entry.guards.ts:51-54`). There is also no "billable" flag separate from the project type.
- **Paid:** a paid or payout-linked entry is fully read-only and cannot be deleted. A notice says how it was paid (via payout or marked paid) or that a pending payout reserves it (`WTE/TimeEntryPaymentNotice.tsx`, `TE/time-entry.guards.ts:110-147`).

### Delete

- Delete is **permanent: no trash, no undo** (`TE/time-entry.executors.ts:1757-1831`).
- Refused for paid entries and entries of archived projects. Linked appointments only produce a warning.

### Bulk actions (W project list, selection mode)

- Shift-click selects a range; checkboxes on a month or day header select the group (`apps/web/src/hooks/useTimelineSelection.ts`, `apps/web/src/features/projects/shell/ProjectSelectionPanel.tsx`).
- Actions: **Pay selection**, **Mark as paid** (one-way, "cannot be undone"), **Delete selection** (with a review).
- **"Edit selection" only shows "Coming soon..."** (`ProjectSelectionPanel.tsx:77-104`).
- No bulk move and no "mark unpaid".

### Missing operations

- Duplicate, manual split, manual merge: **not found.**
- Splits happen only as a side effect of overlap choices.

### Series (W only)

- "Create as series": the same clock times on several dates picked in a calendar (no future dates and no repeat rules).
- Phases and the appointment are dropped. Everything is written in one transaction.
- A review dialog appears per date when a date conflicts (`WTE/overlap-decision/OverlapSeriesDecisionContent.tsx`; `TE/time-entry.series.ts`).
- An overnight series (end time before start time) is not guarded against.

### Overlaps (ADR 0012) — `TE/time-entry.conflicts.ts:326-366`

- **Settings:** "Check overlaps across all projects" (`overlap_across_projects`) and "Allow overlapping time entries" (`allow_time_entry_overlaps`). Both default to off. Project-less entries always conflict with everything.
- **Options in the decision dialog:**
  - **Only capture free time**, the default. The candidate is rounded first; then the uncovered parts are saved exactly, with no minimum fragment size.
  - **Allow overlap**, only when the setting is on.
  - **Capture as shared time**, when eligible.
  - **Save complete interval anyway**, when the new entry is fully covered.
- **"Way out" dialog** (single-entry creation only, when every conflicting entry starts earlier): "Shorten the earlier entry" or "Split the earlier entry around the new one" (`TE/time-entry.overlap-decision.ts:457-566`).
- **Web modal:** a timeline with lanes and the overlap hatched; keys 1–3 choose an option, Enter confirms. Mobile shows a text alert or a selection sheet.

### Shared time (ADR 0025) — W and M

- One interval worked for several projects at once. Each project gets its own entry, and the shares add up to the whole interval.
- **Lead project:** its rounding rule rounds the shared interval once, and it receives the leftover **seconds** (`ST/shared-time.shares.ts:165-188,236-245`).
- **Shares:** edited as percentages; changing one scales the others in proportion.
- **Adding projects later** divides the stored booked duration without rounding again.
- **Leaving:** a member leaves only through "Dissolve". **The dissolved entry then books the group's whole total, so total booked time rises** (`ST/shared-time.shares.ts:396-414`).
- **Freeze:** once any member is paid or reserved, the interval and shares are frozen.

### Daily booking limit (`TE/time-entry.daily-booking-limit.ts`)

- Setting default on (`supabase/migrations/20261004120000_settings_daily_booking_limit.sql:8`).
- For each Calendar day a write touches, the code sums the booked seconds of all project entries. An entry crossing midnight counts `active_seconds × part on that day ÷ interval length`. Daylight-saving days use their real 23 or 25 hours.
- A write is refused if it would increase any day's excess over 86,400 s. Days that are already over may stay over.
- Project-less entries are ignored.

### Midnight and time zones

- An entry crossing midnight stays one record. `packages/core/src/helper/workHelper/splitEntryByDay.ts` splits it only for reports.
- All times are shown and entered in the one Account timezone (ADR 0046; `apps/web/src/features/settings/components/general/TimeZoneSettings.tsx`, mobile `TimeZoneField.tsx`).

### Rounding (code in `TT/time-tracker.shared.ts`)

- **Which rule applies:** the project's rule if `rounding_interval` and `rounding_direction` are both set; otherwise the global settings (`:342-367`). Timers can also carry their own override.
- **Formula:** `ceil / floor / round(s / (interval·60)) · interval·60` for up / down / nearest (`:38-55`).
- **Ordinary rounding** (`:128-160`):
  1. The start is cut to the minute.
  2. Work time = elapsed time − Rest-break time. Short breaks count as work.
  3. Booked duration = the rounded work time.
  4. End = start + booked duration + Rest-break time.
  5. If rounding down would cut into a Rest break, the end lands where work time reaches the booked duration.
- **Time-fragment rounding** (`:171-224`):
  - The start is floored and the end ceiled to clock-time fragments (5/10/15/30/60 min) in the Account timezone.
  - Every fragment that holds any non-break work books its full length.
- **Exact saving** (W only): the switch "Apply project rounding". When off, the interval is stored as entered, booked = interval − Rest breaks (`WTE/form/TimeEntryRoundingSection.tsx`). It is shown on create, and on edit only after a time change.
- **When rounding runs:** on create, on a time change, and on a project move the user accepted. Never on a memo-only edit, never for project-less entries.
- **Inconsistency:** if settings have not loaded, the fallback fragment interval is 10 min on web but 15 on mobile and in timers.

### Time categories and Time classes

- **CRUD** in W Settings (`apps/web/src/features/time-categories/`) and M Settings: create, rename, reorder, archive, restore, delete.
- **Starter catalog:** Deep Work (Focus), Work (Active), Short break, Break (Rest break), Leisure (`db/work/time-category/time-category.starter.ts:13-51`).
- **Class lock:** the class can change only while nothing uses the category (a DB trigger, `supabase/migrations/20261013000100_time_category.sql:103-121`).
- **Delete:** a used category can only be deleted by choosing a replacement of the same class; all uses move in one step.

### AI assistant and agents

- **In-app assistant** (W, every write needs approval): create, update, delete (permanent), query and get entries, list categories, summarize work, create an entry from an appointment.
- **External agents (MCP):** the same tools without delete; overlaps come back as `overlap_decision_required` (`apps/web/src/lib/agent-connections/agentWorkTools.ts:247-267`).

---

## 4. Timer features

### Start, submit, discard (W, M, D)

- **Start** from the project picker (Favourites, then Recent, then All), the header cockpit, the dashboard bar, the project detail row, or mobile `AddTimerModal`.
- **Submit** saves the memo first, then creates the entry.
- **Discard** asks for confirmation and records nothing.
- Logic: `TT/time-tracker.executors.ts:748-798`, `TT/shared-timer.executors.ts:464`.

### Pause and resume

- Pause is a **phase switch** to the first active rest-break category (else a short-break one). It is disabled if no break category exists. Resume returns to the timer's own category (`TT/time-tracker.phases.ts:96-194`).
- **Pause picker:** 5 / 15 / 30 min, Custom (1–480), or Open-ended. The choice becomes the phase's Planned duration. The last choice is remembered in `settings.last_pause_planned_duration_seconds`.
- **Overtime:** past its Planned duration a phase runs on and shows "+ over", unless auto-continue is on.
- **"Switch to" menu** changes the Time category while running and starts a new phase. The base category itself can change only while the timer is idle.

### Several timers at once

- Up to 10 timer rows. One timer per project.
- **Project-less timers** (lunch, leisure) are never rounded.
- **Shared Timer:** add or remove projects while it runs (retroactively), re-weight shares, change the lead project. On submit it produces one Shared time.
- Starting several projects at once (`executeStartShared`, `TT/time-tracker.actions.ts:123`) **has no UI caller**.
- **"Automaticly stop other timers when starting a new one" only takes effect when a timer starts from an appointment** (`calendar.executors.ts:569-580`). Starts from the cockpit, picker or hotkey ignore it, so the setting is half-finished.

### Visible everywhere (W)

- **Header:** a button with up to 2 live clocks plus "+N" (`web/tt/cockpit/HeaderRunningTimers.tsx`).
- **Cockpit:** a popover, or popped out as a draggable floating window that can shrink to a pill (`web/tt/cockpit/TrackingCockpit.tsx`).
- **Timer card:** a phase ring, phase clock, total, booked duration, live earnings per currency, memo and an editable timeline (`web/tt/timer-card/TimerCard.tsx:331-347`).
- **Dashboard timer bar** and the project detail timer row.
- **Calendar:** a live "active timer" block with a hover card for save, cancel, adjust time and rounding, memo and Pomodoro.
- **Hotkeys:** `O T` opens the cockpit. `T S` submits the single running timer, otherwise starts the top project, otherwise opens the cockpit (`apps/web/src/features/hotkeys/useAppCommands.tsx:311-394`).

### Editing a running timer

- **W, `ModifyTimeTrackerModal`:** project, shared projects, and a Time tab with start ±1 min, a start date-time picker, end ±1 min ("ended N minutes ago") and minute shifts.
- **Rule:** effective start = `start_time + delta_start_time`; effective end = `now + delta_end_time` while running (`TT/time-tracker.shared.ts:416-430`).
- **Rounding tab:** a per-timer override with a live Active vs Booked preview (W only).
- **M:** start and end buttons of ±1 and ±5 min only.
- **Memo:** saved 500 ms after typing stops, on all platforms.
- **Task link:** stored, but **no UI sets it**, so it is schema/dead code only.

### Rounding on submit

- **Which rule:** the timer override, else the project rule, else the settings. Project-less timers are never rounded (`TT/time-tracker.shared.ts:378-406`).
- A timer always rounds ordinarily (start cut to the minute) unless fragments are on.

### Starting from an appointment (W)

- Allowed from 60 minutes before the start until the appointment is past.
- Start "now", or "from appointment start" (backdated).
- The resulting entries are linked to the appointment as "tracked".
- In-app reminders 10 minutes before, with the actions "Start now" and "From appointment start" (`apps/web/src/hooks/notification-hooks/useAppointmentTimerNotifications.tsx`).

### Pomodoro

- A plan of phases, with state derived from the phases (ADR 0043).
- **Settings:** work 5–90, short break 1–15, long break 10–30 min, sessions 2–8, colours, sound, "Continue working?" after the long break, auto-submit after the long break (default on), and per-step categories (`apps/web/src/features/settings/components/work/PomodoroSettings.tsx`).
- Per-timer session overrides (W only).
- **"Continue automatically when a planned Phase ends"** (default off) applies to Pomodoro steps and planned pauses.

### Overlap or daily limit on submit

- The timer is **frozen** with a block reason and shows "Resolve overlap" or "Check daily limit".
- It cannot be restarted; it can only be resubmitted or discarded. A frozen timer blocks deleting its project (`TT/time-tracker.submission.ts:447-535`).

### Notifications

- **W:** system notification, sound and toast when a planned phase ends — only while the app is open.
- **M:** local notifications are scheduled for each planned phase, so they fire in the background.
- **Forgotten timer:** only a mobile Today insight for any timer running ≥ 10 h (`packages/core/src/today/todayInsights.ts:112-113`). No push or reminder.
- **Idle detection: does not exist.** It is only listed as a next step in `apps/desktop/README.md:191-192`.

### Desktop tray / menu bar (D, macOS)

- **Title:** the primary timer's clock, or a countdown or Overtime when the phase has a Planned duration. The icon changes for focus or break.
- **Left-click:** a popover with the same timer cards and a "Today" view.
- **Right-click menu:** "Pause X" / "Submit X" per timer.
- **Bug that loses data: the tray's "Pause X" resets the timer to idle and throws away the tracked time** (`apps/web/src/features/time-tracker/desktop/DesktopTrayTimerHost.tsx:179-181`).
- The tray menu labels are hard-coded in German.

### Mobile

- **Timers tab:** today's total, running and pending timer cards, idle start rows.
- **iOS Live Activity:** display only, one per running timer. No home-screen widget.
- **Today:** a running-timer tile.

### Restore after restart

- Timers are fully persisted and synced (`state` + `start_time` + deltas + phases), so they survive a reload, a restart and a device switch.
- Pomodoro steps that came due while the app was closed are applied at their original time once it runs again.

---

## 5. Views and analysis

### W project entry list (project detail only) — `apps/web/src/features/projects/detail/time-entry-list/TimeEntryVirtualList.tsx`

- A virtual timeline: month → day (with week number) → entries. A month rail shows hours bars, with sticky week and month totals.
- Each total shows **open amount and paid amount per currency, plus booked duration**.
- **Entry row:** time span, memo, category badge, share, amount (= salary × booked hours, rounded to cents), a paid tick, a pending-payout icon.
- **Filters:** only the period. There is no global all-projects entry list on web, and no project, category or paid/unpaid filter.

### M Entries tab — `apps/mobile/src/features/work/components/TimeEntriesTab.tsx`

- All entries, project-less included, grouped by day with "X booked". Swipe to delete.
- No money, no selection, no filters.

### W calendar

- **Blocks:** one per entry; a Shared time is one block "A · B" with phase bands. Paid blocks cannot be moved.
- **Hover card:** earnings and payout state.
- **Week view:** a daily summary of time and earnings per project.
- **Filters:** project and tags.
- **"Assign time entries…"** to an appointment; appointment status derived from linked entries (`apps/web/src/features/scheduler/`).

### W dashboard — `apps/web/src/features/dashboard/`

- **Last 7 days by project.**
- **Open work:** grouped by contact and currency, with the age of the oldest entry (orange after 30 days) and a "Payout" button per project.
- **This month:** time, earned amount, and **effective hourly rate** with a trend.
  - Per currency, rate = earned ÷ hours.
  - Earned = hourly entries in the month, plus for fixed-price projects `total_value × hours in the month ÷ all hours ever on that project`.
  - Employment and hobby projects are excluded (`packages/core/src/helper/workHelper/effectiveHourlyRate.ts:75-102`).
- **Last 7 days by weekday.**
- **Time classes:** today and this week, wall-clock time including project-less entries.

### M Today

- A "Booked today" tile.
- Insights: long-running timer, open work, weekly earnings with an implied rate, focus vs breaks.

### Payouts (W creates; M can correct and delete but **cannot create**)

- **Entry points (hourly projects only):** the toolbar Payout icon opens Quick payout ("All time", "This month", "Last month"), or "Pay selection", or the Open-work widget button.
- **Amount:**
  - `source_value = round(Σ entry.salary × active_seconds / 3600, 2)` from each entry's own snapshot.
  - **The source currency is the project bank account's currency, not each entry's own `currency`.**
  - The server locks the entries and rejects the whole payout if any entry is paid, already in a payout, or belongs to another project (`supabase/migrations/20261003000100_payout_hard_cutover.sql:400-440`).
- **Payout dialog:**
  - The amount received; a date between the last work day and today; the destination account (another currency shows a "currency conversion" notice, no rate is stored).
  - A reason is required when the currency is the same but the amount differs.
- **Writes, in one transaction:**
  - the `payout` row;
  - one cashflow "Payout (<project>) <date>" carrying the project's contact and tags;
  - every entry set to `paid=true, payout_id`.
- **Offline:** a payout starts as a Pending Payout that reserves its entries; a rejection shows an alert with a retry.
- **Correct** (title, amount, reason, date, contact, account) and **Delete** both check the revision on the server. Delete removes the cashflow and sets the entries back to unpaid, which is the only way back to unpaid.
- **Finance → Payout tab:** per-currency metrics (this month vs last, average per month, this year, total), filters by project and contact.
- **"Mark as paid" without a payout:** one-way, no cashflow (`TE/time-entry.executors.ts:1963-2013`).
- **Fixed-price projects** are settled through their finance project's cashflows, not payouts. **Employment projects** never turn time into money.

### Exports

- **No CSV, PDF or invoice export** for entries or payouts. The app's own docs say "it does not create an invoice" (`apps/web/src/messages/docs-features.ts:1577`).
- The only export is the account-wide GDPR JSON (`packages/db/src/legal/user-data-export.ts`), on web only.

---

## 6. Settings that affect projects and time tracking

Stored in `settings`, T:1909.

- **Projects:**
  - W: "Default salary & account" (default hourly rate `default_salary_amount`, default bank account `default_project_bank_account_id`), "Preferred project type" (hourly / project / hobby only) (`apps/web/src/features/settings/components/work/project-manager/`).
  - M: `apps/mobile/src/features/settings/screens/ProjectSettingsScreen.tsx`.
- **Module colour:** `work_color`, default amber.
- **Time tracker** (W `.../work/time-tracker/TimeTrackerSettings.tsx`, M `TimeTrackerSettingsScreen.tsx`):
  - auto-stop other timers (only works on appointment starts);
  - continue automatically when a planned phase ends;
  - check overlaps across all projects;
  - allow overlapping entries;
  - book at most 24 hours per day.
- **Rounding** (`RoundingSettings.tsx`): interval in minutes (default 1), mode up/down/nearest (default up), round in time fragments plus fragment interval 5/10/15/30/60 (`round_in_time_sections`, `time_section_interval`).
- **Pomodoro:** durations, sessions, colours, sound, auto-continue and auto-submit, per-step categories.
- **Time categories** (see §3).
- **General:**
  - default currency — used only for money display order and the bank-account form, not for projects (`apps/web/src/components/ui/money/MoneyGlance.tsx:63`);
  - Account timezone, or follow the device;
  - 24-hour format;
  - first day of week (`LocaleSettings.tsx:82-93`).
- **Privacy:** privacy mode plus a picker for private projects.

---

## 7. Other things a user notices, and loose ends

- **Privacy mode** works only for allowlisted users, as a demo mode (`packages/core/src/privacy/privacyMode.ts:3`).
  - It hides private projects only in the tree, the archived section and the "last 7 days by project" card.
  - It does not hide them in overview cards, open work, the calendar, payouts or the effective rate.
- **Habits** can be linked to projects; booked time becomes read-only "Derived entries" of habit progress.
- **Half-finished or broken:**
  - The tray "Pause" loses tracked time.
  - The auto-stop setting is mostly ignored.
  - "Edit selection" bulk action is "Coming soon".
  - Mobile project tabs Appointments and Review are placeholders.
  - Multi-project timer start has no UI.
  - The timer task link has no UI.
  - The project form's folder field exists on mobile only.
  - Mobile lacks payout creation, mark-paid, selection, series, exact saving, the per-timer rounding override, Pomodoro colours and the overlap timeline.
- **Dead code:**
  - legacy Pomodoro columns, and `pomodoro_auto_start_phases` (replaced);
  - the overview mode of `TimeEntryVirtualList`;
  - unused analysis outputs (best day, best week, weekly points);
  - unused enums `roundingAmount` and `timeSectionInterval`.
- **Inconsistencies:**
  - Fallback currency is "USD" in some places and "EUR" in others (`HourlyPayoutCard.tsx:40`, `ProjectCard.tsx:133`).
  - Quick-payout months use device time, not the Account timezone.
  - The overview counts an entry on its start day, while the dashboard splits entries at midnight.
  - The fixed-price Payout button does nothing when no finance project is linked.
  - The glossary says "minute remainder" for the lead project; the code gives seconds.
  - Dissolving a Shared-time member increases total booked time.
