# Fakten

Befunde aus Recherche und Audits, auf die sich Entscheidungen stützen. Keine Entscheidungen.

## Referenzprojekt t3code (geprüft 2026-11-07)

`pingdotgg/t3code` (MIT) nutzt: pnpm 12, Node 26, Vite+ 1.4 (`vite` per Catalog auf
`@voidzero-dev/vite-plus-core` umgeleitet), `vp run` mit Cache und selbst gehostetem
Remote-Cache, `vp lint`/`vp fmt`, knip, ein eigenes Oxlint-Plugin, Electron 44 +
electron-builder + electron-updater. **Kein electron-vite:** Main und Preload werden mit
`vp pack` (tsdown) als CJS gebaut, der Renderer ist die Web-App (`apps/web`), gebaut mit
Vite. Damit ist ein funktionierender Weg für Electron unter Vite+ belegt.

## Alte App: Abrechnung

- Self-Engine hat Abo-Infrastruktur über Clerk Billing (`apps/web/src/features/billing`),
  der Self-Service-Checkout ist aber abgeschaltet (`SELF_SERVE_CHECKOUT_OPEN = false`).
  Kein Rechnungs-/Invoice-Modul. Payouts existieren (ADR 0016).

## Wiederverwendungs-Audit (Zusammenfassung)

- `packages/time` ist abhängigkeitsfrei mit 96 Zeitzonen-Tests → 1:1 übernehmbar. _Überholt:_ Die
  unabhängige Prüfung fand später drei Fehler
  ([`research-layer-3-core.md`](research-layer-3-core.md), Abschnitt 5a).
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

## Sync-Recherche (Zusammenfassung)

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

## t3code: Release-Kanäle (geprüft 2026-11-08)

- Kanäle stable, nightly, preview; Dev-Build mit eigenem Protokoll-Schema (`t3code-dev`).
- Nightly-Version: `<basis>-nightly.<JJJJMMTT>.<Lauf>`, Tag `v…`, GitHub-Prerelease
  (`scripts/resolve-nightly-release.ts`).
- `release.yml`: Zeitplan-Trigger prüft, ob seit dem letzten Nightly Änderungen da sind
  (`check-nightly-release.cjs`); manueller Start mit Kanalwahl; Stable-Tags getrennt.
- **Stable baut den Commit des letzten veröffentlichten Nightlys**, „so stable only ever
  ships a build that nightly users have already run“.
- Eigene Concurrency-Gruppen für Nightly und Stable, nichts wird abgebrochen.

## Alte Self-Engine-Desktop-App (geprüft 2026-11-08)

- `apps/desktop/electron-builder.yml`: `appId: com.self-engine.desktop`,
  `productName: Self-Engine`, Updates über GitHub-Releases des alten Repos.
- Mobile-Schema der alten App: `lifemanager`.
- Folge: Während des Übergangs (D12) braucht die neue App eine andere App-ID, sonst
  überschreiben sich Installationen und Datenordner. Ein neues Stable namens „Self-Engine“
  würde auf dem Mac dieselbe `Self-Engine.app` belegen.
