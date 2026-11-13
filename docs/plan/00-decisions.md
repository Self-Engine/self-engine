# OSS-Nachfolger von Self-Engine: Entscheidungslog

Stand: 2026-11-07 · Status: Grilling läuft (Runde 4)

> Hinweis: Der erste Entwurf in `.temp/oss-plan/` (Self-Engine-Worktree) wurde am
> 2026-11-07 unbemerkt gelöscht. Diese Datei und der Design-Baum wurden aus dem
> Gesprächsverlauf wiederhergestellt; die beiden Rechercheberichte nur als Zusammenfassung.
> Seitdem liegt der Plan in diesem Repo (D13).

## Arbeitsthese

Ein lokales, quelloffenes „Betriebssystem für Leben und Arbeit“: aus fachlich tiefen
Modulen zusammenstellbar, echte App-Oberfläche statt Markdown, Sync als optionaler
Dienst, Organisationen stellen geteilte Bereiche mit festen Regeln (Policies) bereit.
Langfristig Plugins von Dritten. Ersetzt Self-Engine.

## Entscheidungen

### Runde 1 (2026-11-07)

- **D1 Erste Zielgruppe: Freelancer und Selbstständige.** Einzelpersonen ohne Org-Zwang,
  nutzen die fachliche Tiefe (Rundung, Payouts, Finanzen). Natürlicher Weg zu Teams:
  Auftraggeber stellt später einen Space bereit. _Verworfen:_ reine Privatnutzer (zu
  generisch), Teams zuerst (Org-Spaces zu früh), alle gleichzeitig.
- **D2 Warum OSS: Vertrauen/Datenschutz (Hauptgrund), Plugin-Ökosystem (langfristig),
  persönliche Motivation (Portfolio, Lernen, Spaß).** Community-Beiträge zum Kern sind
  willkommen, aber keine Planungsgrundlage.
- **D3 Self-Engine: Fokus wandert ins neue Projekt; Self-Engine wird bei Bedarf noch
  weiterentwickelt.** Wechsel erst, wenn das neue Projekt alles abdeckt. Import aus
  Self-Engine ist Pflicht. _Verworfen:_ schrittweiser Umbau von Self-Engine (Server-first →
  Local-first lässt sich nicht inkrementell drehen).
- **D4 Repo: komplett neues, öffentliches Repo.** Übernahme aus Self-Engine bewusst,
  Datei für Datei, mit Tests. _Verworfen:_ im Monorepo starten, Self-Engine öffnen.
- **D5 Kapazität: solo, viel mit KI-Agenten, Teilzeit.** Ziel: in 3–4 Monaten Projekte +
  Zeit lokal nutzbar (siehe D9 zur Ablösung).
- **D6 Plattform: Desktop als Hauptplattform + Web.** Mobile später, spätestens mit Sync.
- **D7 Ablage des Plans: im neuen OSS-Repo** (umgesetzt mit D13).
- **D8 Grundprinzip: Fachmodule mit echter Logik + generische Schicht obendrauf**
  (eigene Felder, Ansichten, Dashboards). _Verworfen:_ generisch wie Notion,
  nur starre Fachmodule.

### Runde 2 (2026-11-07)

- **D9 Ablösung erst bei (fast) voller Funktionsgleichheit; fließender Übergang.**
  Der Owner braucht fast alles, was Self-Engine kann, bevor er wechselt. Projekte + Zeit
  bleiben der erste Meilenstein, sind aber kein Ablöse-Zeitpunkt. Wie der Übergang
  konkret läuft, ist offen (Q23).
- **D10 Feste Modulgrenzen ab Tag 1** (eigener Ordner/Paket pro Modul, Lint-Regeln für
  erlaubte Importrichtungen, keine Zyklen). Formales Manifest erst ab dem dritten Modul.
- **D11 Sync kommt später; die Engine wird erst in der Sync-Phase gewählt.** Jetzt
  festgelegt ist nur: lokales SQLite, und alle Module sprechen über eine eigene
  Speicher-Schnittstelle (ein Port pro Modul), nie direkt mit einer Sync-Bibliothek.
  PowerSync ist laut Recherche Favorit; LiveStore/Jazz werden bis dahin beobachtet.

### Runde 3 (2026-11-07)

- **D12 Übergang: Daten bleiben bis zum Stichtag in Self-Engine; die neue App bekommt
  früh einen wiederholbaren Import** (jederzeit den aktuellen Stand neu laden und mit
  echten Daten testen). Gewechselt wird an einem Stichtag, wenn alles passt.
  _Verworfen:_ Modul für Modul wechseln (reißt Brücken wie Zeit → Finanzen auseinander),
  Dauerabgleich beider Apps (fast so aufwendig wie die App).
- **D13 Plan liegt ab sofort im neuen, privaten Repo `GwydionBr/self-engine-next`**
  (Arbeitstitel) unter `docs/plan/`. Öffentlich wird es später.

### Runde 4 (2026-11-07)

- **D14 Der Owner nutzt Self-Engine täglich auf dem Handy → Mobile-App und Sync sind
  Pflicht vor dem Stichtag** (D12). Sync und Mobile rücken damit vor die Ablösung; die
  Reihenfolge bis zum Stichtag ist noch offen.
- **Q22 (Speicherform) wird vertieft**, siehe [`02-storage-options.md`](02-storage-options.md).

### Runde 5 (2026-11-07)

- **D15 Nutzer-Generik: Ziel sind eigene Typen (wie Notion-Datenbanken), erster Schritt
  eigene Felder an bestehenden Typen.** Das Datenmodell muss eigene Typen von Anfang an
  erlauben („Schema als Daten“), gebaut werden zuerst nur eigene Felder.
- **D16 Das Datenmodell wird über Recherche und danach einen Wegwerf-Prototyp entschieden.**
  Recherche: wie Anytype, Tana, Logseq (DB), Notion, Capacities u. a. intern speichern
  (`research-data-models.md`). Danach Prototyp: Tabellen pro Entität gegen „typisierte
  Objekte auf generischem Kern“, mit realistischen Datenmengen aus Self-Engine.

### Runde 6 (2026-11-07)

- **D17 Desktop-Shell: Electron.** SQLite nativ in Node, Sync-SDKs unterstützen es (Tauri:
  Alpha), Tray/Popover/Updater aus Self-Engine übernehmbar. _Verworfen:_ Tauri.
- **D18 Lizenz: AGPL-3.0 für App und Sync-Server, MIT für Plugin-SDK** (und
  Datenformat-Spezifikation). _Verworfen:_ alles MIT (kommerzielle geschlossene Klone des
  Sync-Dienstes), alles AGPL (bremst Plugin-Ökosystem).
- **D19 Prototyp für das Datenmodell: nur Desktop** (Node + SQLite), drei Varianten
  (V1 Tabellen pro Entität, V2 `objects` + generierte Spalten, V3 `objects` +
  Lese-Tabellen), synthetische Daten in Self-Engine-Form. Web, Mobile und Sync-Test
  folgen in den jeweiligen Phasen. Ort: `prototypes/data-model/`.

### Runde 7 (2026-11-07): Kurskorrektur

- **D20 Produktkern: fokussierte App, kein Baukasten.** Projekte, Zeit, Finanzen,
  Kalender und Gewohnheiten, gut gebaut. Nutzer können Module an- und abschalten, die
  Oberfläche anordnen und eigene Felder ergänzen (Modularität Stufe 1–3). Eigene Typen à la
  Notion (Stufe 5) sind kein Ziel mehr. _Gründe:_ Solo und Teilzeit, Mobile und Sync sind
  Pflicht vor dem Stichtag (D14), beim Baukasten Konkurrenz durch Notion, Anytype, Obsidian
  und Tana, die Nische „lokal, offen, Zeit + Finanzen + Arbeitgeber-Modus“ ist frei.
  _Verworfen:_ Baukasten, in dem Zeiterfassung ein Modul unter vielen ist. _Ersetzt:_ D15
  (Ziel eigene Typen) und schwächt D8 ab (generische Schicht nur für eigene Felder).
- **D21 Plugins von anderen: „irgendwann“, kein Architekturziel jetzt.** Die Tür bleibt
  nur durch saubere Modulgrenzen (D10) offen. Keine Plugin-API, keine Sandbox, kein
  generisches Datenmodell für fremde Module in der Planung. _Folge:_ Q22 (Datenmodell) wird
  neu geöffnet; der Vorteil von V3 („neues Feld ohne Migration“) zählt vor allem für fremde
  Plugins. Kandidat jetzt: Tabellen pro Modul + `custom`-JSON-Spalte für Nutzerfelder.

### Runde 8 (2026-11-07)

- **D22 Datenmodell: Tabellen pro Modul-Entität + `custom`-JSON-Spalte für Nutzerfelder +
  eigene Verknüpfungstabellen für Brücken** (z. B. `payout_entries` statt `paid`/`payout_id`
  am Zeiteintrag). Schema-Änderungen über normale Migrationen; die DB prüft Verweise.
  _Verworfen:_ V3 (`objects` + Lese-Tabellen) und V2, weil fremde Plugins kein Ziel mehr
  sind (D21). Prototyp-Ergebnis: V1 ist bei Auswertungen gleich schnell wie V3.
- **D23 UI: React + Mantine, von Grund auf neu und von unten nach oben.** Zuerst die
  App-Hülle (Navbar, Sidebar, Seitenrahmen, Theme, Grundkomponenten) fertig gestalten, dann
  kommen die Module hinein. Eigene, überarbeitete Optik. Keine eigene UI-Schicht für Plugins
  (D21).
- **D24 Sprachen: Deutsch + Englisch in der App ab Tag 1; Code und Doku Englisch.**
- **Leitprinzip (zu D23): Das Projekt wird stabil von unten nach oben gebaut.** Jede Schicht
  ist fertig und getestet, bevor die nächste darauf aufsetzt; keine Fachfunktion vor ihrem
  Fundament.

### Runde 9 (2026-11-07)

- **D25 Schichtenfolge als grober Rahmen:** 0 Repo-Fundament → 1 Design-System + App-Hülle →
  2 Datenschicht → 3 gemeinsamer Kern → 4 Projekte + Zeit → 5 Import. Jede Schicht bekommt
  eine eigene Vertiefung mit Recherche und Einzelentscheidungen (z. B. Vite+), **bevor**
  darauf aufgebaut wird. Dokumente: `03-layer-0-foundation.md` usw.
- **D26 Desktop ist das Hauptprodukt und kommt zuerst.** Web und Mobile folgen; der
  Web-Build kompiliert bis zur Sync-Phase in CI mit, wird aber nicht ausgeliefert.
- **D27 Agenten-Setup: ausgewählt übernehmen, nicht blind.** Jedes Element aus Self-Engine
  (CLAUDE.md-Regeln, Skills, Hooks, Verify-Pipeline) wird einzeln geprüft: noch aktuell,
  noch nötig, passt zum neuen Repo? Grundlage: ein Audit.

### Runde 10 (2026-11-07): Schicht 0, erste Entscheidungen

- **D28 (L0.1) Toolchain: Vite+** (`vp check`, `vp test`, `vp run`, `vp pack`), vorbehaltlich
  der Spikes S1/S2.
- **D29 (L0.2) Paketmanager: pnpm mit Node** statt Bun. Gründe: Electron Forge ohne
  Bun-Support, Bun-Fehler bei electron-builder, native Module (better-sqlite3), strenge
  Paket-Isolation für Modulgrenzen. Bewusster Bruch mit Self-Engine.
- **D30 (L0.3) Kein Turborepo, Task-Runner ist `vp run`.** Turborepo und Vite Task
  (`vp run`) konkurrieren direkt: beide orchestrieren Tasks über den Paketgraphen und cachen
  lokal und remote. Beide zu nutzen hieße doppeltes Caching. Vorbild t3code
  (pingdotgg/t3code): `vp run` mit eigenem Remote-Cache (Cloudflare Worker in
  `infra/task-cache`, Option `run.cache.remote` in `vite.config.ts`). Turborepo bleibt
  Ausweichlösung, falls `vp run` nicht trägt.
- **D31 Spikes S1 und S2 vor der Festlegung**, als Wegwerfcode in `prototypes/`.

## Referenzprojekt t3code (geprüft 2026-11-07)

`pingdotgg/t3code` (MIT) nutzt: pnpm 12, Node 26, Vite+ 1.4 (`vite` per Catalog auf
`@voidzero-dev/vite-plus-core` umgeleitet), `vp run` mit Cache und selbst gehostetem
Remote-Cache, `vp lint`/`vp fmt`, knip, ein eigenes Oxlint-Plugin, Electron 44 +
electron-builder + electron-updater. **Kein electron-vite:** Main und Preload werden mit
`vp pack` (tsdown) als CJS gebaut, der Renderer ist die Web-App (`apps/web`), gebaut mit
Vite. Damit ist ein funktionierender Weg für Electron unter Vite+ belegt.

### Runde 11 (2026-11-08)

- **D32 (L0.6, S1) Electron-Aufbau wie t3code (Weg A):** Main und Preload mit `vp pack` als
  CJS, Renderer als normale Vite-App, Paketierung mit electron-builder, Updates mit
  electron-updater. _Verworfen:_ electron-vite (funktioniert, bleibt Ausweichlösung),
  Electron Forge (verlangt `node-linker=hoisted`).
- **D33 (S2) SQLite: better-sqlite3 13** (N-API, ein Binary für Node und Electron),
  `npmRebuild: false` in electron-builder, Tests direkt mit `vp test` in Node.
  `node:sqlite` beobachten.
- **D34 Node-Version wie t3code:** `engines` auf Node 26 (Werkzeuge, Tests),
  `@types/node` auf die Node-Version von Electron gepinnt (aktuell 24), damit TypeScript
  Node-26-APIs meldet, die Electron noch nicht kennt. Offen: zusätzlicher CI-Lauf mit
  `ELECTRON_RUN_AS_NODE` (im Spike erprobt), nicht Teil des t3code-Vorbilds.

- **D35 (L0.4) Lint und Format über `vp check`** (Oxlint + Oxfmt). Eigene Regeln wie
  `no-silent-catch` in einem eigenen Oxlint-Plugin (Vorbild `oxlint-plugin-t3code`).
- **D36 (L0.5) Modulgrenzen dreifach:** ein Workspace-Paket pro Modul (strenge
  pnpm-Isolation), `exports`-Feld als öffentliche Schnittstelle, dependency-cruiser in CI für
  erlaubte Richtungen und Zyklen.

- **D37 (L0.7) Routing wie t3code:** TanStack Router mit dateibasierten Routen, eigenes
  Protokoll in Electron (Dev und Produktion mit eigenem Schema; Dev leitet an den
  Vite-Dev-Server weiter, Produktion liefert gebaute Dateien mit `index.html`-Fallback und
  CSP), Hash-History in Electron, Browser-History im Web.
- **D38 Release-Kanäle: dev, nightly, stable** (Wunsch des Nutzers). Details offen (L0.9).

- **D39 Jeder Kanal ist eine eigene App:** dev, nightly und stable parallel installierbar,
  je eigener Name, Icon, App-ID, Protokoll-Schema und Datenordner. Funktion „Daten aus
  Stable kopieren“. _Grund:_ Migrationen nur vorwärts; eine Nightly-Migration würde die
  Stable-Datenbank unlesbar machen.
- **D40 Stable baut nur einen Commit, der schon als Nightly veröffentlicht wurde** (wie
  t3code).
- **D41 Nightly automatisch jede Nacht, nur bei Änderungen seit dem letzten Nightly;**
  manueller Start zusätzlich möglich.

- **D42 (L0.8) Tests:** Vitest über `vp test` für Logik und Daten, Vitest-Browser-Modus für
  Komponenten, Playwright-Electron für Ende-zu-Ende ab Schicht 1.
- **D43 (L0.9) Versionierung ohne release-please:** PR-Titel als Conventional Commits (in CI
  geprüft), Stable von Hand mit Versionsnummer gestartet, Changelog beim Release aus den
  Commits seit dem letzten Stable (z. B. git-cliff). _Grund:_ Der Release-PR von
  release-please erzeugt einen Commit, der nie als Nightly lief (Widerspruch zu D40).

- **D44 (A1) Ein Gate `pnpm verify`** für Mensch und Agent: Format → Lint (Warnungen =
  Fehler) → Typecheck → ADR-Prüfung → Tests, über `vp`-Tasks mit Cache, Schlusszeile
  `VERIFY: PASS`/`VERIFY: FAIL`. Hilfsskripte (Push-Guard, Stamp) laufen mit Node 26.
- **D45 (A2) PRs ab Tag 1 + Push-Guard:** jede Änderung per PR mit CI, PR-Titel als
  Changelog-Eintrag; Push nur, wenn `verify` auf genau diesem Stand bestanden hat; `main`
  ist immer releasefähig.
- **D46 (A3) Sprache und ADRs:** `docs/plan/` Deutsch; alles für Agenten Englisch
  (`AGENTS.md`, Skills, ADRs, Glossar). ADRs mit `status:` im YAML-Kopf. Mit dem ersten Code
  werden tragende D-Entscheidungen zu ADRs; `00-decisions.md` ist danach Historie.

- **D47 (A4) Versionsnummern bis 1.0.0 steigen sehr langsam.** Start bei `0.0.1` (geändert 2026-11-08, vorher `0.1.0`). Nicht
  jedes `feat` erhöht die Version: Der Vorschlag beim Stable-Release ist immer nur Patch
  (`0.0.x`); die mittlere Stelle wird nur bewusst bei Meilensteinen erhöht (z. B. Schicht
  fertig). `1.0.0` beim Umstieg von Self-Engine. Nach 1.0 neu entscheiden.
- **D48 (A5) Issues ab Schicht 0:** `docs/plan/` plant bis zum ersten Code; danach wird jede
  Schicht in GitHub-Issues zerlegt, mit den fünf Triage-Labels. Externe Issues/PRs erst,
  wenn das Repo öffentlich wird.
- **D49 (A6) Für alle Agenten:** `AGENTS.md` ist die Quelle (`CLAUDE.md` als Symlink);
  Skills liegen in `.agents/skills/` mit Symlinks nach `.claude/skills/`, damit Claude Code,
  Codex und andere Agenten dieselben Skills sehen.

### Runde 12 (2026-11-08)

- **D50 (Q14) Name bleibt „Self-Engine“.** Das neue Projekt löst das alte ab und heißt
  gleich. Kanalnamen: „Self-Engine“, „Self-Engine Nightly“, „Self-Engine Dev“.
  Kollisionen mit der alten App während des Übergangs: siehe Fakten.

- **D51 (Q33a) Eigene App-IDs während des Übergangs** (z. B. `app.selfengine.desktop`,
  `.nightly`, `.dev`). Bis zum Stichtag nutzt der Owner die Nightly; Stable 0.x erscheint
  für andere. Am Stichtag wird `1.0.0` die Haupt-App „Self-Engine“; die alte App bekommt
  ein letztes Update mit Umstiegshinweis.
- **D52 (Q33b) Repo-Umbenennung am Stichtag:** alt → `self-engine-legacy`, neu →
  `self-engine`. Nicht vorher (alte Desktop-Updates, CI und Vercel hängen am alten Namen).
- **D53 Nächster Schritt: Schicht 0 bauen** (Issues, Umsetzung), Schicht 1 parallel planen.

### Runde 13 (2026-11-08): Schicht 1, Grundrichtung

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

### Runde 14 (2026-11-08): offene Grundfragen

- **D83 (Q12) Geschäftsmodell: App und Selbsthosten kostenlos, bezahlt werden gehosteter
  Sync und Organisations-Spaces.** Passt zur AGPL (D18): Wer den Sync-Server selbst
  betreibt, zahlt nichts. Details (Preise, Abrechnung) erst in der Sync-Phase.
  _Verworfen:_ nur Spenden, gar kein Geschäftsmodell.
- **D84 (Q13) Self-Engine wird nicht eingeschränkt; der Schwerpunkt liegt im neuen
  Projekt.** Weder Funktionen noch Schemaänderungen sind gesperrt. Folge für den Import
  (Schicht 5): Er liest das jeweils aktuelle Self-Engine-Schema, prüft beim Start die
  erwartete Schema-Version und bricht mit klarer Meldung ab, statt still falsch zu
  importieren. Der wiederholbare Import (D12) fängt spätere Änderungen auf.
  _Verworfen:_ Self-Engine auf Bugfixes einfrieren.
- **D85 (Q16) KI-Assistent nach dem MVP, mit eigenem API-Schlüssel des Nutzers und einem
  lokalen MCP-Server.** Schon vorher werden Befehle agententauglich gebaut: Jede
  Aktion geht über das zentrale Befehlsregister (D75) mit typisierten Eingaben, sodass
  ⌘K, Tastenkürzel und später der Agent dieselben Befehle aufrufen. D64 (angedockter
  Assistent) bleibt vorläufig; die Form wird beim Bau entschieden.

### Runde 15 (2026-11-08): Schicht 2, Grundrichtung

Grundlage: [`research-layer-2-data.md`](research-layer-2-data.md).

- **D86 (L2.1) Schicht 2 liefert nur das Fundament:** Datenbank im Desktop, Migrationen,
  das Muster für Speicher-Ports (ein Port pro Modul, In-Memory-Fake, Contract-Tests; Fake ersetzt durch D95),
  Einstellungen in der Datenbank (Fortsetzung von #15) sowie Sicherung und
  Wiederherstellung der Datenbankdatei. Fachliche Tabellen kommen erst in Schicht 3 und 4.
- **D87 (L2.2) Sync-taugliche Konventionen ab Tag 1, auch ohne Sync:** `id` als
  Text-Primärschlüssel mit UUIDv7, `created_at`/`updated_at` als UTC-Text, weiches Löschen
  über `deleted_at`, `space_id` an jeder Tabelle, die später synct. `STRICT`-Tabellen,
  Fremdschlüssel `DEFERRABLE INITIALLY DEFERRED`, `custom` als JSON-Text. Brückentabellen
  bekommen eine eigene `id` plus eindeutiges Paar (PowerSync kennt keine zusammengesetzten
  Schlüssel).
- **D88 (L2.3) Jede Änderung ist eine benannte Operation** (z. B. `timeEntry.stop`) durch
  den Port, kein freies `UPDATE`. Passt zu Befehlsregister (D75) und Agent (D85); später
  prüft der Server im Org-Space dieselbe Operation. Kein dauerhaftes Operations-Protokoll
  jetzt; Rückgängig beim Löschen (D79) läuft über weiches Löschen. Das Protokoll kommt mit
  Sync. _Verworfen:_ Protokoll ab Tag 1 (Verlauf, allgemeines Rückgängig).
- **D89 Schicht 2 bleibt unabhängig von jeder Sync-Engine; PowerSync ist nicht gesetzt.**
  In der alten Self-Engine kam PowerSync wegen TanStack DB; im neuen Plan war es Favorit,
  weil Schreibvorgänge über die eigene API laufen und der Server sie ablehnen kann (D11).
  Die Wahl fällt neu in der Sync-Phase. Nahtstelle: Port pro Modul (D11) + eigener
  Schreibweg (D88) + Änderungsereignis (D92). Keine Engine-Bibliothek und kein
  Engine-Spike in Schicht 2. Kriterien für die spätere Wahl: Server prüft Schreibvorgänge
  (Org-Policies), lange Offline-Phasen, SQLite auf Desktop, Web und Mobile, Selbsthosten,
  Lizenz passt zur AGPL (D18). Grenze: Engines mit eigenem Speichermodell (z. B. LiveStore)
  ersetzen die Speicher-Implementierung hinter den Ports, nicht Module und Oberfläche.
- **D90 (L2.4) Die Datenbank läuft in einem eigenen Electron-`utilityProcess`** (Datenprozess);
  der Renderer spricht ihn direkt über einen `MessagePort` an, mit typisierten Verträgen in
  einem eigenen Paket `contracts` (wie t3code). _Grund:_ better-sqlite3 ist synchron, im
  Hauptprozess würden Import oder Neuaufbau das Fenster blockieren. SQLite-Einstellungen
  wie t3code (WAL, `busy_timeout`, `foreign_keys=ON` …, siehe Recherche).
  _Verworfen:_ Hauptprozess, Worker-Thread im Hauptprozess.
- **D91 (L2.5) Abfragen mit Kysely, Migrationen als nummerierte, handgeschriebene SQL-Dateien**
  (nur vorwärts, D40). Kysely ist typisiertes SQL ohne ORM; für jede SQLite-Variante wird
  nur der Dialekt getauscht. Ein Test pro Modul prüft, dass Kysely-Typen, Zod-Schema und
  echte Spalten übereinstimmen. Zod 4 ist die Quelle für Entitäten und Operations-Eingaben.
  _Verworfen:_ Drizzle (Migrationsgenerator bringt bei handgeschriebenen `STRICT`-Tabellen
  wenig), reines SQL (keine Typen), Effect Schema (bringt den ganzen Effect-Stil mit).
- **D92 (L2.6) Oberfläche: TanStack Query hinter eigenen Hooks pro Modul** plus ein eigenes
  Ereignis `tablesChanged([...])`, das der Datenprozess nach jedem Commit sendet; Hooks laden
  betroffene Abfragen neu. Eine spätere Sync-Engine löst dasselbe Ereignis aus.
  _Verworfen:_ TanStack DB (erst RC, Kopplung an eine Engine im Renderer wie in der alten
  Self-Engine); in der Sync-Phase erneut ansehen.
- **D93 (L2.7) Verbindung Oberfläche ↔ Datenprozess über oRPC** mit Zod-Verträgen im Paket
  `contracts`, Message-Port-Adapter (`@orpc/server/message-port`, `@orpc/client/message-port`);
  `tablesChanged` als Event Iterator. Später derselbe Vertrag im Web über einen Worker.
  Geprüft: offizieller Electron-Weg über `MessagePortMain` aus dem Hauptprozess;
  Event Iterators gehen über Message Ports, nur nicht mit `experimental_transfer`.
  Nicht geprüft: Server im `utilityProcess` (Port vom Hauptprozess per `MessageChannelMain`
  weiterreichen) → erste Aufgabe im Issue für den Datenprozess, mit Rückfall auf eine
  eigene kleine RPC-Schicht. _Verworfen:_ eigene RPC-Schicht als Standard.
- **D94 (L2.8) Sicherung über die SQLite-Backup-Funktion**, nicht durch Dateikopie:
  automatisch täglich und vor jeder Migration, aufbewahrt werden 7 tägliche und 4
  wöchentliche, im Datenordner des Kanals. Im Einstellungsbereich „Daten“ (D80): „Sicherung
  jetzt erstellen“ und „Wiederherstellen“; vor dem Wiederherstellen wird die aktuelle
  Datenbank selbst gesichert.
- **D95 (L2.9) Tests gegen echtes SQLite statt handgeschriebenem Fake** (ändert D86): Module
  testen gegen den echten Port auf einer frischen `:memory:`-Datenbank mit allen
  Migrationen; Contract-Tests pro Port laufen dagegen. Ein Fake nur, wo gar keine
  Datenbank gebraucht wird (z. B. Storybook-Stories). _Grund:_ kein doppelter Code, Tests
  prüfen echtes SQL. In der alten Self-Engine war der Fake wegen PowerSync nötig.
- **D96 (L2.10) Keine eigene Verschlüsselung der Datenbankdatei** (kein SQLCipher); Verweis auf
  die Festplattenverschlüsselung des Betriebssystems (FileVault, BitLocker). _Gründe:_
  eigener better-sqlite3-Build, Schlüsselverwaltung, erschwert eine spätere Sync-Engine.
  Ende-zu-Ende-Verschlüsselung bleibt Q21 (Sync-Phase).
- **D97 (L2.11) Schicht 2 baut nur Desktop**, aber Verträge, Ports, Migrationen und
  Kysely-Abfragen plattformneutral. Web (wa-sqlite + OPFS im Worker) und Mobile (op-sqlite)
  kommen, wenn diese Plattformen anstehen; der Web-Build kompiliert weiter mit (D26).
- **D98 (L2.12) Schicht 2 jetzt in Issues zerlegen** (`layer:2`), siehe
  [`05-layer-2-data.md`](05-layer-2-data.md).

### Runde 16 (2026-11-08): Fehlererfassung

- **D99 Fehler werden zuerst nur lokal erfasst.** Ein Fehlerprotokoll im Nutzerdaten-Ordner
  (begrenzt, rotiert) sammelt Fehler aus Haupt-, Renderer- und Datenprozess: Zeit, Prozess,
  Meldung, Stacktrace, Version, Kanal, Betriebssystem, nie Inhalte. Unter Einstellungen →
  Daten zeigt „Diagnose“ die Einträge und kopiert einen per Klick (für ein Issue oder einen
  Agenten). Ein neuer Fehler zeigt einen unaufdringlichen Hinweis; Source Maps liegen bei,
  damit Stacktraces auf den TypeScript-Code zeigen. Issue #37. _Grund:_ Solange der
  Maintainer der Hauptnutzer ist, bringt ein externer Dienst wenig und kostet eine
  Datenschutz-Frage.
- **D100 Fehlererfassung über eine eigene Schnittstelle mit austauschbaren Empfängern.** Das
  lokale Protokoll ist der erste; Sentry (EU-Region) kommt als zweiter Empfänger vor der
  ersten öffentlichen Version oder sobald andere die App nutzen: nur nach Zustimmung beim
  ersten Start, nur technische Daten, ein Test beweist das Herausfiltern von Inhalten.
  Selbsthoster schalten es ab oder zeigen auf einen eigenen Server (z. B. GlitchTip).
  Die Lint-Regel `no-silent-catch` („melden“) meldet über diese Schnittstelle.
- **D101 Keine Produktanalyse (PostHog) vorerst.** Später nur nach Zustimmung, anonym und mit
  wenigen festgelegten Ereignissen. _Grund:_ Datenschutz ist der Hauptgrund für OSS (D2).

### Runde 17 (2026-11-08): GitHub-Repo-Einstellungen

- **D102 Nur Squash-Merge;** PR-Titel wird Commit-Titel, PR-Text wird Commit-Text; Auto-Merge
  an, Branches werden nach dem Merge gelöscht. _Verworfen:_ Merge-Commits (Zwischenstände ohne
  `verify` auf `main`), Rebase (jeder Commit müsste einzeln sauber sein).
- **D103 Ruleset für `main`:** PR-Pflicht, nur Squash, lineare Historie, kein Force-Push, kein
  Löschen, kein Bypass, 0 Approvals. Agenten arbeiten über `gh` und MCP mit dem Login des
  Owners, also gälte ein Bypass auch für sie, und eigene PRs lassen sich nicht selbst
  approven. _Verworfen vorerst:_ Pflicht für signierte Commits; sie blockierte alle PRs mit
  unsignierten Commits.
- **D104 Required Checks `quality` und `title`,** an GitHub Actions gebunden, ohne „Branch
  muss aktuell sein“. _Grund:_ Das würde parallele Agenten-PRs nach jedem Merge zum
  Aktualisieren zwingen.
- **D105 Actions nur per SHA gepinnt** (Repo-Einstellung), wegen der späteren Signier-Secrets
  (#10).
- **D106 Dependabot:** Alerts, Sicherheitsupdates und wöchentliche Versions-Updates mit 7 Tagen
  Wartezeit. Renovate bleibt Ausweichlösung. Wiki und Projects-Tab sind aus.
- **D107 Umzug in die Organisation `Self-Engine` beim Wechsel auf öffentlich,** spätestens vor
  dem ersten Release für andere. Vorher nicht, weil Rulesets in privaten Repos einer
  Free-Organisation nicht greifen.
- **Merkliste für den Wechsel auf öffentlich:** Einstellungen der Organisation, Merge Queue
  prüfen, Signierung per SSH-Schlüssel, eigene GitHub App für Agenten mit Approval-Pflicht,
  `SECURITY.md`, `CONTRIBUTING.md`, private Sicherheitsmeldungen, Secret Scanning mit Push
  Protection, CodeQL, Freigabe für Fork-PRs, Tag-Schutz für `v*` (mit #9), `CODEOWNERS` prüfen.

### Runde 18 (2026-11-08): Wohin die Releases gehören (#9)

- **D108 Releases liegen im privaten Projekt-Repo `GwydionBr/self-engine-next`.** Der
  Release-Workflow legt Tag und GitHub-Release nur mit dem eingebauten `GITHUB_TOKEN` an. Kein
  eigenes Releases-Repo, kein Token in der App. **Updates werden von Hand geladen.** Zum
  Herunterladen braucht man Zugriff auf das Repo; dem zweiten Nutzer kann der Owner einen
  Build direkt geben. Der Updater in der App kommt mit dem Wechsel auf öffentlich (D107) und
  der Signierung (#10). _Grund:_ Eine App darf kein Token mitbringen, und Squirrel.Mac lehnt
  Updates ad-hoc-signierter Builds ab (die Anforderung ist der Hash genau dieses Builds).
  Der Nightly-Zeitplan ist zunächst aus (Repo-Variable `NIGHTLY_SCHEDULE_ENABLED`), weil
  macOS-Minuten im privaten Repo begrenzt sind und die Build-Dauer noch unbekannt ist.
- **D109 macOS-Releases sind mit der Developer ID signiert, gehärtet und notarisiert (#10).**
  Das Packen prüft das Ergebnis, weil electron-builder ohne Identität nur warnt. In CI lässt
  ein fehlendes Secret den Lauf scheitern; lokal ohne die Eingaben bleibt der Build ad hoc und
  braucht kein Apple-Konto. Einziges Entitlement ist `allow-jit`. Der Updater in der App wartet
  weiter auf den Wechsel auf öffentlich (D107). Windows-Signierung ist offen.
- **D110 Der Nightly-Zeitplan läuft vorerst nur jede zweite Nacht** (ungerade Monatstage) und
  ersetzt damit den Rhythmus aus D41. Gebaut wird weiter nur, wenn sich `main` seit dem letzten
  Nightly geändert hat; manuell geht es jederzeit.

### Runde 19 (2026-11-09): Theme-Engine (#14, verfeinert D57, D58, D61, D68–D71, D81)

- **D109 Die Theme-Engine ist die einzige Farbquelle** (ADR 0009). Neues Paket
  `@self-engine/theme` mit zwei Einstiegen: reiner Kern (Themes, Farbsätze, Berechnung,
  Kontrastfunktion; kein React, kein Mantine, kein DOM) und Mantine-Anbindung (`ThemeProvider`,
  Abbildung auf Mantine, Hook mit den Endwerten). Der Kern rechnet aus Einstellungen und Katalog
  alle Endwerte als sRGB-Hex; Wide-Gamut wird bewusst aufgegeben. Dieselben Werte speisen die
  `--se-*`-Variablen, Mantine und den Kontrasttest. _Grund:_ Was nur im Browser entsteht, kann
  kein Test sehen.
- **D110 Themes sind vollständige Rollentabellen** für mindestens einen Farbmodus, mit
  `version: 1`, ID und Name; die IDs `neutral`, `warm`, `cool` bleiben dauerhaft. 22 Rollen je
  Farbmodus (fünf Flächen, Text, Linien, `hover` als einzige durchscheinende Rolle, je vier
  Statusrollen), dazu vier Akzentrollen. `navSurface` wird berechnet: `surface` zu 70 % über dem
  endgültigen `chrome`, immer deckend. Der Katalog ist offen, fremde Formate werden einmal beim
  Import umgewandelt. Fehlt ein Theme oder ein Farbmodus, gilt das Standard-Theme, der
  gespeicherte Wert bleibt.
- **D111 Die Engine besitzt den Farbmodus:** Sie löst „System“ selbst auf und gibt Mantine nur
  hell oder dunkel. Mantines eigener Farbspeicher wird nicht benutzt (`forceColorScheme` allein
  reicht in 9.7.5 nicht, beim Start wird der Speicher sonst trotzdem gelesen). Der Provider ist
  nur lesend; die Einstellungen besitzt der Store (#15).
- **D112 Kontrast ist ein Test, keine Absicht:** Der Kontrasttest läuft in `pnpm verify` über die
  öffentliche Funktion des Kerns auf den Endwerten und nennt im Fehlerfall Theme, Farbmodus,
  Akzent, Hintergrundtönung, Paar und Verhältnis. Texte 4,5:1, Eingabe-Umrisse und Fokusring
  3:1, `hover` gegen die Fläche 1,1:1 (eigene Regel). Die erleichterten 3:1 für große Schrift
  gelten nicht, weil Rollen die Schriftgröße nicht kennen.

### Runde 20 (2026-11-09): Einstellungs-Store (#15, verfeinert D62)

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

### Runde 21 (2026-11-09): SQLite, Konventionen und Migrationen (#30)

- **D133 Paket `@self-engine/db` mit drei Einstiegen:** der Kern (Migrationen, Runner, Id- und
  Zeit-Helfer, Typen) ohne better-sqlite3, durch eine Kern-Reinheitsregel in den Modulgrenzen
  gesichert; `@self-engine/db/better-sqlite3` mit Verbindung und Kysely-Dialekt, nur für den
  Datenprozess und Tests; `@self-engine/db/testing` für die Konventionsprüfung. Kysely kommt schon
  hier statt in #31, weil sein Migrator der Runner ist.
- **D134 Pragmas der Verbindung:** `journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON`,
  `synchronous=NORMAL`, `checkpoint_fullfsync=ON`, `temp_store=MEMORY`, `journal_size_limit` von
  128 MiB und `auto_vacuum=INCREMENTAL` bei neuer Datenbank.
- **D135 Migrationen pro Modul:** Kyselys Migrator mit eigenem Provider für handgeschriebenes
  SQL, nur vorwärts. Name `<modul>/<nummer>`, vierstellig pro Modul (`time/0003`), doppelte Namen
  sind ein Fehler. Der Aufrufer stellt die Liste zusammen, das Paket kennt kein Modul.
  `allowUnorderedMigrations` ist an, weil die erste Migration eines neuen Moduls vor bereits
  gelaufenen Namen sortieren kann. Kyselys eigene zwei Tabellen behalten ihre Namen.
- **D136 Eine Migration liest und schreibt nur die Tabellen ihres Moduls.** Fremdschlüssel auf
  Tabellen anderer Module sind erlaubt, weil SQLite sie vor der Elterntabelle annimmt. Sonst
  unterscheidet sich eine Neuinstallation von einer gewachsenen Datenbank: Ein Nachtragen von
  Daten könnte eine Spalte suchen, die eine spätere Migration eines anderen Moduls schon
  umbenannt hat. Daten zwischen Modulen zu verschieben geht nicht über eine Migration.
- **D137 Eine Transaktion pro Lauf** (ändert „eine pro Datei“ aus #30). Kysely hält SQLite für
  nicht transaktionsfähig bei DDL und liefe ohne Transaktion; ein kleiner Adapter meldet die
  Fähigkeit, und Kysely legt den ganzen Lauf in eine Transaktion. Ein gescheiterter Lauf lässt
  die Datenbank vollständig auf ihrem alten Stand.
- **D138 Eine neuere Datenbank wird abgewiesen:** Kyselys Prüfung auf eine gelaufene, aber
  unbekannte Migration beendet den Lauf mit einem Fehler, der sie nennt. Die Anzeige kommt in
  #29. Der Runner meldet außerdem, ob Migrationen ausstehen, damit nur dann gesichert wird.
- **D139 SQL-Dateien kommen per `import.meta.glob` mit `?raw` ins Bundle.** Jedes Modul übergibt
  seine `<vier Ziffern>.sql`-Dateien an `defineMigrations`, Vitest und Vite-Build laden sie
  gleich. Eine Datei darf mehrere Anweisungen enthalten: Sie läuft über `exec` des Treibers auf
  derselben Verbindung wie Kysely und damit in dessen Transaktion. `vp pack` lädt `?raw` nicht
  von selbst und braucht für den Datenprozess in #29 ein kleines Plugin.
- **D140 Konventionsprüfung gegen das Schema nach den Migrationen:** jede Tabelle `STRICT`, jeder
  Fremdschlüssel `DEFERRABLE INITIALLY DEFERRED`; außerhalb lokaler Tabellen Text-`id` als
  Primärschlüssel, `created_at`/`updated_at` als Text ungleich NULL, `deleted_at` als Text mit
  NULL, `space_id` als Text ungleich NULL; kein SQL-`DEFAULT` auf den Zeitspalten. Eine lokale
  Tabelle trägt das Präfix `local_` und ist nur von den Pflichtspalten befreit, eine
  Ausnahmeliste gibt es nicht. Eine synchronisierte Tabelle darf nicht auf eine lokale verweisen,
  umgekehrt schon.
- **D141 Ids und Zeitpunkte nur aus Helfern:** UUIDv7 aus `uuid`; Zeitpunkte immer UTC in genau
  der Form `2026-11-09T14:07:46.297Z`, weil SQLite Text zeichenweise vergleicht und `…:46Z` hinter
  `…:46.297Z` sortiert. Eine Migration nutzt beim Nachtragen
  `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`. Tests können Uhr und Zufall vorgeben.
- **D142 Gemergte Migrationen sind unveränderlich:** Eine Prüfung in `pnpm verify` schlägt fehl,
  wenn eine Datei, die auf `main` liegt, geändert, gelöscht oder umbenannt wurde. „Auf `main`“
  steht für „schon irgendwo gelaufen“, weil jeder Stand von `main` als Nightly ausgeht. Ohne die
  nötige Git-Historie schlägt sie fehl, statt still zu bestehen. _Verworfen:_ Prüfsumme beim
  App-Start (träfe Nutzer statt Entwickler, schon bei einem geänderten Kommentar).

### Runde 22 (2026-11-09): Schicht 3, gemeinsamer Kern

Grundlage: [`research-layer-3-core.md`](research-layer-3-core.md).

- **D143 (L3.1) Der gemeinsame Kern besteht aus vier Paketen, ein Paket `core` gibt es nicht.**
  `time` und `money` sind reine Werte und importieren kein anderes Paket des Repos. `spaces` und
  `tags` haben eigene Tabellen, Port und Migrationen (`spaces/0001`, `tags/0001`) und liegen über
  `db`. Fachmodule und `contracts` importieren nach unten, nie umgekehrt. Einstiege wie bei
  `settings`: `.`, bei Bedarf `./react` und `./testing`. „Gemeinsamer Kern“ bleibt nur der Name
  der Schicht. _Gründe:_ Das alte `packages/core` wurde mit rund 23.000 Zeilen zum Sammelbecken;
  153 seiner Dateien importieren `db`, umgekehrt keine, deshalb entstanden Kopien der Rundung in
  `db`. `time` lag als eigenes Paket ganz unten und blieb ohne Kopien. _Verworfen:_ `time`, `money`
  und ein `core` für Spaces und Tags (lädt wieder zum Sammeln ein), ein einziges Paket mit
  mehreren Einstiegen (Werte lägen über `db`).
- **D144 (L3.2) Schicht 3 baut genau einen persönlichen Space, ohne Oberfläche.** Tabelle `spaces`
  mit `kind` (vorerst nur `personal`); die Zeile trägt ihre eigene `id` als `space_id` und besteht
  so die Konventionsprüfung aus #30 ohne Ausnahme. Das Paket `spaces` legt sie beim Start nach den
  Migrationen an, mit zufälliger UUIDv7 und nur falls keine existiert; ein eindeutiger Index
  erlaubt höchstens einen persönlichen Space. Der Port bekommt den Space beim Erzeugen als Kontext,
  Operationen nehmen ihn nicht als Eingabe, jede Abfrage filtert danach; das Contract-Kit (#32)
  prüft, dass fremde Spaces unsichtbar bleiben. Jede Fachtabelle hat einen Fremdschlüssel auf
  `spaces`, Verweise zwischen Zeilen bleiben innerhalb eines Space. _Folge für Sync:_ Das erste
  Gerät behält seine ID, ein weiteres mit Offline-Daten schreibt seine `space_id` einmalig in einer
  Transaktion um. _Verworfen:_ `spaceId` in jeder Operation (ein vergessener Filter bliebe
  unbemerkt), feste ID per Migration (kollidiert auf dem Server, jedes Gerät müsste umschreiben),
  sichtbare Spaces jetzt schon (wird mit Sync und Organisationen entschieden).
- **D145 (L3.3) Geld wird ganzzahlig gespeichert und einmal gerundet.** Beträge sind `INTEGER` in
  der kleinsten Einheit plus Währung als ISO-4217-Text, geprüft im Code statt per SQL-`CHECK`; in
  TypeScript eine sichere Ganzzahl mit eigenem Typ, ohne `BigInt`. `money` führt einen eigenen
  Katalog aus Währungscode und Stellenzahl: Neue Währungen dürfen dazukommen, die Stellen einer
  vorhandenen ändern sich nie (ein Test sichert das). Stundensätze werden genauso gespeichert
  (13,00 €/h als `1300`). `money` hat genau eine Funktion für Satz × Sekunden / 3600, ganzzahlig
  und kaufmännisch gerundet; gerundet wird einmal auf die Summe der Sekunden einer Abrechnung, nie
  pro Eintrag. ADR 0002 der alten App gilt weiter: keine Kurse, keine Basiswährung, Summen nur pro
  Währung. _Folge für den Import:_ Alte Fließkommawerte werden gerundet, jede Abweichung wird
  gemeldet. _Verworfen:_ `REAL` (Rundungsfehler), Dezimal als Text (SQLite kann nicht summieren),
  Sätze mit zwei Extrastellen (zweite, verwechselbare Einheit, in den geprüften Daten kein Bedarf),
  Stellenzahl aus `Intl` (weicht von ISO 4217 ab und hängt an der Laufzeit).
- **D146 (L3.4) Eingabe, Anzeige und Benennung von Geld.** `parseAmount` und `formatMoney` liegen
  in `money`, das Gebietsschema ist immer ein Parameter; `i18n` bleibt reine Übersetzung. Ein
  Trennzeichen, das als Tausendergruppe gültig ist, folgt dem Gebietsschema; eines, das keine
  gültige Gruppe sein kann, gilt als Dezimaltrenner (`12.5` im Deutschen ist 12,50). Mehr Stellen,
  als die Währung hat, sind ein Eingabefehler; ob null erlaubt ist, entscheidet die Operation. Die
  Anzeige nutzt den Katalog aus D145, glatte Beträge bleiben ohne Nachkommastellen. Spalten und
  Felder in der kleinsten Einheit enden auf `_minor` bzw. `Minor`, über die Grenze zur Oberfläche
  gehen sie als `{ amountMinor, currency }`. `money` liefert die Zod-Schemas selbst mit. Das
  Eingabefeld entsteht mit dem ersten Modul, das eines braucht, auf Basis von Mantines
  `NumberInput`. _Grund:_ In der alten App wurde `12.5` im Deutschen still zu 125. _Verworfen:_
  Formatierung in `i18n`, strenges Ablehnen von `12.5`, Spaltenname `amount` ohne Einheit.
- **D147 (L3.5) Eine Zeitzone ohne Server, ADR 0046 der alten App gilt weiter.** Eine Zeitzone als
  Synced Setting entscheidet über „heute“, Mitternacht und Wochengrenzen; der Wochenstart ist eine
  eigene Einstellung. Beim ersten Start kommt sie still vom Gerät, beim Import aus der alten App.
  Sie ändert sich nur durch den Nutzer: Ein abweichendes Gerät bietet den Wechsel an, „dem Gerät
  folgen“ ist eine Option (aus); „nicht mehr fragen“ ist eine Device Setting; die Entscheidung
  liegt rein in `time`. Keine Historie: Vergangene Zeitpunkte erscheinen in der aktuellen Zeitzone
  und können auf einen anderen Tag rutschen, Calendar days bewegen sich nie. Tageslogik nie in SQL,
  weil SQLite keine IANA-Zeitzonen kennt: `time` rechnet Tagesgrenzen im Datenprozess um, gruppiert
  wird in TypeScript; der Datenprozess liest die Einstellung pro Operation und übergibt sie
  ausdrücklich. Eine einzige Funktion löst die Zeitzone auf; kennt die Laufzeit den Namen nicht,
  gilt die Gerätezeitzone und das Fehlerprotokoll bekommt einen Eintrag. _Verworfen:_ Historie der
  Zeitzone (jede Tagesberechnung bräuchte sie, Sync-Konflikte verschöben Tage rückwirkend; kann
  später ergänzt werden), Gerätezeitzone als Autorität, Zeitzone an jedem Eintrag.
- **D148 (L3.6) `time` wird Datei für Datei übernommen, mit Pflicht-Uhr und Typen bis in die
  Zeile.** Übernommen werden Typen, Uhr, Zonen, Kalender, relative Tage, Formatierung,
  Geräte-Brücke und Zonenliste mit ihren Tests; `legacy.ts` entfällt; die Testuhr kommt nach
  `./testing`; die Wochenstart-Vorgabe je Region wandert aus dem alten `i18n` nach `time`. Die Uhr
  ist ein Pflichtargument ohne Standardwert, der Port bekommt sie als Kontext neben dem Space
  (D144), `systemClock` wird nur beim Zusammenbau der App gesetzt. `time` liefert Zod-Schemas für
  `Instant`, `CalendarDay` und `WallClockTime`, die Entitäten benutzen sie; gespeichert wird nur die
  kanonische Form. Das Repo-Plugin bekommt die fünf alten Lint-Regeln, neu ein Verbot von
  `Date.now()` und `new Date()` ohne Argument, gültig in `packages/` und `apps/` außer `time`, und
  ein Verbot direkter Importe von `date-fns`, `dayjs` und `luxon`; Mantines Datumsfelder dürfen
  `dayjs` intern nutzen. Dateien mit `.tz.test.ts` laufen zusätzlich in Los Angeles. #91 bleibt wie
  geplant; das `time`-Issue übernimmt als Abnahmekriterium, dass der Helfer in `db` danach auf
  `time` aufsetzt. _Verworfen:_ 1:1 mit optionaler Uhr, #91 auf `time` warten lassen (bräche die
  Reihenfolge der Issue-Nummern), Temporal statt `Intl` (Polyfill auf Hermes).
- **D149 (L3.7) Ergänzungen zu D148 aus einer unabhängigen Prüfung.** `TimeZone` wird ein geprüfter
  Typ mit Zod-Schema; die Auflösung aus D147 ist der einzige Weg dorthin, führt Aliasse auf einen
  festen Namen zurück und lehnt Offsets ab; die Auswahlliste nutzt immer die eigene Zonenliste.
  Gültig sind nur die Jahre 1000 bis 9999, geprüft in Konstruktoren und Parsern; `addDays` und
  `addMonths` nehmen nur ganze Zahlen. `instantRangeOf(span, zone)` kommt sofort,
  `splitIntervalByDay` und `groupByCalendarDay` mit dem ersten Nutzer, ein Cache nur nach Messung.
  Uhrzeiten sind nur `HH:MM`, Zod-Schemas prüfen nur die kanonische Form, das tolerante
  `parseInstant` bleibt für Import und Sync. Explizite Exporte statt `export *`; `now()` entfällt;
  `fixedClock` kommt nach `./testing`; `systemClock` bekommt einen eigenen Einstieg nur für den
  Zusammenbau der App. Die relative Anzeige rechnet mit Kalendertagen; ein `today`, das um
  Mitternacht umspringt, kommt mit der ersten Oberfläche nach `./react`. Die Lint-Regeln verbieten
  zusätzlich `new Date(y, m, d)`, Zeitangaben ohne Offset, `toLocale*String` und
  `Intl.DateTimeFormat` ohne `timeZone`. Tests: `fast-check` mit festem Seed, Parser als Tabellen
  gegen die Zod-Schemas, der Test mit der echten Uhr entfällt. Von der Wochenstart-Tabelle werden
  nur `de-DE` und `en-US` übernommen. _Zurückgestellt:_ doppelte Mitternacht in historischen
  kanadischen Zeitzonen, Prüfung auf Hermes.
- **D150 (L3.8) Tags hängen über Brücken der Module an Einträgen.** Tabelle `tags` mit Titel,
  optionaler Beschreibung und `modules` als JSON-Text mit Modul-IDs (leer heißt überall). Der Titel
  ist pro Space eindeutig, über eine in TypeScript berechnete Spalte `normalized_title` mit
  eindeutigem Index für nicht gelöschte Zeilen, weil SQLites `lower()` nur ASCII kennt. Jedes Modul
  besitzt seine Brücke (z. B. `project_tags`) mit eigener `id`, Fremdschlüssel auf `tags` und
  eindeutigem Paar; `tags` liefert eine gemeinsame Funktion zum Setzen und ein Contract-Kit in
  `./testing`. Module lesen nur Tag-IDs aus ihrer Brücke und filtern darüber, die Oberfläche löst
  Titel über einen Hook aus `tags/react` auf. Löschen ist weich und per Rückgängig samt Zuordnungen
  umkehrbar; eine entfernte und neu gesetzte Zuordnung belebt dieselbe Zeile wieder. Farbe, Icon,
  Hierarchie und Starter-Tags sind vorerst nicht dabei; Starter-Tags gehören zum Onboarding.
  _Folgen:_ Der Import führt doppelte Titel zusammen und meldet das; das Zusammenführen offline
  angelegter gleicher Tags gehört in die Sync-Phase. _Verworfen:_ generische Tabelle `taggings`
  (keine Prüfung der Verweise, siehe `habit_link`), `tags` besitzt alle Brücken (dreht die Richtung
  aus D143 um), `modules` weglassen (D9).
- **D151 (L3.9) Icon und Farbe an Entitäten, ohne neues Paket.** Zwei optionale Textspalten `icon`
  und `color`, nur wo nötig. `icon` hält einen Namen oder genau ein Emoji, unterschieden am
  Zeichentyp (Muster aus ADR 0009 der alten App). `color` ist der Name eines Farbsatzes und wird
  wie die Modulfarben dargestellt, nie als Farbwert; `theme` bekommt die fehlenden Farbsätze `red`,
  `cyan`, `lime` und `yellow` unter derselben Kontrastprüfung, die Akzentfarben-Auswahl bleibt.
  `icons` bekommt ein gemeinsames Verzeichnis aus Name und Icon für alle Entitäten, mit den alten
  Namen, und einen Einstieg ohne React mit Erkennung und Zod-Schema; `theme` liefert ein Schema für
  Farbsätze. Geschrieben werden nur bekannte Namen und genau ein Emoji; beim Lesen zeigt ein
  unbekannter Wert das Standard-Icon oder die neutrale Farbe. _Verworfen:_ alte Farben beim Import
  umbiegen (verändert Daten), Listen je Entität, eigene Spalte für Emoji.
- **D152 (L3.10) Abläufe über mehrere Module laufen über Brücken.** Ein Modul importiert ein anderes
  nur, wenn die Abhängigkeit fachlich zwingend und einseitig ist (das Zeitmodul darf `projects`
  importieren). Alles andere läuft über ein eigenes Brücken-Paket über den beteiligten Modulen,
  benannt nach seinem Zweck (etwa `billing`); es besitzt die Brückentabellen und benannten
  Operationen, die Module kennen es nicht. Jede Operation gibt es auch in einer Form, die eine
  laufende Transaktion annimmt; die Brücke öffnet sie, `tablesChanged` meldet alle betroffenen
  Tabellen zusammen. Eine Brücke liest über die Abfragen der Module, nie aus ihren Tabellen.
  Operationen öffnen keine Dialoge, sondern geben einen typisierten Konflikt mit Optionen zurück und
  werden mit der Wahl erneut aufgerufen. Schutzregeln (etwa „abgerechnet nicht löschen“) meldet die
  Brücke beim Zusammenbau der App an, sie laufen in derselben Transaktion. Schicht 3 baut keine
  Brücke: Sie liefert die Regeln als ADR und die Transaktions-Form in #32; die erste Brücke kommt
  mit Finanzen oder Kalender. _Verworfen:_ feste Reihenfolge aller Module ohne Brücken (Arbeit und
  Kalender brauchen sich gegenseitig), Ereignisse statt Aufrufe (keine Transaktion über beide
  Seiten), Brückentabellen im „größeren“ Modul (bringt die alten Zyklen zurück).
- **D153 (L3.11) Einstellungen des Kerns.** Die Region folgt vorerst über genau eine Funktion aus
  der Sprache (`de` → `de-DE`, `en` → `en-US`); eine eigene Regionen-Einstellung lässt sich dort
  später ergänzen. Der Wochenstart ist eine Synced Setting mit dem Wert „automatisch“, der der
  Region folgt. Die Standardwährung ist eine Synced Setting, die nur vorbelegt und nie umrechnet;
  sie kommt beim ersten Start aus der Region (`EUR`, `USD`), beim Import aus der alten App.
  Einstellungen, die Oberfläche und Datenprozess beide lesen (Zeitzone, „dem Gerät folgen“,
  Wochenstart, Standardwährung), werden in `contracts` deklariert, reine Oberflächen-Einstellungen
  bleiben in `apps/web`. `formatMoney` hält `Intl.NumberFormat`-Objekte pro Gebietsschema und
  Währung vor. Standard-Stundensatz und Rundung gehören in Schicht 4. _Verworfen:_ eigene
  Regionen-Einstellung sofort, Standardwährung fest auf `USD`, doppelte Deklaration.
- **D154 (L3.12) Schicht 3 wird in acht Arbeitspakete geschnitten, jedes wird einzeln gegrillt.**
  Spec #103 mit den Unter-Issues #104 bis #111; aus jedem entstehen nach seinem Grilling Spec und
  Teil-Tickets, wie bei #14 bis #20 und #30. Nur #107 (ADR und Glossar) braucht kein Grilling. Alle
  tragen `ready-for-agent` und `layer:3`, die erste Zeile verlangt das Grilling vor dem Bau. #34
  wird durch #109 ersetzt, weil es eine echte Space-Zeile aus #108 braucht und jedes Issue nur von
  kleineren Nummern abhängen darf. _Verworfen:_ 13 feine Tickets (dreizehn Grillings, teils für sehr
  kleine Teile), `needs-triage` statt `ready-for-agent` (nach jedem Grilling Umstellung von Hand),
  #34 behalten (bräche die Reihenfolge).

### Runde 23 (2026-11-10): Arbeitsablauf

- **D155 Der Stand eines Tickets wird abgelesen, nicht gepflegt.** Geprüft wird der Reihe nach:
  geschlossen (gebaut), offener PR schließt es (im Review), hat Teil-Tickets (geschnitten), Body
  enthält ein Spec (spezifiziert), Label `needs-grilling` (Grilling nötig), Label `ready-for-agent`
  (baubar), sonst Triage offen. `ready-for-agent` heißt nur noch, dass ein Agent bauen darf; die
  Pakete vor ihrem Grilling tragen `needs-grilling`. Das revidiert den Label-Teil von D154.
  _Verworfen:_ ein Label pro Stufe (ein vergessener Schritt macht die Übersicht falsch).
- **D156 Die Agenten halten die Übersichtsseite aktuell.** Der Ablauf steht in `docs/agents/`, der
  letzte Schritt jeder Stufe ist das Aktualisieren. Ein Skript in `scripts/` erzeugt die ganze Seite
  aus GitHub und einer kurzen Liste für Schichten ohne Issues, der Agent veröffentlicht das Ergebnis.
  So holt der nächste Agent einen vergessenen Schritt von selbst nach. Fehlt einem Agenten das
  Werkzeug zum Veröffentlichen, sagt er das in seinem Bericht. _Verworfen:_ Änderungen von Hand am
  HTML (jeder Agent stuft selbst ein), stündlicher geplanter Lauf (der Stand ändert sich mit den
  Arbeitsschritten), GitHub Pages (macht den Planungsstand vor dem Öffentlich-Machen zugänglich).
- **D157 Entscheidungen aus einem Grilling gehen sofort per Docs-PR auf `main`.** Der PR folgt direkt
  dem Grilling und kommt vor dem Bau, das Spec steht sofort im Issue. ADRs gehen mit dem Bau-PR,
  weil sie beschreiben, was im Code gilt. _Grund:_ Das Grilling von #30 belegte D133–D142 auf `main`,
  während Schicht 3 dieselben Nummern auf einem Branch nutzte. _Verworfen:_ Entscheidungen im Bau-PR
  (das nächste Grilling sieht sie tagelang nicht).
- **D158 Ein Integrations-Branch und ein PR pro Paket.** Der PR schließt das Paket und seine
  Teil-Tickets, der Titel wird ein Changelog-Eintrag. Würde ein Paket deutlich mehr als rund 4.500
  Zeilen, wird es beim Schneiden geteilt (bisher 450 bis 4.450 neue Zeilen). _Verworfen:_ ein PR pro
  Teil-Ticket (ein Changelog-Eintrag je Teil, halbfertige Funktionen auf `main`).
- **D159 Der Ablauf steht im Repo, die Skills bleiben persönlich.** `docs/agents/workflow.md`
  beschreibt jede Stufe mit Ergebnis und nennt den passenden Skill, die Skills bleiben vorerst in
  `~/.agents/skills`. Sie werden erst kopiert, wenn Agenten außerhalb des eigenen Macs arbeiten.
  _Verworfen:_ die sechs Skills sofort kopieren (Kopien veralten, Lizenz ungeklärt).
- **D160 Ein Paket kommt nur unter drei Bedingungen ohne Grilling aus:** prüfbare
  Abnahmekriterien, kein Muster für andere Module, keine offene Entwurfsfrage. Entschieden wird beim
  Schneiden, sichtbar am Label. Findet ein Agent beim Bau doch eine offene Entwurfsfrage, hört er
  auf, schreibt sie ins Issue und setzt `needs-grilling`. Teil-Tickets aus einem Spec gelten immer
  als baubar. Layer-Specs wie #103 tragen kein Bau-Label. _Verworfen:_ immer grillen (kostet Zeit
  für Fälle wie #25).

### Runde 24 (2026-11-10): Umzug in die Organisation

- **D161 Das Repo heißt `Self-Engine/self-engine`, schon vor dem Stichtag (ändert D52).** Mit dem
  Umzug in die Organisation (D107) ist der Name dort frei. Die alte App bleibt unverändert unter
  `GwydionBr/self-engine`, ihre Desktop-Updates, CI und Vercel hängen also weiter am alten Namen.
  Die Umbenennung der alten App in `self-engine-legacy` entfällt damit.
- **D162 Das Repo wird öffentlich, nimmt aber vorerst keine fremden Beiträge an.** Issues und PRs
  anlegen dürfen nur Collaborators. Kommentare auf bestehenden Issues und PRs bleiben möglich.
  Ob es ein CLA oder DCO braucht, wird erst entschieden, bevor fremde Beiträge erlaubt werden.
  _Verworfen:_ ein Interaction Limit „Collaborators only“, weil CodeRabbit damit nicht mehr antwortet.
- **D163 Nightlies sind öffentliche Entwicklungs-Builds und entstehen zweimal am Tag (ändert D110).**
  Gebaut wird weiter nur, wenn sich `main` geändert hat. Release-Notizen und README sagen, dass es
  keine Unterstützung gibt. Sie gelten nicht als öffentliche Version im Sinne von D100; das ist erst
  die erste Stable für andere.

### Runde 25 (2026-11-10): Bearbeiten-Drawer und Rückmeldung (#21, verfeinert D60, D63, D67, D79, D120)

- **D164 Ein Bearbeiten-Drawer hat zwei Ausgänge (ändert den Vertrag aus #20).** `onClose` wird zu
  `onCancel` (darf nachfragen) und `onDone` (schließt ohne Nachfrage, nach erfolgreichem Speichern
  oder Löschen). Ein fehlgeschlagenes Speichern ruft keinen von beiden, der Entwurf bleibt.
  _Verworfen:_ ein einziges `onClose` (ein Speichern endet sonst in einer falschen Warnung).
- **D165 Ungespeichertes wird erfragt, nicht gemeldet.** `useUnsavedChanges(check)` hinterlegt eine
  Funktion, die die Hülle nur beim Verlassen aufruft. Tippen kostet dadurch nichts, und sie passt zu
  Mantines `form.isDirty()`. Mehrere Prüfungen sind erlaubt, eine einzige mit `true` löst die
  Nachfrage aus. _Preis:_ Die Hülle kann im Rahmen keine Markierung „geändert“ zeigen, das zeichnet
  ein Modul bei Bedarf selbst. _Verworfen:_ ein gemeldeter Zustand `isDirty` (Update bei jedem
  Tastendruck, kann veralten).
- **D166 Der Drawer-Titel ist der gespeicherte Name.** `useEditDrawerTitle(title)` setzt ihn. Bis
  dahin steht dort der Name des Moduls, also beim Laden und bei einem nicht gefundenen Eintrag. Der
  Titel liegt im Zustand des Rahmens und zeichnet die View nicht neu.
- **D167 Eine Wache an der Adresse fängt jeden Ausgang ab.** Jeder Weg hinaus ist eine Änderung der
  Adresse: Schließen-Knopf, Esc, Klick daneben, `onCancel`, Zurück, Vor und Befehle. `ShellRouting`
  bekommt dafür eine neue Fähigkeit, die App setzt sie mit TanStack Routers `useBlocker` um, die
  Hülle bleibt frei vom Router. Gefragt wird, wenn die nächste Adresse den offenen Eintrag entfernt
  oder tauscht. Ein Filterwechsel läuft durch. „Verwerfen“ setzt die ursprüngliche Navigation fort,
  „Weiter bearbeiten“ lässt Adresse und Entwurf unverändert, Esc und Klick daneben bedeuten
  „Weiter bearbeiten“. Es ist immer nur eine Frage offen, und währenddessen schließt Esc den Drawer
  nicht. _Bekannte Lücke:_ Neuladen und Beenden fragen nicht (`enableBeforeUnload` bleibt aus),
  ein späteres automatisches Speichern ist die bessere Antwort. _Verworfen:_ jeden Ausgang einzeln
  absichern (Zurück und Befehle würden durchrutschen).
- **D168 Das Paket `@self-engine/ui` entsteht mit #21** (D120: beim ersten geteilten Baustein). Es
  hängt nur von Mantine, Lingui, `theme` und `icons` ab, Module brauchen für einen Baustein also
  nicht den Rahmen der Hülle.
- **D169 Nachfragen und Hinweise laufen über schmale Eingänge auf Mantine.** `confirm()` antwortet
  mit ja oder nein, ist der einzige Eingang zu `@mantine/modals` und funktioniert auch außerhalb von
  Komponenten. `notifyUndoable()` und `notifyError()` sind die einzigen Eingänge zu
  `@mantine/notifications`. Ein Hinweis mit Rückgängig bleibt 8 Sekunden und pausiert beim
  Darüberfahren. Hinweise stehen unten rechts, am Telefon über der Leiste. `FeedbackHost`
  bindet beides einmal in App und Komponentenkatalog ein. _Verworfen:_ ein eigener Dialog (Mantine
  bringt ihn mit, er wäre außerhalb von Komponenten nicht aufrufbar).
- **D170 Leer, Laden und Fehler sind geteilte Bausteine.** `EmptyState`, `ErrorState` und
  `LoadingState` sitzen dünn auf Mantine. `ErrorState` ersetzt `ContributionFailure`.
  `LoadingState` bleibt die ersten 200 ms unsichtbar, weil lokale Lesezugriffe meist Millisekunden
  dauern. Es ist der Fallback beim Laden des Drawer-Codes, Views behalten das Verhalten aus
  ADR 0013. _Verworfen:_ Skeletons (erst, wenn ein echtes Modul sie braucht).
- **D171 Der Drawer-Rahmen ist für alle Module gleich.** 460 px breit, schwebend mit 8 px Abstand
  und 16 px Ecken bei den Layout-Stufen wide, medium und narrow, volle Breite am Telefon. Der Inhalt
  bekommt die volle Höhe. _Verworfen:_ Breite pro Modul (erst bei echtem Bedarf).
- **D172 Löschen ist sofort und weich, Rückgängig stellt wieder her (verfeinert D79, D88).** Löschen
  aus dem Drawer schließt ihn, Rückgängig öffnet ihn nicht wieder. Bis ein eigenes späteres Paket
  Papierkorb, Fristen pro Datenart und endgültiges Löschen regelt, löscht die App nie von selbst.
  _Verworfen:_ erst beim Ablauf des Hinweises löschen (beim Beenden ginge das Löschen verloren, und
  jede andere View und später der Sync müssten einen Zustand „gleich gelöscht“ kennen).
- **D173 Einen fehlenden Eintrag erkennt das Modul.** Es zeigt `ErrorState` mit „Eintrag nicht
  gefunden“ und nur einem Schließen, das `onDone` ruft. Ein fehlgeschlagenes Laden zeigt `ErrorState`
  mit Wiederholen.

### Runde 26 (2026-11-10): Befehle, Kürzel und Palette (#22, verfeinert D74, D75, D85, ändert D132)

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

### Runde 27 (2026-11-10): Datenprozess, Port-Muster und Hooks (#29, #31, #32, #33, verfeinert D88, D90–D93, D95)

Grundlage ist ein Wegwerf-Durchstich durch alle vier Pakete: ein Platzhalter-Modul mit Tabelle,
Speicher, oRPC über `MessagePort` im `utilityProcess` und Hooks. Die Zahlen sind Mediane aus fünf
Starts der gepackten App auf einem Apple M3 Pro, die Einzelwerte stehen in den Kommentaren der vier
Issues. oRPC 1.16.2 läuft im `utilityProcess` mit Sandbox und `contextIsolation`, die eigene
RPC-Schicht aus D93 entfällt.

- **D187 Die Schemas eines Ports liegen im Modul, `contracts` setzt nur zusammen (ändert #29).**
  Jedes Modul hat einen Einstieg `./contracts` mit seinen Zod-Schemas und seinem oRPC-Vertrag. Das
  Paket `contracts` baut daraus den einen Gesamtvertrag und besitzt selbst nur Übergreifendes:
  `health`, `tablesChanged`, die Deklaration der Einstellungen (D153). Die Richtung ist
  `contracts → Modul`, ein Modul importiert `contracts` nie. `./contracts` bleibt rein: nur Zod,
  `@orpc/contract` und die Wert-Pakete `time` und `money`, gesichert durch eine Regel in den
  Modulgrenzen. Der Renderer importiert den Gesamtvertrag nur als Typ. _Preis:_ `contracts` hängt
  von jedem Modul ab. _Verworfen:_ alle Schemas zentral (jeder fachliche PR ändert `contracts`, die
  Typen lägen nicht beim Modul, dem die Tabelle gehört); jede App setzt selbst zusammen (Desktop,
  Mobile und MCP-Server liefen auseinander).
- **D188 Eingaben prüft immer der Datenprozess, Ausgaben nur Tests und der Dev-Build.** Der Renderer
  prüft nie. Gemessen kostet ein Listenaufruf mit 10.000 Zeilen ungeprüft 12 ms und mit Zod auf
  beiden Seiten 28 ms, die Prüfung im Datenprozess allein 4,9 ms bei 3,8 ms für die Abfrage. Was
  die Ausgabeprüfung fände, fangen der Übereinstimmungstest (D91) und die Contract-Tests (D95)
  vorher. Bedingung: Ausgabe-Schemas wandeln nichts um, also kein `transform` und kein `default`;
  Zeit- und Geldwerte gehen als gebrandete Texte und Zahlen über den Port. _Preis:_ In der gepackten
  App erreicht eine falsch geformte Zeile die Oberfläche unbemerkt, die übrigen Zeilen bleiben
  sichtbar. _Offen:_ #32 klärt als Erstes, ob oRPC die Ausgabeprüfung je Build abschalten kann. Mit
  dem Sync wird die Frage für fremde Zeilen neu gestellt. _Verworfen:_ immer im Datenprozess prüfen
  (eine einzige falsche Zeile sperrt die ganze Liste); auf beiden Seiten (doppelt, und im Thread
  der Oberfläche).
- **D189 Port, Vertrag und Speicher sind drei Begriffe, der Speicher hat zwei Lagen.** Der Port ist
  alles, was ein Modul mit seinen Daten anbietet, und der einzige Weg an seine Tabellen. Der Vertrag
  beschreibt ihn (`./contracts`), es gibt genau einen pro Modul und keine zweite handgeschriebene
  Schnittstelle. Der Speicher setzt ihn gegen SQLite um (`./data`). Untere Lage: Funktionen, die
  eine laufende Transaktion, den Kontext (D195) und die Eingabe bekommen und selbst nichts öffnen
  oder melden. Obere Lage: der Aufruf aus dem Renderer, der die Eingabe prüft, die Transaktion
  öffnet und danach die geänderten Tabellen meldet. Eine Brücke (D152) ruft Funktionen der unteren
  Lage aus mehreren Modulen in ihrer eigenen Transaktion und schreibt nie selbst in fremde Tabellen.
  Die drei Begriffe kommen mit #32 ins Glossar. _Verworfen:_ Brücken rufen über den Vertrag (jeder
  Aufruf hätte seine eigene Transaktion).
- **D190 Ein Port kennt zwei erwartete Fehler, alles andere ist unerwartet.** „Nicht gefunden“ und
  „Konflikt“ mit einem Grund, den das Modul festlegt (`name_taken`, `already_billed`). Jede Operation
  zählt ihre Gründe im Vertrag auf. Ein Fehler trägt einen Code und nie Text, der Renderer übersetzt
  ihn. Der Speicher übersetzt Datenbank-Fehler selbst; was er nicht übersetzt, ist unerwartet und
  geht mit allen Details ins lokale Fehlerprotokoll (D99–D101), die Oberfläche zeigt dafür eine
  allgemeine Meldung. Bei jedem Fehler ist nichts geschrieben und nichts gemeldet. Ein abgestürzter
  Datenprozess ist kein Fehler des Ports, sondern ein Zustand der Verbindung (#29). Kein Effect in
  Schicht 2: oRPC typisiert die Fehler im Vertrag schon, der Datenprozess arbeitet synchron, und
  Effect brächte eigene Schemas und ein eigenes RPC neben Zod und oRPC. _Preis:_ In der unteren Lage
  sieht TypeScript geworfene Fehler nicht, die Contract-Tests lösen deshalb jeden Grund einmal aus.
  _Offen:_ Effect für Sync und Import neu bewerten, dort hinter dem Vertrag einsetzbar.
  _Verworfen:_ eigene Codes für ungültige Eingabe (das fängt das Formular, sonst ist es ein
  Programmierfehler) und fehlende Berechtigung (erst mit Organisations-Spaces).
- **D191 D139 bleibt: Der Build sammelt die SQL-Dateien ein.** Der Durchstich las sie stattdessen zur
  Laufzeit und musste jede Datei einzeln zum Kopieren eintragen, was beim ersten Versuch scheiterte.
  Folge: Alles, was den Speicher eines Moduls lädt, läuft durch Vite; ein Skript direkt unter Node
  kann das nicht. _Offen:_ Kann das Build-Werkzeug von Mobile nicht einsammeln, erzeugt dort ein
  Skript eine TypeScript-Datei aus denselben SQL-Dateien, und das Gate prüft, dass sie aktuell ist.
- **D192 Die Datenschicht gehört zum Start, die Grenze wird einmal angehoben.** TanStack Query und
  der oRPC-Client kosten im Durchstich rund 70 KB, damit blieben 43 KB bis zur Grenze. #33 setzt sie
  neu, mit Messung, wie `docs/development/performance.md` es verlangt. Der Smoke-Test der gepackten
  App in #29 bekommt eine Zeitgrenze für „erste Daten“, weil Bytes nur ein Ersatzmaß sind (gemessen:
  erstes Bild nach 221 ms, erste Antwort nach 253 ms). Ein eigenes Ticket untersucht ein Paket von
  112 KB mit Zod im Start. _Verworfen:_ den Datenclient nachladen (das Budget sähe besser aus, die
  Daten kämen später).
- **D193 Keine Abfrage wächst mit der Datenmenge.** Der Vertrag kennt nur drei Arten von Listen:
  Fenster (ein fachlicher Ausschnitt wie eine Woche oder ein Projekt), Seiten (höchstens N Zeilen,
  dann weiter ab einer Marke) und kleine Menge (ganze Tabelle, ausdrücklich so markiert, etwa
  Projekte oder Tags). Das Muster in #32 bietet nur diese drei Bausteine an. Summen, Zählungen und
  Gruppierungen liefert der Port fertig; wo D147 SQL verbietet, rechnet der Datenprozess in
  JavaScript. Neu geladen wird pro Tabelle (D92) und nur, was sichtbar ist, alles andere wird als
  veraltet markiert. Eine Transaktion löst genau eine Meldung aus. Gemessen dauert ein Umbenennen
  bis zur aktuellen Liste 49 ms bei 1.000 und 257 ms bei 10.000 Zeilen, davon entfallen 2 und 12 ms
  auf das Holen. _Preis:_ Suchen und Sortieren laufen im Datenprozess, und eine „kleine Menge“ mit
  tausenden Zeilen wird langsam. _Verworfen:_ Meldungen pro Zeile (deutlich aufwendiger, bei
  begrenzten Abfragen ohne spürbaren Gewinn).
- **D194 Die Oberfläche zeichnet nur, was sich geändert hat, und wartet auf den Datenprozess.**
  Seiten-Listen zeichnen nur die sichtbaren Zeilen, mit TanStack Virtual in einem gemeinsamen
  Baustein in `@self-engine/ui`, weil Mantine dafür nichts mitbringt; früh geladene Seiten werden
  wieder verworfen. Fenster und kleine Mengen zeichnen normal. Eine geänderte Zeile zeichnet eine
  Zeile neu: Im Durchstich waren es bei 1.000 Zeilen rund 4.150 Komponenten, #33 klärt die Ursache
  und hält das Ergebnis mit einem Test im Gate fest. Standard ist Warten auf die Antwort, das
  dauert mit begrenzten Abfragen ein bis drei Bilder. Vorgreifen gibt es nur bei direktem Anfassen
  (Ziehen, Häkchen) und wird pro Fall entschieden. _Verworfen:_ Vorgreifen als Standard (jede
  Operation gäbe es ein zweites Mal im Renderer, und nichts prüft, dass beide dasselbe tun).
- **D195 Uhr, Id-Erzeuger und Space kommen als ein Kontext aus dem Datenprozess.** Die obere Lage
  baut ihn pro Aufruf und reicht ihn an jede Funktion der unteren Lage, keine holt sich Zeit oder
  Ids selbst (D141). Der Renderer schickt nichts davon und bekommt nach dem Anlegen den fertigen
  Eintrag zurück. Die Zeit wird einmal pro Transaktion gelesen, alles daraus trägt denselben
  Zeitpunkt. Jede Abfrage filtert nach `space_id`, das Contract-Test-Kit prüft das mit Zeilen in zwei
  Spaces, und jeder Index für ein Fenster beginnt mit `space_id`. Bis #108 liefert der Kontext einen
  festen persönlichen Space, bis #104 den Zeitpunkt aus `db`; danach ersetzt die Uhr aus `time`
  (D148) den Typ, es bleibt bei einer Uhr. Das beantwortet die offene Frage aus #32.
- **D196 Stories und Komponenten-Tests bekommen feste Antworten.** Eine Story legt fest, was ein
  Aufruf liefert: Daten, Laden, einen Fehler, einen Konflikt. Ein Helfer baut den Ersatz aus dem
  Vertrag, er enthält keine Logik und liegt nur im Test- und Story-Code. Die Hooks bekommen den
  Zugang zum Port von außen gereicht, und die App stellt einen einzigen Zwischenspeicher für alle
  Module bereit. Die Web-App im Browser ohne Datenprozess zeigt bis zum Web-Treiber denselben
  Zustand wie bei einem abgestürzten Datenprozess. _Preis:_ Keine Story spielt einen Ablauf durch.
  _Verworfen:_ ein nachgebauter Speicher pro Modul (zweite Fassung jeder Operation, im Durchstich
  wäre er samt Beispieldaten ausgeliefert worden); echtes SQLite im Browser (das ist der
  Web-Treiber).

### Runde 28 (2026-11-11): Einstellungsbereich (#23, verfeinert D77, D115, ändert D80 und D116)

- **D197 Einstellungszeilen sind Daten, Seiten und Suche entstehen aus derselben Liste.** Jede
  sichtbare Zeile des Einstellungsbereichs steht einmal in einer Liste: ID, View, Titel, optionale
  Beschreibung, Suchwörter und ein Bedienelement oder ein Wert. Die Seite einer View zeichnet ihre
  Zeilen der Reihe nach, die Suche filtert dieselbe Liste. Eine Zeile ist keine Einstellung: Sie
  bedient eine, mehrere oder keine („Theme“ schreibt zwei Einstellungen, „Version“ keine, die Breite
  der Modul-Sidebar hat keine Zeile). Besonderes wie die Theme-Auswahl zeichnet den rechten Teil
  frei, bleibt aber eine Zeile mit Titel und Suchwörtern. Die Liste liegt hinter `load` und kommt
  nicht ins Startpaket. Der Erweiterungspunkt für Module wird noch nicht gebaut; die Form der Zeile
  liegt so, dass Module sie später importieren können. Beim Bauen entsteht dazu ein ADR. _Preis:_
  Jede Zeile muss in die Form „Titel, Beschreibung, Bedienelement“ passen. _Verworfen:_ frei gebaute
  Seiten mit getrennt gepflegtem Suchindex (läuft auseinander, sobald jemand eine Einstellung
  ergänzt); Suche nur über die Titel der Views (kann die Befehlspalette schon, erfüllt D80 nicht).
- **D198 Eine View entsteht erst mit echtem Inhalt (ändert D80).** #23 baut vier Views: Darstellung,
  Sprache, Tastenkürzel, Über. „Module“ und „Daten“ kommen mit ihrer ersten echten Zeile, „Daten“
  also mit der Sicherung (#35). „Sprache“ heißt „Sprache und Region“, sobald die Region kommt
  (D153). Wer die Einstellungen öffnet, landet auf „Darstellung“. _Verworfen:_ alle sechs sofort mit
  Platzhaltern (ein Klick in eine leere Seite, die Suche findet dort nichts).
- **D199 Das Suchfeld sitzt oben im Inhalt, Treffer sind bedienbare Zeilen.** Die gemeinsame
  Seiten-Komponente aller vier Views setzt das Feld über die Zeilen, es ist damit in jeder
  Layoutstufe sichtbar. Mit Suchtext zeigt der Inhalt statt der View die passenden Zeilen aller
  Views, nach View gruppiert und mit ihren Bedienelementen; ein leeres Feld zeigt wieder die View.
  Der Suchtext steht als Suchparameter in der Adresse und bleibt beim Wechsel der View erhalten.
  Durchsucht werden Titel, Beschreibung, Suchwörter und Werte in der angezeigten Sprache, nach den
  Regeln der Befehlspalette (D184: Wortanfang vor Wortmitte, keine Tippfehler-Suche); ohne Treffer
  erscheint `EmptyState`. Der Einstellungsbereich lädt dafür als ein Paket nach, nicht je View. Die
  Hülle bleibt unverändert: Während der Suche bleiben die Markierung in der Modul-Sidebar und der
  Seitentitel bei der View aus der Adresse. _Verworfen:_ das Feld im Groups-Bereich, wie #23 es
  vorschlug (läge unter der View-Liste und ab der Layoutstufe „schmal“ in der Schublade);
  Sprungliste mit Hervorhebung (ein Klick mehr, zweiter Suchparameter, Scrollen und Hervorheben).
- **D200 Die App-Sprache folgt allein dem Store.** Sie ist die Synced Setting `i18n.language` mit
  offenem Schema und dem Standardwert `system`. Der Picker bietet „System“, „Deutsch“ und „English“
  und schreibt nur die Einstellung; die Sprachen stehen in ihrer eigenen Sprache. Ein Beobachter
  über dem Router reagiert auf jede Änderung des Werts, vom Picker, aus einem anderen Tab oder
  später vom Sync (D119), lädt den Katalog und schaltet dann um. Scheitert das Laden, bleibt die
  alte Sprache sichtbar, ein Hinweis meldet es, und der gespeicherte Wert bleibt (D117). Beim Start
  löst die App den gespeicherten Wert auf, der Store ist dann schon geladen (D113). Ein unbekannter
  Wert verhält sich wie `system` und bleibt gespeichert (D118). Bei `system` folgt die App einem
  Wechsel der Systemsprache sofort (`languagechange`). _Verworfen:_ erst laden, dann speichern
  (für Änderungen von außen bräuchte es den Beobachter trotzdem, also zwei Abläufe).
- **D201 Darstellung: Theme-Karten, ein oder zwei Picker, alles wirkt sofort.** Bei festem
  Farbmodus gibt es einen Picker „Theme“, der das Theme dieses Farbmodus schreibt, bei „System“
  zwei („Theme für Hell“, „Theme für Dunkel“). Ein Picker bietet nur Themes, die den Farbmodus
  mitbringen. Ein Theme ist eine Karte mit seinen echten Farben aus der Theme-Engine, auf Mantines
  `Radio.Card`. Farbmodus und Dichte sind Umschalter, der Akzent sind Farbkreise mit „Vom Theme“
  davor (nicht wählbar, wenn das aktive Theme keinen Akzent mitbringt), die Hintergrundtönung ist
  ein Schalter, die Schriftgröße ein Schieberegler mit fünf Rasten in Prozent. Es gibt keinen
  Speichern- und keinen Zurücksetzen-Knopf. _Verworfen:_ immer zwei Picker (einer ohne sichtbare
  Wirkung); `Select` (ein Theme sieht man erst nach der Wahl).
- **D202 Der Einstellungsbereich ist ein eigenes Paket (ändert D116).** Es enthält die Form der
  Einstellungszeile, die Seiten-Komponente mit Suche und die vier Views; der Arbeitsname ist
  `@self-engine/settings-area`, klar getrennt vom Store-Paket `@self-engine/settings`. Die App
  reicht Store, Befehlsliste und Versionsangaben an eine Funktion des Pakets, die den fertigen
  Hüllen-Beitrag zurückgibt. Die Deklarationen der Darstellung und der Sprache ziehen aus der App
  in einen Einstieg des Pakets ohne Oberfläche, weil die App sie schon vor dem ersten Bild braucht.
  D116 gilt weiter für alles andere: Jeder Besitzer deklariert seine Einstellungen selbst.
  _Verworfen:_ alles in `apps/web` (Module könnten die Form der Zeile nie importieren, die App
  bekäme eigene Oberflächen).
- **D203 „Tastenkürzel“ und „Über“ zeigen nur an.** „Tastenkürzel“ listet die Befehle mit
  Standardkürzel aus dem Register (D174) und dazu ⌘K, nach Modul gruppiert, die Kürzel der Hülle als
  „Allgemein“ zuerst. Die Zeilen entstehen aus dem Register und sind durchsuchbar; Befehle ohne
  Kürzel erscheinen erst mit dem eigenen Belegen (D75). „Über“ zeigt Version, Kanal (nur im
  Desktop), Betriebssystem, einen Knopf, der diese Angaben als eine Zeile kopiert, und die Lizenz.
  Im Desktop reicht die Brücke die Version aus `app.getVersion()` durch, weil ein Release sie erst
  beim Verpacken bekommt; im Web setzt der Build sie ein. Kein Update-Knopf und kein Kanalwechsel
  (#46), keine Links nach außen. _Verworfen:_ alle Befehle mit Strich (lange Liste ohne Nutzen,
  solange niemand Kürzel belegen kann).
- **D204 Begriffe: Ein Abschnitt ist eine View, die Zeile heißt Einstellungszeile.** Was #23
  „section“ nennt, ist eine View des Einstellungsbereichs; das Glossar meidet „section“ bereits bei
  _Group_. Neu ist _Settings Row_ (de: _Einstellungszeile_): eine Zeile des Einstellungsbereichs mit
  Titel, optionaler Beschreibung und Bedienelement oder Wert, und das, was die Suche findet. Der
  Glossareintrag entsteht beim Bauen.

### Runde 29 (2026-11-12): Fensterzustand (#24, verfeinert D78, D114)

- **D205 #24 merkt nur noch den Fensterzustand, die Windows/Linux-Titelleiste wartet (#167).**
  Gebaut wird nur eine macOS-dmg, und niemand kann ein Windows- oder Linux-Fenster ansehen;
  blind gebaut gingen Farben, Hover, Knopfbreite und Ziehbereich ungeprüft an Nutzer, die es
  noch nicht gibt. Bis zu einem Windows- oder Linux-Build behalten beide den nativen Rahmen.
  Startpunkte für #167, nicht entschieden: `titleBarOverlay` ohne eigenen Hintergrund,
  Symbolfarbe per IPC aus `useFinalColors`, Platz über `env(titlebar-area-*)`, Höhe wie die
  Kopfzeile. _Verworfen:_ blind bauen; Prüfung per Bildschirmfoto auf einem Windows-Runner.
- **D206 Gemerkt werden normale Bounds, maximiert und Vollbild, kurz nach jeder Änderung.** Die
  normalen Bounds (Fenster weder maximiert noch im Vollbild) bleiben im maximierten Zustand und im
  Vollbild erhalten, damit Wiederherstellen und Vollbild-Verlassen zu ihnen zurückführen. Die
  Datei trägt eine Formatversion. Geschrieben wird etwa 0,5 s nach der letzten Änderung und
  sofort beim Schließen, immer über eine Hilfsdatei, die umbenannt wird. Kosten: höchstens ein
  kleiner Schreibvorgang pro halbe Sekunde im Hauptprozess, der Renderer merkt nichts.
  _Verworfen:_ nur beim Schließen schreiben (Absturz, Zwangsbeenden und Neustart für Updates
  verlieren die Sitzung).
- **D207 Ist der gemerkte Platz auf keinem Bildschirm sichtbar, öffnet das Fenster in der
  gemerkten Größe zentriert auf dem Hauptbildschirm.** Immer passend auf die Arbeitsfläche
  verkleinert, nie schmaler als 576 px (D131). Fehlt die Datei, ist sie kaputt oder hat sie eine
  unbekannte Version, gilt das Standardfenster 1280 × 800. _Verworfen:_ ganz auf das
  Standardfenster zurückfallen (die eingestellte Größe ginge verloren); an den nächsten
  sichtbaren Rand schieben (schwer vorherzusagen).
- **D208 Maximiert und Vollbild kommen beim Start wieder** (bestätigt D78). Auf dem Mac heißt das:
  eigener Space beim Start. _Verworfen:_ Vollbild nicht wiederherstellen, nur maximiert.
- **D209 Begriff _Window State_ (de: _Fensterzustand_), die Vollbild-Lücke ist #168.** Neu im
  Glossar: wo das Desktop-Fenster war, wie groß, und ob maximiert oder im Vollbild, pro Kanal
  gemerkt; keine Einstellung. Der Glossareintrag entsteht beim Bauen. Im Vollbild blendet macOS
  die Fensterknöpfe aus, die Hülle hält ihren Streifen aber frei; das zu beheben braucht den ersten
  Kanal vom Hauptprozess zum Renderer und gehört daher nicht in #24.

### Runde 30 (2026-11-12): App-Check `verify-desktop` (#25, verfeinert D76)

- **D210 Ein festes Skript fährt den Ablauf, der Skill erklärt nur drumherum.** Das Skript liegt
  in `scripts/` mit Test und baut auf dem Start der Stufe `smoke` auf; die `SKILL.md` sagt, wann
  man es startet, wie man die Ausgabe liest und was in den Bericht gehört. Jeder Lauf ist gleich,
  und ein Agent kann danach von Hand weitermachen. _Verworfen:_ ein Rezept, nach dem jeder Agent
  sein eigenes Playwright schreibt (ungetestet, jeder Lauf anders, Electron-Fallen wie
  `ELECTRON_RUN_AS_NODE` und das Wegwerf-Profil jedes Mal neu).
- **D211 Geprüft wird die gebaute App im eigenen Checkout des Agenten.** Erst der Build, dann
  Electron mit Wegwerf-Profil und eigenem Port, wie `smoke`; `--executable` prüft eine paketierte
  App. Läuft im selben Checkout `pnpm dev`, bricht das Skript mit einem Hinweis ab, statt mit dem
  Build die laufende Dev-App neu zu starten. _Verworfen:_ ein Dev-Server-Modus oder das Andocken an
  eine laufende `pnpm dev`-Sitzung (eigene Daten, fester Port 5733, das eigene Fenster würde auf
  576 px gezogen).
- **D212 Das Fenster bleibt unsichtbar, auch in `smoke`.** Eine Umgebungsvariable, die nur der
  Kanal `dev` beachtet, lässt das Fenster ungezeigt, blendet das Dock-Symbol aus und schaltet die
  Hintergrund-Drosselung ab, damit die Seite trotzdem voll zeichnet. Playwright holt Screenshots
  aus Chromium, nicht vom Bildschirm. `--visible` zeigt das Fenster doch. So springt weder beim
  App-Check noch bei `pnpm verify` ein Fenster nach vorne und nimmt den Fokus. Eine paketierte
  Nightly oder Stable lässt sich so nicht verstecken. _Verworfen:_ `showInactive()` (das Fenster
  springt trotzdem achtmal sichtbar um); ein Fenster außerhalb des Bildschirms (macOS und D207
  holen es zurück).
- **D213 Screenshots zeigen nur die Seite, die Fensterknöpfe prüft die Geometrie.** macOS zeichnet
  die Knöpfe über die Seite, sie fehlen also auf den Bildern; der Skill sagt das dem Agenten. Das
  Skript prüft stattdessen in jeder Layoutstufe, dass der Streifen für die Knöpfe frei bleibt, mit
  dem Maß, das die Hülle selbst dafür verwendet. Unter Windows und Linux gibt es bis #167 den
  nativen Rahmen (D205) und daher nichts zu prüfen; #167 erweitert die Prüfung. _Verworfen:_ eine
  Aufnahme auf Systemebene (braucht die macOS-Freigabe für Bildschirmaufnahme, nur Mac).
- **D214 Hell und Dunkel kommen über das System-Theme.** Der Hauptprozess stellt das System-Theme
  um; der Farbmodus bleibt auf seinem Standard „System“. Das prüft nebenbei, dass die App dem System
  folgt. _Verworfen:_ die Einstellung im Einstellungsbereich anklicken (bindet den Ablauf an dessen
  Oberfläche); Medien-Emulation des Browsers (umgeht Electron).
- **D215 Vier Breiten, jede gegen ihre Layoutstufe geprüft.** 1280 (wide), 1100 (medium), 800
  (narrow) und 576 (Mindestbreite, noch narrow), je hell und dunkel. Die Hülle zeigt ihre
  Layoutstufe als Attribut an ihrer Wurzel; das ist Produkt-Markup, kein Test-Haken, und kostet
  nichts, weil die Stufe ohnehin berechnet ist. Die Breiten exportiert die Hülle an einer Stelle,
  Stories und Skript lesen sie von dort. Ändert jemand einen Breakpoint, scheitert der Lauf, statt
  plausibel aussehende Bilder der falschen Stufe zu liefern.
- **D216 Objektive Fehler lassen den Lauf scheitern, alles andere beurteilt der Agent.** Hart
  scheitert er an der Fehlerseite statt der Hülle, an einem ungefangenen Fehler in Seite oder
  Hauptprozess, an `console.error`, an einer falschen Layoutstufe, einer falschen Route oder einem
  belegten Streifen für die Fensterknöpfe. Aussehen, Überlappung und Kontrast beurteilt der Agent an
  den Bildern. Auch ein gescheiterter Lauf behält die Bilder bis zum Fehler.
- **D217 Der Ablauf folgt der Oberfläche, nicht den Platzhaltern.** Das Skript liest die Module aus
  der Navbar und ihre Ansichten aus der Modul-Sidebar, über Rollen und Namen, und klickt sie an wie
  ein Mensch; so übersteht es den Ersatz der Platzhalter und prüft, dass jede Ansicht erreichbar
  ist. Es besucht jede Ansicht (wide, hell), deckt auf der ersten alle Layoutstufen in beiden
  Farbmodi ab, öffnet den Einstellungsbereich und lädt neu (dieselbe Route muss bleiben). Deep Link
  heißt: eine volle Adresse in den Hash schreiben und neu laden. Für `?edit=` (D77) startet es die
  Hauptaktion des ersten Moduls, das eine hat, und öffnet die Adresse mit offenem
  Bearbeiten-Drawer später neu. Ein OS-Protokoll (`self-engine://`) gehört nicht dazu.
  _Verworfen:_ das Register über einen Test-Haken der App auslesen (Testschnittstelle in der
  ausgelieferten App, Klickweg ungeprüft).
- **D218 Ausgabe in `.temp/`, Bericht mit Bildern, Verweis in AGENTS.md.** Jeder Lauf schreibt in
  einen eigenen Ordner mit Zeitstempel: nummerierte Bilder mit Schritt, Layoutstufe und Farbmodus im
  Namen und eine Zusammenfassung mit Schritten, Routen, Layoutstufen und Fehlern. Der Agent zeigt
  die wichtigen Bilder im Bericht, nennt, was ihm auffiel, und was ungeprüft blieb. Die Regel in
  AGENTS.md, eine nicht geprüfte visuelle Änderung zu melden und den Check anzubieten, nennt den
  Skill. Läuft nur auf Wunsch, nie in CI (D76).

### Runde 31 (2026-11-12): Typisierte Abfragen mit Kysely und Zod (#31, verfeinert D87, D91, D187, D195)

- **D219 Die Zeilen-Map ist die einzige geschriebene Quelle der Spaltentypen.** Jedes Modul
  deklariert in `./data` eine Map aus Tabellennamen und Zod-Zeilenschemas mit Speichertypen
  (snake_case, `deleted_at` nullbar). Die Kysely-Typen leitet ein kleiner Typ `TablesOf` aus `db`
  daraus ab; `withTables` und jede Speicherfunktion nutzen ihn, und der Übereinstimmungstest
  liest dieselbe Map. Das geht, weil Zeilen keine Defaults haben (D140, D141) und damit beim
  Einfügen, Lesen und Ändern gleich aussehen; `Generated<>` und `ColumnType` entfallen. Ein
  abgeleiteter Typ ist immer ein `type`-Alias, die `interface`-Reibung des Durchstichs entfällt.
  _Preis:_ Die Zeilenschemas werden beim Laden von `./data` gebaut, aber nie geparst (D188).
  _Verworfen:_ handgeschriebener Kysely-Typ neben einem Zod-Schema (zwei Quellen, dritte
  Prüfung); `kysely-codegen` (erzeugte Datei pro Modul, Erzeugung muss durch Vite, D191).
- **D220 Spalten snake_case, Entitäten camelCase, eine handgeschriebene Abbildung pro Entität.**
  Sie liegt in `./data`, ist gegen die abgeleitete Zeile typisiert und macht auch die übrigen
  Umwandlungen (`0/1` zu `boolean`, Weglassen der Konventionsspalten). Gemessen: 0,39 ms pro
  10.000 Zeilen. _Verworfen:_ Kyselys `CamelCasePlugin` (zwei Namen für eine Spalte, rohe
  `sql`-Fragmente umgehen es, Kosten pro Zeile ohne Ersparnis bei der Abbildung); snake_case bis in
  die Entität.
- **D221 Eine Entität trägt `id`, `createdAt` und `updatedAt`, Gelöschtes verlässt den Port nur
  ausdrücklich.** `space_id` und `deleted_at` bleiben im Datenprozess: Der Space kommt aus dem
  Kontext (D195), und solange nur ein Space sichtbar ist, trüge jede Zeile denselben Wert. Braucht
  eine Ansicht später Spaces gemischt, kommt `spaceId` als additives Feld. Rückgängig beim Löschen
  (D79) braucht nur die `id` und `restore`; ein Papierkorb wäre eine eigene Operation mit eigener
  Entität samt `deletedAt`. `get` und jede Änderung auf eine gelöschte Id liefern „nicht gefunden“
  (D190). Jede Abfrage filtert selbst; #32 baut einen gemeinsamen Einstieg, der `space_id` und
  `deleted_at IS NULL` an einer Stelle setzt, und das Contract-Test-Kit legt neben die Zeilen in
  zwei Spaces eine gelöschte Zeile. Eindeutige Indizes auf synchronisierten Tabellen sind partiell
  auf `deleted_at IS NULL`, sonst blockiert ein gelöschter Name einen neuen; `checkConventions`
  prüft das. Ein Wiederherstellen in einen inzwischen vergebenen Wert ist ein Konflikt mit Grund
  (klärt #32). _Verworfen:_ eine View pro Tabelle (doppelt in unveränderlichen Migrationen, Lesen
  und Schreiben getrennt); nur Konvention ohne Prüfung.
- **D222 `custom` kommt erst mit den Nutzerfeldern (schärft D87).** Form, Prüfung und Oberfläche
  der Nutzerfelder sind nicht entworfen; jetzt eine Spalte festzulegen nähme dem Entwurf eine
  Antwort vorweg und kostete in jeder Zeile ein `JSON.parse`. Mit dem Feature ergänzt jedes Modul
  `ALTER TABLE … ADD COLUMN custom TEXT NOT NULL DEFAULT '{}'`, in SQLite eine reine
  Schemaänderung ohne Umschreiben der Tabelle; D140 verbietet `DEFAULT` nur auf den Zeitspalten.
  Ihr Platz ist die Zeilen-Map (`z.string()`) und die Abbildung (`JSON.parse`). _Preis:_ eine
  Migration pro Modul, wenn das Feature kommt.
- **D223 `time` entsteht jetzt mit nur `Instant`.** `./contracts` darf `db` nicht importieren
  (D187), braucht aber für D188 einen gebrandeten Zeitpunkt. `time` bekommt daher in #31 genau
  `Instant` mit Zod-Schema: exakte Form `2026-11-09T14:07:46.297Z`, Jahre 1000 bis 9999 (D149).
  `newTimestamp` in `db` liefert `Instant`. Name und Form folgen dem, was #104 aus der alten App
  übernimmt (D148); #104 baut das Paket aus, statt etwas zu ersetzen. _Verworfen:_ vorläufig in
  `db` mit Ausnahme in den Modulgrenzen (alles zöge nach #104 um); `string` bis #104 (gegen D188).
- **D224 Eine Id-Marke pro Entität.** `idSchema("Project")` prüft UUIDv7 und trägt die Marke
  `ProjectId`. Zeilen-Map, Kysely-Typen (über D219), Abbildung und Vertrag nutzen dieselben
  Schemas, auch für Fremdschlüssel; eine Abfrage auf `projects.id` liefert direkt `ProjectId`. Neue
  Ids entstehen nur über den Kontext, ohne Typumwandlung von Hand. Ein Fremdschlüssel auf ein
  anderes Modul importiert dessen `./contracts` und braucht seinen Eintrag in `ALLOWED_IMPORTS`.
  _Grund:_ `timeEntries.create({ projectId: task.id })` kompiliert sonst und fällt erst beim
  Commit oder gar nicht auf. Marken kosten zur Laufzeit nichts. _Verworfen:_ eine gemeinsame
  Marke `Id`; keine Marke.
- **D225 Ein reiner Einstieg `@self-engine/db/schema` (ergänzt D187).** Er enthält nur Zod-Schemas,
  die Zeile und Vertrag teilen: `idSchema` und `sqliteBoolean`. Die Kern-Reinheitsregel sichert ihn
  (kein Kysely, kein `uuid`, kein Treiber), und `./contracts` darf ihn importieren. _Verworfen:_
  ein eigenes Paket für eine Datei; Id-Schemas in jedem Modul.
- **D226 Der Übereinstimmungstest vergleicht die Zeilen-Map mit den echten Spalten.** Er kommt aus
  `@self-engine/db/testing`, liefert wie `checkConventions` eine Liste von Verstößen und lässt die
  Migrationen des Moduls allein auf einer frischen Datenbank laufen; jede Tabelle danach gehört dem
  Modul, ausgenommen die von Kysely und SQLite. Geprüft werden: Tabellen und Spalten als Menge
  gleich; nur erlaubte Formen (`z.string()` und alles darauf zu `TEXT`, `z.number().int()` zu
  `INTEGER`, `z.number()` zu `REAL`, `sqliteBoolean` als `0 | 1` zu `INTEGER`); `.nullable()` genau
  bei Spalten ohne `NOT NULL`; `.optional()` ist verboten. `z.boolean()` ist verboten, weil der
  Treiber `0`/`1` liefert und der abgeleitete Typ sonst lügt; die Spalte trägt `CHECK (x IN (0,
  1))`, den der Test nicht liest. Indizes, Fremdschlüssel und `STRICT` bleiben bei
  `checkConventions`.
- **D227 Jeder Index auf einer synchronisierten Tabelle beginnt mit `space_id`, ohne Ausnahmeliste
  (schärft D195).** Eine Prüfung kann nicht wissen, welcher Index einem Fenster dient, und ein
  Index ohne Fenster ist nicht in Sicht: Suchen nach `id` deckt der Primärschlüssel, „Aufgaben
  eines Projekts“ ist selbst ein Fenster. Der automatische Index des Primärschlüssels und lokale
  Tabellen sind ausgenommen. Mit D221 heißt das: Eindeutigkeit auf synchronisierten Tabellen läuft
  über `CREATE UNIQUE INDEX (space_id, …) WHERE deleted_at IS NULL`, nie über ein eingebettetes
  `UNIQUE`. `checkConventions` prüft beides. _Preis:_ eine Space-Id mehr pro Indexeintrag, bei
  100.000 Zeilen rund 3,6 MB pro Index (gerechnet). _Verworfen:_ nur Konvention; Ausnahmeliste.
- **D228 Kein `*OrThrow` im Speicher.** Kyselys `NoResultError` war im Bundle nicht am Namen zu
  erkennen. Abfragen nutzen `executeTakeFirst()`, und der Speicher macht aus `undefined`
  ausdrücklich „nicht gefunden“ (D190). Eine Lint-Regel im Repo-Plugin verbietet
  `executeTakeFirstOrThrow` und `takeFirstOrThrow` und nennt den Ersatz. _Verworfen:_ `instanceof
  NoResultError` (erwartete Fälle als Ausnahme, `try/catch` in jeder Funktion).
- **D229 `createTestSources(start)` in `@self-engine/db/testing`.** Liefert Uhr, `IdSources` und
  `advance(ms)` über eine gemeinsame Zeit, die nur bei `advance` weiterläuft (eine Zeit pro
  Transaktion, D195). Die Zufallsbytes sind ein Zähler: Ids sind eindeutig und steigen auch
  innerhalb einer Millisekunde in Anlegereihenfolge. Der Test-Kontext aus #32 baut darauf auf.
- **D230 Das Beispiel ist ein Testmodul in `db`.** Eine Tabelle `notes` nach allen Konventionen mit
  Zeilen-Map, partiellem eindeutigem Index, Abbildung und Entitäts-Schema; sein Test führt
  `checkConventions` und den Übereinstimmungstest aus und liest eine geschriebene Zeile gebrandet
  zurück. Das bestehende Migrations-Testmodul bleibt, wie es ist. Die absichtlich falschen Spalten
  stehen als Fixtures in den Tests des Übereinstimmungstests. Die Aufteilung in `./contracts` und
  `./data` zeigt erst #32. _Verworfen:_ eine Tabelle in `placeholder-alpha` vor dem Port-Muster;
  ein eigenes Paket.

### Runde 32 (2026-11-12): Port-Muster und Contract-Test-Kit (#32, verfeinert D152, D188–D190, D193, D221, ändert D135 und D230)

Geprüft vor der Runde: oRPC 1.16.2 hat keinen Schalter für die Ausgabeprüfung, `validateOutput`
läuft immer, sobald ein Ausgabe-Schema da ist. better-sqlite3 13.0.3 bietet keinen Update-Hook.
Kysely 0.29.8 reicht einem Plugin in `transformQuery` den Abfragebaum, und `withPlugin` gibt es
auch auf einer Transaktion. Gebaut oder gemessen wurde in dieser Runde nichts; wo eine Zahl steht,
ist sie geschätzt und so benannt.

- **D231 Die Transaktion merkt sich selbst, welche Tabellen sie geschrieben hat.** Ein
  Kysely-Plugin liest aus jedem Abfragebaum das Ziel von `INSERT`, `UPDATE` und `DELETE` und
  sammelt die Tabellennamen; nach dem Commit meldet die obere Lage (D189) genau diese Menge. Kein
  Modul zählt Tabellen von Hand auf. Rohes SQL ist im Speicher verboten, weil das Plugin es nicht
  lesen kann; eine Lint-Regel sichert das. Das Contract-Test-Kit prüft den Mechanismus: Die
  gemeldeten Tabellen stimmen mit den wirklich geänderten überein. _Preis:_ ein Durchlauf über den
  Abfragebaum pro Schreibbefehl, nicht gemessen. _Verworfen:_ Tabellen pro Operation von Hand
  angeben (eine vergessene Tabelle heißt: Die Liste lädt nicht neu, und kein Test merkt es); ein
  Update-Hook des Treibers (gibt es nicht).
- **D232 Der Rahmen der oberen Lage wird einmal gebaut.** Er prüft die Eingabe, baut den Kontext
  (D195), öffnet die Transaktion, meldet die Tabellen (D231), rollt bei einem Fehler zurück und
  übersetzt ihn (D238). Ein Modul liefert pro Vertragseintrag eine Funktion `(tx, kontext,
  eingabe) => ergebnis` der unteren Lage und markiert sie als Abfrage oder Operation. Eine Abfrage
  bekommt einen Zugang, der nur lesen kann. Brücken (D152) rufen dieselben Funktionen. Sonderfälle
  wie ein langer Import mit Fortschritt oder ein Strom werden von Hand geschrieben, wie `health`
  und `tablesChanged` heute. _Verworfen:_ jedes Modul schreibt den Rahmen selbst (die Regeln aus
  D188, D190 und D195 lägen in jeder Datei noch einmal).
- **D233 Die Modulliste der Datenseite liegt in `data-process`, die Bausteine in einem neuen Paket
  `@self-engine/storage` (ändert D135).** Bisher stellt die Desktop-App die Migrationen zusammen.
  Künftig hält `data-process` eine Liste der Daten-Einstiege aller Module und baut daraus
  Migrationen und Router; jede App, die den Datenprozess startet, bekommt dieselbe Liste. Was ein
  Modul für seinen Speicher braucht (Markierungen für Abfrage und Operation, Kontext,
  Listen-Bausteine, gemeinsamer Einstieg, Test-Kit), liegt in `storage`, denn ein Modul darf
  `data-process` nicht importieren, wenn `data-process` die Module importiert
  ([ADR 0006](../adr/0006-module-boundaries-are-enforced-three-ways.md)). `db` kennt weiter kein
  Modul. _Verworfen:_ jede App setzt selbst zusammen (Desktop, Mobile und MCP-Server liefen
  auseinander, wie in D187); Bausteine in `db` (zöge oRPC und den Vertrag in das Treiber-Paket).
- **D234 Die Ausgabeprüfung schaltet der Rahmen, nicht oRPC (beantwortet die offene Frage aus
  D188).** Module schreiben normale Zod-Ausgabe-Schemas in den Vertrag. Der Rahmen bekommt beim
  Start die Option „Ausgaben prüfen“; ist sie aus, arbeitet er auf einer Kopie des Vertrags ohne
  Ausgabe-Schemas. Tests und der Dev-Build prüfen, die gepackte App nicht; ein Test hält beide
  Fälle fest. Das Kit prüft, dass kein Ausgabe-Schema etwas umwandelt. _Verworfen:_ ein
  ungeprüftes Schema wie im Durchstich (der Vertrag verlöre die Form der Ausgabe, auch für Stories
  nach D196).
- **D235 Der gemeinsame Einstieg bietet `live(tabelle)` und vier einzeilige Standard-Schreibwege.**
  `live` setzt `space_id` aus dem Kontext und `deleted_at IS NULL` (D221). Anlegen, Ändern,
  Löschen (weich) und Wiederherstellen setzen die Konventionsspalten und liefern „nicht gefunden“
  nach D221. Beides gilt nur für synchronisierte Tabellen. Alles andere (Verbindungen, Summen,
  Änderungen an mehreren Zeilen) bleibt freies Kysely; die Filter setzt dort das Modul, und das Kit
  prüft sie. _Verworfen:_ ein vollständiger Abfrage-Baukasten über Kysely (eine zweite
  Abfragesprache, die jede Ausnahme nachbauen müsste).
- **D236 Eine Seiten-Liste blättert mit einer undurchsichtigen Marke, die Größe bestimmt der Port
  (schärft D193).** Der Datenprozess gibt mit jeder Seite eine Marke für davor und danach mit, der
  Renderer reicht sie unverändert zurück und kennt ihren Inhalt nicht. Sie entsteht aus dem
  Sortierwert und der `id`; jede Seiten-Liste hat eine feste Reihenfolge mit der `id` als letztem
  Kriterium. Eine Seite hat 100 Zeilen, eine einzelne Liste darf das im Speicher auf höchstens 500
  setzen, der Renderer wählt die Größe nie. Das Kit liest den Abfrageplan und schlägt fehl, wenn
  eine Seiten-Abfrage ohne Index sortiert. Die Gesamtzahl der Zeilen klärt #137. _Verworfen:_ der
  Renderer baut die Marke aus der letzten Zeile (jede Liste der Oberfläche müsste die Sortierung
  kennen); Größe pro Aufruf (eine Komponente könnte alles verlangen).
- **D237 Fenster und kleine Menge bleiben unbegrenzt, der Dev-Build warnt ab 1.000 Zeilen.** Beide
  liefern immer alles. Prüft der Rahmen Ausgaben (D234), schreibt er ab 1.000 Zeilen eine Warnung
  mit dem Namen der Abfrage ins lokale Fehlerprotokoll. Die Zahl ist geschätzt, nicht gemessen.
  _Preis:_ Die Warnung fällt nur auf, wenn jemand mit vielen Daten entwickelt; den großen
  Testdatensatz plant #33 mit den Zeitmessungen ein. _Verworfen:_ nur die Markierung (niemand
  erfährt, wenn die Menge wächst); eine harte Grenze (ein Auswahlfeld ginge kaputt, das nur
  langsam gewesen wäre).
- **D238 Das Modul hinterlegt, welcher eindeutige Index welcher Konflikt ist, der Rahmen übersetzt
  (schärft D190, klärt D221).** Pro eindeutigem Index nennt das Modul den Grund (`name_taken`). Der
  Rahmen fängt die Verletzung aus SQLite und macht daraus „Konflikt“ mit diesem Grund; eine
  Verletzung ohne Eintrag ist unerwartet und geht ins Fehlerprotokoll. Es gibt keine Abfrage vor
  dem Schreiben, die Regel steht nur im Index. Das Kit prüft, dass jeder eindeutige Index eines
  Moduls einen Eintrag hat, und löst jeden Grund einmal aus. Wiederherstellen in einen inzwischen
  vergebenen Wert meldet denselben Konflikt wie Anlegen; die Oberfläche entscheidet, was sie
  anbietet. Gründe, die kein Index ausdrückt (`already_billed`), wirft die Funktion der unteren
  Lage weiter selbst. _Verworfen:_ vorher nachfragen (eine Abfrage mehr pro Schreibvorgang, die
  Regel doppelt); beim Wiederherstellen umbenennen (ändert Daten ungefragt und wäre für eine
  Rechnungsnummer falsch).
- **D239 Das Contract-Test-Kit ist ein Aufruf pro Modul.** Das Modul übergibt seinen
  Daten-Einstieg, eine Funktion, die Beispieldaten anlegt, und pro Vertragseintrag eine gültige
  Beispiel-Eingabe; fehlt eine, schlägt der Test fehl. Das Kit läuft gegen echtes SQLite in
  `:memory:` (D95) und prüft für jeden Eintrag: gemeldete gegen geänderte Tabellen (D231);
  Abfragen schreiben nichts (D232); Ausgabe-Schemas wandeln nichts um und die Ausgabe passt zum
  Vertrag (D188, D234); keine Zeile aus einem zweiten Space und keine gelöschte Zeile (D195,
  D221); Seiten-Abfragen nutzen einen Index (D236); jeder eindeutige Index hat seinen Grund
  (D238); ungültige Eingaben werden abgewiesen. Die Fachlogik testet das Modul selbst.
  _Verworfen:_ ein Werkzeugkasten, aus dem jedes Modul seine Prüfungen zusammensetzt (eine
  vergessene Prüfung fällt nicht auf).
- **D240 Das Beispiel `notes` zieht nach `storage` und wird zur Vorlage (ändert D230).** Es bekommt
  `./contracts` und `./data`, Abfragen in allen drei Listen-Arten, Operationen und seinen
  eindeutigen Index, läuft durch das Kit und ist das Muster, von dem Module abschreiben. In der App
  taucht es nicht auf. Der Durchstich durch die echte App (`placeholder-alpha` auf dem Port) ist
  die erste Aufgabe von #33, weil er die Hooks braucht; dort entsteht auch der Helfer für feste
  Antworten (D196). _Verworfen:_ `placeholder-alpha` schon in #32 umstellen (#32 wäre ohne die
  offenen Entscheidungen von #33 nicht baubar).
- **D241 Ein Modul liest fremde Daten nur über freigegebene Lese-Bausteine, nie über fremde
  Tabellen (verfeinert D152).** Das besitzende Modul exportiert in `./data` einen Baustein mit
  wenigen festen Spalten (etwa Id, Name und Farbe eines Projekts) und eingebautem Space-Filter.
  Ein Modul, das nach D152 darauf aufbauen darf, verbindet ihn in einer Abfrage und kann so danach
  sortieren und filtern. Der Baustein liefert auch gelöschte Zeilen und markiert sie, damit ein
  Zeiteintrag nicht verschwindet, weil sein Projekt gelöscht ist. Eine Brücke liest über die
  Abfragen der Module oder über diese Bausteine. Die Zeilen-Map eines fremden Moduls zu
  importieren verbietet eine Lint-Regel; geschrieben wird in fremde Tabellen nie. Die Regel
  dahinter: Ein Modul kennt nur Module, auf denen es aufbaut. _Preis:_ Das besitzende Modul pflegt
  den Baustein. _Offen:_ Wie ein Modul in der Oberfläche etwas in die Seite eines anderen einhängt
  (das Zeitmodul eine Karte „Aufgenommene Zeit“ in die Projektseite), ist nicht entschieden und
  gehört zu Schicht 4. _Verworfen:_ nur über die Abfragen des anderen Moduls (kein Sortieren und
  Filtern über beide Seiten); freier Zugriff auf fremde Tabellen (jede Spaltenänderung bricht das
  lesende Modul, die Filter stünden doppelt).

### Nachtrag zu Runde 32 (2026-11-12): beim Bau von #32 entschieden (verfeinert D231, D236–D239, D241)

Beim Bau von #32 blieben fünf Fragen offen, die Runde 32 nicht beantwortet hatte. Sie wurden
während des Baus und im Review entschieden und hier nachgetragen. Gemessen wurde auf SQLite im Speicher, ohne den
Weg zwischen den Prozessen; die Zahlen stehen mit #210 in `docs/development/performance.md`.

- **D242 Das Kit bildet ungültige Eingaben selbst (verfeinert D239).** Das Modul übergibt pro
  Vertragseintrag nur eine gültige Beispiel-Eingabe. Das Kit bildet daraus Kandidaten (feste Werte
  vom falschen Typ, das Beispiel ohne je ein Feld, das Beispiel mit je einem Feld vom falschen
  Typ). Jeden Kandidaten, den das Eingabe-Schema ablehnt, muss auch der Rahmen abweisen. Lehnt das
  Schema eines Eintrags keinen einzigen ab, schlägt der Test fehl: Ein Schema, das alles annimmt,
  prüft nichts. _Verworfen:_ das Modul liefert ungültige
  Beispiele mit (jedes Modul müsste sie pflegen, und ein vergessenes Beispiel fiele nicht auf).
- **D243 Eine Tabelle wird nur gemeldet, wenn eine Zeile betroffen war (verfeinert D231).** Das
  Plugin merkt sich das Ziel jedes Schreibbefehls; der Rahmen meldet nach dem Commit nur die
  Tabellen, bei denen mindestens eine Zeile geändert wurde. Ein `UPDATE`, das nichts trifft, lädt
  keine Liste neu. Das Kit vergleicht die gemeldeten Tabellen mit dem wirklichen Inhalt vorher und
  nachher und schlägt auch fehl, wenn eine geänderte Tabelle nicht gemeldet wurde. Ein Trigger, der
  eine zweite Tabelle schreibt, fällt so im Test auf und kommt nicht unbemerkt in die App.
  _Preis:_ rund 0,4 µs pro Schreibbefehl, gemessen. _Verworfen:_ jedes Schreibziel melden (Listen
  lüden neu, obwohl sich nichts geändert hat); Trigger im Plugin nachverfolgen (das Plugin sieht
  nur den Abfragebaum, nicht das Schema).
- **D244 Unerwartete Fehler und die Warnung ab 1.000 Zeilen gehen an eine Melde-Stelle des Rahmens
  (verfeinert D237, D238).** D237 und D238 nennen das lokale Fehlerprotokoll, das es erst mit #37
  gibt. Der Rahmen bekommt deshalb beim Start eine Funktion `report` und ruft sie mit einem von
  zwei Ereignissen auf: unerwarteter Fehler (mit Eintrag und Fehler) oder große Ergebnismenge (mit
  Eintrag und Zeilenzahl). Der Datenprozess reicht die Funktion durch. Bis #37 schreibt der
  Dev-Build auf die Konsole, die gepackte App nirgendwohin; #37 hängt das Protokoll an dieselbe
  Stelle, ohne dass ein Modul sich ändert. _Preis:_ rund 7 ns pro Abfrage für die Prüfung der
  Zeilenzahl, gemessen. In der gepackten App geht ein unerwarteter Fehler bis #37 nur als Fehler an
  den Aufrufer und wird nirgends festgehalten. _Verworfen:_ das Protokoll in #32 vorziehen (#37
  hat eigene offene Fragen); `console` fest im Rahmen (die gepackte App schriebe ins Leere, und
  Tests könnten nichts prüfen).
- **D245 Eine Blätter-Marke ist unsigniert und übersteht einen Neustart des Datenprozesses
  (verfeinert D236).** Die Marke enthält den Namen des Vertragseintrags, die Richtung und die
  Sortierwerte der Randzeile, als Base64 verpackt. Der Rahmen prüft sie beim Lesen: Name des
  Eintrags, Anzahl der Werte und jeder Wert gegen das Schema seiner Spalte; alles andere ist eine
  ungültige Eingabe. Eine Signatur gibt es nicht. Der Renderer ist kein Gegner, sondern Teil
  derselben App, und eine gefälschte Marke erreicht nur Zeilen, die dieselbe Abfrage mit ihren
  Space- und Löschfiltern ohnehin liefert. Führt eine Marke hinter das Ende, kommt eine leere Seite
  mit einer Marke zurück, die wieder zur letzten Zeile führt. _Offen:_ Zwei Module, die einer
  Seiten-Liste denselben Eintragsnamen geben, nehmen die Marken des jeweils anderen an; der
  Modulname gehört in die Marke, sobald das erste echte Modul eine Seiten-Liste hat (#33).
  _Verworfen:_ Signatur mit einem Schlüssel pro Prozess (jede Marke würde bei einem Neustart des
  Datenprozesses ungültig, und die offene Liste spränge an den Anfang); Schlüssel auf der Platte
  (ein Geheimnis mehr, ohne dass es etwas schützt).
- **D246 Ein Modul sieht vor dem Schreiben nach, ob das Ziel eines Verweises existiert (verfeinert
  D241).** Speichert eine Operation einen Verweis auf die Zeile eines anderen Moduls (ein
  Zeiteintrag auf ein Projekt), liest sie das Ziel zuerst über dessen Lese-Baustein. Fehlt es, ist
  es gelöscht oder liegt es in einem anderen Space, meldet sie „nicht gefunden“, und der
  Vertragseintrag nennt diesen Fehler. Ohne das Nachsehen käme ein fehlendes Ziel als interner
  Fehler beim Aufrufer an. Ob ein gelöschtes Ziel im Einzelfall doch erlaubt ist, entscheidet das
  Modul; die Vorlage `note-links` lehnt es ab. Der Fremdschlüssel in der Datenbank bleibt als
  zweite Sicherung. _Preis:_ eine Abfrage über den Primärschlüssel mehr pro Schreibvorgang mit
  Verweis, nicht gemessen. _Verworfen:_ der Rahmen übersetzt die Fremdschlüssel-Verletzung (SQLite
  nennt nicht, welcher Fremdschlüssel verletzt wurde; bei zwei Verweisen wüsste niemand, welches
  Ziel fehlt, und ein Ziel in einem fremden Space fiele gar nicht auf).

Richtigstellung zur Spezifikation in #32: Ein Port hat zwei Einstiege, `./contracts` und `./data`
(D187, D240). „Vier Einstiege“ in der ersten Fassung der Spezifikation war ein Schreibfehler; die
Texte von #32 und #209 sind korrigiert.

### Runde 33 (2026-11-13): Tabellenmeldung und Hooks (#33, verfeinert D92, D190, D192–D194, D196, D240, D245)

Vor den Einzelfragen wurde die Bauweise noch einmal ganz geprüft, unabhängig vom Stand des Codes.
Zahlen aus dem Durchstich (Runde 27) sind als gemessen genannt; alles andere ist als nicht gemessen
markiert und wird beim Bau gemessen.

- **D247 Die Grundlage bleibt „fragen und neu laden“; eine Kopie in der Oberfläche gibt es nur
  gezielt pro Ansicht (bestätigt D92).** Verglichen wurden vier Bauweisen: (1) Daten in SQLite im
  Datenprozess, die Oberfläche stellt benannte Abfragen und lädt nach einer Meldung neu; (2) eine
  Kopie der Zeilen im Speicher der Oberfläche, die dort rechnet und Schreiben vorgreift (TanStack
  DB, Linear); (3) ein Ereignis-Protokoll, aus dem SQLite abgeleitet wird (LiveStore); (4) eine
  Sync-Engine, die Tabellen und Schreibwege vorgibt. Für diese App trägt (1): Die Daten wachsen
  über Jahre und werden viel summiert, das ist die Stärke von SQLite mit Indizes; der Speicher der
  Oberfläche wächst nicht mit; jede Sync-Engine kann später andocken (D89); Module bleiben über
  ihren Port getrennt (D241). Gemessen kostet das Holen 2 ms bei 1.000 und 12 ms bei 10.000 Zeilen,
  die spürbare Zeit liegt im Zeichnen. Die Schwäche von (1) ist direktes Anfassen (Ziehen, Häkchen,
  Zeitblöcke verschieben); dort darf eine einzelne Ansicht Bauweise (2) hinter ihrem Hook bekommen
  (D194, D249). _Neu prüfen, wenn:_ die gewählte Sync-Engine eine Kopie in der Oberfläche
  voraussetzt, oder sich nach #33 normale Formulare und Listen träge anfühlen. _Nicht gemessen:_
  TanStack DB in dieser App, weder Größe noch Geschwindigkeit. _Verworfen:_ (2) als Grundlage (der
  Port bräuchte einen allgemeinen Zeilen-Zugang statt benannter Abfragen, Joins liefen an den
  Lese-Bausteinen vorbei, jede Operation gäbe es zweimal); (3) und (4) (legen Datenmodell oder
  Engine sofort fest).
- **D248 Eine Abfrage erklärt die Tabellen, die sie liest, auf der Datenseite (verfeinert D92,
  D193).** Die Erklärung steht neben der Abfrage-Funktion. Das Kit führt die Abfrage aus und
  schlägt fehl, wenn sie eine nicht erklärte Tabelle liest. Der Datenprozess schickt dem Renderer
  bei jedem Verbinden einmal die Liste „Abfrage → Tabellen“; ein Hook nennt keine Tabellennamen.
  Die Liste sagt nebenbei, welche Einträge Abfragen sind: Der Baustein meldet im Dev-Build, wenn
  ein Abfrage-Hook auf einer Operation liegt. Feste Antworten (D255) brauchen die Liste nicht.
  _Preis:_ ein Feld pro Abfrage und einmal pro Verbindung eine kleine Liste, geschätzt wenige
  Kilobyte bei hundert Abfragen, nicht gemessen. _Verworfen:_ Tabellen von Hand im Hook (ein
  vergessener Name lässt eine Liste mit Join still veralten, und kein Test merkt es); Tabellen im
  Vertrag (oRPC typisiert `meta` nicht pro Eintrag, und der Renderer müsste den Vertrag zur
  Laufzeit laden); jede Antwort trägt ihre Tabellen mit (ändert die Form jeder Antwort).
- **D249 Nur ein gemeinsamer Baustein kennt TanStack Query (verfeinert D92, D196).** Er liegt als
  React-Einstieg im Paket `data-client`. Ein Modul schreibt pro Hook, welcher Eintrag seines
  Vertrags gemeint ist und ob er Abfrage oder Operation ist; Schlüssel, Neuladen und Fehlerwege
  sind für alle gleich. Eine Lint-Regel verbietet den direkten Import von TanStack Query in
  Modulen, wie bei den Tastenkürzeln. Die Hooks eines Moduls liegen im Modul neben seinen
  Ansichten und werden nur freigegeben, wenn ein anderes Modul sie braucht (D150). _Preis:_ Was
  der Baustein nicht kann, wird dort einmal ergänzt statt im Modul gelöst. Laufzeit: eine dünne
  Hülle, kein messbarer Unterschied erwartet, nicht gemessen. _Verworfen:_ TanStack Query direkt
  in Modulen (jedes Modul entschiede Schlüssel und Fehlerwege selbst, und D247 ließe sich nicht
  mehr hinter dem Hook umsetzen).
- **D250 Eine Antwort gilt, bis eine Tabellenmeldung ihre Tabellen trifft (verfeinert D193).** Ist
  die Abfrage sichtbar, lädt sie sofort neu, und der alte Stand bleibt bis zur Antwort stehen. Ist
  sie nicht sichtbar, wird sie nur markiert und lädt beim nächsten Anzeigen, wobei kurz der alte
  Stand zu sehen ist. Nach jedem Neuverbinden mit dem Datenprozess wird alles markiert, weil
  Meldungen verloren gegangen sein können. Fenster-Fokus und Zeitablauf lösen nichts aus.
  Antworten, die niemand mehr anzeigt, verfallen nach 5 Minuten. _Preis:_ Die Regel verlässt sich
  darauf, dass jede Änderung gemeldet wird (D243, D248). Speicherbedarf der 5 Minuten: nicht
  gemessen. _Verworfen:_ die Voreinstellungen von TanStack Query (laden bei jedem Anzeigen und bei
  Fokus neu, obwohl der Datenprozess Bescheid sagt); eine Ladeanzeige beim Anzeigen markierter
  Abfragen (bei wenigen Millisekunden stört sie als Flackern).
- **D251 Erwartete Fehler einer Operation sind Rückgabewerte (verfeinert D190).** Der
  Operations-Hook wirft für „Konflikt“ und „nicht gefunden“ nichts, sondern gibt sie zurück. Bei
  einem Konflikt bekommt das Formular den Grund; das Modul legt pro Grund einen übersetzten Text
  und ein Feld fest, und TypeScript verlangt einen Text für jeden Grund des Vertragseintrags. Der
  Drawer bleibt offen, es kommt keine Benachrichtigung. Bei „nicht gefunden“ zeigt der Baustein
  eine Benachrichtigung, und das Modul schließt den Drawer; ein Modul darf den Standard ersetzen.
  Bei einem unerwarteten Fehler zeigt der Baustein eine allgemeine Benachrichtigung über
  `notifyError()`, der Drawer bleibt offen. Der Hook meldet, solange die Operation läuft, damit
  der Knopf sich gegen doppeltes Absenden sperrt. _Nicht hier:_ ein allgemeiner Formular-Helfer
  mit Eingabeprüfung vor dem Absenden; er wird ein eigenes Ticket, sobald das erste echte Modul
  Formulare mit mehreren Feldern hat. Bis dahin prüft der Datenprozess jede Eingabe (D188).
  _Preis:_ ein Text pro Konflikt-Grund von Hand. _Verworfen:_ geworfene Fehler (ein Modul kann sie
  versehentlich übergehen).
- **D252 `placeholder-alpha` bekommt eine echte Tabelle, die überall ausgeliefert wird (verfeinert
  D240).** Die Liste startet leer, der Befehl für den Beispiel-Eintrag legt echte Zeilen an, und
  der absichtlich fehlschlagende Eintrag wandert in eine Story mit fester Antwort. So prüft der
  Smoke-Test der gebauten App den Weg, den echte Module gehen. Die Tabelle entsteht in jeder
  Datenbank, die diese Version startet; vor dem Ersatz der Platzhalter kommt kein Stable-Release.
  Der Nightly-Takt ist am 2026-11-13 abgestellt (Repo-Variable `NIGHTLY_SCHEDULE_ENABLED`), von
  Hand lässt sich weiter eine Nightly bauen; damit startet die gepackte App nicht mehr automatisch.
  _Offen:_ Wie ein Modul samt Tabelle verschwindet, klärt die Schicht, die den Platzhalter
  ersetzt. _Preis:_ eine Migration mehr beim ersten Start, nicht gemessen. _Verworfen:_ die
  Datenseite des Platzhalters nur im Dev-Build (die gebaute App hätte kein Modul auf dem Port, und
  es bräuchte eine Weiche, die es sonst nicht gibt).
- **D253 #33 baut den Abfrage-Hook und den Operations-Hook; der Seiten-Hook entsteht in #137
  (verfeinert D194).** Der Abfrage-Hook deckt Fenster, kleine Menge und einzelne Zeile ab.
  Nachladen, Verwerfen früher Seiten und das Neuladen geladener Seiten hängen an der Liste, die
  nur Sichtbares zeichnet, und werden mit ihr entworfen und gemessen. `placeholder-alpha` nutzt
  eine kleine Menge. _Preis:_ #137 wird größer, und bis dahin zeigt keine Ansicht mehr als ein
  Fenster oder eine kleine Menge. _Verworfen:_ der Seiten-Hook jetzt (ein Hook ohne Nutzer wird
  nach Vermutung entworfen).
- **D254 Vier Begriffe kommen ins Glossar.** _Operation_ (de: Operation): ein Eintrag eines Ports,
  der Daten ändert, ganz oder gar nicht. _Query_ (de: Abfrage): ein Eintrag eines Ports, der liest
  und nichts ändert. _Table Change_ (de: Tabellenmeldung): die Nachricht des Datenprozesses,
  welche Tabellen ein Commit geändert hat. _Fixed Answer_ (de: feste Antwort): was ein
  Port-Eintrag in einer Story oder einem Komponenten-Test liefert, ohne Datenprozess. Beim
  _Command_ steht „operation“ künftig nur noch als zu vermeidendes Wort für einen Befehl; ein
  Befehl kann eine Operation aufrufen. „Hook“ und „Zwischenspeicher“ sind Wörter der Umsetzung
  und kommen nicht ins Glossar. Die Einträge entstehen beim Bau.
- **D255 Feste Antworten werden gegen Typ und Schema des Vertrags geprüft (verfeinert D196).** Der
  Helfer prüft jede feste Antwort beim Rendern gegen das Ausgabe-Schema; ein Konflikt darf nur
  einen Grund nennen, den der Vertragseintrag aufzählt. Ruft eine Ansicht einen Eintrag auf, für
  den nichts festgelegt ist, schlägt die Story fehl und nennt ihn. „Laden“ hält die Story, solange
  sie will. Das Schema wird nur im Story- und Test-Code geladen. _Preis:_ Stories brauchen
  vollständige, gültige Beispieldaten; ein Beispiel-Erzeuger pro Modul hilft. Die Stories-Stufe
  wird etwas langsamer, nicht gemessen. _Verworfen:_ nur der Typ (eine Id in falscher Form oder
  ein ungültiger Zeitpunkt rutschte durch, und die Story bewiese nichts).
- **D256 Der Zeichen-Test im Gate: eine geänderte Zeile zeichnet genau eine Zeile neu (verfeinert
  D194).** Aufbau: 1.000 Einträge, gezeichnet wie in `placeholder-alpha`, im Chromium der
  Stories-Stufe; ein Eintrag wird umbenannt, die Tabellenmeldung kommt, die Liste lädt neu.
  Grenze: genau eine Zeile zeichnet neu, dazu einmal die Liste selbst; die Zahl ist fest, kein
  Prozentwert. Dafür behalten unveränderte Zeilen nach dem Neuladen dasselbe Objekt, und eine
  Zeile ist eine eigene Komponente, die ihre Zeile als Ganzes bekommt; die Regel steht im
  Leitfaden. Der Test prüft Baustein und Vorlage, nicht jede Liste jedes Moduls; `pnpm renders`
  bleibt zum Nachmessen. _Preis:_ Der Vergleich von alter und neuer Antwort wächst mit ihrer
  Größe, bei 1.000 Zeilen um eine Millisekunde erwartet, nicht gemessen; der Bau misst es.
- **D257 Abfragen zeigen die vorhandenen Zustands-Bausteine.** Erstes Laden: `LoadingState`, erst
  nach 200 ms. Neuladen: der alte Stand bleibt, ohne Ladeanzeige. Unerwarteter Fehler beim ersten
  Laden: `ErrorState` mit „Erneut versuchen“, ohne Benachrichtigung. Scheitert ein Neuladen,
  während Daten da sind: Der alte Stand bleibt, und eine Benachrichtigung sagt, dass er veraltet
  sein kann. Ohne Datenprozess warten Abfragen auf die neue Verbindung; den Zustand zeigt die App
  schon. Ein gemeinsamer Baustein in `@self-engine/ui` ordnet Zustand und Anzeige zu.
- **D258 Die neue Start-Grenze ist die gemessene Größe plus 6 %, aufgerundet auf volle KiB
  (verfeinert D192).** Dieselbe Regel wie bei der heutigen Grenze (851.968 Bytes). Die Messung
  steht im Pull Request und in `docs/development/performance.md`; die Zeit bis zur ersten Antwort
  im Smoke-Test zeigt, ob der Start spürbar länger wird.
- **D259 #33 räumt zwei Reste aus #32 ab (löst das „Offen“ in D245).** Der Modulname kommt in die
  Blätter-Marke, damit gleichnamige Seiten-Listen zweier Module ihre Marken nicht mehr gegenseitig
  annehmen. `windowList` und `smallSetList` leiten ihren Eingabe-Typ aus dem Vertrag ab. _Nicht
  hier:_ der Läufer für Brücken über mehrere Module (kommt mit der ersten Brücke, D152); die
  Grenzen der Seiten-Liste bei Sortierspalten und Reihenfolge (#137).
- **D260 Ein Speicher-Modul wird in zwei Schritten definiert (verfeinert D259).**
  `defineStorageModule({ name, contract, rowMap, migrations, conflicts? }).entries({ … })`: Erst
  stehen Name, Vertrag, Zeilen-Karte und Migrationen fest, dann werden die Einträge geprüft. So
  leiten `pageList`, `windowList` und `smallSetList` `tx` und `input` aus dem Vertrag ab, auch eine
  Seiten-Liste mit erweiterter Eingabe (`pageInputSchema.extend({ q })`). In einem einzigen
  Objekt prüft TypeScript den Aufruf eines Bausteins, bevor es den Vertrag aus demselben Objekt
  abgeleitet hat; `input` war dort `unknown`, und `pageList` fiel nur auf `PageInput` zurück.
  _Preis:_ keiner zur Laufzeit; jede Moduldefinition bekommt einen zweiten Aufruf.
  _Verworfen:_ die Bausteine für Fenster und kleine Mengen streichen und die Einträge als
  Objekt schreiben (`pageList` bliebe ohne Ableitung); den Vertragseintrag an den Baustein geben
  (`tx` bliebe von Hand typisiert).
- **D261 Jeder Befehl bekommt den Port-Zugang in seinem Kontext (verfeinert D174, D249).** Ein
  Befehl ruft eine Operation auf, läuft aber außerhalb von React und kann keinen Hook nutzen. Darum
  trägt der Kontext jeder Art (`page`, `open`, `input`) das Feld `data`: denselben Port-Zugang, den
  die App dem `DataProvider` gibt, zusammen mit dessen Weg für Benachrichtigungen
  (`useDataAccess()` → `{ access, notify }`, D265); die Hülle reicht beides an jeden Start weiter,
  ein späterer Agent ebenso. Der Baustein bietet neben dem Operations-Hook dessen Form als Funktion
  (`portHooks(…).run(eintrag, behandlung)` → `(daten, eingabe) => Ergebnis`), aus demselben Vertrag
  typisiert, mit demselben Ergebnis und denselben Standard-Benachrichtigungen über denselben Weg;
  Hook und Funktion teilen sich den Code dafür. Stories und Tests geben feste Antworten in dasselbe Feld. Die Hülle
  typisiert das Feld über einen reinen Typ-Import von `data-client` (Kante in `ALLOWED_IMPORTS` und
  `package.json`). _Preis:_ ein Feld mehr im Befehls-Kontext; zur Laufzeit nichts. _Verworfen:_ ein
  globaler Zugang des zuletzt eingehängten Providers (zwei Provider auf einer Seite überschreiben
  sich, ein Befehl vor dem ersten Provider hätte nichts); Befehle rufen noch keine Operationen
  (D252 wäre nicht erfüllt, die Frage käme mit dem ersten echten Modul wieder); das Feld als
  `unknown` mit Prüfung zur Laufzeit.
- **D262 Die Gruppen von `placeholder-alpha` filtern nicht mehr (verfeinert D252).** Die Kunden
  „Studio“ und „Garten“ bleiben als Vorlage für eine Suche, die sich die Ansichten eines Moduls
  teilen (`sharedSearch`); eine Gruppe ändert nur die Adresse und markiert sich. Echte Einträge
  gehören keinem Kunden, also zeigt die Liste alle. _Preis:_ In der App sieht man nach einem Klick
  auf eine Gruppe keine andere Liste. _Verworfen:_ nach Namensanfang filtern (eine erfundene Regel
  über Daten); die Gruppen entfernen (kein Modul zeigte mehr Gruppen, die App-Stories dazu müssten
  in die Hülle wandern).

### Runde 34 (2026-11-13): Befunde der Code-Prüfung zu #33 (verfeinert D187, D196, D251, D257, D261)

- **D263 Die Web-App ohne Datenprozess zeigt den Zustand „Daten nicht erreichbar“ (verfeinert
  D196, D257).** Ohne Desktop-Brücke wird die Verbindung beim Start gestoppt; die Seite zeigt
  denselben Zustand wie die Desktop-App, wenn der Datenprozess nach mehreren Abstürzen steht,
  aber ohne „Erneut versuchen“ (im Browser kann nichts einen Datenprozess starten) und mit einem
  eigenen Satz, dass der Browser noch keinen Zugang zu den Daten hat. Der Port-Zugang der
  Web-App ist `NO_DATA_PROCESS`: Jeder Aufruf scheitert sofort, nichts wartet still dahinter.
  „Wie bisher“ in der Spezifikation war ein Irrtum: Auf `main` zeigte die Web-App nur die
  Einträge im Speicher, die #33 entfernt. _Preis:_ ein übersetzter Satz mehr; zur Laufzeit
  nichts. _Verworfen:_ ewig laden (Liste im Spinner, Speichern-Knopf und Befehl ohne Antwort);
  die App ohne Daten zeigen (jede Ansicht zeigte ihren Fehlerzustand, ohne zu sagen, warum).
- **D264 Ein Konfliktgrund ohne Feld sagt das ausdrücklich (verfeinert D251).** Die Typen
  verlangen weiter für jeden Grund Text und Feld; ein Modul darf `field: null` schreiben, wenn
  kein Feld den Konflikt zeigen kann (Rückgängig, ein Befehl ohne Formular). Dann zeigt der
  Baustein den Text selbst als Benachrichtigung, genau einmal, über denselben Weg wie seine
  anderen Benachrichtigungen; das Ergebnis trägt `field: null`. Ein weggelassenes Feld
  kompiliert nicht. _Verworfen:_ ein erfundenes Feld wie `id` und eine Kopie des
  Benachrichtigungs-Helfers im Modul (der Baustein ließe eine Lücke, die jedes Modul selbst
  stopft).
- **D265 Alle Benachrichtigungen des Bausteins gehen über eine Naht (verfeinert D261).** Der
  Befehls-Kontext trägt in `data` den Port-Zugang zusammen mit dem `notify` des `DataProvider`
  (`useDataAccess()` → `{ access, notify }`), und die Funktionsform einer Operation nimmt beides.
  So landen die Benachrichtigungen von Hook, Funktionsform, Neuladen und Konflikt ohne Feld an
  derselben Stelle, und eine Story oder ein Test, der den Zugang ersetzt, sammelt sie mit.
  _Verworfen:_ die Funktionsform ruft das Rückmelde-System direkt (Tests müssten `ui` ersetzen,
  eine Story sähe die Benachrichtigungen nicht).
- **D266 Zwischen Paketen gibt es keinen Kreis, auch nicht über devDependencies (verfeinert
  D187, ADR 0006).** `health` und der Strom der Tabellenmeldungen liegen im Paket
  `data-protocol`, das kein Modul kennt; `data-client`, Datenprozess und Desktop-Brücke nehmen
  sie von dort. Der Kern des Datenprozesses kennt keine Module mehr: Die Desktop-App gibt ihm
  ihre Modulliste (`apps/desktop/src/data-modules.ts`), geprüft gegen den App-Vertrag, den
  `contracts` weiter zusammensetzt. Ein Test über alle `package.json` schlägt bei jedem Kreis
  zwischen Paketen fehl; dependency-cruiser sieht nur Kreise zwischen Dateien. Ein Import nur
  für Tests steht immer in `TEST_ONLY_IMPORTS`. _Preis:_ ein Paket mehr. _Verworfen:_ die Tests
  über den echten Datenprozess aus `data-client` und dem Modul in ein höheres Paket verschieben
  (die Tests lägen weit weg von ihrem Code, und der Kreis über `contracts` bliebe).

### Runde 35 (2026-11-13): Wo Hinweise stehen (#230, ändert D79 und D169)

- **D267 Hinweise stehen oben in der Mitte, gestapelt, eine Lücke unter dem Kopf des Inhalts
  (ändert D79, D169).** Unten rechts lagen sie über Speichern und Abbrechen des Drawers und
  nahmen deren Klicks. Mantine stellt sie jetzt mit `position="top-center"` und
  `layout="stacked"` (Mantine 9.7.5): Nur der neueste Hinweis ist ganz zu sehen, die älteren
  liegen dahinter und fächern sich auf, solange der Zeiger darauf liegt. Der vorderste Hinweis
  bleibt 8 Sekunden; die dahinter warten, bis sie vorne sind (drei Hinweise stehen also bis zu
  24 Sekunden). Rückgängig bleibt im Hinweis; einen hinteren erreicht der Zeiger, wenn der Stapel
  aufgefächert ist. Eine Linie am unteren Rand füllt sich, bis der Hinweis schließt
  (`withAutoCloseProgress` an `Notifications`); sie fehlt bei Hinweisen ohne Ablauf wie dem
  Fortschritt und ist ausgeblendet, solange ein Hinweis wartet oder der Zeiger darauf liegt.
  Ein Hinweis beginnt auf jeder Layout-Stufe an derselben Stelle: eine Lücke
  (8 px) unter dem Kopf des Inhalts, bei 64 px, ob ein Drawer offen ist oder nicht, damit er nicht
  springt. Gemessen bei den Referenzbreiten: Der Kopf des Inhalts endet bei 56 px, Titel und
  Schließen-Knopf des Drawers bei 52 px (Telefon 44 px), sein erstes Feld beginnt bei 70 px
  (Telefon 62 px). Ohne Abstand (Mantines 16 px) lag der Hinweis über dem Titel des Drawers auf
  jeder Stufe und über Seitenleisten-Knopf oder Ansichtstitel; tiefer als 64 px deckte er nur mehr
  vom Feld. Ein mittiger Hinweis (440 px) überschneidet den schwebenden Drawer (460 px plus 8 px
  Rand), solange das Fenster schmaler als 1376 px ist, also bei allen Referenzbreiten:
  breit (1280) und mittel (1100) liegt er über dem linken Rand von Beschriftung und Feld, ein Klick
  ins Feld erreicht es noch; schmal (800), schmalste (576) und Telefon (390) liegt er über der
  Feldmitte. Das ist dort unvermeidbar, ohne Titel oder Schließen-Knopf zu verdecken. Stories
  prüfen bei jeder Stufe, hell und dunkel, dass Titel, Schließen, Löschen, Abbrechen und
  Speichern und ohne Drawer der Seitenleisten-Knopf und der Ansichtstitel den Klick bekommen,
  bei breit und mittel auch das Feld, und bei 1440 px, dass kein Hinweis das Feld berührt, auch
  aufgefächert. _Preis:_ eine CSS-Variable; im gestapelten Modus misst Mantine jeden Hinweis
  einmal (ResizeObserver), sonst nichts. _Verworfen:_ oben rechts unter dem Drawer-Kopf (lag
  bei jeder Stufe über dem ersten Feld und bei breiten Fenstern unnötig über dem Drawer); unten
  links (nicht gewählt); unten rechts mit Versatz nur bei offenem Drawer (der Hinweis spränge); ein
  Abstand je Stufe (eine Regel reicht, der Kopf des Inhalts steht überall gleich).

## Fakten

- Self-Engine hat Abo-Infrastruktur über Clerk Billing (`apps/web/src/features/billing`),
  der Self-Service-Checkout ist aber abgeschaltet (`SELF_SERVE_CHECKOUT_OPEN = false`).
  Kein Rechnungs-/Invoice-Modul. Payouts existieren (ADR 0016).

### Wiederverwendungs-Audit (Zusammenfassung)

- `packages/time` ist abhängigkeitsfrei mit 96 Zeitzonen-Tests → 1:1 übernehmbar.
- Wertvollste Domänenregeln mit Tests (grob gezählt): time-entry inkl. Overlaps/Split
  (337), time-tracker inkl. Rundung in `time-tracker.shared.ts` (212), payout (143),
  shared-time (91), core `workHelper` (279).
- Keine Clerk-/Infisical-Imports in `packages/*`. Kopplung liegt in: Row-Typen aus dem
  generierten `core/supabase.types.ts` (66 Imports), 28 `use-*-query.ts`-Hooks an
  `@tanstack/react-db`/PowerSync, Persistence Port (ADR 0023) als ein Monolith über alle
  5 Domänen. Prinzip übernehmen (Port injiziert, In-Memory-Fake, 84 Contract-Tests,
  Import-Grenz-Test), Form ändern: ein Port pro Modul.
- Zyklen: work↔finance (Time-Entry-Row trägt `paid`/`payout_id`, `project.employment.ts`
  legt Daueraufträge an, Payout importiert `WorkTimeEntry`), work↔calendar
  (`time-entry.executors.ts`, `calendar.mutations.ts`). Tags und Währungsschema liegen in
  `finance/`, werden aber überall genutzt → gehören in einen gemeinsamen Kern.
  Abrechnung wird im neuen Projekt eine Brücke statt Felder am Zeiteintrag.
- UI: Mantine durchgängig; Server-Funktionen nur in `apps/web/src/actions/*`; die
  eigentliche Bindung sind Datenhooks (473 Dateien in `features/` importieren
  `@self-engine/db`).
- Desktop lädt heute die gehostete Web-App per `loadURL`, kein lokales SQLite. Tray,
  Popover, Updater übernehmbar; Fenster- und Datenteil neu.

### Sync-Recherche (Zusammenfassung)

- Ranking: 1. **PowerSync** (Writes über eigene API → Server prüft/lehnt ab, Client rollt
  zurück; Sync Streams GA seit 2026-05-14, Filter pro Space; SQLite auf Web,
  Node/Electron, React Native; Service laut GitHub seit 2026-11-03 Apache-2.0, Website
  nannte noch FSL → vor Entscheidung erneut prüfen). 2. **LiveStore** (Event Sourcing,
  Store pro Space, E2E-freundlich; Beta v0.5, Server-Prüfung über `onPush` selbst bauen).
  3. **Jazz 2.0** (Rewrite im Alpha, beobachten).
- Ausgeschlossen: Zero (nicht für lange Offline-Phasen), Triplit (keine Releases seit
  07/2025), cr-sqlite (letztes Release 01/2024), SQLite Sync von sqlite.ai (Elastic
  License), Automerge/Yjs (Server kann Writes nicht ablehnen), Evolu (immer E2E → keine
  Server-Prüfung; Vorbild für persönliche Spaces).
- Risiken: Server-Prüfung und E2E schließen sich pro Space aus; Umstieg lokal → Sync ist bei
  PowerSync ein manueller Kopierschritt; Self-Hosting braucht Postgres + Service +
  Speicher + API (All-in-one-Image nötig); PowerSync-SDK für Tauri ist Alpha → Electron
  sicherer.
- Vorschlag für Plugins: generische `records`-Tabelle (JSON) + ein Sync Stream.
- Unverifiziert: Join-Regeln bei PowerSync, Event-Kompaktierung bei LiveStore, ob Jazz 2.0
  ohne Account lokal schreibt, Multi-Table-Shapes bei Electric.

### t3code: Release-Kanäle (geprüft 2026-11-08)

- Kanäle stable, nightly, preview; Dev-Build mit eigenem Protokoll-Schema (`t3code-dev`).
- Nightly-Version: `<basis>-nightly.<JJJJMMTT>.<Lauf>`, Tag `v…`, GitHub-Prerelease
  (`scripts/resolve-nightly-release.ts`).
- `release.yml`: Zeitplan-Trigger prüft, ob seit dem letzten Nightly Änderungen da sind
  (`check-nightly-release.cjs`); manueller Start mit Kanalwahl; Stable-Tags getrennt.
- **Stable baut den Commit des letzten veröffentlichten Nightlys**, „so stable only ever
  ships a build that nightly users have already run“.
- Eigene Concurrency-Gruppen für Nightly und Stable, nichts wird abgebrochen.

### Alte Self-Engine-Desktop-App (geprüft 2026-11-08)

- `apps/desktop/electron-builder.yml`: `appId: com.self-engine.desktop`,
  `productName: Self-Engine`, Updates über GitHub-Releases des alten Repos.
- Mobile-Schema der alten App: `lifemanager`.
- Folge: Während des Übergangs (D12) braucht die neue App eine andere App-ID, sonst
  überschreiben sich Installationen und Datenordner. Ein neues Stable namens „Self-Engine“
  würde auf dem Mac dieselbe `Self-Engine.app` belegen.
