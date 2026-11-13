# Runde 14 (2026-11-08): offene Grundfragen

- **D83 (Q12) Geschäftsmodell: App und Selbsthosten kostenlos, bezahlt werden gehosteter
  Sync und Organisations-Spaces.** Passt zur AGPL (D18): Wer den Sync-Server selbst
  betreibt, zahlt nichts. Details (Preise, Abrechnung) erst in der Sync-Phase.
  _Verworfen:_ nur Spenden, gar kein Geschäftsmodell.
- **D84 (Q13) Self-Engine wird nicht eingeschränkt; der Schwerpunkt liegt im neuen
  Projekt.** Weder Funktionen noch Schemaänderungen sind gesperrt. Folge für den Import
  (Schicht 5): Er liest das jeweils aktuelle Self-Engine-Schema, prüft beim Start die
  erwartete Schema-Version und bricht mit klarer Meldung ab, statt still falsch zu
  importieren. Der wiederholbare Import (D12) fängt spätere Änderungen auf.
  _Verworfen:_ Self-Engine auf Bugfixes einfrieren.
- **D85 (Q16) KI-Assistent nach dem MVP, mit eigenem API-Schlüssel des Nutzers und einem
  lokalen MCP-Server.** Schon vorher werden Befehle agententauglich gebaut: Jede
  Aktion geht über das zentrale Befehlsregister (D75) mit typisierten Eingaben, sodass
  ⌘K, Tastenkürzel und später der Agent dieselben Befehle aufrufen. D64 (angedockter
  Assistent) bleibt vorläufig; die Form wird beim Bau entschieden.
