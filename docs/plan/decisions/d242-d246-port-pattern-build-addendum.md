# Nachtrag zu Runde 32 (2026-11-12): beim Bau von #32 entschieden (verfeinert D231, D236–D239, D241)

Beim Bau von #32 blieben fünf Fragen offen, die Runde 32 nicht beantwortet hatte. Sie wurden
während des Baus und im Review entschieden und hier nachgetragen. Gemessen wurde auf SQLite im Speicher, ohne den
Weg zwischen den Prozessen; die Zahlen stehen mit #210 in `docs/development/performance.md`.

- **D242 Das Kit bildet ungültige Eingaben selbst (verfeinert D239).** Das Modul übergibt pro
  Vertragseintrag nur eine gültige Beispiel-Eingabe. Das Kit bildet daraus Kandidaten (feste Werte
  vom falschen Typ, das Beispiel ohne je ein Feld, das Beispiel mit je einem Feld vom falschen
  Typ). Jeden Kandidaten, den das Eingabe-Schema ablehnt, muss auch der Rahmen abweisen. Lehnt das
  Schema eines Eintrags keinen einzigen ab, schlägt der Test fehl: Ein Schema, das alles annimmt,
  prüft nichts. _Verworfen:_ das Modul liefert ungültige
  Beispiele mit (jedes Modul müsste sie pflegen, und ein vergessenes Beispiel fiele nicht auf).
- **D243 Eine Tabelle wird nur gemeldet, wenn eine Zeile betroffen war (verfeinert D231).** Das
  Plugin merkt sich das Ziel jedes Schreibbefehls; der Rahmen meldet nach dem Commit nur die
  Tabellen, bei denen mindestens eine Zeile geändert wurde. Ein `UPDATE`, das nichts trifft, lädt
  keine Liste neu. Das Kit vergleicht die gemeldeten Tabellen mit dem wirklichen Inhalt vorher und
  nachher und schlägt auch fehl, wenn eine geänderte Tabelle nicht gemeldet wurde. Ein Trigger, der
  eine zweite Tabelle schreibt, fällt so im Test auf und kommt nicht unbemerkt in die App.
  _Preis:_ rund 0,4 µs pro Schreibbefehl, gemessen. _Verworfen:_ jedes Schreibziel melden (Listen
  lüden neu, obwohl sich nichts geändert hat); Trigger im Plugin nachverfolgen (das Plugin sieht
  nur den Abfragebaum, nicht das Schema).
- **D244 Unerwartete Fehler und die Warnung ab 1.000 Zeilen gehen an eine Melde-Stelle des Rahmens
  (verfeinert D237, D238).** D237 und D238 nennen das lokale Fehlerprotokoll, das es erst mit #37
  gibt. Der Rahmen bekommt deshalb beim Start eine Funktion `report` und ruft sie mit einem von
  zwei Ereignissen auf: unerwarteter Fehler (mit Eintrag und Fehler) oder große Ergebnismenge (mit
  Eintrag und Zeilenzahl). Der Datenprozess reicht die Funktion durch. Bis #37 schreibt der
  Dev-Build auf die Konsole, die gepackte App nirgendwohin; #37 hängt das Protokoll an dieselbe
  Stelle, ohne dass ein Modul sich ändert. _Preis:_ rund 7 ns pro Abfrage für die Prüfung der
  Zeilenzahl, gemessen. In der gepackten App geht ein unerwarteter Fehler bis #37 nur als Fehler an
  den Aufrufer und wird nirgends festgehalten. _Verworfen:_ das Protokoll in #32 vorziehen (#37
  hat eigene offene Fragen); `console` fest im Rahmen (die gepackte App schriebe ins Leere, und
  Tests könnten nichts prüfen).
- **D245 Eine Blätter-Marke ist unsigniert und übersteht einen Neustart des Datenprozesses
  (verfeinert D236).** Die Marke enthält den Namen des Vertragseintrags, die Richtung und die
  Sortierwerte der Randzeile, als Base64 verpackt. Der Rahmen prüft sie beim Lesen: Name des
  Eintrags, Anzahl der Werte und jeder Wert gegen das Schema seiner Spalte; alles andere ist eine
  ungültige Eingabe. Eine Signatur gibt es nicht. Der Renderer ist kein Gegner, sondern Teil
  derselben App, und eine gefälschte Marke erreicht nur Zeilen, die dieselbe Abfrage mit ihren
  Space- und Löschfiltern ohnehin liefert. Führt eine Marke hinter das Ende, kommt eine leere Seite
  mit einer Marke zurück, die wieder zur letzten Zeile führt. _Offen:_ Zwei Module, die einer
  Seiten-Liste denselben Eintragsnamen geben, nehmen die Marken des jeweils anderen an; der
  Modulname gehört in die Marke, sobald das erste echte Modul eine Seiten-Liste hat (#33).
  _Verworfen:_ Signatur mit einem Schlüssel pro Prozess (jede Marke würde bei einem Neustart des
  Datenprozesses ungültig, und die offene Liste spränge an den Anfang); Schlüssel auf der Platte
  (ein Geheimnis mehr, ohne dass es etwas schützt).
- **D246 Ein Modul sieht vor dem Schreiben nach, ob das Ziel eines Verweises existiert (verfeinert
  D241).** Speichert eine Operation einen Verweis auf die Zeile eines anderen Moduls (ein
  Zeiteintrag auf ein Projekt), liest sie das Ziel zuerst über dessen Lese-Baustein. Fehlt es, ist
  es gelöscht oder liegt es in einem anderen Space, meldet sie „nicht gefunden“, und der
  Vertragseintrag nennt diesen Fehler. Ohne das Nachsehen käme ein fehlendes Ziel als interner
  Fehler beim Aufrufer an. Ob ein gelöschtes Ziel im Einzelfall doch erlaubt ist, entscheidet das
  Modul; die Vorlage `note-links` lehnt es ab. Der Fremdschlüssel in der Datenbank bleibt als
  zweite Sicherung. _Preis:_ eine Abfrage über den Primärschlüssel mehr pro Schreibvorgang mit
  Verweis, nicht gemessen. _Verworfen:_ der Rahmen übersetzt die Fremdschlüssel-Verletzung (SQLite
  nennt nicht, welcher Fremdschlüssel verletzt wurde; bei zwei Verweisen wüsste niemand, welches
  Ziel fehlt, und ein Ziel in einem fremden Space fiele gar nicht auf).

Richtigstellung zur Spezifikation in #32: Ein Port hat zwei Einstiege, `./contracts` und `./data`
(D187, D240). „Vier Einstiege“ in der ersten Fassung der Spezifikation war ein Schreibfehler; die
Texte von #32 und #209 sind korrigiert.
