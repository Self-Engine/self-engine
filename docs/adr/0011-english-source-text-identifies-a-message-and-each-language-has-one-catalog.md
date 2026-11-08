---
status: accepted
date: 2026-11-09
decisions: D24, D66
---

# English source text identifies a message and each language has one catalog

## Context

The app ships in German and English from the first release, and every visible text passes through
Lingui. How a message is identified appears at every call site, so changing it later means touching
all of them. The old Self-Engine has about 6,700 messages, and its code is ported file by file. The
repo also keeps strict module boundaries (ADR 0006), which suggests that each module might own its
translations.

## Decision

1. **The English text is the message.** Code contains the English sentence, and Lingui derives the
   id as a hash of that text and its optional context. English is the Base Language: it is the
   source of every other language and the fallback for a missing translation.
2. **Ambiguous text carries a context.** Identical English with identical context is one message,
   so a short word with several meanings ("Open" as a verb and as a status) must state its context.
3. **Each language has one catalog.** The catalogs live in `packages/i18n` and are extracted from
   the source of every app and package, with patterns that need no change for a new module.
   Extraction reads across packages; no module imports another for it.

## Consequences

- Changing an English text creates a new message. Its translations are empty until someone fills
  them in, so a text cannot change in English while German silently keeps the old meaning. Even a
  typo fix in English touches the catalogs.
- Translations of the old Self-Engine carry over when the English text stays the same.
- No check can detect two meanings merged into one message; only the rule on context prevents it.
- Parallel PRs edit the same catalog files and can conflict. Running extraction again resolves that.
- A module is not self-contained for translation. A later third-party plugin can still bring its
  own catalog, because Lingui merges catalogs at runtime.

## Considered Options

- **Named keys (`projects.form.save`):** rejected. Every text would need an invented name and an
  edit in a second file, and an English change would leave German silently out of date.
- **German as the source:** rejected. Code and documentation are English (D24), and English is the
  better fallback for further languages.
- **One catalog per module:** rejected. The same word would be translated once per module and could
  drift, and every module would have to register its catalog at runtime.
