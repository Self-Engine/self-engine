# Runde 54 (2026-11-21): Nachtrag aus dem Bau von #277: Der Hinweis „Uhr vor dem Start“ öffnet das Formular des Timers

Grundlage: der Stand des Integrations-Branchs von #277 nach allen Slices und die Prüfung gegen
die Spec.

- **Laut D349:** Liegt die Uhr des Datenprozesses beim Stopp vor dem Start des Timers, speichert
  der Stopp nichts, und der Timer läuft weiter. Die Uhr des Computers wurde dann zurückgestellt,
  während der Timer lief.
- **Laut D358:** Der Hinweis dazu bietet „Stoppen um …“ an und öffnet das Panel des Timers an
  diesem Teil.
- **Lücke im Gebauten (#350):** „Stoppen um …“ nimmt nur ein Ende an, das nach dem Start und
  nicht nach „jetzt“ liegt. Solange die Uhr vor dem Start steht, gibt es kein solches Ende. Der
  Knopf am Hinweis führt also zu einem Formular, das in genau dieser Lage jede Eingabe ablehnt.
  _Ablauf:_ Start um 14:00; die Uhr springt auf 13:00; „Stopp“; der Hinweis erscheint; „Stoppen
  um …“; jedes Ende ab 14:00 liegt in der Zukunft, jedes davor vor dem Start.

- **D372 Der Hinweis „Uhr vor dem Start“ öffnet das Formular des Timers.** Der Knopf am Hinweis
  heißt „Timer bearbeiten“ und öffnet das Panel am Teil mit dem Formular. Dort lässt sich der
  Start korrigieren, wonach der Stopp normal gelingt, oder der Timer verwerfen. Ist das Panel
  schon an „Stoppen um …“ offen, wechselt es zum Formular. Ein Aufrufer ohne Bildschirm bekommt
  wie bisher den Hinweis ohne Knopf. _Gründe:_ Beide Wege, die aus der Lage herausführen, liegen
  in diesem Teil des Panels. _Beispiel:_ Im Ablauf oben stellt die Person den Start auf 12:00
  und stoppt; der Eintrag läuft von 12:00 bis 13:00. _Preis:_ ein anderes Ziel und ein anderer
  Text an einem Knopf; D358 gilt für diesen Hinweis nicht mehr. _Laufzeit:_ keine Änderung; der
  Knopf lädt dasselbe Panel wie zuvor. _Verworfen:_ „Stoppen um …“ nimmt in dieser Lage ein
  Ende nach „jetzt“ an (die App speicherte ein Ende, das nach ihrer eigenen Uhr in der Zukunft
  liegt); den Knopf weglassen (die Person müsste den Weg selbst finden).

- **Bekannte Folge, nichts gebaut:** Wird in dieser Lage ein zweiter Timer gestartet, bleibt der
  erste laufen (sein Stopp speichert nichts), und der Hinweis erscheint. Der Modul-Indikator
  und sein Panel zeigen weiter den ersten Timer, weil sie den mit dem spätesten Start zeigen,
  und die Zahl „2“ steht daneben. Wird der Start des ersten vor den des zweiten gelegt oder der erste
  verworfen, zeigt der Indikator den zweiten. _Grund:_ Der Fall setzt eine zurückgestellte Uhr und einen
  weiteren Start voraus; die Zahl und der Hinweis zeigen, dass zwei Timer laufen, und der Knopf
  aus D372 führt zu dem Timer, der im Weg steht.
