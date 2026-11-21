# Runde 52 (2026-11-21): Nachträge aus dem Bau von #277: der Eingabefehler, den eine Operation selbst meldet, und Mantines Verhalten an den Datums- und Zeitfeldern (#377 bleibt offen)

Grundlage: der Stand des Integrations-Branchs von #277 nach den Slices #346 und #352, und die
Befunde aus #377.

- **Laut Spec von #277:** Ein Timer-Beginn in der Zukunft und ein falsches Ende bei „Stoppen um …“
  werden am Feld gemeldet wie ein Eingabefehler, weil die Grenze das „Jetzt“ des Datenprozesses
  ist (D348). Wie die Meldung ans Feld kommt, stand nicht fest.
- **Stand vor der Runde:** Die Seite kennt vier Antworten einer Operation neben dem Erfolg: nicht
  gefunden, Konflikt, Ablehnung und unerwartet. Ein Eingabefehler, den der Datenprozess meldet,
  zählt als unerwartet und erreicht kein Feld. Die Prüfung der Seite nutzt das Eingabe-Schema des
  Vertrags (D317) und kennt das „Jetzt“ des Datenprozesses nicht.
- **Gebaut in #346:** `inputError(Pfad, Grund)` im Paket `storage`. Eine Operation meldet damit
  einen Eingabefehler in derselben Form wie die Eingabeprüfung des Rahmens.
- **#377:** Kalender und Zeitliste öffnen sich bei jedem Fokus und verdecken nach einem
  blockierten Speichern die Meldung; Esc schließt die Zeitliste nicht. Beides ist das eingebaute
  Verhalten von Mantines `DateInput` und `TimePicker` (gelesen in 9.8.0 und 9.8.2). Mantine hat
  dafür keine Einstellung; ändern heißt, das Öffnen über `popoverProps.opened` zu übernehmen.

- **D369 Eine Grenze, die nur der Datenprozess kennt, meldet die Operation als Eingabefehler, und
  das Formular zeigt ihn am Feld.** Die Operation ruft `inputError` mit dem Feld und einem Grund.
  Die Seite bekommt dafür eine eigene Antwort „Eingabe ungültig“ neben Konflikt und Ablehnung, und
  `forms` zeigt den Grund am genannten Feld, mit demselben Weg zum Text wie bei der Prüfung auf der
  Seite. _Gründe:_ Ein Weg für beide Fälle des Timers und für jeden Aufrufer, auch einen ohne
  Bildschirm. Die Meldung bleibt, was sie ist, ein Eingabefehler; sie kommt nur später.
  _Beispiel:_ Um 15:05 wird der Beginn eines laufenden Timers auf 15:10 gesetzt. Die Operation
  schreibt nichts, und am Feld „Beginn“ steht, dass der Beginn nicht in der Zukunft liegen darf.
  _Abgrenzung:_ Eine Grenze, die vom Datenbestand abhängt, bleibt eine Schutzregel mit Ablehnung
  (D331–D340). D369 gilt für Grenzen an der Eingabe selbst, die erst der Datenprozess beurteilen
  kann, bisher sein „Jetzt“. _Preis:_ eine neue Antwortart, die jedes Formular kennt. Der Grund
  ist ein einfacher Text wie bei den Gründen des Eingabe-Schemas („Ende vor Beginn“); fehlt sein
  Text, schlägt eine Story fehl, nicht der Compiler. _Laufzeit:_ ein Vergleich je Operation, nicht
  messbar. _Verworfen:_ die Seite mit ihrer eigenen Uhr prüfen lassen (die Regel stünde an zwei
  Stellen, und `forms` bräuchte eine Prüfung neben dem Vertrag); eine Schutzregel mit Ablehnung
  (passt für den Beginn des Timers, nicht für „Stoppen um …“: das Ende landet im Zeiteintrag, und
  dort sind Einträge in der Zukunft erlaubt); als Konflikt melden (ein Konflikt ist ein doppelter
  Wert).
- **D370 Die Datums- und Zeitfelder behalten vorerst Mantines Verhalten.** An den Befunden aus
  #377 wird jetzt nichts geändert, auch nicht an den dort genannten Ideen (Fokus auf den Teil mit
  dem Problem, die Meldung des Bereichs unter der ganzen Zeile). _Gründe:_ Der Owner will solche
  Anpassungen an Mantines Verhalten später überlegt und für alle Stellen gemeinsam entscheiden,
  nicht einzeln während eines Arbeitspakets. _Folge:_ Die Befunde gelten als bekannt; ein
  App-Check führt sie als bekannt, nicht als Befund. Das Formular des Timers (#350) nutzt die
  Felder unverändert. #377 bleibt mit `needs-grilling` offen. _Laufzeit:_ keine. _Verworfen:_ nur
  die zwei Lücken schließen; das Öffnen auf Klick und eine Taste beschränken.
