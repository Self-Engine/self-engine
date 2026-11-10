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
A named group of four matching colors for one hue: a fill, the text on that fill, a soft fill, and colored text on normal backgrounds. _Accents_ and _Module Colors_ are _Color Sets_.
_Avoid_: hue, color scale

**Density** (de: _Dichte_):
How tightly the interface is laid out, either comfortable or compact. It changes spacing and control sizes, not the size of the text.
_Avoid_: compact mode, zoom

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

**Local Table** (de: _lokale Tabelle_):
A table whose rows stay on one device and never sync, such as cached figures. Nothing that syncs may depend on its rows.
_Avoid_: private table, device table

### Development

**Component Catalog** (de: _Komponentenkatalog_):
The place outside the app where every shared building block can be seen and tried out in any appearance. It never ships with the app.
_Avoid_: catalog (on its own), design system, Storybook

### Settings

**Device Setting** (de: _Geräteeinstellung_):
A _Setting_ that stays on one device and never syncs, such as the _Color Mode_ or the _Density_. Window size and position are not _Settings_.
_Avoid_: local setting, device-local setting

**Setting** (de: _Einstellung_):
One decision of the user about how the app behaves or looks. Two values that only make sense together are one _Setting_.
_Avoid_: preference, option, config

**Synced Setting** (de: _synchronisierte Einstellung_):
A _Setting_ that belongs to the user and follows them to every device once sync exists, such as the _Theme_ or the _Accent_.
_Avoid_: global setting, account setting

### Shell

**Command** (de: _Befehl_):
One action of the app that can be started by name, such as opening a new entry. Its kind decides who can start it: a person on a page, a person or a later assistant, or only a later assistant. Reading data is not a _Command_.
_Avoid_: action (for the declared thing), operation, handler

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
A short message bottom right that says something happened or failed, stays for eight seconds and can offer to undo. It asks nothing; a question that needs an answer is a confirmation dialog.
_Avoid_: toast, snackbar, notification

**Shell** (de: _Hülle_):
The frame of the app around the modules, made of the navigation and the content area.
_Avoid_: layout, frame, chrome

**Shortcut** (de: _Tastenkürzel_):
A key combination with ⌘ on macOS or Ctrl elsewhere that starts a _Command_. One that starts a _Command_ of a module works while that module is shown, and one that needs no page works everywhere; it is quiet while a confirmation or the _Command Palette_ is open.
_Avoid_: hotkey, keybinding, accelerator

**Shell Contribution** (de: _Hüllen-Beitrag_):
What a module declares about itself so that the _Shell_ can show it, such as its name, its icon and its _Views_. The _Shell_ only puts contributions together and knows nothing else about a module.
_Avoid_: manifest, module config, plugin

**View** (de: _Ansicht_):
One page of a module with its own address, such as the active projects or the week in the time module. A module's _Views_ are fixed by the module and do not depend on the user's data.
_Avoid_: page, route, screen, tab

### Translation

**App Language** (de: _App-Sprache_):
The language the app is shown in: German, English, or whatever the device's system uses. A user's explicit choice applies on all their devices; following the system is decided by each device for itself.
_Avoid_: locale, UI language, account language

**Base Language** (de: _Basissprache_):
English: the language every text is first written in, and the one shown when a text has no translation in the language asked for.
_Avoid_: default locale, fallback language, source locale
