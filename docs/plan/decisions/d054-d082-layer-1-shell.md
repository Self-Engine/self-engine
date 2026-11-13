# Runde 13 (2026-11-08): Schicht 1, Grundrichtung

- **D54 (L1.1) Optik: modern, elegant, praktisch, farbig, aber nicht verspielt.**
  Vorbild t3code und aktuelle moderne Apps. Ruhiger als die alte Self-Engine, Farbe gezielt
  statt überall.
- **D55 (L1.1) Hülle aus zwei Leisten:** links eine **Navbar** für die Module, in der
  Breite veränderbar (nur Icons bis breit mit Beschriftung). Daneben eine **Modul-Sidebar**
  im gleichen Stil mit den Aktionen und Unterseiten des aktiven Moduls. Dann der
  Seiteninhalt.
- **D56 (L1.2) Fühlt sich wie eine Desktop-App an** (eigene Titelleiste, ⌘K,
  Tastaturkürzel, Fenster merkt sich Größe und Position), passt sich aber sauber an kleine
  Fenster und Bildschirme an.
- **D57 (L1.3) Styling:** Mantine-Theme mit eigenen Design-Tokens (Farben, Abstände,
  Radien, Typografie) und CSS-Modulen. Kein Tailwind.
- **D58 (L1.4) Farben:** neutrale Grundflächen, eine App-Akzentfarbe, eine Farbe pro Modul
  (gezielt an Icon, aktivem Eintrag, Diagrammen). Hell und Dunkel ab Tag 1, Standard folgt
  dem System. Akzentfarbe noch offen.
- **D59 (L1.5) Kleine Fenster:** breit = Navbar + Modul-Sidebar; mittel = Navbar nur
  Icons; schmal = Modul-Sidebar als Schublade; Handy-Breite im Web = untere Leiste.
- **D60 (L1.6) Rechte Seite:** Die Hülle stellt rechts Drawer zum Bearbeiten bereit
  (Eintrag öffnen und ändern, ohne die Liste zu verlassen). Der KI-Agent kommt später
  ebenfalls über die rechte Seite.
- **D61 (L1.4a) Theming wie t3code:** semantische Farbrollen (z. B. `canvas`, `surface`,
  `text`, `border`, `accent`, `error`) als CSS-Variablen über Mantines
  `cssVariablesResolver`; Komponenten nutzen nur Rollen. Themes sind versionierte Daten mit
  Hell- und Dunkel-Variante. In Schicht 1 gebaut: Modus (Hell/Dunkel/System), Akzentfarbe,
  Farbe pro Modul, Schriftgröße, Dichte, mehrere fertige Themes mit Wahl je Modus. Später:
  Theme-Editor, Import/Export.
- **D62 (L1.4b) Einstellungen über eine eigene Schnittstelle:** in Schicht 1 lokal
  gespeichert, ab Schicht 2 in der Datenbank (damit sie später mitsyncen). Gerätebezogenes
  (Fenstergröße und -position) bleibt immer lokal.
- **D63 (L1.7) Bearbeiten-Drawer liegt über dem Inhalt** und schiebt ihn nicht weg:
  Bearbeiten ist ein aktiver Vorgang. Wer mit geänderten Daten schließt oder abbricht, muss
  das Verwerfen bestätigen.
- **D64 (L1.7) Der Assistent ist angedockt** (vorläufig): Er schiebt den Inhalt zur Seite,
  und die App bleibt normal bedienbar. Ob der Agent eine andere Form bekommt, ist offen
  (zusammen mit Q16).
- **D65 (L1.8) Vor dem Bau ein Wegwerf-Prototyp der Hülle** unter
  `prototypes/layer-1-shell/`: Navbar, Modul-Sidebar, Drawer, Hell/Dunkel, umschaltbare
  Akzentfarben und Themes. Akzentfarbe, Dichte und Abstände werden daran entschieden.
- **D66 (L1.9) Übersetzung mit Lingui** (wie die alte App).
- **D67 (L1.8) Optik der Hülle: Variante B3 des Prototyps** („Schwebend, Navigation in
  einem Container“): leicht mit der Akzentfarbe eingefärbter Hintergrund; Navbar und
  Modul-Sidebar teilen sich einen abgerundeten Container (feine Trennlinie), der Inhalt ist
  ein zweiter Container; abgerundete Kacheln, Listen und Drawer. Quelle:
  `prototypes/layer-1-shell/` (`?variant=B3`).
- **D68 (L1.10) Standard-Akzentfarbe Blau**, Standard-Theme Neutral (Theme nicht explizit
  gewählt, Annahme). Beides änderbar (D61).
- **D69 (L1.11) Hintergrund mit der Akzentfarbe eingefärbt**, abschaltbar in den
  Einstellungen (Regler/Schalter für einen neutralen Hintergrund).
- **D70 (L1.12) Dichte: Standard „Bequem“**, „Kompakt“ als Einstellung.
- **D71 (L1.13) Schrift: Inter** (vorerst), als variable Webfont mit der App ausgeliefert.
- **D72 (L1.14) Icons: Phosphor** (wie die alte App, React-Native-Version für später),
  nur über ein eigenes Icon-Paket eingebunden, damit ein Wechsel an einer Stelle bleibt.
- **D73 (L1.15) Komponenten-Katalog mit Storybook ab Schicht 1**, verbunden mit Vitest im
  Browser-Modus (Stories sind Tests). Das Design-System entsteht zuerst im Katalog.
- **D74 (L1.16) Module melden sich mit einem typisierten Hüllen-Beitrag an:** ID, Name
  (DE/EN), Icon, Modulfarbe, Inhalt der Modul-Sidebar, Routen, Befehle/Kürzel,
  Bearbeiten-Drawer. Die Hülle setzt nur zusammen und kennt keine Modul-Details. Schlanke
  Vorstufe des Manifests (D10). Schicht 1 testet mit zwei Platzhalter-Modulen.
- **D75 (L1.17) Tastaturkürzel mit TanStack Hotkeys** (`@tanstack/react-hotkeys`; geprüft
  2026-11-08: Kern 0.24.0, React 0.22.0, **Beta**). Darüber ein eigenes zentrales
  Befehls-Register (ID, Text, Standard-Kürzel), das auch ⌘K speist und doppelte Kürzel im
  Test findet. Eigenes Neubelegen später, mit den Recorder-Hilfen der Bibliothek.
- **D76 (L1.18) Skill `verify-desktop` in Schicht 1:** startet die Electron-App über
  Playwright, klickt einen Ablauf durch, Screenshots in Hell/Dunkel und mehreren Breiten.
  Nur auf ausdrücklichen Wunsch, kein Gate.
- **D77 (L1.19) Routen:** `/<modul>/<ansicht>` (z. B. `/projects/active`, `/time/week`);
  der offene Bearbeiten-Drawer als Suchparameter (`?edit=<id>`), verlinkbar und
  reload-fest; Einstellungen unter `/settings/<bereich>`. Gleich in Electron und Web (D37).
- **D78 (L1.20) Fenster:** Mac ohne Titelleiste (`hiddenInset`), Fensterknöpfe oben links
  im Navigations-Container, oberer Rand zum Ziehen; Windows/Linux mit
  `titleBarOverlay` oben rechts. Größe, Position und Vollbild pro Kanal gemerkt.
- **D79 (L1.21) Rückmeldung:** Hinweise unten rechts (Mantine-Notifications);
  Rückgängig statt Nachfrage beim Löschen; Nachfrage nur beim Verwerfen (D63) und bei
  Unumkehrbarem. Leer-, Lade- und Fehlerzustände sind Bausteine des Design-Systems im
  Katalog.
- **D80 (L1.22) Einstellungen als eigener Bereich** wie ein Modul: Abschnitte in der
  Modul-Sidebar, Suche über alle Einstellungen. Start-Abschnitte: Darstellung, Sprache und
  Region, Tastaturkürzel (Übersicht), Module, Daten (inkl. „Daten aus Stable kopieren“,
  D40), Über und Updates.
- **D81 (L1.23) Barrierefreiheit und Bewegung ab Schicht 1:** alles per Tastatur, sichtbarer
  Fokus-Ring, Kontrast jedes Themes im Test nach WCAG AA, dezente Animationen
  (150–200 ms), aus bei „Bewegung reduzieren“.
- **D82 (L1.24) Schicht 1 jetzt in Issues zerlegen** (`layer:1`, abhängig von Schicht 0).
  Prototyp B3 ist Vorlage, kein übernommener Code.
