# Schicht 1: Design-System und App-Hülle

Stand: 2026-11-08 · Status: **in Planung** (parallel zum Bau von Schicht 0, D53)

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

## Offen

- L1.7 Rechte Seite: Drawer über dem Inhalt oder angedockt; Drawer und Agent gleichzeitig?
- L1.8 Hüllen-Prototyp für Layout und Akzentfarbe
- L1.9 i18n-Mechanik (alte App: Lingui 6.10)
- Später: i18n-Mechanik (DE/EN), Schriften, Icons, Befehlspalette, Einstellungsseite,
  Tastaturkürzel-System, App-Check-Skill, Komponenten-Katalog (Storybook o. ä.)
