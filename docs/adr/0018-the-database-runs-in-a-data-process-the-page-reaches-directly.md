---
status: accepted
date: 2026-11-12
decisions: D90, D93, D97, D187, D190, D192
---

# The database runs in a Data Process the page reaches directly

## Context

better-sqlite3 is synchronous. A long import, a rebuild or a slow query blocks whichever thread
runs it, and in the main process that thread also moves and paints the window. The page needs
typed calls into the database and a way to learn which tables changed, and it must survive the
database side crashing without losing a draft. The core of this must also run on mobile later,
where there is no Electron.

## Decision

1. **The database runs in its own _Data Process_**, an Electron `utilityProcess` that opens the
   file in the channel's data folder and runs all pending migrations before it serves anything.
   Its core lives in `@self-engine/data-process` and knows nothing about Electron. It takes an
   opened database, the migrations and a message port.
2. **The page talks to the _Data Process_ directly over a `MessagePort` with oRPC.** For each
   request the main process creates a `MessageChannelMain` and gives one end to each side. A port
   cannot cross the context bridge, so the preload forwards it into the page with a window message.
   The page accepts that message only from its own origin. `@self-engine/contracts` composes the
   one app contract from the modules' contracts and owns only what crosses modules: `health` and
   the `tablesChanged` stream. `@self-engine/data-client` builds the typed client on the page.
3. **The main process only starts, watches and hands out ports.** No call passes through it. After
   an unexpected exit it restarts the _Data Process_ and gives the page a fresh port. After three
   unexpected exits within one minute it stops until the person retries.
4. **The two failure states stop instead of looping.** When a migration fails or the database
   comes from a newer version, the _Data Process_ stays alive and answers only `health`, which
   names the migration. It refuses every other call, and the main process does not restart it.
   The page shows the reason in place of the app.
5. **A lost _Data Process_ is a state of the connection, not an error of a port.** The page is
   connecting, ready, reconnecting, or in one of the failure states. While it reconnects, the app
   stays mounted and its calls wait.

## Consequences

- The window stays responsive while the database works, at the cost of a third process and a
  third bundle next to main and preload.
- The native SQLite module ships unpacked from the archive. The smoke stage of `pnpm verify` and
  the packaged smoke test start the real app and check that the page shows the app, the first
  answer and a reconnect after the _Data Process_ is killed.
- The data client loads at startup, because data is part of the first screen. Its bytes count
  against the startup budget.
- The web app has no _Data Process_ yet. It keeps running without one until a web driver runs the
  same core in a worker.

## Considered Options

- The database in the main process: a slow query would freeze the window, and a crash would take
  the whole app down.
- A worker thread in the main process: it would still share the main process's lifetime and
  crash with it.
- An own RPC layer over the port: oRPC already types the calls, their errors and event streams,
  and runs inside a sandboxed `utilityProcess`. An own layer was only the fallback in case that
  failed.
- Routing calls through the main process with IPC: each call would cross two hops and wait
  behind the main process's own work.
