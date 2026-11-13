# Runde 17 (2026-11-08): GitHub-Repo-Einstellungen

- **D102 Nur Squash-Merge;** PR-Titel wird Commit-Titel, PR-Text wird Commit-Text; Auto-Merge
  an, Branches werden nach dem Merge gelöscht. _Verworfen:_ Merge-Commits (Zwischenstände ohne
  `verify` auf `main`), Rebase (jeder Commit müsste einzeln sauber sein).
- **D103 Ruleset für `main`:** PR-Pflicht, nur Squash, lineare Historie, kein Force-Push, kein
  Löschen, kein Bypass, 0 Approvals. Agenten arbeiten über `gh` und MCP mit dem Login des
  Owners, also gälte ein Bypass auch für sie, und eigene PRs lassen sich nicht selbst
  approven. _Verworfen vorerst:_ Pflicht für signierte Commits; sie blockierte alle PRs mit
  unsignierten Commits.
- **D104 Required Checks `quality` und `title`,** an GitHub Actions gebunden, ohne „Branch
  muss aktuell sein“. _Grund:_ Das würde parallele Agenten-PRs nach jedem Merge zum
  Aktualisieren zwingen.
- **D105 Actions nur per SHA gepinnt** (Repo-Einstellung), wegen der späteren Signier-Secrets
  (#10).
- **D106 Dependabot:** Alerts, Sicherheitsupdates und wöchentliche Versions-Updates mit 7 Tagen
  Wartezeit. Renovate bleibt Ausweichlösung. Wiki und Projects-Tab sind aus.
- **D107 Umzug in die Organisation `Self-Engine` beim Wechsel auf öffentlich,** spätestens vor
  dem ersten Release für andere. Vorher nicht, weil Rulesets in privaten Repos einer
  Free-Organisation nicht greifen.
- **Merkliste für den Wechsel auf öffentlich:** Einstellungen der Organisation, Merge Queue
  prüfen, Signierung per SSH-Schlüssel, eigene GitHub App für Agenten mit Approval-Pflicht,
  `SECURITY.md`, `CONTRIBUTING.md`, private Sicherheitsmeldungen, Secret Scanning mit Push
  Protection, CodeQL, Freigabe für Fork-PRs, Tag-Schutz für `v*` (mit #9), `CODEOWNERS` prüfen.
