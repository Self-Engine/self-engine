# Self-Engine

A local-first, open-source app for organizing life and work — the planned successor of
Self-Engine.

- **Composable:** built from domain modules (projects, time tracking, tasks, calendar,
  finance, habits) and the bridges between them. Later: plugins by others.
- **Local-first:** your data lives on your device. No account required.
- **Sync is opt-in:** a hosted service or self-hosted, added later.
- **Work-ready:** organizations will be able to provide shared spaces with locked rules
  (e.g. a rounding method), while personal data stays private.

Status: early development, not ready for everyday use. The
[nightly builds](https://github.com/Self-Engine/self-engine/releases) are development builds:
they change often, can break and come without support.

This project does not accept issues or pull requests from others yet, see
[`CONTRIBUTING.md`](CONTRIBUTING.md). To report a security problem, see
[`SECURITY.md`](SECURITY.md).

The planning documents in [`docs/plan/`](docs/plan/) are in German for now.

- [`docs/plan/00-decisions.md`](docs/plan/00-decisions.md) — decision log
- [`docs/plan/01-design-tree.md`](docs/plan/01-design-tree.md) — open and settled questions

For module authors: [add a module’s port](docs/development/port-pattern.md), then [use it in its Views](docs/development/port-hooks.md).
