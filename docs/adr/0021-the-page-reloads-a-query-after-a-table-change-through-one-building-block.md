---
status: accepted
date: 2026-11-13
decisions: D247, D248, D249, D250, D251, D253, D255, D256, D257, D261
---

# The page reloads a Query after a Table Change, through one building block

## Context

A module’s data lives behind its Port in the Data Process (ADR 0018, ADR 0020). The page has
to read through it, learn when an answer is outdated, call Operations and show their errors.
Left to each module, ten modules would bring ten answers to the same questions, and a list
that joins two tables would silently show old data whenever someone forgot to name one of
them. A measured refetch costs 2 ms at 1,000 rows and 12 ms at 10,000; the time a user feels
is spent drawing.

## Decision

- **Ask and reload.** Data stays in SQLite in the Data Process; the page calls named Queries
  and reloads them after a Table Change. A client-side copy of rows is allowed only for a
  single View with direct manipulation, behind its own hook. There are no optimistic updates.
- **Declared reads.** A Query entry declares the tables it reads next to its SQL, on the data
  side. The contract kit fails when a Query reads an undeclared table. The Data Process sends
  the list of every mounted Query’s tables with the opening event of each Table Change stream;
  entries absent from it are Operations. The page never names a table.
- **Freshness.** An answer is valid until a Table Change names one of its tables. A matching
  Query on screen reloads at once and keeps showing its previous answer until the new one
  arrives; one off screen is marked and reloads when shown. Every reconnect marks every answer.
  Window focus and elapsed time trigger nothing. Answers no View shows are dropped after 5
  minutes. Unchanged rows keep their object identity across a reload.
- **One building block knows the query library.** It is the React entry of `data-client`
  (`portHooks`, `DataProvider`); a boundary check rejects the library’s import anywhere else.
  A module builds one hook per entry from its Contract type and mount name: a Query hook for
  windows, small sets and single rows, and an Operation hook. Keys, reloads and error paths are
  the same for every module. The Port access comes from outside, so a story substitutes it.
  A module’s hooks live inside the module and are released to others only on demand. The hook
  for page lists comes with the list that draws only what is visible (#137).
- **Expected errors are values.** An Operation returns success, a conflict with its reason,
  not found, or unexpected, and throws for none of them. The module gives every conflict reason
  of an entry a translated text and a field; the types demand all of them. The building block
  announces “not found”, which a module may replace, and unexpected errors.
- **Commands reach the Port through their context.** Every Command context carries the Port
  access the app gives the building block, and the building block offers each Operation as a
  function of that access, with the same result and the same default Notices as the hook.
- **Shared states.** One piece in `ui` maps a Query’s state to the existing loading state
  (after its delay), the error state with retry, or the answer. A failed reload keeps the
  answer and shows a Notice that it may be outdated.
- **Fixed Answers.** Stories and component tests give each Port entry a Fixed Answer, checked
  against the entry’s output schema and declared errors. A call to an entry without one fails.
  The Contract’s schemas load at runtime only in story and test code.
- **One changed row redraws one row.** A row is its own memoized component that receives its
  row whole and nothing that is new on every list render. A gate test renames one of 1,000
  `placeholder-alpha` rows and requires exactly one row and the list itself to draw.

## Consequences

Module authors write one line per hook and handle only what is special to their module; the
[guide](../development/port-hooks.md) gives the steps, with `placeholder-alpha` as the template.
What the building block lacks is added there once, not worked around in a module. Freshness
depends on every committed change being announced and every Query declaring its reads; the
contract kit checks both, but sees only the SQL its examples run. A later sync engine only has
to send the same Table Change; the page needs no change. Stories show states, not flows: a
Fixed Answer never changes, so each module proves its flow in one test over the test Data
Process. The building block adds about 40 KB to the startup JavaScript, and the startup limit
was raised once by the rule in D258 ([performance](../development/performance.md)).

## Considered Options

- **A client-side copy of rows as the base** (TanStack DB, Linear), an event log (LiveStore) or
  a sync engine that dictates tables: rejected for now. The Port would need generic row access,
  joins would bypass the read pieces and every Operation would exist twice; the others fix the
  data model or the engine now.
- **Tables named in the hook:** a forgotten name lets a joined list go stale silently.
- **Tables in the Contract:** oRPC does not type metadata per entry, and the page would have to
  load the Contract at runtime.
- **The query library in modules directly:** each module would choose its own keys and error
  paths, and a View could no longer switch to a client-side copy behind its hook.
- **The query library’s defaults:** they reload on every mount and on focus although the Data
  Process says when data changed.
- **Thrown errors for conflicts and “not found”:** a module can overlook them.
- **A global Port access for Commands:** two providers on one page overwrite each other, and a
  Command before the first provider would have nothing.
- **Fixed Answers checked by type only:** an id of the wrong form or an invalid instant would
  pass, and the story would prove nothing.
