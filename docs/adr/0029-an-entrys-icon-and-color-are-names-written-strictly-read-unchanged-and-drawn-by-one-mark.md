---
status: accepted
date: 2026-11-14
decisions: D151, D291, D292, D293, D294, D295, D296, D297, D298
---

# An entry's icon and color are names, written strictly, read unchanged and drawn by one mark

## Context

A freelancer recognizes a project, a habit, a bank account, a recurring cashflow or a task status
by its picture and color before reading its title. The old app offered that, with three problems:

- It kept five icon lists, one per kind of entry: 130 names for 107 pictures, in 142 rows of
  (kind of entry, name). Some pictures had two or three names, and `savings` meant three
  different pictures depending on the list.
- Its colors were Mantine color names drawn at full strength. A yellow icon on a white list had a
  contrast of about 1.9:1, and white text on yellow had 1.86:1.
- The text color on a fill was decided in the browser by Mantine's automatic contrast, which no
  test could see.

Five kinds of entry share icon and color, so the first module of Layer 4 should not solve it for
itself. Two devices on different app versions will also meet one day: a value the older one does
not know must not break its lists.

## Decision

1. **The color of an entry is the name of a _Color Set_, and there are twelve.** `theme` gained
   `red`, `cyan`, `lime` and `yellow`, so the twelve color names of the old app are exactly the
   Color Sets. "No color" is no value: an entry without a color looks neutral.
   - The names are a list in `@self-engine/theme/names`, `COLOR_SET_NAMES`, in color-wheel order
     from red. Its type is `ColorSetName`; the catalog of Color Sets is typed against the list, so
     a name without colors is a type error.
   - Cyan, lime and yellow keep a bright fill and carry dark text on it, so they stay
     recognizable in bars, calendar blocks and charts. Red carries white text.
   - The text on a fill always comes from the Color Set. Mantine's filled variants of a Color Set
     take its on-fill text, never Mantine's automatic contrast, so the contrast check sees the
     value the screen shows ([ADR 0009](0009-the-theme-engine-is-the-only-source-of-color.md)).
   - The Accent choices stay blue, indigo, violet, teal, orange and grape. Every Color Set can be
     a _Module Color_; a module with yellow gets dark text on its filled areas.

2. **One icon name per picture, named after what it shows.** `@self-engine/icons/names` holds 107
   names in `ICON_NAMES`, such as `house`, `barbell` and `piggy-bank`, never a meaning such as
   `rent` or `savings`. Every kind of entry may use every name; no module keeps a list.
   - A name is lower-case letters, digits and single hyphens, spelled like the picture in
     Phosphor. The names belong to the app: a name is never renamed, and its picture is never
     removed without a successor. When the icon library changes, the name stays.
   - `OLD_ICON_NAMES` translates the old app's 142 rows of (kind of entry, old name) to these
     names. A test leads every row to a name of the list and uses every picture. The later import
     reads it; nothing else does.

3. **The names, the schemas and the resolvers load without React.** Each of
   `@self-engine/theme/names` and `@self-engine/icons/names` holds a list, a schema and a
   resolver, and nothing a browser provides or Hermes lacks. A _Contract_, the _Data Process_ and
   a later mobile app import them.
   - The boundary rule `theme-names-is-pure` keeps React, Mantine, the color calculation and the
     rest of `theme` out of its entry. `icons-names-is-pure` lets the icon names import only Zod
     and their own files. `module-contracts-is-pure` lets a module's contracts import both.
   - The schemas are `zod/mini`, so they never bring Zod's full build to startup.

4. **"Exactly one emoji" is one rule, the same on every device.** `isSingleEmoji` starts from the
   old app's regular expression and needs no `v` flag, which Hermes may lack.
   - A character drawn as text by default, such as ©, ❤ or a digit, counts only with the variation
     selector U+FE0F after it, or as a keycap.
   - A flag of two regional indicators counts, and so do the flags of England, Scotland and Wales.
   - A joined emoji has at most four parts, the longest sequences Unicode defines.

   An `icon` is a name or one emoji, told apart without a marker: a name is plain ASCII, and no
   emoji is.

5. **A Contract writes strictly and reads the stored text unchanged.** Every module with an icon
   or a color copies four rules:
   1. An _Operation_'s input accepts for `icon` only a known name or exactly one emoji
      (`entryIconSchema`), and for `color` only the name of a Color Set (`colorSetNameSchema`).
      Anything else is an input error. Both schemas reject an empty text, so the Contract makes
      the field optional or nullable around them. An Operation checks only the fields the call
      carries.
   2. A _Port_'s answer carries `icon` and `color` as text or empty, not checked against the
      lists.
   3. One place resolves. `resolveEntryIcon` turns the text into a known icon, an emoji or
      `none`; `resolveColorSetName` turns it into a Color Set name or `undefined`. Both answer so
      for anything unknown, `gray` and a name from a newer version included, and never throw. No
      module checks on its own.
   4. Empty means default. No icon shows the usual icon of the kind of entry, no color shows the
      neutral look. No name stands for "default", and no empty text is stored.

6. **The directory of pictures never loads at startup.** `@self-engine/icons/directory` maps
   every name to its picture in `ICON_DIRECTORY`, typed against `ICON_NAMES`, so a name without a
   picture is a type error. Beside it, `ICON_LABELS` holds one English label per picture as a
   `msg` descriptor with the context "Icon"; the icon picker shows and searches it. The labels are
   not in the names entry, so the Data Process never loads them.
   - The interface keeps importing its own icons one by one from the main entry of `icons`; only
     those are in the startup code.
   - Only `icons` and `ui` may import the directory (rule `icon-directory-only-in-ui`). In `ui` the
     mark and the pickers have their own entries, `@self-engine/ui/entry-mark` and
     `@self-engine/ui/entry-pickers`, outside the main entry, and a View that loads on demand
     imports them.
   - The startup check of the web app names the directory in `lazyOnly`
     (`apps/web/startup-rules.ts`): a build fails when startup code reaches it.
   - Only the web directory exists. A directory for React Native comes with the mobile app, typed
     against the same list.

7. **One mark draws an entry's icon or emoji in its color.** `EntryMark` takes the stored `icon`
   and `color`, the usual icon of the kind of entry, a form and a size, and resolves the text
   itself. It is the one building block that draws an entry's icon.
   - Two forms. The bare tinted icon is the default, as the navigation draws a Module Color. The
     soft tile, for cards and detail headers, puts the icon or emoji on the Color Set's soft fill;
     it is Mantine's `ThemeIcon` in its light variant, fed from the Color Set. There is no filled
     tile.
   - In both forms the icon carries the Color Set's colored text, which the contrast check holds
     to 4.5:1. The check gets no exception.
   - An emoji keeps its own colors. An unknown icon shows the usual icon; an unknown color shows
     the neutral look: muted text, and the hover color as the tile's fill.
   - The mark is hidden from screen readers; the entry's title names the entry.

8. **Module Colors and entry colors share one CSS scope.** `data-color-set="<name>"` sets the
   variables `--se-color-set`, `--se-color-set-on`, `--se-color-set-soft` and
   `--se-color-set-text` on its element. It replaced `data-module-color` everywhere. The contrast
   check holds every Color Set's colored text on its soft fill and on the navigation, the canvas,
   the surface and raised surfaces such as popovers and drawers.

9. **Three pickers in `ui`.** `EntryIconPicker` chooses a name from the directory and searches the
   labels in the user's language. `EntryEmojiInput` accepts exactly one emoji and points to the
   emoji keyboard of the operating system. `EntryColorPicker` offers "no color" first, then the
   Color Sets in the order of the list. Each shows a stored value it cannot show as nothing
   chosen, leaving it stored until the user acts, and each can clear what it stands for: "No
   icon" clears any stored text but an emoji, a name from a newer version included; the emoji
   field clears an emoji; "no color" clears any stored color.

10. **Every icon of the app is drawn in the regular weight.** `catalogIcon` draws it for the icons
    of the interface and the pictures of the directory, so an entry's mark is regular too. A
    caller still cannot choose a weight; a place that should be duotone gets an option on the
    catalog when it is built (D298 changes D297).

## Consequences

- A list keeps working when one entry holds a value the device does not know: that entry shows
  the usual icon or the neutral look, and renaming it keeps the value.
- The type of a read icon or color is only text. The compiler does not force it through the
  resolver; the mark does, as the only building block that draws an entry's icon.
- A yellow entry's icon is ochre in the light Color Mode, and a lime one olive; the bright color
  appears where it fills an area. In the bare form an emoji hides the entry's color.
- The directory and the mark measured 343,907 bytes (88,198 gzipped) in a chunk that loads on
  demand, against 46,650 bytes left below the startup limit. The slice of the mark added 63
  bytes to startup, the pickers none. The pickers' own chunk is 26,353 bytes; the 214 labels
  (107 in each language) sit in the language catalogs
  ([performance guide](../development/performance.md)).
- The import of old data (Layer 5) reads `OLD_ICON_NAMES`, writes the old `gray` as empty and
  keeps the twelve color names as they are. Removing a picture breaks the test of the table.
- The mark and the pickers are Mantine. A later mobile app brings its own and shares only the
  names, schemas and resolvers.

## Considered Options

- **Values only, the mark and the pickers with the first module:** rejected (D291). The shared
  building blocks would land in the first module, and the contrast check would not know which
  color pairs an entry uses.
- **The old app's 130 names, or second names that reading accepts and writing replaces:**
  rejected (D292). Equal pictures would carry different stored values, and a second name could
  never be removed once data carries it. `savings` needs a translation in any case.
- **The directory in the startup code:** rejected (D293). Each icon carries all six weights; the
  directory alone is several times the room left below the startup limit.
- **The Data Process turning an unknown value into empty when reading:** rejected (D294). The
  types would be clean, but an older device that saves the entry would erase the newer device's
  icon.
- **A strict list in the Port's answer:** rejected (D294). One unknown value would fail the whole
  Query, and a list would show an error instead of its entries.
- **Darkened fills for all twelve colors:** rejected (D295). Yellow turns bronze, lime moves
  toward green, and cyan can barely be told from teal in bars and charts.
- **Mantine's automatic contrast for the text on a fill:** rejected (D295). It decides in the
  browser, only for Mantine components and only between black and white, so the contrast check
  cannot see it.
- **The soft tile as the default form:** rejected (D296). The navigation draws a Module Color as
  a bare icon, and lists and rows follow it; a card or a detail header asks for the tile.
- **The icon in the full fill color, as in the old app:** rejected (D296). Yellow on white has
  1.7:1, and it would be the first exception to the contrast check.
- **Unicode's own emoji list (`\p{RGI_Emoji}`):** rejected. It needs the `v` flag, whose support
  on Hermes could not be confirmed, and every device must apply the same rule.
