# Runde 56 (2026-11-24): Arbeitsablauf: Wayfinder-Karte für große Vorhaben

Anlass: Der Owner will Projekte und Zeiterfassung ausbauen, bis sie für sich nutzbar sind und
Schritt für Schritt können, was die alte App kann, jede Funktion neu durchdacht statt übernommen.
Das sind viele Entscheidungen über Wochen. Die späten lassen sich heute noch nicht scharf
formulieren.

- **D374 Ein großes Vorhaben wird über eine Wayfinder-Karte entschieden, nicht über ein
  Schicht-Grilling.** Die Karte ist ein Issue mit dem Label `wayfinder:map`. Ihre Tickets sind
  Teil-Issues mit je einer Entscheidungsfrage und dem Label `wayfinder:<art>`; sie tragen kein
  Bau-Label. Eine Sitzung löst ein Ticket. Was sich noch nicht scharf fragen lässt, steht auf der
  Karte unter „Not yet specified“ und wird zum Ticket, sobald es greifbar ist. Die Karte ersetzt
  für ihr Vorhaben die Stufen 1 und 2 des Ablaufs und endet, wenn ihr letztes Ticket die
  Arbeitspakete geschnitten hat. Gebaut wird auf dem bisherigen Weg eines Arbeitspakets. Die
  Übersichtsseite zeigt Karte und Tickets nicht, weil sie Entscheidungen sind und keine Bauarbeit;
  die Schicht verweist in `roadmap.json` auf die Karte. Erste Karte: #396, die Zeiterfassung nach
  Schicht 4. _Grund:_ Ein Schicht-Grilling in voller Tiefe würde wochenlang entscheiden, bevor
  etwas gebaut wird, und die späten Entscheidungen wären beim Bau veraltet. _Verworfen:_ das
  Schicht-Grilling wie bisher; eine Themenliste ohne Werkzeug (kein Platz für das Unscharfe, kein
  sichtbarer Stand, jede Sitzung trägt den ganzen Verlauf mit); eine Karte, die auch den Bau
  trägt (sie wird nie fertig und verliert den Überblick).
- **D375 Die Entscheidungen einer Karte stehen in ihren Tickets.** Der Lösungskommentar eines
  Tickets hält die Entscheidung fest, die Karte listet sie mit einer Zeile. Dafür gibt es keine
  Runde im Log und keinen Docs-PR je Ticket. Ändert ein Ticket einen Eintrag einer Runde, nennt
  der Lösungskommentar ihn, und der Eintrag bekommt den Vermerk `_Geändert durch #<Ticket>._` mit
  dem nächsten Docs-PR. ADRs und Glossar kommen weiter mit dem Bau, weil sie beschreiben, was der
  Code tut; der Lösungskommentar nennt die gewählten Begriffe mit ihrem deutschen Wort. _Preis:_
  Entscheidungen liegen an zwei Orten, im Log und in Tickets. Die Übersicht in `00-decisions.md`
  nennt deshalb jede Karte. _Verworfen:_ jede Ticket-Entscheidung zusätzlich als D-Nummer
  (doppelte Pflege, und die Nummern stoßen zwischen Zweigen zusammen, wie bei D157 beschrieben).
- **D376 Recherche für eine Karte liegt in `docs/research/`, auf Englisch.** Bestandsaufnahmen
  und Recherchen, die mehrere Tickets brauchen, werden einmal abgelegt und von der Karte
  verlinkt, damit keine Sitzung sie wiederholt. Jede Datei nennt ihr Datum und wird nicht
  nachgeführt. Englisch, weil Karte und Tickets englisch sind. _Verworfen:_ die Ergebnisse nur im
  Gesprächsverlauf (die nächste Sitzung sieht sie nicht); ein Branch, der nie gemergt wird (ein
  frischer Checkout hat die Dateien nicht).

## Mit dieser Runde schon entschieden

Zwei Tickets der Karte #396 sind in der Sitzung gelöst worden, die sie angelegt hat:

- **#397:** Der Ausbau von Projekten und Zeit kommt vor dem Import. Das ändert die Reihenfolge aus
  D12 und D316; `roadmap.json` führt den Ausbau als Schicht 5 und den Import als Schicht 6.
- **#398:** Die Einheit der erfassten Zeit ist ein Zeiteintrag mit Strecken darin.
