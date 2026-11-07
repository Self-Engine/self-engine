# Schicht 0: Repo-Fundament

Stand: 2026-11-07 · Status: Recherche fertig, Entscheidungen offen

Alles, worauf die übrigen Schichten aufbauen. Jede Frage wird einzeln entschieden, bevor
Code entsteht (D25). Desktop (Electron) ist das Hauptprodukt (D26).

## Fragen

| Nr. | Thema | Optionen (vorläufig) |
|---|---|---|
| L0.1 | Toolchain | Vite+ (`vp`) als Gesamtpaket vs. Einzelwerkzeuge (Vite, Vitest, Linter, Formatter, Task-Runner) |
| L0.2 | Paketmanager und Runtime | Bun vs. pnpm (Node) |
| L0.3 | Monorepo-Task-Runner | Vite+ eingebaut vs. Turborepo vs. keiner |
| L0.4 | Lint und Format | Oxlint + Oxfmt vs. ESLint + Prettier vs. Biome |
| L0.5 | Modulgrenzen erzwingen | Lint-Regel, dependency-cruiser, Workspace-Pakete pro Modul |
| L0.6 | Electron-Build und Updates | electron-vite, Electron Forge, electron-builder |
| L0.7 | Routing im Renderer | TanStack Router (SPA) |
| L0.8 | Tests | Vitest; Ende-zu-Ende mit Playwright für Electron |
| L0.9 | CI und Releases | GitHub Actions; Versionierung (release-please, Changesets) |
| L0.10 | Agenten-Setup | Audit der Self-Engine-Elemente (D27) |

## Recherche

- Toolchain (L0.1–L0.9): `research-layer-0-tooling.md`
- Agenten-Setup (L0.10): `research-agent-setup.md`

## Entscheidungen

- L0.1 Vite+ (D28), L0.2 pnpm (D29), L0.3 `vp run`, kein Turborepo (D30).
- Spikes S1/S2 laufen (D31). S1 vergleicht zwei Wege: electron-vite unter Vite+ und den
  t3code-Weg (`vp pack` für Main/Preload, Renderer als normale Vite-App, electron-builder).
- Spikes S1/S2 fertig → `prototypes/layer-0-spikes/RESULTS.md`. Beide S1-Wege laufen;
  Empfehlung Weg A (t3code-Stil). S2: better-sqlite3 13 (N-API, ein Binary für Node und
  Electron), `npmRebuild: false`, Tests mit `vp test` in Node.
- L0.6 Electron wie t3code (D32), SQLite better-sqlite3 13 (D33), Node 26 + `@types/node` 24 (D34).
- L0.4 `vp check` mit Oxlint + Oxfmt (D35), L0.5 Modulgrenzen dreifach (D36).
- L0.7 Routing wie t3code (D37). L0.9 erweitert um Kanäle dev/nightly/stable (D38).
- Kanäle: getrennte Apps (D39), Stable aus Nightly-Commit (D40), Nightly automatisch bei Änderungen (D41).
- L0.8 Tests (D42), L0.9 Versionierung ohne release-please (D43). Offen: L0.10 Agenten-Setup.
- L0.10: Gate `pnpm verify` (D44), PRs + Push-Guard (D45), Sprache/ADRs (D46).
