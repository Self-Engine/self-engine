# Runde 23 (2026-11-10): Arbeitsablauf

- **D155 Der Stand eines Tickets wird abgelesen, nicht gepflegt.** Geprüft wird der Reihe nach:
  geschlossen (gebaut), offener PR schließt es (im Review), hat Teil-Tickets (geschnitten), Body
  enthält ein Spec (spezifiziert), Label `needs-grilling` (Grilling nötig), Label `ready-for-agent`
  (baubar), sonst Triage offen. `ready-for-agent` heißt nur noch, dass ein Agent bauen darf; die
  Pakete vor ihrem Grilling tragen `needs-grilling`. Das revidiert den Label-Teil von D154.
  _Verworfen:_ ein Label pro Stufe (ein vergessener Schritt macht die Übersicht falsch).
- **D156 Die Agenten halten die Übersichtsseite aktuell.** Der Ablauf steht in `docs/agents/`, der
  letzte Schritt jeder Stufe ist das Aktualisieren. Ein Skript in `scripts/` erzeugt die ganze Seite
  aus GitHub und einer kurzen Liste für Schichten ohne Issues, der Agent veröffentlicht das Ergebnis.
  So holt der nächste Agent einen vergessenen Schritt von selbst nach. Fehlt einem Agenten das
  Werkzeug zum Veröffentlichen, sagt er das in seinem Bericht. _Verworfen:_ Änderungen von Hand am
  HTML (jeder Agent stuft selbst ein), stündlicher geplanter Lauf (der Stand ändert sich mit den
  Arbeitsschritten), GitHub Pages (macht den Planungsstand vor dem Öffentlich-Machen zugänglich).
- **D157 Entscheidungen aus einem Grilling gehen sofort per Docs-PR auf `main`.** Der PR folgt direkt
  dem Grilling und kommt vor dem Bau, das Spec steht sofort im Issue. ADRs gehen mit dem Bau-PR,
  weil sie beschreiben, was im Code gilt. _Grund:_ Das Grilling von #30 belegte D133–D142 auf `main`,
  während Schicht 3 dieselben Nummern auf einem Branch nutzte. _Verworfen:_ Entscheidungen im Bau-PR
  (das nächste Grilling sieht sie tagelang nicht).
- **D158 Ein Integrations-Branch und ein PR pro Paket.** Der PR schließt das Paket und seine
  Teil-Tickets, der Titel wird ein Changelog-Eintrag. Würde ein Paket deutlich mehr als rund 4.500
  Zeilen, wird es beim Schneiden geteilt (bisher 450 bis 4.450 neue Zeilen). _Verworfen:_ ein PR pro
  Teil-Ticket (ein Changelog-Eintrag je Teil, halbfertige Funktionen auf `main`).
- **D159 Der Ablauf steht im Repo, die Skills bleiben persönlich.** `docs/agents/workflow.md`
  beschreibt jede Stufe mit Ergebnis und nennt den passenden Skill, die Skills bleiben vorerst in
  `~/.agents/skills`. Sie werden erst kopiert, wenn Agenten außerhalb des eigenen Macs arbeiten.
  _Verworfen:_ die sechs Skills sofort kopieren (Kopien veralten, Lizenz ungeklärt).
- **D160 Ein Paket kommt nur unter drei Bedingungen ohne Grilling aus:** prüfbare
  Abnahmekriterien, kein Muster für andere Module, keine offene Entwurfsfrage. Entschieden wird beim
  Schneiden, sichtbar am Label. Findet ein Agent beim Bau doch eine offene Entwurfsfrage, hört er
  auf, schreibt sie ins Issue und setzt `needs-grilling`. Teil-Tickets aus einem Spec gelten immer
  als baubar. Layer-Specs wie #103 tragen kein Bau-Label. _Verworfen:_ immer grillen (kostet Zeit
  für Fälle wie #25).
