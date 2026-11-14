---
status: accepted
date: 2026-11-12
decisions: D187, D188, D189, D190, D195, D231, D232, D233, D234, D235, D236, D237, D238, D239, D240, D241, D260, D287, D317
---

# Modules implement their ports through one shared frame

## Context

Each module needs typed calls into its stored data. Repeating validation, transactions,
Space scoping and table announcements in every module makes omissions silent: a list can
show another Space’s data or fail to reload. Checking every output in the packaged app also
makes one malformed row block an entire list. Bridges need to compose several modules’
changes atomically without opening a transaction for each call.

## Decision

- A module owns one port and one contract describing it. Its pure `./contracts` entry exports
  schemas and the oRPC contract; `./data` implements it with a row map, migrations, lower
  functions, conflict mappings and released read pieces. There is no second hand-written
  interface for the same port. A module is defined in two steps: its name, contract, row map
  and migrations first, then its lower functions, which take their transaction and input types
  from that first step, list builders included.
- `@self-engine/storage` supplies a shared frame built on oRPC. It checks inputs before the
  transaction, builds a context with one sampled time, branded id generation and the Space,
  and calls a lower function marked query or operation. Lower functions receive the existing
  transaction and never commit or announce. Queries have read-only access. Bridges call
  lower functions inside their own transaction; streams and progress imports may remain
  hand-written.
- A form checks its Draft with the Contract’s input schema for field feedback (D317).
  This does not replace the frame’s input check: the Data Process checks every input and
  decides, including calls from Commands, imports and a later assistant. Contracts used by
  forms load with the lazy Edit Drawer, never at startup (ADR 0030).
- The frame checks outputs inside the transaction in tests and development. With checks off
  it uses a copy of the contract without output schemas. Output schemas preserve values in
  both modes; the contract kit rejects conversions and defaults. A failure rolls back and
  announces nothing.
- A query-tree plugin records successful write targets affecting at least one row, treating
  a missing affected-row count conservatively as a write. After an operation commits, the
  frame announces the nonempty set once. Raw SQL in storage is forbidden by lint. The kit
  detects every changed table missing from the announcement, including trigger side effects;
  an announcement is valid even when affected rows were rewritten with identical values.
- The shared query entry scopes synchronized rows to the current Space and live rows. Its
  standard insert, update, soft-delete and restore paths set convention columns and report
  absent rows explicitly. Other queries remain ordinary Kysely with explicit filters.
- Lists are windows, pages or small sets. Pages use an indexed fixed keyset order ending in
  `id`, default to 100 rows and allow at most 500, chosen in storage. Their unsigned opaque
  cursor carries the module and contract entry names, direction and sort values and survives Data Process
  restarts. Windows and small sets return all rows; with output checks on, at least 1,000 rows
  produce a warning rather than a failure.
- Expected errors are `NOT_FOUND` and `CONFLICT` with operation-specific reason codes. Each
  unique index maps to a reason; create and restore share that mapping. Lower functions throw
  business conflicts that no index expresses. Unmapped violations and other unexpected errors
  become a generic internal error. Details and large-result warnings go through one injected
  `report` callback passed through by the Data Process. Issue #37 connects the local error log;
  until then reports write no file.
- Foreign reads use owner-released pieces with fixed columns and a built-in Space filter.
  They retain deleted targets and mark them, so deleting a target does not hide recorded work.
  Consumers join them in one query and keep only their own row map. Lint rejects foreign
  row-map imports; writing foreign tables directly remains forbidden.
- One data-side module list in `data-process` builds migrations and router together. Modules
  depend on storage, never data-process. Storage contains neither Electron nor a native driver,
  keeping transport, driver and future sync changes behind the ports.
  _Replaced in part by [ADR 0022](0022-the-desktop-app-owns-the-module-list-and-the-data-protocol-what-crosses-modules.md):
  the module list lives in the desktop app, which hands it to the `data-process` core._
- One contract-kit call per module uses real in-memory SQLite, its migrations, a seed and
  valid examples for every entry, plus conflict examples. The kit derives invalid inputs;
  accepting every derived candidate fails. It checks shared invariants, not business behavior.
  The test-only notes module is the template, with note-links proving foreign read composition.

## Consequences

Module authors write domain-specific functions while one frame owns the repeated rules.
The kit and agreement/convention checks carry more responsibility because packaged output
validation is deliberately off. The plugin cannot observe trigger writes directly, so the kit’s
unannounced-change check is essential. Read-piece owners maintain a deliberate stable surface.
The Space of the context is the Personal Space the Data Process makes sure of at its start
([ADR 0028](0028-every-row-belongs-to-a-space-the-context-supplies-and-the-database-knows.md)),
and page totals follow in #137. The renderer side,
hooks and Fixed Answers, is recorded in ADR 0021.

The [module-author guide](../development/port-pattern.md) gives the implementation steps;
[performance checks](../development/performance.md#storage-port-pattern) record measured costs.
This completes the port pattern anticipated by ADR 0019 and moves its notes template from db
to storage. The data-side module list replaces the desktop-side composition anticipated by D135.
[ADR 0022](0022-the-desktop-app-owns-the-module-list-and-the-data-protocol-what-crosses-modules.md)
moves that list back into the desktop app, so the `data-process` core knows no module.

## Considered Options

- A separate frame per module: duplicates the same failure-prone rules.
- Manually declared changed tables: forgetting one silently prevents reloads.
- A driver update hook: unavailable in the chosen driver and less portable than query trees.
- A complete query language above Kysely: every unusual query would require another abstraction.
- Calling framed ports from bridges: each call would own a different transaction.
- Reading foreign tables directly: duplicates scoping and couples consumers to private columns.
- Always checking outputs: one malformed row would prevent an otherwise usable list from loading.
