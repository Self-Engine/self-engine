# Recherche: Agenten-Setup aus Self-Engine (L0.10, D27)

Stand: 2026-11-07 · Status: Audit fertig, Entscheidungen offen

Geprüft wurde der Self-Engine-Stand `e2cefbb47` (Worktree `t3-44718352`). Jedes Element
bekommt ein Urteil:

- **ADOPT**: so übernehmen.
- **ADAPT**: übernehmen, aber umbauen (wie, steht dabei).
- **DROP**: nicht übernehmen (Grund steht dabei).
- **LATER**: erst übernehmen, wenn der Anlass da ist (Mobile, Sync, Web-Auslieferung, Releases).

Maßstab: Electron zuerst (D17, D26), lokales SQLite (D11), kein Supabase/Clerk/Infisical/Vercel,
React + Mantine (D23), Vitest, DE + EN (D24), solo mit Agenten (D5), Toolchain noch offen (L0.1).

## Grundbefund

Das Setup ist in vier Monaten gewachsen (erste Agentenregeln 2026-06, Push-Guard 2026-10-09,
Verify-Slot 2026-10-12, Infisical 2026-11-01). Grob drei Schichten:

1. **Allgemeine Arbeitsregeln** (Gate vor „fertig“, Shell-Regeln, `.temp/`, Glossar + ADRs,
   PR-Titel): klein, wertvoll, fast alles übertragbar.
2. **Infrastruktur für parallele Worktrees auf einem geteilten Stack** (Verify-Slot,
   Schema-Claims, Seed-Personas, `dev:agent`, `verify:web`): Lösung für ein Problem, das
   das neue Repo ohne Server-DB nicht hat. Größter Block, fast alles DROP.
3. **Anbieter-Wissen** (Clerk-Skills, HeroUI-MCP, EAS, Supabase-Migrationen, Release-Deploy):
   DROP oder LATER.

Zwei Widersprüche im alten Setup, die man nicht mitkopieren sollte:

- `pr-convention` sagt „`feat` hebt die Minor-Version“, `release-please-config.json` setzt aber
  `versioning: always-bump-patch` (seit #182, 2026-07-08). Die Doku ist veraltet.
- ADR-Format uneinheitlich: von 51 ADRs haben 11 YAML-`status:`, 7 einen Abschnitt
  `## Status`, 33 gar keinen Status.

## 1. Root `AGENTS.md` (+ `CLAUDE.md` als Symlink)

`CLAUDE.md` ist ein Symlink auf `AGENTS.md`, damit Claude Code und Codex dieselbe Datei lesen.
33 Commits seit 2026-03; zuletzt Release-Deploy (#1407) und Infisical (#1358).

| Regel / Abschnitt | Was sie tut, warum | Urteil |
|---|---|---|
| Symlink `CLAUDE.md → AGENTS.md` | Eine Quelle für alle Agenten-Tools | **ADOPT** |
| Task Completion: `verify:agent` muss passen, Ergebnis aus `VERIFY: PASS/FAIL`-Zeile lesen | Ein Gate statt „Agent sagt fertig“; Pipe-Exitcodes logen | **ADAPT**: Regel ja, Befehlsname nach Toolchain-Wahl (L0.1). Hinweis auf Push-Hook erst, wenn der Hook existiert |
| Pull Requests: `pr-convention`-Skill Pflicht, Body mit globalem `pr`-Skill | Titel steuert Changelog/Version | **ADAPT**: Kurzregel direkt in AGENTS.md (Conventional-Commit-Titel, Englisch), Skill erst mit release-please (LATER) |
| „Always use Bun“ | Paketmanager fest | **ADAPT**: je nach L0.2 (Bun oder pnpm) eine Zeile |
| „Never `supabase db push`“ | Prod-DB nur über Release | **DROP** (kein Supabase). Allgemein: „nie gegen Produktion“ wird erst mit Sync-Server relevant (LATER) |
| Shell-Abschnitt (zsh: Globs quoten, 1-indizierte Arrays, kein `timeout`, ein git-Befehl pro Aufruf, kein `cd … &&`, Exitcode im selben Aufruf, an Subagenten weitergeben) | Echte Fehlerquellen der Bash-Tools unter macOS/zsh | **ADOPT** wörtlich |
| Test: Vitest, nie `bun test`; `test:agent` | Bun hat eigenen Test-Runner, der still andere Semantik hat | **ADAPT**: „nie `bun test`“ nur bei Bun; `--reporter=agent` (in Vitest eingebaut) übernehmen |
| Verifying in a Real App: nur auf Wunsch, über Skills; visuelle Änderung ohne App-Check im Bericht nennen | Spart Zeit/Kontext; ehrliche Berichte | **ADAPT**: Prinzip und Berichtspflicht ADOPT; Skills ersetzen durch einen Electron-Check (Playwright `_electron`), sobald die App-Hülle steht |
| Offline-Smokes als Gate | Service-Worker-Regressionen | **DROP**: Desktop lädt lokal, kein SW. Bei Web-Auslieferung neu bewerten (LATER) |
| Temporary Files in `.temp/` (gitignored) | Agenten verstreuen sonst Wegwerfdateien | **ADOPT** |
| Local Infra (geteilter Supabase + PowerSync-Stack) | Worktrees teilen eine DB | **DROP**: jede Instanz hat eigenes SQLite. Mit Sync-Server LATER neu schreiben |
| Secrets aus Infisical, nie Werte ausgeben | Keine `.env`-Dateien (ADR 0048) | **ADAPT**: nur die Regel „nie Secret-Werte ausgeben/loggen/schreiben, nur Namen“ übernehmen. Infisical DROP (Day 1 hat kein Secret) |
| Project Snapshot | Kontext für Agenten | **ADAPT**: neu schreiben (Electron, SQLite, Module) |
| „Sweeping changes erwünscht“ / Maintainability (Shared Logic extrahieren, keine Duplikate, keine lokalen Abkürzungen) | Gegen Copy-Paste der Agenten | **ADOPT**, ergänzt um Modulgrenzen (D10) und „von unten nach oben“ (Leitprinzip D23) |
| UI: Mantine (Web), HeroUI Native (Mobile), TanStack zuerst | Einheitliche Bausteine | **ADAPT**: Mantine ADOPT; HeroUI LATER (Mobile); „TanStack zuerst“ als Leitlinie ok, aber pro Bibliothek entscheiden |
| TanStack Pacer statt `setTimeout` | Einheitliches Timing | **LATER**: erst wenn Pacer tatsächlich installiert ist; als Regel ohne Abhängigkeit sinnlos |
| Package Roles | Wegweiser im Monorepo | **ADAPT**: neu nach Paketzuschnitt (Modul-Pakete, `time`, `core`, `testkit`, `desktop`) |
| Agent skills: Issue tracker, Triage labels, Domain docs (Verweise auf `docs/agents/*`) | Konfiguration für die globalen Matt-Pocock-Skills | **ADAPT**, siehe Abschnitt 5 |

## 2. Verschachtelte `AGENTS.md`

| Datei | Inhalt | Urteil |
|---|---|---|
| `apps/web/AGENTS.md` | Pure Tests im Node-Projekt ohne DOM; DOM-Tests in eigenes Projekt; Geschäftsregeln in `db`/`core`; Testkit-Builder statt lokaler Fixtures; keine Server-Secrets in `VITE_*` | **ADAPT**: die vier ersten Punkte gelten für den Renderer (`apps/desktop`) gleich. `VITE_*`-Regel: im Electron-Kontext umformulieren („nichts Geheimes in den Renderer-Bundle; Main/Preload trennen“) |
| `packages/db/AGENTS.md` | Domänenregeln im Paket; Unit-Tests deterministisch, ohne Netz/Docker/Secrets; Testkit nicht zurückimportieren (Zyklus); Integrationstests getrennt benennen | **ADAPT**: gilt je Modul-Paket. „Ohne Supabase/PowerSync“ wird „ohne echtes SQLite-File/Netz, außer `*.integration.test.ts`“ |
| `apps/mobile/AGENTS.md` | Expo-Regeln, kein `prebuild`/EAS, `EXPO_PUBLIC_*`, Codex-`build_and_run.sh` | **LATER** (Mobile). Codex-Hinweis ist Altlast aus 2026-06 |

Muster „kurze AGENTS.md pro Paket mit 3–6 harten Regeln“: **ADOPT**.

## 3. `.claude/`, `.codex/`, `.mcp.json`, `skills-lock.json`

| Element | Was / warum | Urteil |
|---|---|---|
| `.claude/settings.json`: PreToolUse-Hook auf Bash → `scripts/verify-agent-guard.ts` | Blockiert `git push` und `gh pr create`, wenn der letzte grüne `verify:agent` nicht exakt auf dem HEAD-Tree lief (#948, 2026-10-09). Grund: Agenten pushten ungeprüft | **ADAPT**: sehr wertvoll, aber erst mit echtem Gate. Script portabel machen (läuft heute über `bun`; bei pnpm `node --experimental-strip-types` o. ä.). Day 1 oder kurz danach |
| `scripts/lib/verify-stamp.ts` | Speichert Tree-Hash des grünen Laufs in `.cache/verify-agent-pass.json` (Scratch-Index, echter Index bleibt unberührt) | **ADOPT** mit dem Hook (klein, getestet) |
| `.claude/skills/*` | Nur Symlinks auf `.agents/skills/*` | **ADOPT** das Muster (eine Quelle, beide Tools) |
| `.codex/config.toml` + `.mcp.json` | Starten `@heroui/native-mcp` | **LATER** (Mobile) |
| `skills-lock.json` | Lock für 10 installierte Clerk-Skills (#873) | **DROP** (kein Clerk). Lock-Mechanismus selbst nur, wenn wieder Fremd-Skills ins Repo kommen |
| Agents, Commands | Gibt es in Self-Engine nicht (weder Repo noch `~/.claude`) | – |

## 4. Repo-Skills (`.agents/skills/`)

| Skill | Was / warum | Urteil |
|---|---|---|
| `clerk*` (10 Stück) | Anbieter-Doku für Clerk | **DROP** |
| `pr-convention` | PR-Titel als Conventional Commit, nutzerorientierte Formulierung, Scopes, `Release-As`, Englisch | **ADAPT** (LATER mit release-please): Widerspruch Minor/Patch beheben; Scopes neu (`desktop`, Modulnamen, `core`, `time`); „in-app What's new“ nur, wenn es das gibt. Der Abschnitt „Titel für Nutzer schreiben“ ist der wertvollste Teil |
| `testing` | Vitest-Projekte, Timezone-Tests, Testabhängigkeiten, Verify-Stufen, Offline-Smokes | **ADAPT**: übernehmen: „Prozess-TZ weit weg von Fixture-TZ“ (`Pacific/Chatham` vs. `Europe/Berlin`), `*.tz.test.ts` in zwei Zonen, Testkit-Clock statt Systemzeit-Stubs, „lastabhängig roter Test bleibt rot“. Weg: Supabase/pgTAP, Seeds, PGlite, Smokes. Erst schreiben, wenn es mehr als eine Seite Inhalt gibt; bis dahin reicht AGENTS.md |
| `verify-app` | `verify:web` mit Login, Seed-Accounts, Screenshots, iPad-Emulation, t3code-Preview | **DROP** in dieser Form. Ersatz LATER: `verify-desktop` (Electron per Playwright starten, Screenshot), sobald Schicht 1 (App-Hülle) steht |
| `verify-mobile` | iOS-Simulator über t3code Device-Panel | **LATER** (Mobile) |
| `local-infra` | Geteilter Supabase/PowerSync-Stack, Schema-Claims, Seeds | **DROP**. Mit Sync-Server neu (LATER) |
| `publish-ota` | EAS Update | **DROP** (Expo-spezifisch; bei Mobile neu prüfen) |

## 5. Globale Skills, auf die das Repo baut

Alle unter `~/.agents/skills` (Symlinks in `~/.claude/skills`), überwiegend Matt-Pococks
Engineering-Skills. Sie sind nicht Teil des Repos, lesen aber dessen `docs/agents/*`.

| Skill / Doku | Bezug | Urteil |
|---|---|---|
| `pr` (PR-Body) | von AGENTS.md und `pr-convention` referenziert | **ADOPT** (global, nichts zu tun) |
| `domain-modeling`, `grill-with-docs`, `improve-codebase-architecture`, `codebase-design` | lesen `GLOSSARY.md` + `docs/adr/` laut `docs/agents/domain.md` | **ADOPT**: genau das Werkzeug für D25-Vertiefungen |
| `triage`, `wayfinder`, `to-tickets`, `implement` | lesen `docs/agents/issue-tracker.md` und `triage-labels.md` | **ADAPT**: nützlich, sobald Arbeit in Issues läuft. Labels im neuen Repo anlegen |
| `writing-for-agents` | Stil für AGENTS.md/Skills | **ADOPT** beim Schreiben der neuen AGENTS.md |
| `research`, `grilling`, `prototype`, `tdd`, `diagnosing-bugs`, `code-review` | allgemein | **ADOPT** (global, bereits im Einsatz für `docs/plan/`) |
| `setup-matt-pocock-skills` | erzeugt die `docs/agents/*`-Dateien | **ADOPT**: im neuen Repo einmal laufen lassen statt kopieren |

## 6. `docs/agents/*`

| Datei | Was / warum | Urteil |
|---|---|---|
| `domain.md` | Single-Context: ein `GLOSSARY.md` + `docs/adr/`; Begriffe aus dem Glossar nutzen; ADR-Konflikte offen benennen; ADR-Nummern nie doppelt (`adrs:check`) | **ADAPT**: Repo-Name und Ordnerbaum anpassen; Rest ADOPT. Single-Context passt (D20: fokussierte App) |
| `issue-tracker.md` | `gh`-Befehle, PRs nicht als Anfragekanal, Wayfinder-Operationen | **ADAPT**: Repo `GwydionBr/self-engine-next`. „PRs als Anfragekanal: no“ beim Öffentlichwerden neu entscheiden (OSS, D2) |
| `triage-labels.md` | fünf kanonische Labels + `agent:*`, `area:*`, `size:*`, `risk:high` | **ADAPT**: fünf kanonische ADOPT; `area:*` auf Module umstellen; `agent:*`/`size:*`/`risk:*` erst bei Bedarf |
| `migrations.md` | Supabase-Migrationen, Payout-Rehearsal, Release-Deploy, Expand/Contract | **DROP** bis auf ein Prinzip: **Migrationen nur vorwärts; Entwürfe auf dem Branch editieren statt Patch-Migration; nach `main` nie mehr ändern**. Das wird mit SQLite-Migrationen (D22) in Schicht 2 relevant. Expand/Contract wird mit Sync (alte Clients) wieder Pflicht (LATER) |

## 7. `GLOSSARY.md` und `docs/adr/`

| Element | Was / warum | Urteil |
|---|---|---|
| `GLOSSARY.md` (710 Zeilen, 34 Commits) | Begriffe mit Definition, `_Avoid_:`-Synonymen und deutschem Begriff (`de:`) | **ADAPT**: Format ADOPT (Begriff, Definition, `_Avoid_`, `de:` passt zu D24). Inhalt nicht kopieren, sondern Begriff für Begriff übernehmen, wenn das Modul gebaut wird. Zeit-Begriffe (Account timezone, Instant, Calendar day, Wall-clock time, Day span) gleich mit `packages/time` übernehmen |
| ADR-Namensschema `NNNN-kebab-satz.md`, Titel als Entscheidungssatz | Dateiname sagt die Entscheidung | **ADOPT** |
| `scripts/check-adrs.ts` (+ Test) | Nummern eindeutig, Name passt; Teil von `check:static` | **ADOPT** (43 Zeilen, toolneutral) |
| ADR-Status | uneinheitlich (s. o.) | **ADAPT**: ein Format festlegen (Vorschlag: YAML `status:`), `check-adrs` prüft es mit |
| `docs/research/*` | Recherche-Ergebnisse als Markdown | **ADOPT** (im neuen Repo bisher `docs/plan/research-*.md`; Ort festlegen) |

ADRs, deren **Prinzip** übertragbar ist (Inhalt neu schreiben, nicht kopieren):

| ADR | Prinzip | Wann |
|---|---|---|
| 0046 Account timezone, Calendar days sind nie Instants | Ein Zeitmodul, einzige Stelle mit TZ-Logik; Lint verbietet Geräte-TZ | Schicht 3 (mit `packages/time`) |
| 0023 Persistence Port | Domänenlogik nur über injizierten Port; In-Memory-Fake; Contract-Suite über alle Adapter; Executors geben Konflikte als Ergebnis zurück statt zu fragen | Schicht 2 (Form: ein Port pro Modul, D11) |
| 0006 Ein Diagnosekanal | Ein plattformneutraler Logger, Sink austauschbar; kein verschlucktes Error | Schicht 1/2 |
| 0044 Eine i18n-Mechanik | Genau ein i18n-Weg für die ganze App | Schicht 1 (D24) |
| 0003 Synced vs. device-local preference | Einstellungen in zwei Klassen trennen | Schicht 1 (Sidebar-Breite etc.) |
| 0012 Overlaps explizit, nicht destruktiv | Konflikte zeigen statt still auflösen | Schicht 4 |
| 0016 Payouts über einen Cashflow / 0047 Saldo = Eröffnung + Buchungen | Fachregeln Finanzen | mit Finanzmodul |
| 0029 Agenten dürfen in den Papierkorb, nie löschen / 0037 Rechte pro Akteur | Schutz vor KI-Aktionen | mit KI-Assistent |
| 0030 Seeds aus TypeScript-Personas | Testdaten als Code, deterministisch | Schicht 4/5 (Import-Tests) |
| 0048 Secrets nie in Env-Dateien | Prinzip ja, Infisical nein | wenn Secrets entstehen |

Alles andere (Clerk-OAuth, Vercel, PowerSync-Deploy, iCloud-CalDAV, Sidebar-Details) ist
Self-Engine-spezifisch.

## 8. Verify-Pipeline und Hilfsskripte

| Element | Was / warum | Urteil |
|---|---|---|
| `verify:agent` (`scripts/verify-agent.ts`, 176 Z.) | Erst `format`, dann alle `check:static`-Stufen (laufen alle durch, auch nach Fehler), Tests nur wenn statisch grün. Eine Zeile pro Stufe, Tail der fehlerhaften, `VERIFY: PASS/FAIL <stufen>`, Volllog in `.cache/verify-agent.log`. Schreibt Stamp | **ADAPT**: Kern (Stufen-Liste aus `check:static`, kompakte Ausgabe, Schlusszeile, Log, Stamp) ADOPT. Weglassen: Worktree-übergreifender Slot-Lock, Niceness, Signal-Prozessgruppen, `ensureDependencies`. Ziel: ~60 Zeilen. Falls Vite+ (`vp`) gewählt wird: prüfen, ob dessen Task-Runner die Stufen schon liefert und nur Ausgabe + Stamp dazukommen |
| Verify-Slot über Worktrees (`worktree-lock.ts`, #1019) | Mehrere Gates gleichzeitig trieben die Maschine in Swap | **LATER**: erst bei spürbarem Problem. Kleines Repo = schnelles Gate |
| `check:static`-Stufen: `brand:check`, `seeds:check`, `migrations:check`, `db:catalogs:check`, `i18n:check`, `adrs:check`, `desktop:bundle:check`, `lint`, `lint:time`, `typecheck`, `format:check`, `knip` | Generierte Artefakte aktuell, Code sauber | **ADAPT**: Day 1 nur `lint`, `typecheck`, `format:check`, `adrs:check`, `test`. Später: `i18n:check` (Schicht 1), `lint:time` (Schicht 3), `migrations:check` (Schicht 2), `knip` (sobald es Exporte gibt; sehr wirksam gegen toten Agentencode) |
| `test:agent` = `vitest run --reporter=agent` | Kompakte, fehlerfokussierte Ausgabe (eingebaut in Vitest) | **ADOPT** |
| Vitest-Prozess-TZ `Pacific/Chatham` + `tz-*`-Projekte (`vitest.process-timezone.ts`) | Fängt Geräte-TZ-Lecks | **ADOPT** mit `packages/time` (Schicht 3); die feste Prozess-TZ schon Day 1 |
| `maxWorkers: 50%` lokal | gemessen schneller | **LATER** (Tuning) |
| `dev:agent`, `verify:web`, `verify-web-scenarios/*`, `headless-browser`, `signed-in-web-session`, `clerk-test-sign-in` | Agent startet Web-Server + Stack idempotent, loggt sich ein, macht Screenshots | **DROP**. Ersatz LATER: ein `verify:desktop` mit Playwright-Electron, ohne Login |
| `smoke:offline*` + `offline-smoke*`, `production-web*` | Service-Worker-Offline-Gate | **DROP** (LATER bei Web-Auslieferung) |
| `infra.ts`, `shared-db.ts`, `supabase-stack.ts`, `with-secrets.ts`, `secrets.ts`, `local-env.ts`, `ensure-seed-accounts.ts`, `reseed-account.ts`, `test-db-integration.ts`, `verify-payout-upgrade.ts`, `check-migrations.ts`, `db-types.ts`, `powersync-deploy.ts`, `supabase-migrate.ts` | Supabase/PowerSync/Infisical-Betrieb | **DROP** |
| `prune-worktrees.ts` | Gemergte Worktrees aufräumen | **LATER** (nett, nicht nötig) |
| `vercel-promote.ts`, `release-deploy.ts`, `legal-*`, `public-site-*`, `generate-brand-assets.ts`, `gen-currency-names.ts` | Vercel, Rechtstexte, Website, Brand | **DROP** (Brand-Generator ggf. LATER) |
| Tests für jedes Skript (`scripts-unit`-Projekt) + `typecheck:scripts` | Agenten-Tooling ist selbst getestet | **ADOPT** als Regel |

## 9. Lint-Regeln, die für Agenten existieren

| Regel | Was / warum | Urteil |
|---|---|---|
| Lint-Warnungen brechen das Gate (`--deny-warnings`) | Agenten ignorieren Warnungen sonst | **ADOPT** |
| `self-engine/no-silent-catch` (#990) | Leerer `catch` muss loggen, werfen oder begründen | **ADOPT** (Plugin ist oxlint- und ESLint-kompatibel; Text ohne Sentry-Verweis) |
| `self-engine/no-inline-language-pair` (#1308) | Verbietet inline `"Deutsch"/"English"`-Paare; alles über i18n | **ADOPT** mit der i18n-Wahl in Schicht 1 (D24) |
| Time-Regeln `no-device-timezone`, `no-local-date-accessors`, `no-date-fns-day-boundaries`, `no-iso-string-slicing`, `no-date-only-parsing` (`.oxlintrc.time.json`, #1252) | TZ-Logik nur im Zeitmodul; keine Inline-Ausnahmen | **ADOPT** mit `packages/time` (Schicht 3). Wichtigste Einzelübernahme nach dem Gate |
| `no-restricted-imports` für `date-fns`-Root | Testlaufzeit | **LATER** (nur wenn `date-fns` kommt) |
| Web: `zodResolver`, Mantine `Tooltip`, `ModalsProvider`, `Heatmap` gesperrt | Konkrete Fallen der alten UI | **ADAPT** als Muster („Falle gefunden → Import sperren mit Begründung“), Inhalte erst bei gleicher Falle |
| Web: Features nur über Barrel importieren (`@/features/*/**` gesperrt) | Modulgrenzen im UI | **ADAPT** → Teil von L0.5 (Modulgrenzen, D10); dort mit Paketgrenzen oder dependency-cruiser lösen |
| `no-console` (nur `error`/`warn` verboten) | Ein Diagnosekanal | **ADOPT** mit Logger (ADR 0006-Prinzip) |
| `knip` | Tote Dateien, Exporte, Abhängigkeiten | **ADOPT** ab dem ersten Paket mit Exporten |

## 10. PR-Konvention, CI, Releases

| Element | Was / warum | Urteil |
|---|---|---|
| Squash-Merge, PR-Titel = Commit auf `main` | Saubere Historie, Changelog-Quelle | **ADOPT** |
| `pr-title`-Workflow (`amannn/action-semantic-pull-request`, Kleinbuchstabe, kein Punkt) | Erzwingt Titel | **ADOPT** (auf GitHub Actions statt Depot). Achtung: läuft mit `pull_request_target`; im öffentlichen Repo nur Titel lesen, nie Code auschecken |
| release-please (`node`, `always-bump-patch`, Changelog-Sektionen, `extra-files` für Expo-Version) | Versionen + Changelog aus PR-Titeln | **LATER**: erst bei erstem Release. Dann `always-bump-patch` bewusst entscheiden; Expo-`extra-files` DROP |
| CI `quality` auf Depot (Stufen einzeln, kein Dependency-Cache, Turbo-Remote-Cache) | Kosten vor Tempo | **ADAPT**: GitHub Actions (öffentliches Repo = kostenlose Runner), eine Stufe pro Schritt ADOPT. Depot/Turbo-Cache DROP, bis es weh tut |
| `release-deploy.yml`, ADR 0050/0051 | Migrationen → Sync-Config → Vercel | **DROP** |
| `desktop-release.yml` | Electron-Build + Updater | **LATER** (L0.6), als Vorlage lesen |
| Dependabot (wöchentlich, gruppiert, kein Auto-Rebase) + `docs/dependency-updates.md` | Updates ohne PR-Flut | **ADAPT**: Grundform ADOPT, Expo-Ausnahmen weg. Alternative Renovate prüfen (L0.9) |

## Vorschlag: minimales Setup für Tag 1

Ziel: wenige, harte Regeln und ein echtes Gate. Alles andere wächst mit den Schichten.

1. **`AGENTS.md`** (+ Symlink `CLAUDE.md`), max. ~60 Zeilen, Englisch (D24), geschrieben mit
   `writing-for-agents`:
   - Task Completion: Gate-Befehl muss mit `VERIFY: PASS` enden.
   - Shell-Abschnitt wörtlich aus Self-Engine.
   - Tests: Vitest, `--reporter=agent`; Unit-Tests deterministisch, ohne Netz.
   - `.temp/` für Wegwerfdateien.
   - Nie Secret-Werte ausgeben.
   - Maintainability + Modulgrenzen (D10) + „von unten nach oben“ (D23).
   - App-Check nur auf Wunsch; ungeprüfte visuelle Änderung im Bericht nennen.
   - PR-Titel: Conventional Commit, Englisch, für Nutzer formuliert.
   - Project Snapshot + Package Roles (neu).
   - Verweis auf `docs/agents/domain.md` und `issue-tracker.md`.
2. **Gate-Skript** `verify:agent` (schlank): `format` → `lint` (Warnungen = Fehler) →
   `typecheck` → `format:check` → `adrs:check` → Tests; kompakte Ausgabe, Log in `.cache/`,
   Stamp. Bei Vite+ auf dessen Task-Runner aufsetzen.
3. **Push-Guard-Hook** in `.claude/settings.json` mit `verify-agent-guard.ts` +
   `verify-stamp.ts` (beide mit Tests übernehmen, Laufzeit an L0.2 anpassen).
4. **`docs/agents/`** per `setup-matt-pocock-skills` neu erzeugen: `domain.md`,
   `issue-tracker.md`, `triage-labels.md` (fünf kanonische Labels).
5. **`GLOSSARY.md`** leer mit Format-Kopf; **`docs/adr/`** mit einheitlichem Status-Format
   und `check-adrs.ts`. Erste ADRs: die bereits gefallenen Entscheidungen D17, D18, D22, D23
   (aus `00-decisions.md` destilliert).
6. **Lint-Plugin** mit `no-silent-catch`; Vitest-Prozess-TZ fest auf eine ferne Zone.
7. **CI**: ein `quality`-Job auf GitHub Actions + `pr-title`-Workflow.

Bewusst **nicht** Tag 1: release-please, `pr-convention`-Skill, `testing`-Skill, Time-Lint
(kommt mit `packages/time`), `no-inline-language-pair` (kommt mit i18n), `knip` (sobald es
Exporte gibt), Verify-Slot, App-Check-Skill (kommt mit App-Hülle), alles Mobile/Sync.

## Zu entscheiden mit dem Owner

1. **Gate-Name und Laufzeit:** `verify:agent` beibehalten (Muskelgedächtnis der Agenten) oder
   `vp`-Task? Hängt an L0.1/L0.2. Läuft der Push-Guard unter Bun oder Node?
2. **Push-Guard ab Tag 1?** Er erzwingt „commit → verify → commit Format-Änderungen“. Für
   Solo-Arbeit direkt auf `main` (ohne PRs) wäre er zu streng oder müsste anders greifen.
   Arbeitet das neue Repo von Anfang an mit PRs?
3. **ADR-Status-Format:** YAML-Frontmatter `status:` (Vorschlag) oder `## Status`? Werden die
   D-Entscheidungen aus `00-decisions.md` in ADRs überführt, und ab wann ist das
   Entscheidungslog nur noch Historie?
4. **Sprache der Agenten-Doku:** D24 sagt „Doku Englisch“; `docs/plan/` ist Deutsch. Bleibt
   `docs/plan/` Deutsch und alles für Agenten (AGENTS.md, Skills, ADRs, Glossar) Englisch?
5. **Versionierung später:** `always-bump-patch` wie in Self-Engine oder echtes SemVer
   (`feat` = Minor)? Und: release-please oder Changesets (L0.9)?
6. **Issue-Workflow:** Ab wann Issues + Triage-Labels statt `docs/plan/`? Externe PRs als
   Anfragekanal, wenn das Repo öffentlich wird?
7. **`.agents/skills` + Symlinks** für Codex-Kompatibilität beibehalten, oder nur
   `.claude/skills`? (Self-Engine nutzt beide Tools; im neuen Repo bisher nur Claude Code?)
8. **App-Check für Electron:** eigener `verify-desktop`-Skill mit Playwright-Electron in
   Schicht 1, oder reicht der globale `run`-Skill?
