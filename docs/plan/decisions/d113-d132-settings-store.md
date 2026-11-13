# Runde 20 (2026-11-09): Einstellungs-Store (#15, verfeinert D62)

- **D113 Adapter asynchron, Lesen synchron** (ADR 0010): Adapter haben `load`, `save` und
  `subscribe`, auch über `localStorage`. Die App wartet vor dem ersten React-Render einmal auf
  `load`, der Start Cache überbrückt das. Danach liest der Store synchron aus einem Abbild im
  Speicher; Schreiben ändert sofort das Abbild und speichert im Hintergrund. _Grund:_ Ab #34 ist
  jeder Zugriff asynchron, und Standardwerte im ersten Render würden Farben aufblitzen lassen und
  den Start Cache überschreiben. _Verworfen:_ jetzt synchron und in #34 umbauen; asynchrones
  Lesen mit Ladezustand in jeder Komponente.
- **D114 Fenstergröße und -position sind keine Einstellungen** (verfeinert D62): Der Hauptprozess
  braucht sie, bevor ein Renderer läuft, und erreicht kein `localStorage`. Sie liegen als eigene
  Datei im `userData`-Ordner des Kanals und gehören dem Hauptprozess (#24). Geräteeinstellungen
  bleiben im Renderer auf `localStorage`. _Verworfen:_ gemeinsame Datei mit IPC und zweitem
  Web-Adapter.
- **D115 Ein Eintrag pro Einstellung** (ADR 0010) unter einem dauerhaften Schlüssel; `save`
  bekommt nur Geändertes, mehrere Einträge gemeinsam. Eine Einstellung ist eine Entscheidung des
  Nutzers; was nur gemeinsam Sinn ergibt, ist eine Einstellung mit einem Objekt als Wert. _Grund:_
  Zwei Geräte überschreiben sich nicht gegenseitig, unbekannte Einträge fasst niemand an.
  _Verworfen:_ ein Objekt pro Store oder pro Bereich.
- **D116 Neutrales Paket `@self-engine/settings`**, Kern und `./react`, ohne Importe aus dem
  Workspace. Jeder Besitzer deklariert seine Einstellungen selbst (Schlüssel, Geltung, Standardwert,
  Prüfung), die Darstellungs-Einstellungen liegen in der App. Die Geltung (synchronisiert oder
  Gerät) bestimmt den Adapter. _Verworfen:_ zentrale Deklarationen im Paket (Module wären nicht
  mehr eigenständig); alles in der App (Pakete dürfen keine Apps importieren).
- **D117 Speicherfehler stoppen die App nie** (ADR 0010): Ein kaputter Eintrag zeigt seinen
  Standardwert, ein gescheitertes `load` startet die Sitzung mit Standardwerten, ein gescheitertes
  `save` lässt den Wert bis zum Neustart gelten. Gespeichertes bleibt unberührt, kein automatischer
  Wiederholversuch, gemeldet wird über `onError`. _Verworfen:_ Fehlerbildschirm; Zurücksetzen des
  Werts bei gescheitertem `save`.
- **D118 Einstellungen werden mit Zod geprüft**, Zod kommt damit vor #31 in den Katalog. Offene
  Felder (Theme, Akzent) sind `string`, geschlossene (Farbmodus, Dichte, Schriftgröße) sind Listen
  erlaubter Werte. Ein unbekannter Wert zeigt den Standardwert und bleibt gespeichert. Ungültiges
  Schreiben ist ein Programmierfehler und wirft. _Verworfen:_ eigene Prüffunktionen neben Zod.
- **D119 Änderungen von außen laufen über `subscribe` des Adapters:** andere Tabs im Web, ab #34
  `tablesChanged`, später Sync. Der Store übernimmt nur die gemeldeten Einträge und ignoriert
  Echos eigener Schreibvorgänge.
- **D120 Der Komponentenkatalog ist eine eigene App** (#17), die nur Storybook, Toolbar und
  Decorators enthält. Stories liegen neben ihrem Gegenstand und werden über ein Muster ohne
  Paketnamen gefunden. `packages/ui` entsteht erst mit der ersten geteilten Komponente.
  _Verworfen:_ Storybook in `apps/web` (übernimmt Router-Plugin und Electron-Serverwerte);
  Storybook im UI-Paket (das Paket müsste Module kennen).
- **D121 Ein Story-Test beweist, dass ein Baustein rendert, nicht wie er aussieht** (ADR 0012):
  kein Fehler, kein `console.error`, `play` besteht, in einer festen Darstellung.
  _Verworfen:_ Screenshots im Gate; alle Stories in mehreren Darstellungen.
- **D122 Stories sind eine eigene Gate-Stufe `stories` nach `test`,** `pnpm test` bleibt ohne
  Browser. Chromium holt ein `ensure`-Skript nach dem Muster von Electron, in CI ein eigener
  Schritt mit den Systembibliotheken. _Verworfen:_ Vitest-Projekte in einem Lauf (jeder
  Skript-Test bräuchte Chromium); `postinstall` (nicht jede Installation braucht den Browser).
- **D123 `/theme-preview` behält bis #23 nur die Umschalter,** die Beispiele werden zu Stories.
  _Grund:_ Die Seite ist bis dahin die einzige Stelle, die die Darstellung in der echten App über
  die echten Einstellungen ändert. `/language-sample` bleibt unverändert.
- **D124 Mantine wird nur dort einzeln angepasst, wo seine Wahl der Bedeutung einer Farbrolle
  widerspricht:** Popover, Modal und Drawer nutzen `surfaceRaised`. Alles andere bleibt auf den
  erzeugten Paletten `gray` und `dark`, die `Input` bereits richtig treffen. _Verworfen:_ jede
  genutzte Komponente einzeln abbilden (hängt an Mantines internen Selektoren).
- **D125 Die Toolbar speist direkt den `ThemeProvider`,** ohne Settings-Store, mit einem
  Theme-Schalter für Hell und Dunkel. Startwert ist `DEFAULT_APPEARANCE` mit Hell und Englisch,
  zugleich die feste Darstellung der Story-Tests. Kein Docs-Modus. Stories sind von der
  Übersetzung ausgenommen.
- **D126 Mantine zuerst** (#19): Was Mantine bietet, wird genutzt und über Theme oder Styles API
  angepasst, selbst gebaut wird nur der Rest. Der Prototyp gibt nur die allgemeine Struktur vor,
  nicht Verhalten oder Maße (verfeinert D65, D67).
- **D127 Die Hülle ist ein eigenes Paket `@self-engine/shell`** ohne Router, Settings und
  Plattformwissen. Sie bekommt alles als Props, die App verdrahtet. Der Hüllen-Beitrag aus #20
  liegt im selben Paket (verfeinert D74). _Verworfen:_ Router und Settings im Paket (jede Story
  bräuchte deren Aufbau), Hülle in `apps/web` (Module könnten den Beitragstyp nicht importieren).
- **D128 Aufbau aus `AppShell` und `Splitter`:** `AppShell` im `static`-Modus, die Navbar ist
  seine Navbar mit Mantines Griff, Modul-Sidebar und Inhalt liegen in einem `Splitter` im
  Hauptbereich. Beide Breiten sind unabhängig veränderbar, der Inhalt gleicht aus. _Verworfen:_
  der ganze Navigations-Container als `AppShell.Navbar` mit innerem `Splitter` (beim Einklappen
  der Navbar würde die Modul-Sidebar breiter statt der Inhalt).
- **D129 Zwei Geräteeinstellungen für die Breiten:** `shell.navbar` mit
  `{ collapsed, expandedWidth }` und `shell.moduleSidebarWidth`, eine Breite für alle Module.
  Geschrieben wird beim Loslassen, eine von der Layoutstufe erzwungene Icon-Navbar schreibt nie.
  Doppelklick schaltet die Navbar um und setzt die Modul-Sidebar auf den Standard zurück.
- **D130 Die Schriftstufe läuft über Mantines `theme.scale`,** die Root-Schriftgröße bleibt bei
  100 % (ändert #14). Mantines Griff rechnet mit 16 px pro `rem`, bei anderer Root-Größe springt
  die Navbar beim Ziehen. _Verworfen:_ eigener Griff (Tastatur, Escape und ARIA neu bauen).
- **D131 Layoutstufen auf Mantines `xs`, `md`, `lg`** statt der Prototyp-Werte (verfeinert D59).
  Electron startet mit 1280 × 800 und ist mindestens 576 px breit, die Handy-Stufe gibt es damit
  nur im Web, ohne Plattformabfrage in der Hülle.
- **D132 Die Hülle rendert immer eine Kopfzeile im Inhalt** mit `Burger`, Seitentitel und freiem
  Platz rechts für #22. Die Icon-Navbar ist 68 px breit, damit die macOS-Fensterknöpfe
  nebeneinander passen. Der Streifen dafür erscheint per Prop nur auf dem Mac-Desktop
  (verfeinert D78).
