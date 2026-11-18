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
  Reason's table and column to an input field. A Reason goes to its field only when the caller
  says, per call, that it shows that field; the form says so for the fields it renders that
  still hold the value the save sent, since a change while the save ran answered the Reason
  already, and asks again when it takes the answer: a Reason whose field changed or went after
  the hook's answer goes to a Notice of its own. The form shows those Reasons at their fields and keeps the Draft until the field
  changes, also by text that is no value yet or a stored value it follows, or the next save
  answers. It displays a Check at
  the field first when both apply.
- `DataProvider` supplies the shared Notice of a Refusal through `notifyRefused`. It shows every
  Reason no field of the caller shows, so none is lost. A caller can supply an entry name and
  one action per call, the form its entry name once, or handle the Refusal through the
  Operation's handling options; the Notice takes only the entry and the action of those options,
  never Reasons. There is no undo for a Refusal, and the Notice's action runs once. The projects
  Edit Drawer offers Archive on a refused delete of an active project. While the drawer is open
  and still shows the project active, also when the discard confirmation is answered, that
  Archive uses the same discard confirmation, archive Operation and undo as the form; otherwise
  it archives without an undo, since the page cannot know whether its archive changed anything.
  The Shell tells an editor at the moment it asks whether its opening is still open (`isOpen`);
  a drawer that slides out after the person closed it is closed.
- Each module puts the names of its synced tables (plural Lingui messages) and the texts of its
  own rules' Reasons into its Shell Contribution as data texts, made by `dataTexts` against its
  storage module through a type-only import: a synced table without a name, or a Reason of its
  rules without a text, does not compile, nor does a name or text the storage module does not
  call for, also from a map held in a variable or one of several maps; a rule answers only with the Reasons it
  declares. The app's module list mounts no module without data texts. The module list resolves the names by SQL table. The frame's Reasons are listed
  beside their definitions, and the reference check is typed against that list. The texts of
  rules registered from above are listed by hand in the app (`apps/web/src/reason-texts.ts`).
  The app composes all texts for `DataProvider`. The reference check uses table names, counts
  and the App Language's list and plural rules. Notice and form texts are rendered in the
  active language.
- An Edit Drawer asks for one row's Clearance once per opening, naming the kinds of write it
  presents; reopening the same entry, also during the drawer's exit or for a new object of its
  module, is a new opening, and an opening that closes before the answer calls its Clearance
  off.
  `clearanceQueryFor` checks the table, row ids and write kinds against the module's tables.
  Fields are usable while the answer is pending. Requested actions keep their ordinary
  appearance and ignore activation until the answer arrives; a Clearance that fails leaves
  them usable, since the write checks the rules anyway. A kind of write asked twice is one
  action with one explanation. A blocked action is disabled, and its
  text, its accessible description, appears in a live region above the footer, which stays
  pinned to the bottom of the drawer: the text takes its room from the free space below the
  fields. Nothing is reserved while nothing is blocked. Table Changes leave the opening's
  answer alone: an action the opening did not ask about, such as "Unarchive" after an archive
  elsewhere, is usable, also while the answer is pending, and the write still checks the rules
  when the user acts.
- Fixed Answers represent both kinds of result and validate each Reason against the definitions
  supplied by the story or test; a Refusal compiles only for an entry with the refusal block and
  needs one Reason at least. The Port access asks the Clearance through its own typed method,
  which Fixed Answers implement as the Data Process answers: they reject at setup a blocked
  answer whose Reason names another row or table, read the table, rows and writes of a query, answer each asked row once, and give every call its own copy;
  `answersByMount` routes a Clearance by its table to the mount the story names. The production startup audit keeps runtime Contracts, schema
  definitions and forms on demand.

## Consequences

A lower module can show the Reason for a rule from above without importing the rule or the
referring module. The compiler checks a module's table names and its own rules' texts against
its storage module, but not that the storage module a contribution names is the one the Data
Process mounts beside it. The Reasons of rules registered from above are listed by hand in the
web app, because the desktop app composes the Data Process and the web app imports nothing of
it. The compiler checks the names used in a Clearance Query and column map. The caller still
chooses the write represented by each button and the input field where a Reason belongs.

When the fields fill the drawer, the footer moves down by the height of a blocked action's text,
once, when the answer arrives. An undo offered right after an archive can still meet an archive
from elsewhere that landed after the drawer's last Table Change.

The [Port hooks guide](../development/port-hooks.md) and the [form guide](../development/forms.md)
document how to wire the pattern. Pre-save field locks remain for the first rule that needs them.

## Considered Options

- Loading a Clearance for every list row would add work to each list read and entangle lower
  modules with changes in referring tables. One read per Edit Drawer opening keeps that work
  local to editing and leaves the final decision at the write.
- Copying rules into forms would let the explanation diverge from the write's answer. Showing
  every Reason only in a Notice would detach field-specific feedback from the input to change.
