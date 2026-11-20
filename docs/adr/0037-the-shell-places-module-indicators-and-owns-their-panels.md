---
status: accepted
date: 2026-11-20
decisions: D314, D357, D358, D359, D360
---

# The Shell places Module Indicators and owns their panels

## Context

A module needs to show ongoing work while another View is active. The content header is visible
on every Layout Step. A permanent place there should preserve the header's height and let each
module update its own display.

## Decision

The Shell places one Module Indicator per declaring module at the end of the content header,
in module-list order, including in Settings. The page title shrinks first. The place uses the
module's Color Set and lets its controls receive clicks in the window's drag region. The Shell
passes `full` on wide and medium, and `short` on narrow and phone.

The Shell Contribution declares a loader for the Module Indicator and, optionally, a second
loader for the Indicator Panel's content. The Module Indicator reads its data through the
module's hooks. When a panel is declared, its Module Indicator also receives `togglePanel` and
`panelOpen`. Commands a person can run and Notice actions can open the panel through the Shell
by the module's indicator entry. An entry that no module of the Shell holds opens nothing and is
reported as a failed Command start is, so a Notice's action cannot take the page down.

The Shell starts loading the Module Indicator and the panel frame at the first idle moment
after the first paint. Until the Module Indicator arrives, its place shows the module's icon.
The Shell preloads the panel's content in an idle moment once the Module Indicator's code is on
screen, also after a retry of a Module Indicator that failed to load. An opening can load the content on demand if the preload has yet to finish. The
startup check covers `src/indicator/` and the panel frame.

The Shell owns one open Indicator Panel at a time. It uses a popover below the Module Indicator
on wide, medium and narrow, and a sheet from below on phone. An opening keeps the kind of frame
it opened in until it closes, so its content keeps its state when the window crosses the phone
border. Focus moves into the panel and returns to the Module Indicator when it closes, also when
a Command or a Notice opened it. While the Edit Drawer is open, its overlay covers the Module
Indicator, and the focus returns into the drawer instead, so the drawer takes the next Escape. The
panel lives outside the address and closes on a change of
page, and when its module leaves the module list. A press inside a layer that a field of the
panel draws in a portal, such as a date field's calendar or a Select's list, counts as a press
inside the panel. The popover lies on Mantine's popover layer, over the Edit Drawer; the Command
Palette lies over the panel and takes Escape while it is open.

The Indicator Panel and Edit Drawer use the same unsaved-changes hook, the same question and the
same Escape exit. The question lies just above Mantine's popover layer, so the panel's fields take
no click or key while it waits.
The panel asks before losing a draft on Escape, an outside click, a second click on its opener,
Cancel, a change of page or another panel opening. A click on a link of the navigation is an
outside click and a change of page: it asks once, and "Discard" closes the panel and changes the
page. `onDone` closes the current opening without asking. A form from `forms` reports its draft through the shared hook.

The Module Indicator and panel content have their own error boundaries. A failed Module
Indicator shows the module's icon in a warning tone with an accessible retry control. Failed
panel content offers a retry inside the panel, which can still close. A frame that fails to load
tries again on the next opening.
