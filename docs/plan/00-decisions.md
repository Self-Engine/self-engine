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
  das Muster für Speicher-Ports (ein Port pro Modul, In-Memory-Fake, Contract-Tests),
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
