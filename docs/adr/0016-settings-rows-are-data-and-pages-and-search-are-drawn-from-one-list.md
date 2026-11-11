---
status: accepted
date: 2026-11-12
decisions: D197, D202, D204
---

# Settings Rows are data, and pages and search are drawn from one list

## Context

The settings area has to show every Setting on the page of a View and let a search find it by its name, its explanation or one of its values, across all Views (D199). Built freely, each View would be a hand-written page beside a separately kept search index, and the two drift apart the first time someone adds a Setting. A later module that brings a Setting would have to build its own page. The area must also cost the start nothing: it has controls for every View, and the search needs all of them at once.

## Decision

1. **Every visible line of the settings area is one Settings Row in one list.** A row has an id, the View it belongs to, a title, an optional description, search words, the names of its values, and a control. Titles, descriptions, search words and value names are message descriptors, translated when shown, so they follow a change of the App Language.

2. **The page of a View draws its rows from that list, in order, and the search filters the same list.** Nothing about a row is declared a second time.

3. **A row is not a Setting.** It may serve one Setting, several or none, and a Setting may have no row. The row follows what the user sees, not how a value is stored.

4. **The control is a component of the row.** Standard shapes (a few named values, on or off, a few numbers in order) are built by helpers that also fill in the names of the values. A row that fits none of them draws its control itself and is still one row with a title and search words. A row may also be produced from other data.

5. **The settings area is the package `@self-engine/settings-area`.** Its main entry exports a function that takes what the app owns, at first the settings store, and returns the Shell Contribution `settings`; the app keeps handing it to the Shell beside the modules. Only the id, name, icon and View titles are in the startup bundle. The list of rows and every control load as one chunk when the settings are first opened, not one per View.

6. **The declarations of the Settings the area owns live in a second entry without interface code,** `@self-engine/settings-area/settings`, because the app reads them before the first render. Every other owner keeps declaring its own Settings (ADR 0010).

7. **A unit test audits the real list against the contribution's Views:** every row id is unique, every row belongs to a View the contribution has, and every View has at least one row. A View therefore arrives with its first row. A row also names the keys of the Settings it serves, and the test fails when a Setting the area has to show is served by no row.

## Consequences

- Adding a Setting to the area is one entry in the list. It is then on its View's page and findable: the search compares a row's title, description, search words and value names in the language shown, by the Command Palette's rule, which the Shell exports as `wordMatch` so that the area shares it without loading the palette.
- Every row has to fit "title, description, control". What does not fit that shape is not a row.
- The row's type is exported from a package that modules may import. Modules cannot contribute rows yet; the extension point is added with the first module that needs it.
- The controls receive the store as a prop instead of importing one, so the area can be rendered on any store, which is how its stories test it.
- The startup bundle audit needs no entry for the area: its code sits behind a dynamic import, and importing it eagerly fails the build.

## Considered Options

- **Freely built pages with a separately kept search index:** rejected. The index is out of date as soon as someone adds a Setting to a page only.
- **Searching only the titles of the Views:** rejected. The Command Palette does that already, and it would not find a Setting by its name or value.
- **Rows that describe their control as data (kind, Setting, options) instead of holding a component:** rejected. A list of rows over different value types needs a cast per row, and every special row, such as the Theme cards, would need an escape anyway. The helpers give the same brevity for the standard shapes.
- **Everything in the web app:** rejected. Modules could never import the shape of a row, and the app would grow interface code of its own.
- **One chunk per View:** rejected. A search shows working controls of all Views, so it would load them all anyway.
