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
