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
