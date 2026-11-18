---
status: accepted
date: 2026-11-18
decisions: D334, D335, D336, D339, D340
---

# Pages explain Refusals and Edit Drawers read Clearance on opening

## Context

The write paths and Clearance Query ask the same Protection Rules (ADR 0033). A page needs to
explain the result in the App Language. The package that owns an entry may know what to do next,
while the rule and the tables it reads can belong to other packages.

## Decision

- An Operation hook or function returns `refused` with its Reasons. A caller can look up a
  particular Reason by its definition and read its typed details. An Operation hook can map a
  Reason's table and column to an input field. The form shows those Reasons at their fields and
  keeps the Draft. It displays a Check at the field first when both apply.
- `DataProvider` supplies the shared Notice of a Refusal through `notifyRefused`. It shows the
  applicable Reasons that remain after field mapping. A caller can supply an entry name and one
  action per call, or handle the Refusal through the Operation's handling options. There is
  no undo for a Refusal. The projects Edit Drawer offers Archive on a refused delete of an
  active project, using the same discard confirmation, archive Operation and undo as the form.
- Each module names its synced tables with plural Lingui messages in its Shell Contribution.
  The map is checked against its Row Map through a type-only import. The app's module list
  resolves the names by SQL table. The package that owns a Reason supplies its text with typed
  details. The app lists the definitions and composes their texts for `DataProvider`. The
  reference check uses table names, counts and the App Language's list and plural rules. Notice
  and form texts are rendered in the active language.
- An Edit Drawer asks for one row's Clearance once per opening, naming the kinds of write it
  presents. `clearanceQueryFor` checks the table, row ids and write kinds against the module's
  tables. Fields are usable while the answer is pending. Requested actions keep their ordinary
  appearance and ignore activation until the answer arrives. A blocked action is disabled with
  an accessible description in the space reserved below the footer. Table Changes leave the
  opening's answer alone, and the write still checks the rules when the user acts.
- Fixed Answers represent both kinds of result and validate each Reason against the definitions
  supplied by the story or test. The production startup audit keeps runtime Contracts, schema
  definitions and forms on demand.

## Consequences

A lower module can show the Reason for a rule from above without importing the rule or the
referring module. Composition checks that every listed definition has a text. The list itself
must be kept aligned with the definitions wired into the Data Process. The compiler checks the
names used in a Clearance Query and column map. The caller still chooses the write represented
by each button and the input field where a Reason belongs.

The [Port hooks guide](../development/port-hooks.md) and the [form guide](../development/forms.md)
document how to wire the pattern. Pre-save field locks remain for the first rule that needs them.

## Considered Options

- Loading a Clearance for every list row would add work to each list read and entangle lower
  modules with changes in referring tables. One read per Edit Drawer opening keeps that work
  local to editing and leaves the final decision at the write.
- Copying rules into forms would let the explanation diverge from the write's answer. Showing
  every Reason only in a Notice would detach field-specific feedback from the input to change.
