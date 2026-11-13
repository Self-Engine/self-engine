---
status: accepted
date: 2026-11-10
decisions: D174, D175, D176, D177, D178, D261
---

# A Command's kind decides who can start it, and its code loads on demand

## Context

Every action of the app has to be reachable from a button, a shortcut, the Command Palette and later an assistant (D85). Until now a command took no input and could only write to the page it was started on, so an assistant could neither create nor change anything through it. The code that ran it sat inside the one button that used it. The startup bundle must not grow with the number of Commands, and a new action must not need a second list that says who may call it.

## Decision

1. **Every Command declares a kind, and who can start it follows from that.** There is no separate flag for agents.

   | Kind    | Started by                         | Has a page | Required input | Label and shortcut |
   | ------- | ---------------------------------- | ---------- | -------------- | ------------------ |
   | `page`  | a person                           | yes        | no             | yes                |
   | `open`  | a person or a later agent          | no         | no             | yes                |
   | `input` | a later agent, until a form exists | no         | yes            | none               |

   A Command with both a page and required input does not exist, because nobody could start it. A module's main action is never `input`. The types enforce both, and only a `page` Command gets the address capability in its context. Every Command, of every kind, gets the Port access in its context (`data`, D261): a Command calls an Operation through the Operation's function form, outside React, with the same access the app gives the data building block.

2. **The contribution holds what the palette and shortcuts need at once:** short id, kind, label, default shortcut and `load`. Schema, English description and `run` live in the loaded file, as a View's code does (ADR 0013). The description is for a model, so it is not translated.

3. **A Command's loaded file goes through `definePageCommand`, `defineOpenCommand` or `defineInputCommand`.** They check `run` against the schema and the schema against the kind, then give up the input type, so that the runner and the register can hold any Command.

4. **The register forms the full id `<module>.<command>`.** An id is never renamed or reused, which also holds for module ids. The prefix `shell` belongs to the Shell's own Commands, and no module may be called that.

5. **The runner has two layers.** The core loads, validates, runs and returns success or failure, shows nothing and guards nothing, so a later agent can use it alone and two calls in a row both run. Above it, one start for people captures the page at the moment of the press, ignores a second start of the same Command while the first runs, and reports a failure with a Notice.

Reads are not Commands. They stay declared queries in the oRPC contract (D93).

## Consequences

- A person's "New project" and an agent's `create` are two Commands, one thin wrapper per operation that an agent should reach.
- Whether a schema accepts an empty object can only partly be seen in its type: a refinement is invisible. A unit test over all real contributions therefore loads every Command and compares its kind with its schema's answer. It runs in the tests only, so the app never loads Commands to check them.
- A second start stays ignored while a slow load is pending, also from another page, until that load ends.
- The startup bundle audit needs no list of Commands: a Command's file is a dynamic import like a View's, and importing it eagerly fails the build.

## Considered Options

- **One sort of Command for everyone:** rejected. An agent starting "New project" would only open a drawer.
- **A register for people only, agents call operations directly:** rejected. It reverses D85 and wires every action twice.
- **The schema in the contribution:** rejected. It would pull the domain schemas of every module into the startup bundle.
- **The module writes the full id:** rejected. The module's name would be written twice and could be misspelled.
- **Each caller runs the Command itself:** rejected. A shortcut and a palette would each need their own guard and failure path.
