# Self-Engine

Local-first productivity app for freelancers and the self-employed: projects, time, finance, calendar and habits. This glossary captures terms whose meaning is specific to this project and easy to confuse. Terms arrive with the module that owns them.

## Format

Group terms under a `###` heading per area. Each entry looks like this:

```markdown
**Term** (de: _Begriff_):
One or two sentences on what the term means in this project, and what it does not mean.
_Avoid_: synonyms that blur the meaning, comma-separated
```

- `de:` gives the German term the app shows (the app ships in German and English).
- `_Avoid_:` lists words not to use for this concept in code, issues or UI.
- Refer to another term in _italics_, spelled as its entry.

## Language

### Appearance

**Accent** (de: _Akzentfarbe_):
The app's highlight color for filled controls, active items and links. It is either picked from a fixed list or comes from the _Theme_; a _Theme_ does not have to bring one.
_Avoid_: primary color, brand color

**Background Tint** (de: _Hintergrundtönung_):
The slight coloring of the app's outermost background with the _Accent_. It can be switched off and never affects the containers on top of that background.
_Avoid_: glass, wash

**Color Mode** (de: _Farbmodus_):
Whether the app is shown light or dark, or follows the system.
_Avoid_: color scheme, mode

**Color Role** (de: _Farbrolle_):
The named purpose a color serves, such as the page background or muted text. Components choose a _Color Role_, never a concrete color.
_Avoid_: token, shade, color variable

**Color Set** (de: _Farbsatz_):
A named group of four matching colors for one hue: a fill, the text on that fill, a soft fill, and colored text on normal backgrounds. The text on the fill is part of the set and may be dark, as on yellow. _Accents_, _Module Colors_ and the color the user gives an entry, such as a project or a habit, are _Color Sets_.
_Avoid_: hue, color scale

**Density** (de: _Dichte_):
How tightly the interface is laid out, either comfortable or compact. It changes spacing and control sizes, not the size of the text.
_Avoid_: compact mode, zoom

**Entry Mark** (de: _Marke_):
The icon or single emoji of an entry, such as a project or a habit, drawn in the entry's _Color Set_. An entry without an icon shows the usual icon of its kind, and one without a color looks neutral.
_Avoid_: avatar, entry icon, badge

**Module Color** (de: _Modulfarbe_):
The _Color Set_ a module declares for itself, which marks its icon, its active entries and its charts. It is not a user setting and is separate from the _Accent_, which marks actions.
_Avoid_: brand color, section color

**Start Cache** (de: _Startcache_):
The remembered look of the app from its last run, which paints the first frame before the app has started so that no wrong colors flash. It is only a copy and never decides a setting.
_Avoid_: theme cache, boot cache

**Theme** (de: _Theme_):
A named set of colors for every _Color Role_, for one _Color Mode_ or both. A _Theme_ either ships with the app or was imported from another format.
_Avoid_: skin, palette

### Data

**Contract** (de: _Vertrag_):
The description of a module’s _Port_: its inputs, answers and expected errors. A module has one contract, with no separate description of the same interface.
_Avoid_: port (for its description), storage interface

**Port** (de: _Port_):
Everything a module offers for reading and changing its data, and the only way to reach its tables. Its _Contract_ describes it; its _Storage_ implements it.
_Avoid_: repository, data service

**Storage** (de: _Speicher_):
The implementation of a module’s _Port_ against the stored data. Its lower layer works within an existing transaction; its upper layer checks calls, owns the transaction and announces committed table writes.
_Avoid_: port (for its implementation), persistence layer

**Backup** (de: _Sicherung_):
A whole copy of the database, kept as a file in the data folder of the channel. One is taken once a day, before an update changes the stored data, when the user asks, and before a restore, of the data it replaces. It lies on the same device and is not a sync.
_Avoid_: snapshot, export, dump, archive

**Data Process** (de: _Datenprozess_):
The process of the desktop app that holds the database and answers the page's calls. The page reaches it directly, not through the main process. When it is lost, the connection is lost, not a call.
_Avoid_: backend, server, worker, database process

**Local Table** (de: _lokale Tabelle_):
A table whose rows stay on one device and never sync, such as cached figures. Nothing that syncs may depend on its rows.
_Avoid_: private table, device table

**Entity Id** (de: _Entitäts-Id_):
The identity of one entity, branded for its kind so a project id cannot stand in for a task id. References to that entity keep the same identity.
_Avoid_: generic id, shared id brand

**Field List** (de: _Feldliste_):
The fields of one kind of entry, each with the schema of its value, written once in its _Contract_. The inputs of create and edit are derived from it; a field that may be empty is optional, every other one required. An edit names only the fields that change.
_Avoid_: patch schema, update DTO, partial entity

**Live Row** (de: _nicht gelöschte Zeile_):
A stored row that has not been soft-deleted. Ordinary reads and changes see only live rows in the current _Space_. An archived row is still a _Live Row_; one that is also not archived is _active_ (see _Archive_).
_Avoid_: active row, undeleted record

**Archive** (de: _Archivieren_):
To set an entry aside that is finished but kept, such as a completed project: it leaves the lists of active entries and the pickers and appears in its module's archive View. It is an ordinary change that locks nothing, independent of deleting, and archiving an archived entry changes nothing. An entry that is live and not archived is _active_. Not a _Backup_, which copies the whole database.
_Avoid_: hide, close, deactivate

**Unarchive** (de: _Reaktivieren_):
To bring an archived entry back among the active ones. Unarchiving an active entry changes nothing. The undo of a delete is _restore_, never _unarchive_.
_Avoid_: restore, reopen, reactivate

**Operation** (de: _Operation_):
An entry of a _Port_ that changes data, all of it or nothing. Its expected failures, such as a conflict or "not found", are part of its answer, not surprises.
_Avoid_: mutation, command, action, write

**Query** (de: _Abfrage_):
An entry of a _Port_ that reads data and changes nothing. It names the tables it reads, so its answer stays valid until a _Table Change_ names one of them.
_Avoid_: fetch, read model, selector

**Row Map** (de: _Zeilen-Map_):
A module's complete description of its stored tables and the fields of each row. It is the single source of their storage types, separate from the entities a port exposes.
_Avoid_: entity map, table interface

**Table Change** (de: _Tabellenmeldung_):
The message of the _Data Process_ that names the tables one committed change wrote, so that every _Query_ reading one of them is answered again. A failed or reading call sends none.
_Avoid_: invalidation, change event, update event

### Forms

**Draft** (de: _Formularentwurf_):
The values a form holds while someone fills it in, with the field names of the Operation’s input. A value can still be empty or invalid; it is not stored until the Operation succeeds.
_Avoid_: form state, buffer

**Check** (de: _Formularprüfung_):
The check of a form’s Draft against the Contract before submit, for feedback at its fields. It calls no Operation when a rule is violated. The Data Process still checks every input and decides whether to accept it.
_Avoid_: client validation, business validation

**Field Binding** (de: _Feldbindung_):
The connection that gives a form field its current value, takes its changes and shows its messages. A picker can use it while remaining usable without a form.
_Avoid_: bridge, adapter

### Development

**Agreement Test** (de: _Übereinstimmungstest_):
The check that a module's migrated tables and columns agree with its _Row Map_, including storage types and nullability. It is separate from the checks of table conventions.
_Avoid_: schema validation, convention test

**Component Catalog** (de: _Komponentenkatalog_):
The place outside the app where every shared building block can be seen and tried out in any appearance. It never ships with the app.
_Avoid_: catalog (on its own), design system, Storybook

**Fixed Answer** (de: _feste Antwort_):
What one _Port_ entry returns in a story or component test, without a _Data Process_: data, loading that never ends, an unexpected error, a declared conflict or "not found". It is checked against the entry's _Contract_, and a call to an entry without one fails.
_Avoid_: mock, fixture, stub

### Projects

**Project** (de: _Projekt_):
A piece of work a freelancer keeps track of, with a title and optionally a description, an icon and a color. A project is its id: two projects may carry the same title. It has no type and no rate; those come with billing. It is _archived_ when finished, never closed.
_Avoid_: job, client, engagement, assignment

**Project Reference** (de: _Projekt-Verweis_):
What a module above `projects` holds of a project to show it and know its state: id, title, icon, color, an archive mark and a deletion mark. `projects` releases it as a _Read Piece_ and as a schema; a form hands it to the project picker as the current choice. It is not the project itself, and it does not make an archived project unusable.
_Avoid_: project link, foreign key, project summary

### Settings

**Device Setting** (de: _Geräteeinstellung_):
A _Setting_ that stays on one device and never syncs, such as the _Color Mode_ or the _Density_. Window size and position are not _Settings_.
_Avoid_: local setting, device-local setting

**Setting** (de: _Einstellung_):
One decision of the user about how the app behaves or looks. Two values that only make sense together are one _Setting_.
_Avoid_: preference, option, config

**Settings Row** (de: _Einstellungszeile_):
One line of the settings area with a title, an optional description and a control or a value, and the thing the settings search finds. It is not a _Setting_: a row may serve one _Setting_, several or none, and a _Setting_ may have no row.
_Avoid_: setting (for the line), settings item, settings section

**Synced Setting** (de: _synchronisierte Einstellung_):
A _Setting_ that belongs to the user and follows them to every device once sync exists, such as the _Theme_ or the _Accent_.
_Avoid_: global setting, account setting

### Shell

**Command** (de: _Befehl_):
One action of the app that can be started by name, such as opening a new entry. Its kind decides who can start it: a person on a page, a person or a later assistant, or only a later assistant. Reading data is not a _Command_. A _Command_ may call an _Operation_, but it is not one: "operation" names a _Port_ entry, never a _Command_.
_Avoid_: action (for the declared thing), operation (for a _Command_), handler

**Command Palette** (de: _Befehlspalette_):
The search dialog that opens over everything with a _Shortcut_ and lists _Commands_ and _Views_ to start or go to. It searches names only, never the user's data.
_Avoid_: spotlight, launcher, quick open

**Edit Drawer** (de: _Bearbeiten-Drawer_):
The panel on the right in which a module edits one entry, opened through the address. Every way out asks before unsaved changes are lost, except the end of a successful save or delete.
_Avoid_: edit modal, side panel

**Group** (de: _Gruppe_):
A titled list in the _Module Sidebar_ whose entries come from the user's data, such as a module's clients. Unlike a _View_ it changes with that data, and not every module has one.
_Avoid_: section, category, folder

**Layout Step** (de: _Layoutstufe_):
One of the four arrangements of the _Shell_ that depend on the window's width: wide, medium, narrow and phone.
_Avoid_: breakpoint, responsive mode

**Module Sidebar** (de: _Modul-Sidebar_):
The bar next to the _Navbar_ with the main action, the views and the groups of the active module.
_Avoid_: secondary sidebar, sub navigation

**Navbar** (de: _Navbar_):
The outermost bar with one entry per module, either narrow with icons only or wide with labels.
_Avoid_: main menu, sidebar

**Notice** (de: _Hinweis_):
A short message at the top center that says something happened or failed, stays for eight seconds once it is in front of the others and can offer to undo. It asks nothing; a question that needs an answer is a confirmation dialog.
_Avoid_: toast, snackbar, notification

**Shell** (de: _Hülle_):
The frame of the app around the modules, made of the navigation and the content area.
_Avoid_: layout, frame, chrome

**Shortcut** (de: _Tastenkürzel_):
A key combination with ⌘ on macOS or Ctrl elsewhere that starts a _Command_ or, for ⌘K, opens the _Command Palette_. One that starts a _Command_ of a module works while that module is shown, and one that needs no page works everywhere; it is quiet while a confirmation or the _Command Palette_ is open.
_Avoid_: hotkey, keybinding, accelerator

**Shell Contribution** (de: _Hüllen-Beitrag_):
What a module declares about itself so that the _Shell_ can show it, such as its name, its icon and its _Views_. The _Shell_ only puts contributions together and knows nothing else about a module.
_Avoid_: manifest, module config, plugin

**View** (de: _Ansicht_):
One page of a module with its own address, such as the active projects or the week in the time module. A module's _Views_ are fixed by the module and do not depend on the user's data.
_Avoid_: page, route, screen, tab

**Window State** (de: _Fensterzustand_):
A record of where the desktop window was and how big, and whether it was maximized or in full screen, kept per channel so the next start opens the same way. Not a _Setting_.
_Avoid_: window settings, window preferences, window bounds (for the whole record)

### Time

**Calendar Day** (de: _Kalendertag_):
A date on the calendar, such as 14 November 2026, without a time of day or a _Time Zone_. It stays the same date wherever the person is.
_Avoid_: date (on its own), day (for an _Instant_), midnight

**Clock** (de: _Uhr_):
The source of the current _Instant_, always handed to whatever needs it. The real clock of the device is only one _Clock_; a test uses a fixed one.
_Avoid_: now (for the source), system time, timer

**Day Span** (de: _Tagesspanne_):
A run of whole _Calendar Days_ from a first to a last, both included, such as 1 to 30 November.
_Avoid_: date range, period, interval

**Duration** (de: _Dauer_):
How long something lasted, in whole seconds and never negative. It is not a _Wall-Clock Time_, even when it is shown as hours and minutes.
_Avoid_: time (for a length), elapsed time, interval

**Instant** (de: _Zeitpunkt_):
An exact moment in UTC, with millisecond precision and a year from 1000 to 9999. It is independent of the person's _Time Zone_.
_Avoid_: local time, date

**Time Zone** (de: _Zeitzone_):
A region's rules for the time on its clocks, named like Europe/Berlin, including when the clocks change. Two names can denote the same _Time Zone_; a fixed offset such as +02:00 is not one.
_Avoid_: offset, UTC offset, locale

**Wall-Clock Time** (de: _Uhrzeit_):
The time of day a clock on the wall shows, in hours and minutes, such as 14:30, without a _Calendar Day_ or _Time Zone_. On the day the clocks change, one may not exist or may occur twice.
_Avoid_: local time, time (on its own), hour

### Translation

**App Language** (de: _App-Sprache_):
The language the app is shown in: German, English, or whatever the device's system uses. A user's explicit choice applies on all their devices; following the system is decided by each device for itself.
_Avoid_: locale, UI language, account language

**Base Language** (de: _Basissprache_):
English: the language every text is first written in, and the one shown when a text has no translation in the language asked for.
_Avoid_: default locale, fallback language, source locale

### Stored Data

**Bridge** (de: _Brücke_):
A part of the app above two or more modules that owns one flow across them and is named for its purpose, such as billing. It keeps the records that link the modules' entries and the _Operations_ of that flow; the modules it joins do not know it. A module that builds on another in one direction needs no _Bridge_.
_Avoid_: integration, connector, glue module, cross-module service

**Frame** (de: _Aufrufrahmen_):
The shared boundary around one module call that checks its input, keeps its changes atomic and announces committed changes. It also gives failures a consistent meaning for the caller.
_Avoid_: handler, wrapper

**Personal Space** (de: _persönlicher Space_):
The _Space_ that holds one person's own data. A database has exactly one, created at the first start and never shown.
_Avoid_: default space, user space, private space

**Read Piece** (de: _Lesebaustein_):
A module’s deliberately released view of its own data for other modules to combine with their records, scoped to the current _Space_. Deleted targets remain visible with an explicit deletion mark.
_Avoid_: foreign table, shared row map

**Space** (de: _Space_):
The owner of data. Every synced row belongs to exactly one Space, and a row refers only to rows of its own Space. A Space is not something the user picks to sort entries, such as a folder or a filter.
_Avoid_: workspace, tenant, account, organization
