---
status: accepted
date: 2026-11-08
decisions: D38, D39, D40, D41, D43, D47, D50, D51, D108, D109, D110, D162, D163
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
- **Nightly builds automatically every six hours**, only when `main` changed since the last
  nightly; it can also be started by hand. Nightlies are public development builds without
  support, and their release notes say so.
- **Stable only builds a commit that was already published as a nightly.**
- **No release-please.** PR titles are Conventional Commits (checked in CI) and become the
  squash commits on `main`. A stable release is started by hand with a version number; its
  changelog is generated from the commits since the last stable (for example with git-cliff).
- **Versions rise slowly until 1.0.0.** The project starts at `0.0.1`; a stable release
  proposes a patch bump only. The middle number rises deliberately at milestones (for example
  a finished layer). `1.0.0` is the planned switch from the old Self-Engine, unless the switch
  comes earlier (see Consequences).

## Consequences

- Every channel needs its own identity wired through the build (see the channel identity
  issue in layer 0). The channel is compiled into the bundle (`SELF_ENGINE_CHANNEL` when
  building, unset means dev); it is never read from the running app's environment, and
  `app.isPackaged` cannot tell nightly from stable.
- The stable bundle `Self-Engine.app` has the same name as the old app, so installing it would
  replace an old app still installed under that name. Its app ID and data folder stay separate.
  Anyone with the old app therefore renames its installed bundle (for example to
  `Self-Engine Legacy.app`) before installing stable; renaming it changes neither its data nor
  its signature. The switch is planned for `1.0.0` but may come earlier; until then the owner
  uses nightly (D51).
- `main` must always be releasable, since any night can turn it into a nightly.
- **No commit carries a version.** A `v*` tag marks a published release, and
  `scripts/release-plan.ts` derives the rest from those tags: the base of a nightly and the
  version a stable proposes is a patch bump of the last stable tag
  (`apps/desktop/package.json` seeds the first one), and a nightly is
  `<base>-nightly.<YYYYMMDD>.<run>`. Packaging stamps the version into the app.
- **Releases live in this public repository** (D108, D162): the release workflow creates the tag
  and the GitHub release with the built-in token only, and anyone can download a build.
- **Updates are downloaded by hand.** The in-app updater is still to come; the public repository
  removes what blocked it, since an app cannot ship a token to read a private one.
- **macOS releases are signed with the Developer ID, hardened and notarized** (D109), and the
  packaging checks the result, because electron-builder only warns when it cannot sign. In CI
  a missing secret fails the run. Local packaging without the inputs stays ad hoc and needs no
  Apple account; such a build can never be updated, since Squirrel.Mac checks an update against
  the designated requirement of the running app, and for an ad-hoc signature that requirement
  is the hash of that exact build. The only entitlement is `allow-jit`, which V8 needs under
  the hardened runtime; library validation stays on.
- The repository variable `NIGHTLY_SCHEDULE_ENABLED` switches the nightly schedule, so it can
  be stopped without a commit. A nightly can always be started by hand.

## Considered Options

- **One app with a channel switch.** Rejected: channels would share a database.
- **release-please.** Rejected: its release PR creates a commit that never ran as a nightly,
  which contradicts "stable only ships a nightly commit".
