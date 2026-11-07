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
