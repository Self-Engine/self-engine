---
status: accepted
date: 2026-11-12
decisions: D200
---

# The App Language follows the settings store alone

## Context

The App Language can change from three places: the picker in the settings area, another tab of the same browser, and later sync from another device. A language is only usable once its catalog has loaded, and that load can fail. An app that switched before the catalog arrived would be half translated. The choice also has to be known before the first render, or the start shows text in another language first.

## Decision

1. **The choice is the Synced Setting `i18n.language`.** Its value is `system` or the tag of a language, its default is `system`, and its schema accepts any text. The settings area declares it in `@self-engine/settings-area/settings`, beside the appearance Settings (ADR 0016).

2. **The picker only writes the Setting.** It loads nothing and switches nothing.

3. **One watcher above the router does the switching.** It watches the store and the browser's `languagechange` event. On a change it resolves the App Language from the stored value and the system languages, loads the catalog, and only then switches. The newest wish wins over a slower earlier load.

4. **A catalog that fails to load changes nothing but a Notice.** The language shown stays, `notifyError()` reports it, and the stored value is left alone, so the choice applies at the next start. The watcher does not load the same language again until another one was asked for in between.

5. **A stored value the app does not offer behaves like `system` and stays stored.** A newer version on another device may have a language this one lacks; this device then follows its system and never overwrites the value. The picker shows such a value as "System".

6. **The start resolves the stored value the same way,** after the store has loaded and before the first render (ADR 0010), and renders nothing before that catalog is there.

7. **The names of the languages are not translated.** Each stands in its own language in every catalog, so that someone finds theirs again after a wrong choice.

## Consequences

- A change from the picker, from another tab and from sync takes the same path, so there is one flow to test.
- After a failed load the picker shows the chosen language while the app is still in the old one, until the next start or the next choice.
- `@self-engine/i18n` still knows nothing about Settings: the watcher lives in the app, which owns the store, and hands the language to the package's provider.
- The whole app renders once on a switch. Between switches the watcher costs one read and one comparison per write to the store.
- The area's unit test over the Settings Rows fails when no row serves `i18n.language`.

## Considered Options

- **Load first, then store:** rejected. A change from outside the picker would need the watcher anyway, so there would be two flows.
- **A closed schema with the offered languages:** rejected. A device on an older version would read a newer language as invalid, and the next write would lose it.
- **Storing the resolved language instead of `system`:** rejected. Following the system is decided by each device for itself, and a stored tag would follow the user to a device with another system language.
