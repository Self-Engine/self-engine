# Build a module’s form

Use `@self-engine/forms` for module forms (ADR 0030). Add `forms` to the module’s
`ALLOWED_IMPORTS` entry and `@self-engine/forms` to its dependencies. Only `forms` imports
`@mantine/form` and `@mantine/dates`. Load the form with the module’s lazy Edit Drawer;
import its Contract at runtime there, and as a type in `port.ts`. The startup gate rejects
Contracts, the full Zod build and the form library in startup chunks.

The next consumer is `projects` (#273). The example below describes a proposed multi-field
form, not a settled projects Contract. Projects must first decide its partial-update Contract
and its meaning of missing, empty and value. Do not copy placeholder-alpha’s single-field
rename Contract for a multi-field edit.

## Contract and hooks

Rules belong in the input schema, not in field handlers. The Data Process checks every input
and decides; the form’s Check gives immediate feedback. Output schemas preserve values.
For example, a create schema can declare:

```ts
const fields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable(),
  icon: iconInputSchema.nullable(),
  color: colorInputSchema.nullable(),
};
const createInput = z
  .object(fields)
  .refine((input) => input.description === null || input.description !== input.title, {
    path: ["description"],
    params: { reason: "description_matches_title" },
  });
```

Use the pure icon/color schemas of `ui` (ADR 0029). A rule across fields names its affected
field and reason. For an edit, export tied field groups beside that rule, for example
`[["title", "description"]] as const`; the partial input schema must accept exactly the
subsets the form sends and check a group when it is present. The same schema runs in the
Data Process. Never reimplement the predicate in the form.

Build hooks with `portHooks<typeof contract>(mountName)` as in [the hooks guide](port-hooks.md).
Give every Conflict reason its `msg` descriptor and field there; use `field: null` for a
Conflict no field can show. A taken title is checked by the Operation, not while typing.

## Create: fields and the module’s own texts

Inside a lazy drawer, with its `onCancel` and `onDone` props:

```tsx
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import {
  ColorField,
  EditDrawerForm,
  IconField,
  LongTextField,
  TextField,
  useOperationForm,
} from "@self-engine/forms";
import { projectContract } from "./contracts/index.ts";
import { useCreateProject } from "./port.ts";

function CreateProjectForm({ onCancel, onDone }: EditDrawerProps) {
  const { t } = useLingui();
  useEditDrawerTitle(t`New project`);
  const form = useOperationForm({
    entry: projectContract.create,
    operation: useCreateProject(),
    draft: { title: "", description: "", icon: null, color: null },
    emptyTextFields: ["description"],
    texts: {
      fields: { title: msg`Give this project a title of at most 200 characters.` },
      reasons: { description_matches_title: msg`The description must differ from the title.` },
    },
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

The helper supplies translated violation texts; `texts.fields` replaces a field’s generic
text, and `texts.reasons` names special rules. A reason takes precedence over a field text.
Descriptors follow an open-form language switch. The types do not find a missing reason text;
a story does, at runtime: the field shows the fallback and an error is logged, which the
console-error gate rejects. Exercise every reason in a story.
No raw Zod message reaches the screen.

Nothing is reported before Save. A failed Check calls no Operation, shows messages, focuses
the first affected field and starts checking the whole Draft on every change. A Conflict
stays at its field until that field changes. Unexpected failure preserves input; Data Client
owns its Notice. Success and not-found call `onDone`; `onSuccess(data)` optionally consumes
the successful answer. Pass the Shell’s `onDone`, so a completed save bypasses the leave guard.

## Edit: changed fields and following the entry

Use a separate edit component to keep hook calls unconditional:

```tsx
const form = useOperationForm({
  entry: projectContract.update,
  operation: useUpdateProject(),
  draft: {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    icon: entry.icon,
    color: entry.color,
  },
  edit: { identity: { id: entry.id }, tiedFields: projectFieldGroups, deleted },
  emptyTextFields: ["description"],
  texts: projectFormTexts,
  onDone,
});
```

Give the current stored entry on every render. Untouched fields follow it, changed fields
keep their values, and comparison uses the new stored state. New objects with equal values
do nothing. `form.setValue("title", value)` changes a value by code and updates its field.
Do not keep another Draft, starting value, Conflict text or changed flag in the module.

Create sends all fields. Edit sends identity plus changed fields; every group touched by a
change travels together (including overlapping groups). `edit.tiedFields` must name every group
a rule of the Contract ties. A forgotten group sends one field of the rule without the other,
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
[`placeholder-alpha/edit-drawer.tsx`](../../packages/placeholder-alpha/src/edit-drawer.tsx) does.
An id never found shows “Entry not found”. If an entry that was loaded disappears, retain its
last value and pass `edit.deleted: true`. The form stays readable and copyable with a lasting
warning and Save disabled. Undo passes the restored entry and `deleted: false`.

For deletion inside the Edit Drawer, mark `deletedHere` before calling delete, close through
`onDone`, and pass `deleted: found === undefined && !deletedHere`. Retain the entry throughout
the closing transition (#132); this prevents the deleted-entry warning flashing. This state
belongs to the drawer’s retained entry, not to the form’s Draft.

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
change. Date/time fields follow with `time-tracking`; use the working example in
[`bound-fields.stories.tsx`](../../packages/forms/src/testing/example/bound-fields.stories.tsx)
for the local text pattern.

## Prove the form

Drive fields, buttons and keys; observe visible messages and the Port calls, never helper
internals. The example stories in `packages/forms/src/testing/example/` cover multi-field
Checks, own texts, field binding, changed groups, flow and external changes using Fixed
Answers and Changing Answers. Add stories for your module’s own rules and texts. Prove the
module flow over the test Data Process, as in placeholder-alpha’s `port.test.ts`, including
invalid input sent past the form. Run `pnpm check`, then `pnpm verify`. Measure first-open
latency in the built app and compare `apps/web/dist/startup-bundle.json`; neither the Contract
nor the form library belongs at startup.
