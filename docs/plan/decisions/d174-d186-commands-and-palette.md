# Runde 26 (2026-11-10): Befehle, Kürzel und Palette (#22, verfeinert D74, D75, D85, ändert D132)

- **D174 Ein Register für Mensch und Agent, die Art eines Befehls bestimmt seine Reichweite.**
  `page` braucht eine Seite und wird nur von Menschen gestartet, `open` braucht weder Seite noch
  Pflichteingabe und steht ⌘K, Kürzeln und später dem Agenten offen, `input` hat Pflichteingaben und
  ist dem Agenten vorbehalten, solange es kein Formular dafür gibt. Seite plus Pflichteingabe gibt es
  nicht, das könnte niemand starten. „Neues Projekt“ sind damit zwei Befehle: einer öffnet den
  Drawer, einer legt mit typisierter Eingabe an. Befehle liegen über den Operationen aus D88 und
  verwenden deren Zod-Schema wieder. Eine Hauptaktion ist nie `input`. _Preis:_ ein dünner Befehl pro
  Operation, die Agenten erreichen sollen. _Verworfen:_ eine einzige Sorte für alle (ein Agent würde
  nur einen Drawer öffnen); Register nur für Menschen, Agenten rufen Operationen direkt (kehrt D85
  um, t3code zahlt dafür mit doppelter Verdrahtung).
- **D175 Beim Start ist nur da, was Palette und Kürzel sofort brauchen.** Das sind ID, Art, Text und
  Kürzel. Schema, Beschreibung und Handler kommen über `load` (wie ADR 0013), die Startpaket-Prüfung
  fängt versehentlich frühe Importe. Die Beschreibung ist englisch und läuft nicht über Lingui, sie
  liest nur ein Modell. `input`-Befehle haben weder Text noch Kürzel. Ein Test prüft, ob `{}` zur Art
  passt. _Verworfen:_ Schema sofort im Beitrag (zöge die Fachschemas aller Module in den Start).
- **D176 Die ID eines Befehls ist `<modul>.<befehl>`, das Register setzt sie zusammen.** Sie wird nie
  umbenannt oder wiederverwendet, das gilt damit auch für Modul-IDs. Befehle der Hülle tragen das
  reservierte Präfix `shell`, kein Modul darf so heißen. _Verworfen:_ das Modul schreibt die volle ID
  (doppelte Angabe); die Schreibweise der Operationen aus D88 (seitengebundene Befehle haben keine).
- **D177 Lesezugriffe sind keine Befehle.** Sie bleiben Abfragen im oRPC-Vertrag (D93). Ein späterer
  MCP-Server baut seine Lesewerkzeuge daraus und seine Schreibwerkzeuge aus dem Register.
  _Verworfen:_ Lesezugriffe als Befehle (Hüllen, die kein Mensch startet).
- **D178 Ein Ausführer in zwei Schichten, in der Hülle.** Der Kern lädt, prüft die Eingabe, führt aus
  und gibt Erfolg oder Fehler zurück, ohne etwas anzuzeigen. Der Start für Menschen dient Knopf,
  Kürzel und Palette: Er merkt sich die Seite beim Auslösen, ignoriert einen zweiten Start desselben
  Befehls und zeigt Fehler über `notifyError()`. Die Fehlermeldung unter dem Knopf entfällt. Der
  Agent nutzt nur den Kern, zwei Aufrufe nacheinander laufen also beide. _Verworfen:_ jede Stelle
  führt selbst aus (wie t3code, dort laufen Handler von Kürzeln ungeschützt).
- **D179 TanStack Hotkeys bleibt (D75), aber nachgeladen und hinter einer Datei.** Die Version ist
  exakt festgelegt, weil die Bibliothek weiter Beta ist. Eine Bindungs-Komponente lädt nach dem ersten
  Bild und bindet alle Standardkürzel plus ⌘K. ⌘K ist selbst kein Registereintrag. Gehaltene Tasten
  starten einmal (`requireReset`). _Verworfen:_ Mantines `useHotkeys` (kein `Mod` pro Plattform,
  blockiert ⌘K in Eingabefeldern, keine Scopes); selbst gebaut.
- **D180 Der Geltungsbereich eines Kürzels folgt der Art.** `page` gilt, solange das Modul sichtbar
  ist, und darf sich ein Kürzel mit anderen Modulen teilen. `open` gilt überall und muss eindeutig
  sein. Kürzel laufen über dem Drawer weiter (die Wache aus D167 schützt den Entwurf), aber nicht bei
  offener Nachfrage oder Palette. Standardkürzel brauchen immer `Mod`. Tests verbieten reservierte
  Tasten: ⌘C, ⌘V, ⌘X, ⌘A, ⌘Z, ⌘K und was das Standardmenü von Electron belegt.
- **D181 ⌘Z nimmt den jüngsten sichtbaren Rückgängig-Hinweis zurück.** Außerhalb von Eingabefeldern,
  als `open`-Befehl `shell.undo`, einzige Ausnahme von den reservierten Tasten. Ohne Hinweis passiert
  still nichts. `@self-engine/ui` bekommt dafür `undoLatest()`. Ein allgemeines „gerade verfügbar“
  für Befehle wartet auf ein echtes Modul. _Verworfen:_ kein Kürzel (der Reflex nach dem Löschen geht
  ins Leere); allgemeines Rückgängig (D88).
- **D182 Die Palette ist `Spotlight.Root` mit eigener Filterung.** `@mantine/spotlight` in 9.7.5,
  passend zu Mantine, `shortcut={null}`, und der Code lädt beim ersten Öffnen. Die Einträge entstehen
  nur, solange sie offen ist. _Verworfen:_ `Spotlight` mit `actions` (filtert bei jedem Render, auch
  geschlossen); eigene Palette auf Combobox (deutlich mehr Code, ein Wechsel bleibt lokal möglich).
  _Bekannte Lücke:_ keine Combobox-Rollen für Screenreader.
- **D183 Die Palette durchsucht Befehle und Views, noch keine Nutzerdaten.** `input`-Befehle
  erscheinen nie. Befehle fremder Module laufen erst, wenn die Navigation dorthin angekommen ist:
  `ShellRouting` bekommt dafür eine Fähigkeit, und „Weiter bearbeiten“ bei der Wache stoppt den
  Befehl. _Verworfen:_ nur Befehle (kein Springen zu Views); Nutzerdaten jetzt (Such-Vertrag ohne eine
  einzige Modultabelle).
- **D184 Reihenfolge in der Palette.** Leere Suche: Befehle des aktiven Moduls, seine Views, dann die
  `open`-Befehle. Beim Tippen schlägt der Wortanfang die Wortmitte, dann das aktive Modul, dann die
  Reihenfolge im Beitrag. Höchstens 8 Zeilen, nach Modul gruppiert, nichts vorgewählt. _Verworfen:_
  zuletzt benutzt und Tippfehler-Suche (später nachrüstbar, die IDs sind stabil).
- **D185 Der Einstieg in die Palette sitzt in der Navbar (ändert D132 und #19).** Nur Icon, wenn die
  Navbar schmal ist, Text mit ⌘K-Hinweis, wenn sie breit ist, am Telefon in der unteren Leiste. Der
  freie Platz rechts in der Kopfzeile bleibt frei. _Verworfen:_ der Knopf in der Kopfzeile, für den
  D132 den Platz reserviert hatte.
- **D186 Nightlies entstehen alle sechs Stunden (ändert D163).** Der Zeitplan startet um 00:17,
  06:17, 12:17 und 18:17 UTC. Gebaut wird weiter nur, wenn sich `main` geändert hat.
