---
status: accepted
date: 2026-11-26
---

# The Shell places the focus when the Edit Drawer closes

## Context

Someone who works with the keyboard lost their place when the Edit Drawer closed (#308). Mantine
returned the focus to whatever had it when the drawer opened. That worked when the entry's row
opened the drawer and stayed. It failed after a shortcut or an address opened the drawer, since
nothing had the focus then. It also failed after a delete, an archive or an unarchive removed the
row, and after a create, which has no row until the View's Query reloads. In all these cases the
focus fell to the page, and the next Tab started at the Navbar. A create from the Module
Sidebar's primary action went back to that button, not to the new entry.

The Edit Drawer belongs to the Shell, so one rule has to serve every module. Only the
module knows which control stands for an entry, and only its form knows the id of the entry it
created.

## Decision

- **A module marks and reports. The Shell holds the rule.** A module makes its marks once with
  `editDrawerEntries<Id>()` and spreads `control(id)` on the control that stands for an entry in a
  View, such as its row's button. The id is the one the drawer's address carries. A create calls
  `onCreated(id)` of `EditDrawerProps<Id>` instead of `onDone`, typically as the form's
  `onSuccess`. `onCreated` closes as `onDone` does. A module writes no focus code of its own.
- **Where the focus goes.** After a create, it goes to the new entry's control once the View
  shows it. Otherwise it goes to the control that opened the drawer while that control is still
  on the page, then to the entry's control (a link, a reload or a shortcut opened the drawer),
  then to the fixed place. A control that cannot take the focus is passed over at each step: one
  that was disabled or hidden meanwhile. The rule is the same for every way out: Esc, Cancel, the
  close button,
  the overlay, a save, a named Operation such as Delete or Archive, "Discard" in the
  unsaved-changes question, and a change of the address.
- **The fixed place is the View's first control**, the first element Tab reaches in the page of
  the View. In most Views that is the top of the page or the first row. A field that opens
  something over the page as soon as it takes the focus is passed over: a field that announces a
  popup (`aria-haspopup`), as a searchable Select does with its list. A focus the Shell sets
  opens nothing. In the week of `time-tracking` the fixed place is therefore the "Previous week"
  button, the control after the project filter. A View without any control that can be the
  fixed place takes the focus itself, with `tabindex="-1"` until the focus leaves it. The focus
  is then never on the page, and Tab goes on from the View.
- **The control that opened the drawer** is what had the focus when the drawer went from closed
  to open. A create that Mod+N starts while the drawer shows an entry, and that is then
  cancelled, returns to the control that opened that entry.
- **The Module Sidebar's primary action closes the navigation overlay.** At the narrow step and
  on the phone the Module Sidebar lies in an overlay above the page. Starting the primary action
  there closes the overlay, as picking a View does. The overlay would otherwise stay open above
  the page and cover the entry that takes the focus. The button leaves with the overlay, so a
  cancelled create goes to the fixed place.
- **A bounded wait.** The View's Query reloads after the Table Change of a save, which can come
  after the drawer closed. For `FOCUS_HOLD_MS` (2 seconds) after the closing, the Shell places the
  focus again whenever the page adds or removes elements. In that time the focus moves from the
  fixed place to a created entry's control once it appears, and from a row that leaves, such as
  a deleted one, to the fixed place. A View that never shows the new entry, for example because
  its filter hides it, keeps the focus on the fixed place. The wait ends early on any key press
  or pointer press of the person. The Shell moves the focus only while it is nowhere, still in
  the leaving drawer, or where the Shell put it. Focus that the person or another layer put
  elsewhere stays there.
- **Mantine's `returnFocus` is off for the Edit Drawer.** It returns to what had the focus at the
  opening, which after a create is not the new entry and is often gone. The Shell's placing
  starts 10 ms after the closing, the same delay Mantine uses. A layer that closes in the same
  moment, such as the Command Palette, returns its focus first. If that focus lands in the
  leaving drawer, the Shell moves it on.
- **"Discard" gives the focus back first.** When the question closes on "Discard", the focus goes
  back to where it was when the question opened, before the question's button leaves. The frame
  then places it as it does for every other way out. The Indicator Panel uses the same question
  and keeps its own return to the Module Indicator (ADR 0037).

## Consequences

The rule costs nothing while no drawer closes. A mark is a constant attribute on a row, so
marking adds no draw: opening and closing the drawer over 1,000 rows draws no row, no list and
not the View (`OpeningAndClosingTheDrawerDrawsNoRow`). No row subscribes to anything, and nothing
is registered while the page draws. On a close, the Shell looks the control up once by its
attribute. For the next 2 seconds a mutation observer on the document re-checks the focus when
elements are added or removed, until a key or a pointer press ends it.

The compiler checks that a row is marked with an id of the kind `editDrawerEntries<Id>` names,
and that a create reports an id of the kind `EditDrawerProps<Id>` names. A content that names no
`Id` cannot call `onCreated`. The compiler does not check that a module's marks, its drawer and
its address use the same kind of id, nor that a View marks its rows at all. A View that marks
nothing still gets the fixed place. The stories of each module show the entry's own control
taking the focus.

The fixed place is the top of the View, also after a delete far down a long list, and the View
scrolls there. Giving the focus to a neighbouring row instead would need the Shell to know the
order of a View's entries.

## Considered Options

- **A registry that each row writes its element into, or a context that rows subscribe to.**
  Either one touches every row while the page draws, or redraws rows when the drawer opens or
  closes. The lookup at the closing costs nothing before it.
- **The created entry handed to `onDone` as an optional argument.** `onClick={onDone}` would pass
  the click event as the id. A separate `onCreated` keeps `onDone` as it is for every existing
  form.
- **The marks tied to the Shell Contribution's `editDrawer`, so that the compiler also checks
  that the View and the drawer use one kind of id.** This would change the contribution's
  interface for every module and story. A story already shows the pairing.
- **Focus on the opener after a create** (Mantine's way, for a create from the primary action).
  The person would have to search the list for what they just made.
