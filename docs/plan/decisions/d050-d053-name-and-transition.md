# Runde 12 (2026-11-08)

- **D50 (Q14) Name bleibt „Self-Engine“.** Das neue Projekt löst das alte ab und heißt
  gleich. Kanalnamen: „Self-Engine“, „Self-Engine Nightly“, „Self-Engine Dev“.
  Kollisionen mit der alten App während des Übergangs: siehe [Fakten](../facts.md).

- **D51 (Q33a) Eigene App-IDs während des Übergangs** (z. B. `app.selfengine.desktop`,
  `.nightly`, `.dev`). Bis zum Stichtag nutzt der Owner die Nightly; Stable 0.x erscheint
  für andere. Am Stichtag wird `1.0.0` die Haupt-App „Self-Engine“; die alte App bekommt
  ein letztes Update mit Umstiegshinweis.
- **D52 (Q33b) Repo-Umbenennung am Stichtag:** alt → `self-engine-legacy`, neu →
  `self-engine`. Nicht vorher (alte Desktop-Updates, CI und Vercel hängen am alten Namen).
- **D53 Nächster Schritt: Schicht 0 bauen** (Issues, Umsetzung), Schicht 1 parallel planen.
