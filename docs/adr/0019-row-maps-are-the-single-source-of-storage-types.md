---
status: accepted
date: 2026-11-12
decisions: D219, D220, D221, D222, D223, D224, D225, D226, D227, D228, D229, D230
---

# Row maps are the single source of storage types

## Context

Hand-written query types can drift from SQL, while parsing every row costs more than the
query itself. Contracts need shared id and time schemas without loading database runtime code.
The typed-query spike proved that derived Kysely types and explicit mappings preserve brands
without runtime parsing.

## Decision

- Each module declares one row map in `./data`: table names to Zod row schemas with storage
  names and types. `TablesOf` derives Kysely types from it for `withTables` and storage functions;
  there is no second hand-written table type, `Generated` or `ColumnType`. Row schemas have no
  defaults or transforms and are never parsed in production queries.
- One hand-written, typed row-to-entity mapping per entity converts snake_case to camelCase
  and stored `0 | 1` to boolean. Entities carry `id`, `createdAt` and `updatedAt`, without
  `spaceId` or `deletedAt`. Normal reads and changes filter by space and live rows; deleted ids
  are not found. Deleted data leaves a port only through an explicit operation.
- Every index on a synchronized table starts with `space_id`. Unique indexes are partial on
  `WHERE deleted_at IS NULL`, never inline `UNIQUE`, so deleted names can be reused. Local Tables
  and the primary key's automatic index are exempt. `checkConventions` enforces these rules.
- `Instant` comes from `time`: canonical UTC text with three fractional digits and years
  1000–9999. Each entity has its own UUIDv7 id brand, shared by row maps, foreign keys and
  contracts through `idSchema`. A timestamp is the `Instant` the context's clock returns;
  `newId<EntityId>` creates the requested brand from the context's sources without a caller cast.
- `@self-engine/db/schema` is a pure entry for `idSchema` and `sqliteBoolean`. Contracts may
  import it and `time`; it imports no Kysely, uuid, driver or database runtime.
- Agreement tests run a module's migrations alone in a fresh database and compare its row map
  with the real tables, columns, allowed storage types and nullability. SQLite and Kysely
  bookkeeping are excluded; optional and boolean fields are rejected. CHECK expressions are
  not inspected. STRICT, indexes and foreign keys remain convention checks.
- Storage uses `executeTakeFirst()` and explicitly turns `undefined` into the port's not-found
  result. The lint rule forbids `executeTakeFirstOrThrow` and `takeFirstOrThrow`.
- `createTestSources(start)` supplies one clock, deterministic ordered ids and `advance(ms)`.
  A test-only notes module in `db` proves the typed round trip; the real module entry pattern
  follows with the port package.
- The `custom` JSON column promised by [ADR 0003](0003-one-table-per-module-entity-in-local-sqlite.md)
  is postponed until user fields exist (D222). That feature adds it through a migration, with
  `z.string()` in the row map and JSON parsing in the mapping.

## Consequences

The row map is written once, with agreement tests guarding its match to immutable migrations.
Mappings stay explicit and cheap. User fields need a later migration per module, avoiding an
unsettled schema and JSON parsing on every row today. Restore conflicts and the shared space/live
query entry belong to the port pattern (#32).

## Considered Options

- Hand-written Kysely types alongside schemas, or generated files: extra sources to keep aligned.
- Kysely's camel-case plugin: raw SQL bypasses it and entities still need explicit conversion.
- A shared id brand: it would allow a task id where a project id is required.
- Exception-based not-found handling: bundled exception identity is unreliable and expected
  results should be explicit.
