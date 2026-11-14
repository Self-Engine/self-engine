---
status: accepted
date: 2026-11-14
decisions: D317, D318, D319, D320, D321, D322, D323, D324, D325, D326
---

# Forms check the Contract and share one submit flow

## Context

The first multi-field module needs field feedback and consistent saving without repeating
Draft state, Conflict handling, unsaved-change comparisons or input rules in every module.
The Data Process remains the authority. Contracts and the full schema library cannot enter
the startup chunks merely because a View can open an Edit Drawer.

## Decision

- `forms` owns `useOperationForm`, backed by uncontrolled `@mantine/form`. Modules import
  the helper alone. Only forms may import `@mantine/form` or `@mantine/dates`.
- A form loads its Contract with the lazy Edit Drawer and checks the Operation’s input schema
  for feedback. The Data Process still checks every input and decides (ADR 0020, D317).
  Hooks retain type-only Contract imports (ADR 0021). Startup checks forbid runtime
  Contracts, the full Zod build and form libraries in startup chunks.
- A Draft uses the input’s field names and values; fields can be empty. A field owns unfinished
  text, reports it through its Field Binding and cannot silently submit its previous value.
- The first Check is on submit; a failed Check shows field messages and focuses the first
  affected field, then rechecks on every change. Helper texts are translated descriptors;
  modules may override a field and supply texts for Contract rule reasons. Missing reason
  text falls back and fails the story console-error gate. Raw schema text is never displayed.
- `OperationFormBody` owns submit, locking, duplicate prevention, keyboard submit and the
  persistent warning for an entry deleted elsewhere. `EditDrawerForm` adds Save, Cancel,
  an action slot and registration with the Shell’s leave guard. Conflicts stay at fields;
  unexpected results keep input. Success and not-found call the supplied completion callback.
  Data Client continues to own transient Notices.
- One value comparison answers both Save and the leave guard. Create can always attempt a
  save; unchanged edits cannot. Edit sends identity plus changed fields, expanding tied
  groups declared beside Contract rules. Empty optional text is normalized to null when
  configured. `projects` sets the real partial-update Contract pattern (ADR 0032), not this
  helper.
- An open edit follows stored changes in untouched fields and keeps changed/unfinished ones,
  comparing against the latest stored state. Deletion elsewhere preserves readable input,
  shows a warning in the form and disables saving; undo restores normal behavior.
  `projects` retains its last entry through closing after deletion, archiving or unarchiving
  inside its own drawer, suppressing that warning until #132 settles Shell content retention.
- Text, long text, icon and color fields are shared. Pickers remain in ui; module-owned
  pickers use `useFieldBinding`. Date/time fields follow with time-tracking, not this package.

## Consequences

Modules write fields and name Operations rather than duplicating a form flow. The helper’s
uncontrolled field subscriptions keep typing from redrawing unrelated fields. Changes from
elsewhere require a retained entry in the drawer, distinct from the Draft. Tests drive the
screen and observe the Port; `projects`, the template of every later module, proves the path
over the test Data Process.
The [form guide](../development/forms.md) gives the multi-field authoring pattern. First-open
latency is measured in the built app; the startup size must not grow. Light/dark visual
inspection remains separate from the automated story gate.

## Considered Options

- Separate form predicates duplicate Contract rules.
- Asking the Data Process for every Check delays feedback and changes its expected errors.
- Controlled state redraws unrelated fields during typing.
- A state-only helper leaves submit and leave-guard behavior to be repeated in modules.
- Always sending all fields can overwrite remote changes or reject unknown stored icons.
