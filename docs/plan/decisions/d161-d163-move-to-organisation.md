# Runde 24 (2026-11-10): Umzug in die Organisation

- **D161 Das Repo heißt `Self-Engine/self-engine`, schon vor dem Stichtag (ändert D52).** Mit dem
  Umzug in die Organisation (D107) ist der Name dort frei. Die alte App bleibt unverändert unter
  `GwydionBr/self-engine`, ihre Desktop-Updates, CI und Vercel hängen also weiter am alten Namen.
  Die Umbenennung der alten App in `self-engine-legacy` entfällt damit.
- **D162 Das Repo wird öffentlich, nimmt aber vorerst keine fremden Beiträge an.** Issues und PRs
  anlegen dürfen nur Collaborators. Kommentare auf bestehenden Issues und PRs bleiben möglich.
  Ob es ein CLA oder DCO braucht, wird erst entschieden, bevor fremde Beiträge erlaubt werden.
  _Verworfen:_ ein Interaction Limit „Collaborators only“, weil CodeRabbit damit nicht mehr antwortet.
- **D163 Nightlies sind öffentliche Entwicklungs-Builds und entstehen zweimal am Tag (ändert D110).**
  Gebaut wird weiter nur, wenn sich `main` geändert hat. Release-Notizen und README sagen, dass es
  keine Unterstützung gibt. Sie gelten nicht als öffentliche Version im Sinne von D100; das ist erst
  die erste Stable für andere.
