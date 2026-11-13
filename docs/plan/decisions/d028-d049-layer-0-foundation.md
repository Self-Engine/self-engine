# Schicht 0: Repo-Fundament (D28–D49)

## Runde 10 (2026-11-07): Schicht 0, erste Entscheidungen

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

## Runde 11 (2026-11-08)

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
  manueller Start zusätzlich möglich. _Rhythmus überholt durch D110 (Runde 18)._

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
