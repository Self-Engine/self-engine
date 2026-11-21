# Build a module’s form

Use `@self-engine/forms` for module forms (ADR 0030). Add `forms` to the module’s
`ALLOWED_IMPORTS` entry and `@self-engine/forms` to its dependencies. Only `forms` imports
`@mantine/form` and `@mantine/dates`. Load the form with the module’s lazy Edit Drawer;
import its Contract at runtime there, and as a type in `port.ts`. The startup gate rejects
Contracts, the full Zod build and the form library in startup chunks.

Copy [`projects`](../../packages/projects/src/), the template every later module follows
(D315): its [Edit Drawer](../../packages/projects/src/edit-drawer.tsx) creates, edits, archives,
unarchives and deletes a project. The Contract of a multi-field edit follows the edit
pattern of [ADR 0032](../adr/0032-every-edit-names-what-changes-and-its-inputs-come-from-one-field-list.md):
missing stays untouched, `null` clears, a value sets, an unknown field is an input error and an
edit without fields does nothing. Do not copy placeholder-alpha’s single-field rename Contract
for a multi-field edit. `projects` has no Conflict (D328); a Conflict reason shown at a field is
found in placeholder-alpha’s [Port](../../packages/placeholder-alpha/src/port.ts) and its stories.

## Contract and hooks

Rules belong in the input schema, not in field handlers. The Data Process checks every input
and decides; the form’s Check gives immediate feedback. Output schemas preserve values.
List the entry’s fields once and derive the create and edit inputs with `entryFields` from
`@self-engine/db/schema` ([port guide](port-pattern.md#1-set-up-the-entries-and-contract)):

```ts
import { entryIconSchema } from "@self-engine/icons/names";
import { colorSetNameSchema } from "@self-engine/theme/names";

export const projectFields = entryFields(projectIdSchema, {
  title: z.string().trim().min(1).max(TITLE_MAX),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX)
    .transform((text) => (text === "" ? null : text))
    .nullable(),
  icon: z.nullable(entryIconSchema),
  color: z.nullable(colorSetNameSchema),
});
// create: oc.input(projectFields.create) and edit: oc.input(projectFields.edit)
```

Take the icon and color schemas from the pure `names` entries of `icons` and `theme`
(ADR 0029), which load no pictures and no theme. A field whose schema accepts `null` is
optional. Both inputs are strict: a field the Draft holds but the input does not take is an
input error, not dropped.

`projects` has no rule across fields. When an entry needs one, it names its affected field
and reason and refines both derived inputs; for an edit, export the tied field groups beside
it. The test module `memos` of `storage`
([its Contract](../../packages/storage/test/memos-module/contracts/index.ts)) has one:

```ts
export const bodyDiffers = ({ title, body }: { title?: string; body?: string | null }) =>
  title === undefined || body === undefined || body !== title;
export const bodyRule = { path: ["body"], params: { reason: "body_matches_title" } };
export const memoTiedFields = [["title", "body"]] as const;
const createInput = memoFields.create.refine(bodyDiffers, bodyRule);
const editInput = memoFields.edit.refine(bodyDiffers, bodyRule);
```

The derived edit input accepts exactly the subsets the form sends, and the rule checks a group
when it is present. The same schema runs in the Data Process. Never reimplement the predicate
in the form.

Build hooks with `portHooks<typeof contract>(mountName)` as in [the hooks guide](port-hooks.md).
Give every Conflict reason its `msg` descriptor and field there; use `field: null` for a
Conflict no field can show. To show a Reason of a Refusal at a field, build them with the
module's tables as well, `portHooks<typeof contract, TablesOf<typeof rowMap>>(mountName)`, and
name there the field for each column such a Reason may name (`columns`,
[hooks guide](port-hooks.md)), such as a project field for `project_id`. The form shows such a
Reason at its field only when it renders that field and the field still holds the value the save
sent, with no text in it that is no value yet; every other Reason goes to the shared Notice with
the others, so none is lost. A taken title is checked by the Operation, not while typing.

## Create: fields and the module’s own texts

Inside a lazy drawer, with its `onCancel` and `onDone` props:

```tsx
import { useLingui } from "@lingui/react/macro";
import {
  ColorField,
  EditDrawerForm,
  IconField,
  LongTextField,
  TextField,
  useOperationForm,
} from "@self-engine/forms";
import { projectsContract } from "./contracts/index.ts";
import { useCreateProject } from "./port.ts";

function CreateProjectForm({ onCancel, onDone }: EditDrawerProps) {
  const { t } = useLingui();
  useEditDrawerTitle(t`New project`);
  const form = useOperationForm({
    entry: projectsContract.create,
    operation: useCreateProject(),
    draft: { title: "", description: "", icon: null, color: null },
    emptyTextFields: ["description"],
    onDone,
  });
  return (
    <EditDrawerForm form={form} onCancel={onCancel}>
      <TextField form={form} name="title" label={t`Title`} />
      <LongTextField form={form} name="description" label={t`Description`} />
      <IconField form={form} name="icon" label={t`Icon`} />
      <ColorField form={form} name="color" label={t`Color`} />
    </EditDrawerForm>
  );
}
```

`Draft<Input>` has every input key, including optional keys; each can hold `null`. Text fields
may start with `""`. Only the fields named in `emptyTextFields` hand on an emptied or
whitespace-only text as `null`, "empty", for comparison and submission; every other text field
hands on `""` as typed. Trimming other text belongs in the Contract. Stored string
values can include names unknown to the current input schema, such as a newer icon.

The helper supplies translated violation texts, which is all `projects` needs. A module with
texts of its own passes `texts`: `texts.fields` replaces a field’s generic text, and
`texts.reasons` names special rules, such as
``{ reasons: { body_matches_title: msg`The body must differ from the title.` } }`` for the rule
of `memos` above. A reason takes precedence over a field text.
Descriptors follow an open-form language switch. A reason the Operation declares for its own input
errors (`inputErrors` in its Contract) needs a text here, and the types demand it. The types do not
find a missing text for a reason of the input schema; a story does, at runtime: the field shows the fallback and an error is logged, which the
console-error gate rejects. Exercise every reason in a story.
No raw Zod message reaches the screen.

Nothing is reported before Save. A failed Check calls no Operation, shows messages, focuses
the first affected field and starts checking the whole Draft on every change. A Conflict
stays at its field until that field changes, and so does a Reason of a refused save at a field the
Operation maps its column to: the field shows the Reason's text, the one the shared Notice would
show, in the App Language; like the language, new Reason texts of the `DataProvider` reach it. Text that is no value yet counts as a change too, and so does a new
stored value the field follows. The next answer to a save replaces the Reasons of the last one.
Every other Reason goes to that Notice, the Draft stays and the form stays open: one at a field the
form does not show, and one at a field that changed while the save ran. The form asks again when
it takes the answer: a Reason whose field changed or went after the hook's answer, such as by code
the first Notice runs, goes to a Notice of its own through the provider's `notifyRefused`, never to
its field. An input error the Operation answers (`invalid`, ADR 0040) shows each issue at the
field its path names, worded as the Check words it, with the module's text for its reason; the
first such field on screen takes the focus once the save's lock ends, the message leaves when its
field changes, and the next answer replaces it. An issue at a field the form does not show, or one
whose field changed while the save ran, goes to the general Notice. A violation of a Check
outranks a Conflict, a Reason or an issue at the same field.
Unexpected failure preserves input; Data Client owns its Notice. Success and not-found call `onDone`; `onSuccess(data)` optionally consumes
the successful answer. Pass the Shell’s `onDone`, so a completed save bypasses the leave guard.

## Edit: changed fields and following the entry

Use a separate edit component to keep hook calls unconditional:

```tsx
const form = useOperationForm({
  entry: projectsContract.edit,
  operation: useEditProject(),
  draft: {
    id: project.id,
    title: project.title,
    description: project.description,
    icon: project.icon,
    color: project.color,
  },
  edit: { identity: { id: project.id }, deleted },
  emptyTextFields: ["description"],
  // The Notice of a refused save names the project.
  entryName: project.title,
  onDone,
});
```

Give the current stored entry on every render. Untouched fields follow it, changed fields
keep their values, and comparison uses the new stored state. New objects with equal values
do nothing. `form.setValue("title", value)` changes a value by code and updates its field.
Do not keep another Draft, starting value, Conflict text or changed flag in the module.

Create sends all fields. Edit sends identity plus changed fields; every group touched by a
change travels together (including overlapping groups). `edit.tiedFields` must name every group
a rule of the Contract ties (`projects` has none; `memos` would pass `memoTiedFields`). A forgotten group sends one field of the rule without the other,
and the rule reports at a field the edit does not submit, with a message wrong for what that
field shows; Save then logs an error naming that field, so a story fails. Missing means
untouched, `null` means clear, and a value means set. Thus changing only a title does not send
an unknown stored icon unless a Contract rule ties it to that title. No changed fields means no
Operation.
Save and the Shell’s leave guard share one comparison: typing and undoing a character is no
change. Create Save remains enabled. The helper locks fields and prevents duplicate submits
while an Operation runs. Enter in a single-line input and Ctrl/Cmd+Enter submit; Escape stays
with the Shell. Plain Enter in long text inserts a line break.

Keep the last loaded entry separately from the Draft, as
[`projects/edit-drawer.tsx`](../../packages/projects/src/edit-drawer.tsx) does.
An id never found shows “Entry not found”. If an entry that was loaded disappears, retain its
last value and pass `edit.deleted: true`. The form stays readable and copyable with a lasting
warning and Save disabled. Undo passes the restored entry and `deleted: false`.

For a named Operation that leaves the entry from inside the Edit Drawer (delete, archive,
unarchive), mark the entry as leaving, await the Operation, and close through `onDone` only when
it succeeded or the entry was not found. A failed Operation takes the mark back: the drawer stays
open with what was typed. Pass `deleted: found === undefined && !leaving`, and retain the entry
until the drawer has closed (#132); this prevents the deleted-entry warning flashing. This state
belongs to the drawer’s retained entry, not to the form’s Draft.

An Operation that keeps the entry, such as archive, first awaits the Shell’s `confirmDiscard()`
and runs only when it answers true: it asks “Discard changes?” when the form holds unsaved
changes, like any other way out. A delete asks nothing.

An action that can outlive the drawer, such as the action of a Notice, asks the Shell’s
`isOpen()` when it runs: it is false from the moment the person leaves this opening, also while
the drawer still slides out. Only an open drawer speaks for what the person sees in it, as the
`projects` drawer does before its Notice's Archive offers an undo.

## Action slot and a standalone form

`EditDrawerForm` provides Save and Cancel. Put named Operations in `actions`, for example:

```tsx
<EditDrawerForm
  form={form}
  onCancel={onCancel}
  actions={<Button type="button" onClick={deleteHere}>{t`Delete`}</Button>}
>
  {/* fields */}
</EditDrawerForm>
```

For an action that needs Clearance (D336, D339), define the Query for the module's tables
and use a `ClearanceAction` in the slot. The Query checks the table, row id and kinds of write
against the types of the Row Map. For example, with a type-only import of `projectsRowMap`:

```tsx
const query = clearanceQueryFor<TablesOf<typeof projectsRowMap>>();
const clearance = query({ table: "projects", rows: [project.id], writes: ["delete"] });

<EditDrawerForm
  form={form}
  onCancel={onCancel}
  clearance={clearance}
  actions={<ClearanceAction write="delete" onClick={deleteHere}>{t`Delete`}</ClearanceAction>}
>
  {/* fields */}
</EditDrawerForm>;
```

List the kinds of write the slot shows in `writes`; one listed twice is still one action with one
explanation. The form opens immediately and asks once per opening; reopening the same entry, also
while the drawer still slides out, is a new opening and asks again, and a drawer that closes before
the answer calls its question off. The action keeps its ordinary appearance while the answer is pending and ignores
activation. When blocked, it is disabled and linked to its Reason text, which appears in a live
region above the footer. The footer stays pinned to the bottom of the drawer and the text takes
its room from the free space below the fields, so its arrival moves nothing; nothing is
reserved while nothing is blocked. When the fields fill the drawer, the footer moves down by the
height of the text, once, when the answer arrives. A Clearance that fails leaves the actions
usable: the write checks the rules anyway. A Table Change leaves the answer alone, so an action
the opening did not ask about, such as "Unarchive" after an archive elsewhere, is usable. The
Operation still handles Refusals that arise while the form is open.

Name the entry once with `entryName` (its title) in `useOperationForm`: the Notice of every
refused save names it. A call of your own, such as Archive, passes it per call as
`{ entry: project.title }`.

Archive/Delete are Operations, never Draft fields. Outside the Edit Drawer, use
`OperationFormBody` with the same `form` and fields and your own `type="submit"` button.
It provides Check, locking, keys and the deleted-entry warning without registering a Shell
leave guard or adding Save/Cancel. Do not nest HTML forms. `form.submit()` also submits through
that same flow; never call `operation.run` from a field or Save handler.

## Bind a module-owned picker

Pickers remain usable without forms. A module exporting a project picker can bind it through
`useFieldBinding` (the helper imports no module):

```tsx
function ProjectField({ form }: { form: OperationForm<{ projectId: ProjectId | null }> }) {
  const field = useFieldBinding(form, "projectId");
  return (
    <div ref={field.ref}>
      <ProjectPicker
        value={field.value}
        onChange={field.onChange}
        onBlur={field.onBlur}
        error={field.error}
      />
    </div>
  );
}
```

The picker must display `error` with an accessible association to its control. Register the
focusable control with `ref`, or an outer element containing it if the picker accepts no ref.
Use `typedMemo` for a generic field component and keep its props stable, so typing elsewhere
does not redraw it. Built-in Text/LongText/Icon/Color fields already handle this.

A field accepting half-typed text keeps that text itself. A finished value calls
`onChange(value)`; empty calls `onChange(null)`. Text that is no value calls
``onUnfinished(msg`Complete this value.`)`` and leaving calls `onBlur()`. It counts as an
unsaved change and blocks submit, showing a message on leave or Save. Never silently submit the
older value. When `field.setFromOutside` changes, a value came by code or from the followed
entry: replace the local text with the formatted `field.value`, even if that value did not
change. Use the working example in
[`bound-fields.stories.tsx`](../../packages/forms/src/testing/example/bound-fields.stories.tsx)
for the local text pattern; the date and time fields below follow it.

## A date and a time

`CalendarDayField` binds a Calendar Day, `WallClockTimeField` a Wall-Clock Time, each with
Mantine's picker (D319): the calendar of `DateInput` and the hours and minutes of `TimePicker`
with its lists. Both can be picked and typed. Give the date field the first day of the week and
"today", which the View reads with `useFirstDayOfWeek()` and `useToday(timeZone)` from
`@self-engine/time/react`; no field reads a Setting or a clock:

```tsx
const firstDayOfWeek = useFirstDayOfWeek(); // in the drawer, outside the form
const today = useToday(timeZone);

<CalendarDayField form={form} name="day" label={t`Day`} firstDayOfWeek={firstDayOfWeek} today={today} />
<WallClockTimeField form={form} name="start" label={t`Start`} clearable />
```

The Contract declares the fields with `calendarDaySchema` and `wallClockTimeSchema` of `time`,
`.nullable()` when the field may stay empty, and the Draft starts with `null`. The field writes a
`CalendarDay` (`YYYY-MM-DD`) or a `WallClockTime` (`HH:MM`); a picker never hands on a `Date`.
`name` accepts only a field that holds the value or `null`, and never a title: a Contract's
input type carries no brand of Zod, but the Draft takes the brand from what the input schema hands
on, so it holds `CalendarDay | null` for a day and `string | null` for a title (D365). The same
holds for every branded value, such as a project's id. The field still checks the value it reads,
since the binding hands it on untyped.

- **Typing a day:** the language's numeric order, `5.11.2026` in German, `11/5/2026` in English,
  with any separators and a two-digit year for 2000–2099, or `2026-11-05`. The field shows the
  day as `05.11.2026` or `11/05/2026`. The text becomes the day as soon as it is whole.
- **Typing a time:** into the hours, then the minutes (and AM or PM in English, which counts 12
  hours, as `formatInstant` does). Hours without minutes are unfinished. AM or PM takes the keys
  A and P, the arrows and its list, and no other text.
- **Unfinished:** half a date, a day that does not exist or hours without minutes keep the older
  value, block the save and show "Complete or clear this field." once the field is left.
- **Empty:** emptying the text or every part hands on `null`; `clearable` adds the clear button.
  A click on the day the field holds keeps it.
- **Today:** the calendar opens an empty field on the month of `today` and marks that day. Mantine
  would read both from the device's clock, whose day can differ from the one in the form's Time
  Zone; the field replaces its mark (`getDayProps` sets `data-today`) and its month
  (`defaultDate`). A story passes a fixed day.
- **Language:** month and weekday names, the text of a day and the 12- or 24-hour clock come from
  `time` (`calendarLabels`, the format `fieldDate`, `clockFormatOf`), not from Mantine's date
  library: nothing in the app imports `dayjs` (ADR 0027). A change to a language with the other
  clock draws the time picker anew from the value the field holds; half-typed parts are dropped.
- **A value from outside** draws the picker anew, so a story that changed the value finds its
  inputs again instead of keeping the old element.

Both fields, their styles and `dayjs` load with the first form; the startup check rejects
`@mantine/dates` and `dayjs` in the start. The stories in
[`example-form-dates.stories.tsx`](../../packages/forms/src/testing/example/example-form-dates.stories.tsx)
pick, type, block and switch the language. The inner inputs live in `date-inputs.tsx`, so every
date and time field of `forms` sets Mantine up the same way.

## A stretch of time

`TimeRangeField` is one field "date, start, end" bound to two Instants of the draft (D319, D344,
D347). It shows a date, a start time and an end time; its parts are labelled by `forms` in the App
Language, and `label` names the whole field. The Time Zone, the first day of the week and "today"
are properties; the field reads no Setting and no clock:

```tsx
<TimeRangeField
  form={form}
  start="started_at"
  end="ended_at"
  label={t`Worked`}
  timeZone={timeZone}
  firstDayOfWeek={firstDayOfWeek}
  today={today}
/>
```

The Contract declares both with `instantSchema`, ties them with a rule such as "the end lies after
the start" at the end (`path: ["ended_at"]`, a Reason with its text, D320), and an edit names them
in `edit.tiedFields`, so both travel together (D323). As with a day, the Draft holds an
`Instant | null`, and the field checks what it reads.

- **The next day:** an end time that is not after the start time lies on the next day, and the
  field shows "+1". "Add an end date" opens a separate end date for a longer range; a loaded range
  that "+1" cannot show opens it by itself.
- **Untouched parts keep their seconds (D344):** an Instant is replaced only when the date or the
  time it shows changes. A start moved past the end moves the end to the next day (D362), as "+1" then
  says; one passing there while a time is typed brings it back with its seconds.
- **Clock changes (D347):** a time the zone shows twice is resolved by `resolveWallClockTime` of
  `time`: on an edit with the Instant the field was drawn with (D366), never one that passed
  while a time was typed, else the end with the start as its lower bound. A correction inside the repeated hour stays in the same one of the two: the second 02:05
  corrected to 02:55 is the second 02:55 (D361). The field calls the rule and never repeats it. A note under the time names the offset,
  such as "02:30 (UTC+2)", as the Time Zone picker writes it (`formatUtcOffset`,
  `repeatedOffsetOf`). A time the clocks skip shows a message and blocks the save, like "25:00".
- **A day to start on:** `startDay` is the date the field shows while the draft holds no start,
  such as the day a new entry was opened on; the times stay empty. It is no value of the draft:
  the start takes the day once its time is typed, and closing the empty form asks nothing.
- **The duration** below the field is the time that really passed between the two Instants
  (`durationBetween`, `formatDuration`), also across a clock change.
- **Messages:** text that is no value, a skipped time and the Contract's messages of the start
  show at the start, those of the end at the end; a half-typed day shows its message at the day.

`time-range.ts` holds what the field writes, as pure functions with unit tests. Typing elsewhere
draws the field not; it draws once for each value one of its pickers hands on. The stories in
[`example-form-time-range.stories.tsx`](../../packages/forms/src/testing/example/example-form-time-range.stories.tsx)
run in Berlin on 25 October 2026 and 28 March 2027.

## Prove the form

Drive fields, buttons and keys; observe visible messages and the Port calls, never helper
internals. The example stories in `packages/forms/src/testing/example/` cover multi-field
Checks, own texts, field binding, changed groups, flow, external changes and Reasons at fields using Fixed
Answers and Changing Answers. Add stories for your module’s own rules and texts. Prove the
module flow over the test Data Process, as in the [`port.test.ts`](../../packages/projects/src/port.test.ts)
of `projects`, including invalid input sent past the form. Run `pnpm check`, then `pnpm verify`. Measure first-open
latency in the built app and compare `apps/web/dist/startup-bundle.json`; neither the Contract
nor the form library belongs at startup.
