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
