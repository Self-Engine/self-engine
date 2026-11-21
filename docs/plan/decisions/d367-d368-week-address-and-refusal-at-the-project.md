# Runde 51 (2026-11-21): Nachträge aus dem Bau von #275: die Adresse der Woche von heute und die Ablehnung am Projektfeld (ändert die Adresse aus Runde 45 und zwei Kriterien von #275)

Grundlage: der Stand von #387 nach dem Code-Review, dem Check in der gebauten App und dem Review
von CodeRabbit.

- **Adresse laut Runde 45:** Der erste Tag der gezeigten Woche steht immer in der Adresse.
- **Gebaut in #342:** Die Woche von heute steht nicht in der Adresse, jede andere schon. Ohne
  Woche in der Adresse folgt die Ansicht dem Tag und zeigt am Montag die neue Woche.
- **Lücke im Gebauten (CodeRabbit):** Eine vorgeblätterte Woche behielt ihren Tag in der Adresse,
  auch nachdem sie zur Woche von heute geworden war. Sie folgte dem Tag dann nicht mehr.
- **Ablehnung laut #275:** Ein Speichern, das auf ein gelöschtes Projekt zeigt, wird abgelehnt und
  nennt das Projekt.
- **Gebaut:** Am Projektfeld steht „Das verknüpfte Projekt ist nicht mehr verfügbar.“ Den Namen
  nennt nur das abgelehnte „Rückgängig“.

- **D367 Die Adresse nennt keine Woche, solange die gezeigte Woche die von heute ist.** Das gilt
  für jeden Weg dorthin: über „Heute“, durch Blättern, über einen Link und dadurch, dass eine
  vorgeblätterte Woche zur Woche von heute wird. Die Ansicht nimmt den Tag dann aus der Adresse
  und überschreibt dabei den Eintrag im Verlauf. Jede andere Woche steht mit ihrem ersten Tag in
  der Adresse. _Gründe:_ Wer die App über das Wochenende offen lässt, sieht am Montag die neue
  Woche, ohne „Heute“ zu klicken. Dieselbe Ansicht verhält sich gleich, egal wie sie erreicht
  wurde. _Beispiel:_ Am Samstag, 21.11., blättert der Nutzer auf die Woche vom 23.11.; in der
  Adresse steht `week=2026-11-23`. Am Montag, 23.11., ist sie die Woche von heute, und die Adresse
  verliert `week`. Am 30.11. zeigt die Ansicht die Woche vom 30.11. _Preis:_ Ein Link, der in der
  Woche von heute kopiert wird, öffnet später die dann aktuelle Woche und nicht die kopierte. Wer
  eine feste Woche teilen will, kopiert den Link, solange sie nicht die Woche von heute ist.
  _Laufzeit:_ ein Effekt in der Ansicht, der nur läuft, wenn sich der Tag in der Adresse oder die
  Woche von heute ändert. Er schreibt die Adresse höchstens einmal je Wechsel. Die Spanne der
  Abfrage bleibt gleich, also lädt nichts neu. _Verworfen:_ wie in Runde 45 jede Woche in die
  Adresse schreiben (nach dem Wochenende stünde die alte Woche da, bis der Nutzer „Heute“ klickt);
  die Lücke lassen.
- **D368 Die Ablehnung am Projektfeld nennt die Art des Ziels, nicht seinen Namen.** Wird ein
  Zeiteintrag mit einem Projekt gespeichert, das inzwischen gelöscht wurde, steht am Projektfeld
  „Das verknüpfte Projekt ist nicht mehr verfügbar.“ Das abgelehnte „Rückgängig“ nennt das Projekt
  weiter beim Namen. _Gründe:_ Der Fall entsteht nur, während das Formular offen ist: Ein Projekt
  mit ungelöschten Einträgen lässt sich nicht löschen (D337), also geht es um das Projekt, das der
  Nutzer gerade selbst gewählt hat, und die Meldung steht an dessen Feld. Beim „Rückgängig“ ist
  kein Feld zu sehen, deshalb braucht die Meldung dort den Namen. _Beispiel:_ Das Formular ist
  offen, „Altlast“ ohne Einträge gewählt; in einem zweiten Fenster wird „Altlast“ gelöscht. Beim
  Speichern steht die Meldung am Projektfeld. _Preis:_ Das Kriterium aus #275 gilt nur noch für
  „Rückgängig“. _Laufzeit:_ keine. _Verworfen:_ den Namen am Feld nennen (zwei neue
  Schnittstellen, die jede spätere Auswahl nachbauen müsste).
