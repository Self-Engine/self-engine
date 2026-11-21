---
status: accepted
date: 2026-11-21
decisions: D348, D369
---

# An Operation answers an input error a form shows at its field

## Context

Some limits at an Operation's input only the Data Process can judge: a timer's start must not lie
after its "now" (D348), and the page's clock is not that "now". The page checks a draft with the
Contract's input schema (ADR 0030), which cannot know it. Before this, an input error the Data
Process answered counted as unexpected on the page and reached no field, while a Conflict, a
Refusal and "not found" each had a result of their own (ADR 0021, ADR 0033).

## Decision

- **The Operation raises an input error.** It throws `inputError(path, reason)` of `storage`:
  the same shape as the frame's own check of the input, one custom issue at `path` with
  `params: { reason }`. The frame rolls the transaction back, announces nothing and passes the
  error on. A limit that depends on stored rows stays a Protection Rule with a Refusal
  (ADR 0033); this is for limits at the input itself.
- **The Contract declares its reasons.** The entry spreads `inputErrors(...reasons)` of
  `@self-engine/db/schema` into its `.errors()`, as it lists a Conflict's reasons. With output
  checks on, the frame reports an input error with a reason the entry does not declare as
  unexpected, and still answers it.
- **The page gets a result of its own.** The Operation hook and its function form sort the
  answer into `invalid`, beside `conflict`, `notFound` and `refused`: every issue with its field
  (the dotted path, as a form names fields), its path, its reason where it has one, and the issue
  as it arrived; `atFields` holds those at a field the caller shows (`showsField`). An input error
  of the frame's own check takes the same way. An issue at no field the caller shows, and every
  issue of a caller without fields such as a Command, gets the general Notice of an unexpected
  failure, so none is lost. A malformed one is unexpected.
- **A form shows each issue at its field.** It words it as its own check words an issue: a reason
  takes the module's text from `texts.reasons`, anything else the helper's text for its kind. The
  save failed: the Draft stays, the form unlocks, the first such field on screen takes the focus
  once the lock ends, and the message leaves when its field changes, as a Conflict's does. The
  next answer replaces the issues of the last one.
- **The compiler asks for the texts.** A form of an entry that declares input-error reasons does
  not compile without a text for each of them. A reason without a text that reaches the form all
  the same, from the input schema or past the compiler, shows the catch-all and logs an error,
  which fails a story (ADR 0012).
- **Fixed Answers** give an input error with `{ invalid: [{ path, reason }] }`, only with a
  reason the entry declares.

## Consequences

One way serves both limits of the timer, the start of a running timer (`editTimer` declares
`start_in_future`) and the end of "Stop at …" (`stopTimer` declares `end_before_start` and
`end_in_future`), and every caller, also one without a screen. Every form knows one more result, without code of
its own. The reasons stay strings in the issue on the wire; the tie to the texts is a type of the
Contract entry, and the frame's report catches a raised reason the entry does not declare in tests
and development. Comparing the input with "now" costs one comparison per call.

## Considered Options

- **The page checks with its own clock:** the rule would live in two places, and the form helper
  would need a check beside the Contract.
- **A Protection Rule with a Refusal:** fits a timer's start, not "Stop at …": the end lands in
  the Time Entry, where entries in the future are allowed.
- **A Conflict:** a Conflict is a duplicate value.
- **The reason as a plain string, found missing only by a story** (D369 as first written): kept
  for the reasons of the input schema, whose types Zod does not expose; the declared reasons of an
  Operation cost one spread in the Contract and give the compiler the check.
