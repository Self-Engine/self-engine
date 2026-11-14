---
status: accepted
date: 2026-11-15
decisions: D323, D329
---

# Every edit names what changes, and its inputs come from one field list

## Context

An edit form sends the id and the fields that changed (D323, ADR 0030). The Data Process has to
tell "missing", "empty" and "value" apart for that to mean anything: a title change must not
send, or clear, an icon this version of the app does not know. A caller without a screen, such
as a Command or a later assistant, has no form to keep it honest: a misspelled `titel` that Zod
drops silently answers "saved" and changes nothing, and a retry of an edit must be harmless.

Every module after `projects` writes an edit Operation. Written by hand each time, the create
input and the edit input of one entry drift apart, and each module answers these questions
slightly differently.

## Decision

Every module's edit Operation follows four rules (D329):

1. **Missing, empty, value.** A field missing from the call stays untouched. `null` clears it. A
   value sets it. A required field may be missing but never `null`.
2. **Unknown fields are an input error.** Every input of every Contract entry is strict: it
   rejects an unknown key and drops nothing silently. This holds for create, for every other
   Operation and for Queries too.
3. **An edit without fields does nothing.** It answers with the entry, writes nothing, leaves
   `updated_at` and sends no Table Change. An unknown or deleted id is still "not found".
4. **Create may omit an optional field,** which then counts as empty.

The parts:

- `entryFields(idSchema, fields)` in `@self-engine/db/schema`, beside `idSchema`, derives both
  inputs from one field list. A field whose schema accepts `null` is optional; every other field
  is required. `create` requires the required fields and lets the optional ones be missing;
  `edit` takes the id and every field optional. Both are strict objects, and their types need no
  cast. A rule across fields is declared on a derived input with `.refine`; it checks the fields
  when they travel together, and its `params.reason` reaches the caller in the issues of the
  input error. The entry builds Zod schemas, so it loads with a Contract and never at startup;
  the startup check names it.
- `sharedWrites(tx, context).update(table, id, fields)` writes only the fields that are not
  `undefined`. With none left it reads instead: it answers with the live row and writes nothing,
  so the frame announces nothing. The module maps its input to columns without a branch of its
  own.
- An Operation entry declares itself an edit with `edit: true`. The contract kit then checks
  rules 1 to 3 on a seeded database: an edit without fields writes nothing and announces
  nothing, an unknown id is "not found", and after the example, which sets every field, each
  field sent alone (as `null` where it may be, then as its value) changes that field and no
  other. The input's required keys are the identity and its optional keys the fields; the answer
  carries each field under its input name. For every entry with an object input the kit also
  fails an input that accepts an unknown field.

**Limit:** the Operation does not compare with the stored state. A call that sends the value
already stored writes, and `updated_at` advances; preventing it would cost a read before every
write. The form never sends such a call, because it compares with the stored state (D321).

## Consequences

A module lists its fields once and gets both inputs, so they cannot drift. Contracts become
stricter: renaming a field changes every caller in the same step, and TypeScript shows them.
Tests and fixtures that sent extra keys had to send exactly what an entry takes. The kit's edit
check needs a seeded entry with the example's id, as every operation example already does, and
an example that sets every field. Fields whose names differ between input and answer cannot use
the check; the pattern keeps them equal. The test module `cards` of `storage` shows the pattern;
`projects` is its first real user.

## Considered Options

- **Reject an edit without fields:** it is no mistake of the user, and a retry should succeed.
- **Write an edit without fields:** under a later sync where the newer change wins, a call that
  changes nothing would win over a real rename.
- **Non-strict inputs that drop unknown keys:** a typo in a Command would never show.
- **The pattern by hand in every module:** create and edit drift apart, and each module answers
  "missing" and "empty" its own way.
- **The building block in `storage`:** a form's chunk would load storage code with its Contract;
  the schema entry of `db` is already in every Contract.
- **A separate `edit` write next to `update`:** no caller wants an update that writes only
  `updated_at`, so `update` itself reads when nothing travels.
