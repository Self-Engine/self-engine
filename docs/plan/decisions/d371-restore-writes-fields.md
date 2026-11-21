# Runde 53 (2026-11-21): Nachtrag aus dem Bau von #277: Das Zurückholen einer Zeile schreibt zugleich Felder

Grundlage: der Stand des Integrations-Branchs von #277 nach Slice #348.

- **Laut D349:** Der Zeiteintrag bekommt die Id des Timers. Ein Stopp nach „Stoppen rückgängig“
  holt den gelöschten Eintrag mit derselben Id zurück und schreibt Ende, Dauer und Zeitzone neu.
- **Laut D337:** Das Zurückholen einer Zeile wird abgelehnt, wenn ein Ziel, auf das sie zeigt,
  gelöscht ist.
- **Lücke im Gebauten (#348):** Der Rahmen holt eine Zeile zurück (`restore`) und ändert sie
  danach (`update`). Die Verweis-Prüfung des Zurückholens beurteilt das Projekt, das noch in der
  gelöschten Zeile steht, bevor das neue hineingeschrieben wird. _Ablauf:_ stoppen mit Projekt
  „Altlast“; „Rückgängig“; den Timer auf ein anderes Projekt umstellen; „Altlast“ löschen (keine
  lebende Zeile zeigt mehr darauf); erneut stoppen. Der Stopp wird dauerhaft abgelehnt, und der
  Timer lässt sich nur noch verwerfen.

- **D371 Das Zurückholen einer Zeile im Speicher-Rahmen kann zugleich Felder schreiben.**
  `restore` bekommt ein optionales Argument für Felder. Die Zeile kommt mit diesen Werten zurück,
  in einem Schreibvorgang, und Schutzregeln und Verweis-Prüfung beurteilen die Zeile so, wie sie
  danach steht: für ein mitgeschriebenes Feld den neuen Wert, für jedes andere den gespeicherten.
  Ohne Felder bleibt alles wie bisher. _Gründe:_ Die Sackgasse ist zu, ohne dass eine gelöschte
  Zeile Daten verliert. Jede spätere Operation über zwei Tabellen, die eine Zeile mit derselben
  Id wieder aufnimmt (D349), hat denselben Weg. _Beispiel:_ Im Ablauf oben kommt der Eintrag mit
  dem neuen Projekt, dem neuen Ende, der Dauer und der Zeitzone zurück; „Altlast“ wird nicht mehr
  geprüft. _Preis:_ eine Erweiterung an einem Schreibweg, den alle Module nutzen. _Laufzeit:_
  nicht messbar; Zurückholen und Ändern werden ein Schreibvorgang statt zwei (ein Stopp nach
  „Rückgängig“ lag bei 0,20 ms). _Verworfen:_ „Rückgängig“ leert das Projekt des Eintrags, bevor
  es ihn löscht (die gelöschte Zeile verlöre ihr Projekt und käme aus dem Papierkorb ohne es
  zurück); die Lücke lassen.
