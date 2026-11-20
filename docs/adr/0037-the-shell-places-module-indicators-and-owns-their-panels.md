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
`panelOpen`. Commands a person can run and Notice actions can open the panel through the Shell.

The Shell starts loading the Module Indicator and the panel frame at the first idle moment
after the first paint. Until the Module Indicator arrives, its place shows the module's icon.
The Shell preloads the panel's content in an idle moment after the Module Indicator's code
arrives. An opening can load the content on demand if the preload has yet to finish. The
startup check covers `src/indicator/` and the panel frame.

The Shell owns one open Indicator Panel at a time. It uses a popover below the Module Indicator
on wide, medium and narrow, and a sheet from below on phone. Focus moves into the panel and
returns when it closes. The panel lives outside the address and closes on a change of page.
The Command Palette takes Escape while it is open.

The Indicator Panel and Edit Drawer use the same unsaved-changes hook and the same question.
The panel asks before losing a draft on Escape, an outside click, a second click on its opener,
Cancel, a change of page or another panel opening. `onDone` closes the current opening without
asking. A form from `forms` reports its draft through the shared hook.

The Module Indicator and panel content have their own error boundaries. A failed Module
Indicator shows the module's icon in a warning tone with an accessible retry control. Failed
panel content offers a retry inside the panel, which can still close. A frame that fails to load
tries again on the next opening.
