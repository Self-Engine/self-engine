---
status: accepted
date: 2026-11-09
decisions: D62, D113, D114, D115, D116, D117, D118, D119
---

# Settings are single entries behind an asynchronous port

## Context

Settings start in `localStorage`, which is synchronous. From layer 2 the Synced Settings live in
the database behind a `MessagePort`, where every access is asynchronous, and later they sync
between devices. The theme engine needs its appearance values on the first React render: if the
app rendered defaults and loaded afterwards, the wrong colors would flash and the defaults would
overwrite the Start Cache. A newer app version on one device must also not lose values on an
older one.

## Decision

1. **The port is asynchronous, reading is synchronous.** An adapter has `load`, `save` and
   `subscribe`, all asynchronous, even over `localStorage`. The app waits for `load` once before
   its first render, and the Start Cache covers that wait. From then on the store reads from a
   snapshot in memory. A write changes the snapshot at once and saves in the background.
2. **Each Setting is one entry under a permanent key.** `save` receives only the entries that
   changed. Two devices changing different Settings therefore never conflict, and a version that
   does not know an entry never touches it. Values that only make sense together are one Setting
   with an object as its value.
3. **Failing storage never stops the app.** A broken entry shows its default, a failed `load`
   starts the session from defaults, and a failed `save` keeps the value until the restart. What
   is stored stays untouched, and the failure is reported.

## Considered Options

- One object per store or per area: simpler to write, but a sync conflict silently loses one of
  two independent changes, and every writer has to carry unknown fields along by hand.
- A synchronous interface now, rebuilt in layer 2: cheapest today, but it changes every caller.
- An asynchronous read with a loading state: every component would have to handle "not loaded",
  and the theme provider would have to wait anyway.

## Consequences

- From layer 2 the first render depends on the data process, so the database adapter has to bound
  that wait or keep a local copy of its values.
- Keys are as permanent as Theme ids. Renaming one needs a migration of the stored data.
- Sync can produce a combination of Settings nobody chose. Each Setting has to stand on its own.
- Window size and position are not Settings. The main process needs them before any renderer
  exists, so it keeps them in its own file.
