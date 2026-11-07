# Recherche: Schicht 0 – Werkzeuge (L0.1–L0.9)

Stand: 2026-11-07 · Status: Recherche abgeschlossen, Entscheidungen offen

Bezug: [`03-layer-0-foundation.md`](03-layer-0-foundation.md), [`00-decisions.md`](00-decisions.md)
(D10 feste Modulgrenzen, D25 Einzelentscheidungen, D26 Desktop zuerst).

Legende: **[verifiziert]** = in offizieller Doku, Release-Notes, npm-Registry oder Quellcode
nachgelesen · **[sekundär]** = nur über Fachpresse/Dritte · **[nicht verifiziert]** = plausibel,
aber ohne Primärquelle.

---

## Kurzfassung

1. **Vite+ ist seit 2026-09-28 stabil (1.0), heute 1.5.0, MIT-lizenziert.** Es ist eine dünne
   Klammer um Werkzeuge, die wir sowieso wählen würden (Vite 8, Vitest 5, Oxlint, Oxfmt,
   Rolldown, tsdown, Vite Task). Der Ausstieg ist deshalb billig. **[verifiziert]**
2. **Electron baut nicht über `vp build`.** Electron-Build bleibt bei electron-vite oder Electron
   Forge. Diese laufen auf dem `vite`-Paket, das Vite+ durch einen Alias ersetzt. Das ist nicht
   offiziell dokumentiert und braucht einen kurzen Spike.
3. **pnpm statt Bun.** pnpm ist der Standard von Vite+, isoliert Abhängigkeiten streng (hilft bei
   Modulgrenzen) und ist bei Electron-Paketierung besser getragen. Bun funktioniert, hat aber bei
   Electron Forge keinen offiziellen Support und hatte 2025/26 Regressionen in electron-builder.
4. **electron-vite 6 + electron-builder 26** statt Forge: Forge 8 verlangt bei pnpm
   `node-linker=hoisted` und gibt damit die strenge Isolation auf.
5. **Modulgrenzen: mehrere Schichten** – Workspace-Paket pro Modul + strenges pnpm +
   `exports`-Feld + dependency-cruiser in CI. Oxlint hat (noch) keine Pfad-Zonen-Regel.
6. **Größte Lücke von Vite+ heute:** kein Remote-Cache (für Q4 2026 geplant), und Vitest-/
   TypeScript-Tasks werden noch nicht gecacht.

---

## L0.1 Toolchain: Vite+ gesamt vs. Einzelwerkzeuge

### Was Vite+ heute enthält [verifiziert]

| Befehl | Werkzeug darunter | Zweck |
|---|---|---|
| `vp dev`, `vp build`, `vp preview` | Vite 8 (Rolldown) | Dev-Server, App-Build |
| `vp test` | Vitest 5.1 | Tests (auch Browser-Modus) |
| `vp lint` | Oxlint 1.91 + tsgolint | Lint, optional typbewusst |
| `vp fmt` | Oxfmt 0.76 | Formatierung |
| `vp check` | Oxfmt + Oxlint + tsgolint | Format, Lint und Typprüfung in einem Lauf |
| `vp run` | Vite Task | Task-Runner über Workspaces mit lokalem Cache |
| `vp pack` | tsdown | Bibliotheken und Einzel-Artefakte bündeln |
| `vp install/add/remove` | erkannter Paketmanager | Paketverwaltung (pnpm, npm, Yarn, Bun) |
| `vp env` | – | verwaltet globale Node.js-Version und Paketmanager (abschaltbar: `vp env off`) |
| `vp staged`, `vp hooks` | – | Git-Hooks und Staged-Lint |

Versionen in `vite-plus@1.5.0` (npm, 2026-11-04): Vitest 5.1.0, Oxlint 1.91.0, Oxfmt 0.76.0,
oxlint-tsgolint 7.0.2005. `vite` wird als Alias auf `@voidzero-dev/vite-plus-core@1.5.0`
installiert (bündelt Vite 8.3.x).

Noch **nicht** enthalten: Remote-Cache, `vp release`, `vp docs`, JS-API über Lint/Format hinaus
(alles im Q4-2026-Plan, Issue #3277).

### Lizenz, Preis, Eigentümer [verifiziert]

- **MIT.** Ursprünglich (Ankündigung Okt. 2025) war eine kostenpflichtige Lizenz für Firmen
  geplant. Mit der Alpha (2026-03-13) hat VoidZero das verworfen: komplett frei und Open Source.
- **Kein Preis.** Geschäftsmodell ist „Void“ (Deployment-Plattform), nicht Vite+.
- **VoidZero gehört seit ca. Mai/Juni 2026 zu Cloudflare.** Cloudflare sagt zu: Vite, Vitest,
  Rolldown, Oxc und Vite+ bleiben Open Source und anbieterneutral. Genaues Datum der Übernahme
  nicht gefunden (Cloudflare-Post vom 2026-09-28 spricht von „vier Monaten“).

### Stabilität [verifiziert]

- 0.1.0: 2026-03-06 · Beta: Aug. 2026 · **1.0.0: 2026-09-28** · 1.5.0: 2026-11-04.
- Rhythmus: etwa ein Minor pro Woche. VoidZero nennt 1.0 selbst „Stabilitätsmeilenstein, kein
  fertiges Produkt“ [sekundär, InfoQ].
- Laut InfoQ fast 2 Mio. Downloads pro Woche [sekundär].
- Bekannte Reibung: Paketmanager prüfen Peer-Abhängigkeiten gegen die Alias-Version (1.5.0) statt
  gegen Vite 8. Strenges pnpm (`strictPeerDependencies`) braucht deshalb Ausnahmen (Issue #2806,
  offen; Q4-Plan: Core-Version auf 8 heben).
- Node-Anforderung: `^22.18.0 || ^24.11.0 || >=26.0.0`.

### Electron-Kompatibilität

- Vite+ erwähnt Electron nirgends. Kein Electron-Issue im Repo. **[verifiziert: Fehlanzeige]**
- `vp dev/build` bauen eine Web-App. Für Main/Preload/Renderer braucht es electron-vite oder den
  Vite-Plugin von Forge. Beide hängen von `vite` ab (electron-vite: Peer `^6 || ^7 || ^8`).
- Mit Vite+ bekommen sie den Alias `vite-plus-core`. Das sollte laufen (gleicher Vite-Kern),
  ist aber **nicht verifiziert**. → Spike S1.
- Positives Signal: Electron Forge 8 erzeugt neue Projekte bereits mit Oxlint und Oxfmt.

### Bun-Kompatibilität [verifiziert]

- Bun als **Paketmanager**: unterstützt (Erkennung über `bun.lock`/`bunfig.toml`).
  Einzelne `vp pm`-Befehle fallen bei Bun auf npm zurück. Ein offenes Issue (2026-11-07) zu
  `vp migrate` mit Bun-Catalogs.
- Bun als **Runtime**: nicht vorgesehen. Vite+ verwaltet Node.js.

### Optionen

| Option | Vorteil | Nachteil |
|---|---|---|
| **A: Vite+ als Eingangstür** (`vp check/test/run`), Electron-Build über electron-vite | ein Befehl, eine Config (`vite.config.ts`), Agenten lernen nur `vp` | jung; Alias-Reibung; kein Remote-Cache |
| **B: Einzelwerkzeuge** (Vite 8, Vitest 5, Oxlint, Oxfmt, Turborepo) | jedes Werkzeug unabhängig aktualisierbar, kein Alias | mehr Configs, mehr Glue-Skripte |

### Empfehlung

**Option A**, mit B als geplantem Rückfallweg. Unter Vite+ liegen genau die Werkzeuge aus B.
Fällt Vite+ weg, ersetzt man `vp lint` durch `oxlint`, `vp test` durch `vitest` usw. Das hält das
Risiko klein. Bedingung: Spike S1 (electron-vite unter Vite+) ist grün.

---

## L0.2 Paketmanager und Runtime: Bun vs. pnpm vs. npm

### Stand [verifiziert]

| | Version | Bemerkung |
|---|---|---|
| pnpm | 12.18.0 (2026-11-05); 12.0.0 am 2026-08-26; 11 noch gepflegt | Standard von Vite+ (Fallback ohne Lockfile); isolierte `node_modules` |
| Bun | 1.4.4 (2026-10-22) | seit Dez. 2025 Teil von Anthropic, bleibt MIT; isolierte Installs Standard für neue Workspaces |
| npm | mit Node | flach; keine strenge Isolation |

### Electron und native Module (better-sqlite3)

- better-sqlite3 13.0.3 (2026-08-05), Node ≥ 22. Electron 45.2.3 (2026-11-05) bringt Node 24.22.
- Native Module müssen gegen die Electron-ABI gebaut werden (`@electron/rebuild`, in
  electron-builder als `install-app-deps`; electron-builder 26.18 nutzt `@electron/rebuild` 4.2.1).
- **Bun** führt Lifecycle-Skripte nur für `trustedDependencies` aus. better-sqlite3 und electron
  müssen dort stehen. electron-builder hatte 2025/26 mehrere Bun-Bugs (falsch gesammelte
  Abhängigkeiten, Issues #9434, #9490, #9494, #9641 – inzwischen geschlossen).
- **Electron Forge 8** kennt Bun nicht als Paketmanager. Für pnpm verlangt Forge
  `node-linker=hoisted` (Quellcode `check-system.js` in 8.0.1).
- **electron-builder** unterstützt pnpm mit isolierten Installs; laufende Fixes (26.18.0).

### Expo später [verifiziert]

- Expo SDK 58 (aktuell in der Doku) unterstützt Monorepos mit Bun, pnpm, npm, Yarn.
- Isolierte Installs ab SDK 54 unterstützt. Manche React-Native-Bibliotheken brauchen trotzdem
  `nodeLinker: hoisted` (gilt bei pnpm für den ganzen Workspace).

### Optionen und Abwägung

- **pnpm:** strenge Isolation erzwingt deklarierte Abhängigkeiten (Baustein für L0.5); erste Wahl
  von Vite+; gut getragen von electron-builder; Expo offiziell.
- **Bun:** schnell, bekannt aus Self-Engine, Turborepo-stabil. Aber: Forge offiziell ohne Bun,
  Bun-Pfad in electron-builder weniger erprobt, Runtime-Vorteil fällt mit Vite+ weg (Vite+ nutzt
  Node).
- **npm:** keine Isolation; kein Grund.

### Empfehlung

**pnpm 12 + Node 24** (gleiche Major-Version wie Electron 45 im Main-Prozess). Node über `vp env`
oder `.node-version` festnageln. Bun nur noch als Skript-Runner, falls überhaupt – nicht nötig,
da `vpx` seit 1.4 TypeScript-Dateien direkt ausführt.

---

## L0.3 Monorepo-Task-Runner

### Stand [verifiziert]

| Option | Version | Cache | Bemerkung |
|---|---|---|---|
| **Vite+ `vp run`** (Vite Task) | in 1.5.0 | nur lokal; erkennt Eingaben automatisch | Remote-Cache ist P0 im Q4-Plan; Vitest/TS-Tasks mit eigenem Cache werden noch nicht gecacht; Cache-Schlüssel eingebauter Tasks enthalten absolute Pfade (Issue #3374 – trifft Worktrees) |
| **Turborepo** | 2.11.10 (2026-10-20) | lokal + remote (Vercel oder selbst gehostet) | Bun ≥ 1.2 und pnpm ≥ 8 stabil |
| **Nx** | 24.0.5 (2026-11-06) | lokal + remote (Nx Cloud) | mächtig, aber viel Konzept für ein Solo-Projekt |
| keiner | – | – | `pnpm -r run` reicht für wenige Pakete |

`vp run` liest `package.json`-Skripte (Cache dort nur mit `--cache`) oder Tasks in
`vite.config.ts` (standardmäßig gecacht). Reihenfolge folgt den Workspace-Abhängigkeiten,
`--filter` wie bei pnpm.

### Abwägung

- In Self-Engine spart der geteilte Turbo-Cache CI-Zeit (lokale Verify-Ergebnisse wiederverwenden).
  Das kann `vp run` heute **nicht**.
- Für den Start (wenige Pakete, ein Entwickler) reicht lokaler Cache.
- Tasks als `package.json`-Skripte halten den Wechsel zu Turborepo billig.

### Empfehlung

**`vp run` zum Start.** Tasks als normale `package.json`-Skripte. Neu bewerten, sobald
Vite-Task-Remote-Cache erscheint oder CI-Kosten spürbar werden. Rückfall: Turborepo.

---

## L0.4 Lint und Format

### Stand [verifiziert]

| Werkzeug | Version | Status |
|---|---|---|
| Oxlint | 1.92.0 (2026-11-06) | stabil (1.x), 872 Regeln |
| Oxlint typbewusst (tsgolint) | 7.0.2006 (2026-11-05) | 59 von 61 typescript-eslint-Typregeln; „Abdeckung unvollständig (aber sehr nah)“; braucht **TypeScript 7** |
| Oxlint JS-Plugins | – | **Alpha**; ESLint-v9-API; keine typbewussten JS-Plugins |
| Oxfmt | 0.77.0 (2026-11-06) | Beta seit 2026-02-24; 100 % Prettier-Konformität bei JS/TS; noch Breaking Changes pro Minor |
| Biome | 2.6.6 (2026-11-06) | stabil; 2.6 bringt Markdown/YAML/SCSS und JS-Plugins (Developer Preview) |
| ESLint | 10.14.0 (2026-10-30) | stabil |
| Prettier | 3.9.10 (2026-10-10) | stabil |

TypeScript 7.0 (Go-Compiler) ist stabil seit Juni/Juli 2026 (Blog-Post datiert 2026-07-08), 7.1 in
Beta. **TS 7.0 hat keine programmatische API**; Werkzeuge, die `typescript` importieren
(z. B. typescript-eslint), brauchen das Kompatibilitätspaket `@typescript/typescript6`.

### Plugins

- **react-hooks:** nativ in Oxlint (`react/rules-of-hooks`, `react/exhaustive-deps`), dazu
  React-Compiler-Regeln (`react/*`, standardmäßig aus). `eslint-plugin-react-hooks` läuft auch
  als JS-Plugin (konformitätsgetestet).
- **Import:** nativ `import/no-cycle`, `no-restricted-imports`, `import/no-relative-parent-imports`.
- **Modulgrenzen (Zonen):** **keine** native Entsprechung zu `import/no-restricted-paths` oder
  `eslint-plugin-boundaries` (Oxc-Issue #13789 offen). `eslint-plugin-boundaries` 7.4.2 lässt sich
  über `jsPlugins` laden (Community-Rezept in Issue #431), offiziell aber nicht dokumentiert.

### Optionen

- **Oxlint + Oxfmt (über Vite+):** schnell, ein Config-Ort, typbewusst über TS 7. Risiko: Oxfmt
  noch 0.x, JS-Plugins Alpha.
- **ESLint 10 + Prettier 3:** reifstes Ökosystem, `eslint-plugin-boundaries` nativ. Langsam,
  typescript-eslint hängt an TS 6.
- **Biome 2.6:** ein Werkzeug, stabil. Aber nicht Teil von Vite+, eigene Typinferenz statt
  TypeScript, weniger Regeln für React-Spezialfälle.

### Empfehlung

**Oxlint + Oxfmt über `vp check`**, mit `typeAware` und `typeCheck` an. Grenzen nicht über den
Linter erzwingen (siehe L0.5). Rückfall für einzelne fehlende Regeln: JS-Plugin; erst im Notfall
ESLint parallel.

---

## L0.5 Modulgrenzen erzwingen (D10)

### Bausteine

| Baustein | Was er erzwingt | Status |
|---|---|---|
| **Workspace-Paket pro Modul** + pnpm isoliert | Import nur, wenn im `package.json` deklariert; sonst schlägt die Auflösung fehl | [verifiziert] Standardverhalten von pnpm |
| **`exports`-Feld** pro Paket | nur die öffentliche API ist importierbar, keine Deep-Imports | Node-/TS-Standard |
| **dependency-cruiser** 18.7.2 (2026-11-02, MIT) | erlaubte Richtungen (z. B. `modules/*` → nur `core`), keine Zyklen, keine verwaisten Dateien; läuft unabhängig vom Linter in CI | [verifiziert] aktiv gepflegt |
| **Oxlint** `import/no-cycle`, `no-restricted-imports` | Zyklen und verbotene Pfadmuster im Editor | nativ |
| **eslint-plugin-boundaries** 7.4.2 | Element-Typen und Zonen, sehr ausdrucksstark | unter Oxlint nur über Alpha-JS-Plugins |
| **TS-Projektreferenzen** | Typprüfung pro Paket, Zyklen verboten | unter TS 7 unterstützt laut Doku [nicht verifiziert im Detail]; mit `vp check` (tsgolint) unklar |

### Empfehlung

Drei Schichten, alle ab Tag 1:

1. **Ein Workspace-Paket pro Modul** (`packages/modules/<name>`), Abhängigkeiten explizit, pnpm
   isoliert. Das ist die harte Grenze.
2. **`exports`** mit genau einem öffentlichen Eintrag (später: Port-Schnittstelle, D11).
3. **dependency-cruiser in `vp check`/CI** für Richtungsregeln und Zyklen.

Oxlint `import/no-cycle` als schnelle Rückmeldung im Editor. eslint-plugin-boundaries erst prüfen,
wenn dependency-cruiser nicht reicht.

---

## L0.6 Electron: Build, Paketierung, Auto-Update

### Stand [verifiziert]

| Werkzeug | Version | Rolle | Vite-Bezug |
|---|---|---|---|
| **electron-vite** | 6.0.0 (2026-10-14), MIT | Build + Dev (HMR Renderer, Hot-Reload Main/Preload), Bytecode-Schutz | Peer `vite ^6 \|\| ^7 \|\| ^8`; Vite 8/Rolldown in 6.0 |
| **electron-builder** | 26.18.1 (2026-10-26); 27 in Alpha | Paketierung (dmg, nsis, AppImage, deb …) | unabhängig von Vite |
| **electron-updater** | 6.8.12 (2026-10-26); 7 in Alpha | Auto-Update: differenziell, gestaffelt, GitHub Releases/S3 | – |
| **Electron Forge** | 8.0.1 (2026-09-29) | Build + Paketierung + Release in einem | Vite-Plugin seit 8.0 stabil, zielt auf Vite 8; ESM-only, Node ≥ 22.17 |
| Electron | 45.2.3 (2026-11-05) | Chromium 156, Node 24.22 | – |

Forge-Details: `publish` heißt jetzt `release`; Main/Preload werden als `.cjs` ausgegeben;
pnpm nur mit `node-linker=hoisted`; kein Bun. Auto-Update bei Forge typischerweise über
`update-electron-app` + update.electronjs.org (kostenlos für öffentliche GitHub-Repos)
[nicht verifiziert für Forge 8].

### Passung zu Vite+

- Beide Wege nutzen `vite` als Bibliothek. Unter Vite+ ist das der Alias `vite-plus-core`.
- `vp dev`/`vp build` werden für die Desktop-App nicht genutzt. Stattdessen `vp run dev` →
  `electron-vite dev`. Lint, Format, Tests laufen weiter über `vp`.
- Renderer-Code (React, Mantine, TanStack Router) bleibt reiner Vite-Code und ist später für die
  Web-App wiederverwendbar.

### Empfehlung

**electron-vite 6 + electron-builder 26 + electron-updater 6.** Gründe: verträgt pnpm isoliert
(Forge erzwingt hoisted), reifes Auto-Update mit GitHub Releases inkl. Linux, klare Trennung
Build/Paketierung. Forge 8 bleibt eine ernsthafte Alternative, falls die hoisted-Pflicht
akzeptabel ist.

---

## L0.7 Routing im Renderer

### Stand [verifiziert]

- `@tanstack/react-router` 1.170.46 (2026-10-22), `@tanstack/router-plugin` 1.168.48.
  (Solid-Router 2.0 ist im RC; für React kein v2-Termin gefunden.)
- Dateibasierte Routen: `tanstackRouter({ target: 'react', autoCodeSplitting: true })` aus
  `@tanstack/router-plugin/vite`, **vor** `@vitejs/plugin-react`.
- History-Typen: `createBrowserHistory`, `createHashHistory`, `createMemoryHistory`.
  Hash-History ist laut Doku für Umgebungen ohne Server gedacht.

### Optionen für Electron

| Option | Vorteil | Nachteil |
|---|---|---|
| **Browser-History + eigenes Protokoll** (`app://`, per `protocol.registerSchemesAsPrivileged` mit `standard`/`secure` und `protocol.handle`) | saubere URLs wie im Web; gleicher Code wie Web-App; sicherer als `file://` | etwas Setup im Main-Prozess, SPA-Fallback auf `index.html` selbst bauen |
| **Hash-History** über `file://` | null Setup | `#/`-URLs; `file://` hat Sicherheitsnachteile |
| **Memory-History** | keine URL nötig | kein Reload-Zustand, keine Deep-Links; gut für Tests |

### Empfehlung

**Browser-History über ein eigenes `app://`-Protokoll**, im Dev-Modus den Vite-Dev-Server. Hash als
Notlösung. Memory-History nur in Komponententests.

---

## L0.8 Tests

### Stand [verifiziert]

- **Vitest 5.1.0** (2026-11-02); 5.0.0 am 2026-09-03. Braucht Node 22 und Vite ≥ 6.4.
  Breaking: Mocks werden vor jedem Test standardmäßig zurückgesetzt, nicht abgewartete
  asynchrone Assertions lassen den Test scheitern, Config wird nicht mehr in Elternordnern gesucht.
- **Browser-Modus:** reguläres Feature; Provider `playwright` (empfohlen, parallel),
  `webdriverio`, `preview` (nur lokal).
- **Playwright 1.65.0** (2026-11-05). **Electron-Support weiterhin „experimentell“**, Electron ≥ 21.
  Native Dialoge im Main-Prozess stubben. Die Fuse `EnableNodeCliInspectArguments` darf im
  Test-Build nicht deaktiviert sein.

### Fallstrick: native Module in Vitest [nicht verifiziert, bekanntes Muster]

better-sqlite3 wird für die Electron-ABI gebaut. Vitest läuft unter Node. Dasselbe Binary lädt
dann nicht (`NODE_MODULE_VERSION`-Fehler). Auswege: Domänen-Tests gegen einen Port-Fake oder ein
In-Memory-Adapter; Adapter-Tests unter Electron als Node (`ELECTRON_RUN_AS_NODE=1`); oder getrennte
Builds. Alternative ohne natives Modul: `node:sqlite` (in Node-26-Doku „Release Candidate“,
Electron 45 hat Node 24 – Stand dort unklar). Gehört zur Speicher-Entscheidung, betrifft aber das
Test-Setup. → Spike S2.

### Empfehlung

**Vitest 5 über `vp test`** für Unit- und Integrationstests, Browser-Modus mit Playwright für
Mantine-Komponenten wo jsdom nicht reicht. **Playwright `_electron`** für wenige Ende-zu-Ende-Pfade
(App startet, Projekt anlegen, Zeit buchen) – experimentell, aber ohne ernsthafte Alternative.

---

## L0.9 CI und Releases

### Stand [verifiziert]

- **GitHub Actions** + `voidzero-dev/setup-vp` v1.22.0 (2026-10-23).
- **release-please** 17.11.2 (2026-08-24), Action v5.0.0 (2026-04-22): Versionen und Changelog
  aus Conventional Commits; Manifest-Modus für Monorepos; eine Release-PR.
- **Changesets** CLI 3.0.3 (2026-09-14), Action v2.1.2 (2026-09-07): eine Absichtsdatei pro
  Änderung; stark bei vielen veröffentlichten npm-Paketen.
- Vite+ plant eigenes Monorepo-Publishing (`vp release`, Q4 P1) – noch nicht verfügbar.

### Abwägung

- Hier gibt es **eine App** (Desktop) und interne Pakete, die nicht auf npm landen.
- release-please passt dazu: eine Komponente, Version aus PR-Titeln (Squash-Merge). Bekannt aus
  Self-Engine.
- Changesets lohnt sich erst, wenn Pakete (z. B. eine Plugin-SDK) öffentlich versioniert werden.
- Electron-Release: release-please-Tag → Matrix-Job (macOS, Windows, Linux) → electron-builder
  baut und lädt in den GitHub-Release hoch → electron-updater liest dort.
- Code-Signierung: macOS-Notarisierung braucht ein Apple-Developer-Konto; Windows-Signierung
  (z. B. Azure Trusted Signing) kostet ebenfalls. Kosten und Ablauf nicht recherchiert.

### Empfehlung

**GitHub Actions + setup-vp + release-please** (eine Komponente: die Desktop-App). Changesets erst,
wenn öffentliche Pakete entstehen.

---

## Stack-Paket (Vorschlag)

| Ebene | Wahl | Version (2026-11-07) |
|---|---|---|
| Runtime | Node.js 24 (wie Electron-Main) | 24.x |
| Paketmanager | pnpm, isoliert | 12.18.0 |
| Toolchain | Vite+ (`vp check`, `vp test`, `vp run`, `vp fmt`) | 1.5.0 |
| Bundler | Vite 8 (Rolldown) über Vite+-Alias | 8.3.x |
| Sprache | TypeScript 7 (+ `@typescript/typescript6`, falls ein Werkzeug die API braucht) | 7.0 |
| Lint / Format | Oxlint (typbewusst) + Oxfmt | 1.92 / 0.77 |
| Task-Runner | `vp run`, Tasks als `package.json`-Skripte | – |
| Grenzen | Paket pro Modul + pnpm isoliert + `exports` + dependency-cruiser | 18.7.2 |
| Electron | Electron 45 + electron-vite 6 + electron-builder 26 + electron-updater 6 | 45.2.3 / 6.0.0 / 26.18.1 / 6.8.12 |
| UI | React + Mantine, TanStack Router (dateibasiert, Browser-History über `app://`) | 1.170.46 |
| Tests | Vitest 5 (+ Browser-Modus), Playwright `_electron` | 5.1.0 / 1.65.0 |
| CI / Release | GitHub Actions, setup-vp, release-please | 1.22.0 / 17.11.2 |
| Rückfallwege | Turborepo 2.11 (Remote-Cache), ESLint 10 + eslint-plugin-boundaries, Forge 8 | – |

### Spikes vor der Festlegung (je ein halber Tag)

- **S1:** `vp` + electron-vite 6 mit dem `vite-plus-core`-Alias unter pnpm 12: Dev mit HMR,
  Build, Peer-Warnungen.
- **S2:** better-sqlite3 13 in Electron 45 bauen und paketieren (electron-builder, pnpm isoliert,
  Workspace-Pakete im asar) und gleichzeitig Adapter-Tests in Vitest laufen lassen.
- **S3:** `vp run`-Cache in zwei Git-Worktrees (Issue #3374) – relevant für Agenten-Arbeit.
- **S4:** TypeScript 7 mit allen Werkzeugen (TanStack-Router-Plugin, dependency-cruiser,
  Mantine-Typen, ggf. Projektreferenzen).

---

## Offene Unsicherheiten

1. **electron-vite/Forge unter dem Vite+-Alias** ist nirgends dokumentiert (S1).
2. **Remote-Cache von Vite Task**: geplant für Q4 2026, kein Termin. Bis dahin kein geteilter
   CI-Cache wie in Self-Engine.
3. **Vite Task cacht Vitest- und TS-Tasks noch nicht** (Q4-P0) – der Cache-Gewinn für `test` und
   `check` ist heute klein.
4. **Oxfmt ist 0.x** mit Breaking Changes pro Minor; Vite+ pinnt die Version, Updates können
   Formatänderungen bringen.
5. **Oxlint JS-Plugins sind Alpha**; keine native Zonen-Regel für Grenzen.
6. **TypeScript 7 ohne programmatische API** bis 7.1; welche unserer Werkzeuge das trifft, ist
   offen (S4).
7. **Native Module in Tests** (Electron-ABI vs. Node) – Lösung hängt an der Speicher-Entscheidung
   (`better-sqlite3` vs. `node:sqlite` in Electron 45).
8. **Expo später:** Metro statt Vite; Vite+ hilft dort nur bei Lint/Format/Tasks. Manche
   RN-Bibliotheken brauchen hoisted `node_modules` – das kollidiert mit strenger pnpm-Isolation
   im selben Workspace.
9. **Playwright-Electron bleibt experimentell.**
10. **Code-Signierung und Notarisierung**: Kosten und CI-Ablauf nicht recherchiert.
11. **Cloudflare als Eigentümer von VoidZero**: Zusagen zu Open Source vorhanden, Langfristfolgen
    offen.
12. **Übernahmedatum VoidZero/Cloudflare** und genaues Release-Datum von TS 7.0 (Blogliste und
    Post widersprechen sich: 18. Juni vs. 8. Juli 2026) nicht eindeutig.

---

## Quellen (alle abgerufen am 2026-11-07)

Vite+ / VoidZero
- https://viteplus.dev/guide/
- https://viteplus.dev/guide/run
- https://viteplus.dev/guide/install
- https://viteplus.dev/guide/monorepo
- https://viteplus.dev/guide/migrate
- https://viteplus.dev/guide/lint
- https://viteplus.dev/guide/check
- https://github.com/voidzero-dev/vite-plus/releases (v1.0.0 2026-09-28 … v1.5.0 2026-11-04)
- https://github.com/voidzero-dev/vite-plus/releases/tag/v1.0.0
- https://github.com/voidzero-dev/vite-plus/blob/main/LICENSE
- https://github.com/voidzero-dev/vite-plus/issues/3277 (Plan Q4 2026)
- https://github.com/voidzero-dev/vite-plus/issues/2806 (Peer-Prüfung mit Alias)
- https://github.com/voidzero-dev/vite-plus/issues/1021
- https://github.com/voidzero-dev/vite-plus/issues/3374 (Cache-Schlüssel mit absoluten Pfaden)
- https://github.com/voidzero-dev/vite-plus/issues/3375 (Bun-Catalogs)
- https://www.npmjs.com/package/vite-plus (Abhängigkeiten von 1.5.0)
- https://github.com/voidzero-dev/setup-vp/releases
- https://voidzero.dev/posts/announcing-vite-plus-alpha (2026-03-13)
- https://blog.cloudflare.com/voidzero-update/ (2026-09-28)
- https://infoq.com/news/2026/10/cloudflare-viteplus-stable (2026-10-14) [sekundär]
- https://heise.de/-11212433 [sekundär]

Paketmanager / Runtime
- https://www.npmjs.com/package/pnpm (12.18.0; 12.0.0 2026-08-26; 11.0.0 2026-04-28)
- https://pnpm.io/blog/releases/11.0
- https://github.com/oven-sh/bun/releases (1.4.4)
- https://bun.com/docs/pm/isolated-installs
- https://bun.sh/guides/install/trusted
- https://bun.com/blog/bun-joins-anthropic
- https://docs.expo.dev/guides/monorepos/
- https://nodejs.org/api/sqlite.html

Task-Runner
- https://github.com/vercel/turborepo/releases (2.11.10)
- https://turborepo.dev/docs/getting-started/support-policy
- https://github.com/nrwl/nx/releases (24.0.5)

Lint / Format / TypeScript
- https://oxc.rs/docs/guide/usage/linter/type-aware.html
- https://oxc.rs/docs/guide/usage/linter/js-plugins.html
- https://oxc.rs/docs/guide/usage/linter/plugins.html
- https://oxc.rs/docs/guide/usage/linter/rules.html
- https://oxc.rs/docs/guide/usage/formatter.html
- https://oxc.rs/blog/2026-02-24-oxfmt-beta
- https://github.com/oxc-project/oxc/releases (oxlint 1.92.0, oxfmt 0.77.0)
- https://github.com/oxc-project/tsgolint/releases
- https://github.com/oxc-project/oxc/issues/13789 (no-restricted-paths)
- https://biomejs.dev/blog/
- https://biomejs.dev/linter/rules/no-import-cycles/
- https://github.com/eslint/eslint/releases (10.14.0)
- https://github.com/prettier/prettier/releases (3.9.10)
- https://devblogs.microsoft.com/typescript/
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/

Modulgrenzen
- https://github.com/sverweij/dependency-cruiser/releases (18.7.2)
- https://github.com/javierbrea/eslint-plugin-boundaries/releases (7.4.2)
- https://github.com/javierbrea/eslint-plugin-boundaries/issues/431 (Oxlint-Rezept)

Electron
- https://releases.electronjs.org/ (45.2.3)
- https://github.com/alex8088/electron-vite/releases (6.0.0)
- https://electron-vite.org/guide/
- https://github.com/electron/forge/releases (8.0.1, Release-Notes Forge 8)
- https://unpkg.com/@electron-forge/cli@8.0.1/dist/util/check-system.js (pnpm hoisted)
- https://www.electronforge.io/config/plugins/vite
- https://github.com/electron-userland/electron-builder/releases (26.18.1, 27 Alpha)
- https://www.electron.build/
- https://github.com/electron-userland/electron-builder/issues/9434, /9490, /9494, /9641 (Bun)
- https://github.com/WiseLibs/better-sqlite3/releases (13.0.3)
- https://www.electronjs.org/docs/latest/api/protocol

Routing
- https://tanstack.com/router/latest/docs/framework/react/guide/history-types
- https://tanstack.com/router/latest/docs/framework/react/installation/with-vite
- https://www.npmjs.com/package/@tanstack/react-router (1.170.46)

Tests
- https://github.com/vitest-dev/vitest/releases (5.0.0, 5.1.0)
- https://vitest.dev/guide/browser/
- https://github.com/microsoft/playwright/releases (1.65.0)
- https://playwright.dev/docs/api/class-electron

CI / Releases
- https://github.com/googleapis/release-please/releases (17.11.2)
- https://github.com/googleapis/release-please-action/releases (v5.0.0)
- https://github.com/changesets/changesets/releases (@changesets/cli 3.0.3)
- https://github.com/changesets/action/releases (v2.1.2)
