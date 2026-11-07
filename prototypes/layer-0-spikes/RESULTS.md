# Spikes S1 und S2: Ergebnisse

Stand: 2026-11-07 · Wegwerfcode (D31) · Rechner: macOS 27.2, Apple Silicon, Node 26.13

## Kurzfassung

- **S1: Beide Wege funktionieren.** Dev mit Renderer-HMR, Neustart bei Main-Änderung,
  Produktions-Build, `electron-builder --dir` für macOS arm64, paketierte App startet und zeigt
  die Mantine-Seite mit Daten aus SQLite. Kein Weg ist gescheitert.
- **Empfehlung S1: Weg A (t3code-Stil: `vp pack` + Vite+-Renderer).** Ein Werkzeug weniger,
  keine Abhängigkeit von electron-vite, Renderer ist eine normale Vite-App (später die Web-App).
  Den Dev-Runner (ca. 70 Zeilen) bauen wir selbst.
- **S2: Das Problem „Electron-ABI vs. Node-ABI“ gibt es mit better-sqlite3 13 nicht mehr.**
  Version 13 ist ein N-API-Modul (`NAPI_VERSION=10`) und liefert fertige Binaries für 8
  Plattformen im npm-Paket mit (`prebuilds/*.node`, kein Install-Skript, `gypfile: false`).
  **Dasselbe Binary** lädt in Node 26 (ABI 147) und in Electron 45 (ABI 150). Kein Rebuild nötig.
- **Empfehlung S2: better-sqlite3 13, kein Rebuild (`npmRebuild: false`), Tests mit `vp test`
  in normalem Node.** `ELECTRON_RUN_AS_NODE` nur als Zusatz-Lauf, falls gewünscht.

## Versionen (npm, 2026-11-07)

pnpm 12.18.0 · vite-plus 1.5.0 (`vite` → `npm:@voidzero-dev/vite-plus-core@1.5.0`) ·
Electron 45.2.3 (Node 24.22.2, ABI 150) · electron-builder 26.18.0 (`latest`) ·
electron-vite 6.0.0 · better-sqlite3 13.0.3 (SQLite 3.53.4) · React 19.3.1 · Mantine 9.7.5 ·
@vitejs/plugin-react 6.2.1 · TypeScript 7.0.2 · Vitest 5.1.0 (über Vite+).

## Aufbau

```
layer-0-spikes/            eigener pnpm-Workspace (Catalog + Overrides wie t3code)
  apps/desktop-a/          Weg A: vp pack (Main/Preload, CJS) + vp dev/build (Renderer)
  apps/desktop-b/          Weg B: electron-vite 6 auf dem Vite+-Alias
  packages/db/             better-sqlite3-Code + Vitest-Test
  packages/ui/             gemeinsame Mantine-Seite (zeigt Daten per IPC)
  scripts/                 ensure-electron, vitest-electron, launch-check, asar-ls
```

Beide Apps: DB öffnet im Main-Prozess (`userData/spike.db`), Renderer holt Daten über
`contextBridge` + `ipcRenderer.invoke("db:info")`, Preload mit `sandbox: true`.
`@spike/db` wird in `main.cjs` gebündelt, nur `better-sqlite3` bleibt extern.

Befehle (aus `layer-0-spikes/`): `npx pnpm@12.18.0 install`, `node_modules/.bin/vp check`,
`node_modules/.bin/vp test run`, `node scripts/vitest-electron.mjs`, in `apps/desktop-a`:
`pnpm dev` / `pnpm build` / `pnpm package`, in `apps/desktop-b` ebenso.

## S1: Electron unter Vite+

### Zeiten (grob, warm)

| Schritt                                                | A: vp pack + Vite+              | B: electron-vite                    |
| ------------------------------------------------------ | ------------------------------- | ----------------------------------- |
| Dev: Start bis Fenster mit DB-Daten                    | 1,0–1,4 s                       | 1,1 s                               |
| Renderer-HMR (Änderung in `packages/ui`) bis Re-Render | 0,3 s                           | 0,3 s                               |
| Main-Änderung bis neu gestartet und geladen            | 0,86 s                          | 0,54 s                              |
| Produktions-Build                                      | `vp pack` < 1 s, `vp build` 2 s | 1 s                                 |
| `electron-builder --dir --mac --arm64`                 | 4 s (10 s mit Rebuild)          | 5 s                                 |
| Paketierte App: Main-Start bis Renderer geladen        | ca. 0,27 s                      | ca. 0,28 s                          |
| Renderer-Bundle JS / CSS                               | 269 kB / 249 kB (minifiziert)   | 673 kB / 295 kB (nicht minifiziert) |

Weiter: `pnpm install` 23 s (Store fast kalt), Electron-Binary-Download 49 s,
`vp check` 1 s, `vp test run` 1 s, `vp run -r build` (beide Apps) 1 s. App-Größe 262 MB
(fast nur Electron).

### Was funktioniert hat

- **A:** `pack`-Block in `vite.config.ts` (zwei Einträge, CJS, `.cjs`, Abhängigkeiten außer
  `electron`/`better-sqlite3` gebündelt) plus Renderer-Konfiguration (`root: "renderer"`) in
  **derselben** Datei. `vp pack` und `vp dev`/`vp build` stören sich nicht.
  `vp pack --watch` + eigener Dev-Runner (`scripts/dev.mjs`: Dev-Server, Pack-Watch, Electron
  neu starten bei Änderung in `dist-electron/`).
- **B:** `electron-vite dev -w` läuft ohne Anpassung auf `vite-plus-core` (Banner zeigt
  „VITE+ v1.5.0“). HMR und Main-Neustart eingebaut.
- Beide: `electron-builder --dir` mit pnpm-Workspace (isoliert). Ins `app.asar` kommen nur
  `better-sqlite3` (+ `node-addon-api`), keine devDependencies. Native `.node` wird automatisch
  nach `app.asar.unpacked` gelegt.
- `vp check` über den ganzen Workspace: Format (Oxfmt), Lint (Oxlint, typbewusst) und
  Typprüfung (TS 7). Ein eingebauter Typfehler wurde gefunden (`TS2322`), Exit-Code 1.
- `vp test run` von der Wurzel findet die Tests in `packages/*`.
- `vp run -r build` baut beide Apps in Paketreihenfolge.

### Was gehakt hat (genaue Meldungen)

1. **Peer-Warnungen (Issue #2806), bei A und B:**
   `✕ unmet peer vite  Installed: 1.5.0  Wanted: ^8.0.0: @vitejs/plugin-react@6.2.1`,
   ebenso `vitest@5.1.0` / `@vitest/mocker@5.1.0` (`^6 || ^7 || ^8`) und
   `electron-vite@6.0.0` (`^6.0.0 || ^7.0.0 || ^8.0.0`). Betrifft also auch Weg A, nicht nur
   electron-vite. Lösung wie t3code: `peerDependencyRules.allowedVersions.vite: "*"` → danach
   `No peer dependency issues found`.
2. **pnpm 12 bricht bei nicht freigegebenen Build-Skripten ab:**
   `ERR_PNPM_IGNORED_BUILDS … Ignored build scripts: electron-winstaller@5.4.0` (kommt über
   electron-builder). Lösung: `allowBuilds: { electron-winstaller: false }`.
3. **Electron 45 hat kein Install-Skript mehr.** Nach `pnpm install` fehlt `dist/` mit dem
   Binary. Lösung wie t3code (`ensure:electron`): `node node_modules/electron/install.js`
   (hier `scripts/ensure-electron.mjs` als `postinstall`).
4. **A: `vp pack` bündelte im Preload das npm-Paket `electron`** (den Launcher mit
   `child_process`, `install.js` …), weil `electron` eine devDependency ist und tsdown
   devDependencies bündelt. Ohne Fehler beim Build, Preload wäre zur Laufzeit kaputt.
   Lösung: `deps.neverBundle` für `electron` auch im Preload-Eintrag.
5. **A: Dev-Runner ließ Prozesse übrig.** `node_modules/.bin/vp` ist ein Shell-Shim; `kill` traf
   nur den Shim, `vite dev` und `pack --watch` liefen weiter. Lösung: `detached: true` und
   `process.kill(-pid)` (Prozessgruppe).
6. **B: Renderer wird nicht minifiziert** (672 kB statt 269 kB). Vermutlich electron-vite-Default;
   per `build.minify` lösbar, nicht weiter geprüft.
7. **electron-builder erkennt pnpm nicht:** `packageManager not detected by file, falling back to
   environment detection resolvedPackageManager=npm`. Das Lockfile liegt an der
   Workspace-Wurzel, nicht im App-Ordner. Die gesammelten Abhängigkeiten stimmten trotzdem.

### Vergleich und Empfehlung S1

|                              | A: vp pack (t3code)                                                        | B: electron-vite                                            |
| ---------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Werkzeuge                    | nur Vite+ (tsdown, Vite) + electron-builder                                | zusätzlich electron-vite (ein Maintainer)                   |
| Dev-Komfort                  | Dev-Runner selbst schreiben                                                | eingebaut, Main-Neustart etwas schneller                    |
| Konfig                       | `vite.config.ts` mit `pack` + Renderer, gleiche Datei wie `check/test/run` | zweite Konfig `electron.vite.config.ts`                     |
| Renderer als spätere Web-App | normale Vite+-App                                                          | Renderer liegt im electron-vite-Baum                        |
| Risiko                       | t3code beweist den Weg in großem Maßstab                                   | Alias auf vite-plus-core inoffiziell, aber hier ohne Fehler |
| Fallstricke                  | Bundling von `electron` im Preload, Prozessgruppen im Runner               | Minify-Default                                              |

**Empfehlung: A.** Begründung: weniger Abhängigkeiten, eine Konfiguration, Renderer bleibt eine
reine Vite-App (D26: Web später), belegtes Vorbild t3code. Der Komfortvorteil von B ist klein
(ca. 0,3 s schnellerer Main-Neustart, fertiger Runner). Der Dev-Runner von A ist kurz und wird
einmal geschrieben. B bleibt Rückfallweg; er funktioniert unter Vite+.

## S2: better-sqlite3 mit pnpm und Electron

### Befund

- `better-sqlite3@13.0.3`: `"gypfile": false`, keine `scripts`, Abhängigkeit nur
  `node-addon-api`, `binding.gyp` mit `NAPI_VERSION=10`. Im Paket liegen
  `prebuilds/{darwin,linux,linuxmusl,win32}-{arm64,x64}.node`. `lib/binding.js` nimmt zuerst
  das passende Prebuild, erst danach `build/Release`.
- Gleiches Binary, zwei Laufzeiten (Test `packages/db/src/index.test.ts`):
  - `vp test run`: `[db test] node 26.13.0, abi 147 sqlite 3.53.4` → bestanden
  - `node scripts/vitest-electron.mjs` (Electron als Node): `[db test] node 24.22.2, abi 150,
    electron 45.2.3 sqlite 3.53.4` → bestanden
- Paketierte Apps (A und B) loggen auf stdout:
  `[main] db info {"sqliteVersion":"3.53.4","projects":[…3 Einträge…],"runtime":"node 24.22.2,
  abi 150, electron 45.2.3"}` und `[renderer console] [renderer] db info {…}` (Daten kamen per
  IPC im Renderer an). Prozess lebte nach 3 s noch, danach beendet. Kein Prozess übrig.
- `pnpm install` baut nichts: `allowBuilds: better-sqlite3: true` ist nicht nötig (kein Skript).

### Fallstrick: `@electron/rebuild` in electron-builder

Mit Standard-Einstellung (`npmRebuild: true`) meldet electron-builder
`executing @electron/rebuild … preparing moduleName=better-sqlite3` und legt einen
`build/`-Ordner mit Makefile und `obj.target` an, **direkt in der pnpm-Kopie**
(`node_modules/.pnpm/better-sqlite3@13.0.3/…`), die auch Node-Tests nutzen. Ein fertiges
`build/Release/*.node` entstand nicht, die App lud weiter das Prebuild. Trotzdem: unnötig,
kostet 6 s und verändert den geteilten Store. **Lösung: `"npmRebuild": false`.**

Dazu `files`-Filter: ohne Filter landen 26 MB (Quellen, `deps/`, alle 8 Plattform-Binaries) in
`app.asar.unpacked`, mit Filter 2 MB (nur `darwin-arm64.node`). Für Mehrplattform-Builds den
Filter pro Ziel setzen.

### Optionen für Tests in Node

| Option                                                | Stand                                                                                                                                                                                                             | Bewertung                                                                                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **(0) better-sqlite3 13 N-API, ein Binary für beide** | geprüft, läuft                                                                                                                                                                                                    | kein Zusatzaufwand; Tests laufen mit `vp test` in Node                                                                                |
| (1) `node:sqlite`                                     | Node 26: lädt ohne Warnung, SQLite 3.54.1, hat `Database` + `DatabaseSync`. Electron 45 (Node 24.22): lädt auch im paketierten Main-Prozess, SQLite 3.53.4, nur `DatabaseSync`. Node-Doku 26: „Release Candidate“ | brauchbar, aber API-Unterschiede zwischen Node 24 und 26, keine Garantie für Stabilität; SQLite-Version hängt an der Electron-Version |
| (2) zwei Builds (Node + Electron)                     | mit 13 nicht mehr nötig                                                                                                                                                                                           | nur für ältere, nicht-N-API-Module relevant; bei pnpm schwierig, weil Node und Electron dieselbe Store-Kopie lesen                    |
| (3) Vitest mit `ELECTRON_RUN_AS_NODE=1`               | geprüft, läuft (`scripts/vitest-electron.mjs`, 1 s)                                                                                                                                                               | gut als Zusatz-Lauf „wie in Produktion“ (gleiche Node- und SQLite-Version wie Electron)                                               |

**Empfehlung S2:** better-sqlite3 13 im Main-Prozess, `npmRebuild: false`, Domänen- und
Adapter-Tests mit `vp test` in normalem Node. Optional in CI ein Lauf mit
`ELECTRON_RUN_AS_NODE=1`, damit Node-24-Verhalten (Electron) abgedeckt ist. `node:sqlite` erst
neu prüfen, wenn es in Node und Electron stabil ist; der Port pro Modul (D11) macht den Wechsel
später billig.

## Offene Punkte

1. **Node-Version:** Electron 45 nutzt Node 24.22, lokal läuft Node 26. Tests unter 26, Produktion
   unter 24. Für das Repo Node 24 festnageln (Research L0.2) oder den Electron-Lauf (3) in CI.
2. **Code-Signierung/Notarisierung** nicht getestet (`identity: null`). Bei signierten Builds
   muss `.node` in `app.asar.unpacked` mitsigniert werden.
3. **Mehrplattform:** nur macOS arm64 paketiert. Windows/Linux nicht geprüft, ebenso Universal-
   Builds (dann zwei `darwin-*.node` behalten).
4. **Workspace-Pakete extern im asar:** hier wird `@spike/db` in `main.cjs` gebündelt. Nicht
   getestet, wie electron-builder mit pnpm-Symlinks auf Workspace-Pakete umgeht, die extern
   bleiben müssen. t3code umgeht das mit einem Staging-Ordner und `vp install --prod`.
5. **electron-builder erkennt pnpm nicht** (fällt auf npm zurück). Lief hier richtig; bei mehr
   Abhängigkeiten prüfen oder wie t3code einen Staging-Ordner nutzen.
6. **`app://`-Protokoll** statt `loadFile` (Research L0.7) nicht Teil des Spikes. CSP und
   Mantine liefen unter `file://`.
7. **Screenshot:** `screencapture` scheiterte (`could not create image from display`, fehlende
   Bildschirm-Freigabe für das Terminal). Die Seite wurde über die Logs belegt.
8. **TypeScript 7 + Vite+:** `vp check` lief sauber mit TS 7.0.2. `allowImportingTsExtensions`
   und `vite-plus/client`-Typen (für `*.css`-Importe) waren nötig. Weitere Werkzeuge (S4) offen.
