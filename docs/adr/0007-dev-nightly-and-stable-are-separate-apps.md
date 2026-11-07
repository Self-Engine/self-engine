---
status: accepted
date: 2026-11-08
decisions: D38, D39, D40, D41, D43, D47, D50, D51
---

# Dev, nightly and stable are separate apps

## Context

The owner wants three release channels: dev, nightly and stable. Migrations only move forward
(ADR 0003), so a nightly migration applied to the stable database would make it unreadable for
the stable app.

## Decision

- **Each channel is its own app**: "Self-Engine", "Self-Engine Nightly" and "Self-Engine Dev",
  installable side by side, each with its own name, icon, app ID (`app.selfengine.desktop`,
  `.nightly`, `.dev`), protocol scheme and data folder. A "copy data from stable" action seeds
  the other channels.
- **Nightly builds automatically every night**, only when `main` changed since the last nightly;
  it can also be started by hand.
- **Stable only builds a commit that was already published as a nightly.**
- **No release-please.** PR titles are Conventional Commits (checked in CI) and become the
  squash commits on `main`. A stable release is started by hand with a version number; its
  changelog is generated from the commits since the last stable (for example with git-cliff).
- **Versions rise slowly until 1.0.0.** The project starts at `0.0.1`; a stable release
  proposes a patch bump only. The middle number rises deliberately at milestones (for example
  a finished layer). `1.0.0` marks the switch from the old Self-Engine.

## Consequences

- Every channel needs its own identity wired through the build (see the channel identity
  issue in layer 0).
- `main` must always be releasable, since any night can turn it into a nightly.

## Considered Options

- **One app with a channel switch.** Rejected: channels would share a database.
- **release-please.** Rejected: its release PR creates a commit that never ran as a nightly,
  which contradicts "stable only ships a nightly commit".
