# Schicht 1: Design-System und App-Hülle

Stand: 2026-11-08 · Status: **entschieden** (D54–D82); Zuschnitt in Issues folgt

## Entschieden

| Nr. | Thema | Entscheidung |
|---|---|---|
| L1.1 | Optik | Modern, elegant, praktisch, farbig, nicht verspielt; Vorbild t3code (D54) |
| L1.1 | Hülle | Navbar (Module, Breite veränderbar: Icons ↔ breit) + Modul-Sidebar (Aktionen des Moduls) + Inhalt (D55) |
| L1.2 | Gefühl | Desktop-App, passt sich an kleine Fenster an (D56) |
| L1.3 | Styling | Mantine-Theme + Design-Tokens + CSS-Module, kein Tailwind (D57) |
| L1.4 | Farben | Neutral + App-Akzent + Farbe pro Modul, Hell/Dunkel nach System (D58) |
| L1.5 | Kleine Fenster | Stufen breit/mittel/schmal/Handy (D59) |
| L1.6 | Rechte Seite | Drawer zum Bearbeiten, später der KI-Agent (D60) |
| L1.4a | Theming | Semantische Rollen + Themes als Daten wie t3code; Editor später (D61) |
| L1.4b | Einstellungen | Eigene Schnittstelle, erst lokal, ab Schicht 2 Datenbank (D62) |
| L1.7 | Drawer | Bearbeiten über dem Inhalt mit Verwerfen-Bestätigung (D63); Assistent angedockt, vorläufig (D64) |
| L1.8 | Prototyp | Wegwerf-Prototyp der Hülle vor dem Bau (D65) |
| L1.9 | i18n | Lingui (D66) |
| L1.8 | Optik | Prototyp-Variante B3: Navigation und Inhalt als zwei schwebende Container (D67) |
| L1.10 | Standard | Akzent Blau, Theme Neutral (D68) |
| L1.11 | Hintergrund | Mit Akzent eingefärbt, abschaltbar (D69) |
| L1.12 | Dichte | Standard Bequem, Kompakt als Einstellung (D70) |
| L1.13 | Schrift | Inter, mitgeliefert (D71) |
| L1.14 | Icons | Phosphor über eigenes Icon-Paket (D72) |
| L1.15 | Katalog | Storybook + Vitest-Browser-Modus (D73) |
| L1.16 | Modul ↔ Hülle | Typisierter Hüllen-Beitrag pro Modul (D74) |
| L1.17 | Kürzel | TanStack Hotkeys (Beta) + eigenes Befehls-Register (D75) |
| L1.18 | App-Check | Skill `verify-desktop` (D76) |
| L1.19 | Routen | `/<modul>/<ansicht>`, `?edit=<id>`, `/settings/<bereich>` (D77) |
| L1.20 | Fenster | Mac `hiddenInset`; Win/Linux `titleBarOverlay` zurückgestellt (#167); Fensterzustand pro Kanal gemerkt (D78, D205–D209) |
| L1.21 | Rückmeldung | Notifications, Rückgängig statt Nachfrage, Zustands-Bausteine (D79) |
| L1.22 | Einstellungen | Eigener Bereich mit Views und Suche über Einstellungszeilen (D80, D197–D204) |
| L1.23 | Barrierefreiheit | Tastatur, Fokus, Kontrast-Test AA, reduzierte Bewegung (D81) |
| L1.24 | Issues | Jetzt zerlegen, `layer:1` (D82) |

## Referenz t3code-Theming (geprüft 2026-11-08)

- `packages/shared/src/themePalettes.ts`: ~70 Farbrollen, 6 fertige Themes, Hell/Dunkel-Varianten.
- `apps/web/src/themePalette.ts`: Theme-Dateien (Version 1), eigene Themes im `localStorage`,
  VS-Code-Import, OKLCH über `culori`.
- `components/settings/`: Theme-Editor mit Drahtgitter-Vorschau, je ein Theme für Hell und
  Dunkel, Kontrast, Glas-Transparenz, Typografie.

## Offen

- Akzentfarbe/Schrift nach ersten echten Bildschirmen noch einmal ansehen
- Form des Agenten (mit Q16)
- Später: i18n-Mechanik (DE/EN), Schriften, Icons, Befehlspalette, Einstellungsseite,
  Tastaturkürzel-System, App-Check-Skill, Komponenten-Katalog (Storybook o. ä.)

## Issues (angelegt 2026-11-08, Label `layer:1`)

#14 Tokens + Theme → #15 Einstellungs-Schnittstelle, #16 i18n → #17 Storybook, #18 Icons →
#19 Hülle → #20 Modul-Beitrag + Routen → #21 Drawer + Rückmeldung, #22 Kürzel + ⌘K →
#23 Einstellungen; #24 Fensterzustand (nach #7), #167 Windows/Linux-Titelleiste (wartet auf einen
Windows- oder Linux-Build), #168 Vollbild-Lücke auf dem Mac, #25 `verify-desktop` (nach #2); #37 lokales
Fehlerprotokoll + Diagnose (nach #6, #21, #23, D99–D101). Abhängigkeiten
stehen jeweils als „Blocked by“ im Issue.
