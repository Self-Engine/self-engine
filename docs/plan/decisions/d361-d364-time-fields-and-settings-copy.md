# Runde 48 (2026-11-21): Nachträge aus dem Bau von #332 und #109 (überholt D347.1 und D348.4, ergänzt D344, benennt die Kopie aus D351)

Grundlage: der Stand auf `main` nach #378. Die vier Fragen sind beim Bau von #332 und #109
entstanden und standen seitdem offen.

- **Doppelte Stunde heute:** Beim Bearbeiten gilt der Zeitpunkt, der dem bisherigen Wert am
  nächsten liegt (D347.1). Zum Gleichstand sagt D347 nichts; gebaut war „dieselbe der beiden
  Stunden“. Das Abnahmekriterium von #337 („eine Korrektur innerhalb der doppelten Stunde bleibt
  in derselben Stunde“) widersprach D347.1.
- **Feld „Datum, Beginn, Ende“ heute:** Eine Ende-Uhrzeit, die nicht nach der Beginn-Uhrzeit
  liegt, gilt als Folgetag und zeigt „+1“. Gebaut ist dasselbe für einen Beginn, der hinter das
  Ende geschoben wird; D344 und der Vorschlag aus Runde 45 nennen den Fall nicht.
- **Uhr der Oberfläche heute:** Der gemeinsame Wecker wartet höchstens eine Minute, auch für
  „heute“. D348.4 verlangte einen einzelnen Wecker zum Tagesbeginn.
- **Einstellungen heute:** Die synchronisierten Einstellungen liegen in der Datenbank; eine Kopie
  im `localStorage` beantwortet das erste Bild (D351). ADR 0010 und der Code nannten sie „local
  copy“, das Glossar hatte keinen Begriff.

- **D361 Eine Korrektur innerhalb der doppelten Stunde bleibt in derselben der beiden Stunden
  (überholt D347.1).** Liegt der bisherige Wert selbst in der doppelten Stunde, gilt beim
  Bearbeiten die Uhrzeit auf derselben Seite der Zeitumstellung, egal wie weit die Korrektur die
  Minuten verschiebt. Nur wenn der bisherige Wert außerhalb liegt, gilt der Zeitpunkt, der ihm am
  nächsten liegt. Die Regel für einen neuen Wert (D347.2) bleibt. _Gründe:_ Der Vermerk am Feld
  wechselt nur, wenn der Nutzer die Uhrzeit bewusst über die Grenze schiebt. Der Gleichstand ist
  damit entschieden: Er kommt nur innerhalb der doppelten Stunde vor. _Beispiel (Berlin, 25.
  Oktober 2026):_ Der bisherige Wert ist das zweite 2:05 (UTC+1). Die Korrektur auf 2:55 ergibt
  das zweite 2:55; nach D347.1 wäre es das erste gewesen, weil es nur 10 Minuten davor liegt statt
  50 danach, und der Vermerk wäre auf UTC+2 gesprungen. _Preis:_ Wer in der doppelten Stunde von
  der einen in die andere wechseln will, muss die Uhrzeit erst aus ihr herausschieben. Das betrifft
  eine Stunde im Jahr. _Laufzeit:_ eine Abfrage der Zeitumstellung je Auflösung einer doppelten
  Uhrzeit beim Bearbeiten, sonst nichts. _Verworfen:_ „am nächsten“ wie in D347.1 (eine Korrektur
  um mehr als die halbe Länge der Umstellung wechselt die Stunde, ohne dass der Nutzer es wollte).
- **D362 Ein Beginn, der hinter das Ende geschoben wird, rückt das Ende auf den Folgetag
  (ergänzt D344 und den Vorschlag „Feld für die Zeit“ aus Runde 45).** Das Ende zeigt „+1“ und
  behält seine Sekunden. Es ist dieselbe Regel wie für eine Ende-Uhrzeit, die nicht nach der
  Beginn-Uhrzeit liegt. _Beispiel:_ Ein Eintrag läuft von 10:00 bis 12:00; der Beginn wird auf
  13:00 gestellt. Das Ende ist dann 12:00 am Folgetag, und der Eintrag dauert 23 Stunden. _Gründe:_
  Das Feld hat eine Regel für „Ende nicht nach Beginn“, egal welche der beiden Uhrzeiten sich
  bewegt hat. Die Dauer unter dem Feld zeigt die Folge vor dem Speichern (D347.5). _Preis:_ Ein
  Vertipper beim Beginn ergibt einen langen Eintrag statt einer Meldung; „+1“ und die Dauer sind
  der einzige Hinweis. _Laufzeit:_ keine. _Verworfen:_ das Ende lassen und eine Meldung zeigen
  (zwei Regeln für denselben Zustand des Feldes).
- **D363 „Heute“ wechselt über den gemeinsamen Wecker, der höchstens eine Minute wartet
  (überholt D348.4).** Ein Takt, der nichts Fälliges findet, zeichnet nichts neu und stellt den
  nächsten Wecker. _Gründe:_ Ein Wecker zählt die Zeit nicht, die der Rechner im Ruhezustand war.
  Ein einzelner Wecker zum Tagesbeginn könnte Stunden zu spät feuern, und „stimmt nach dem
  Ruhezustand sofort wieder“ aus D348.3 gälte für „heute“ nicht. _Laufzeit:_ ein Wecker pro
  Minute, solange jemand zuhört und das Fenster sichtbar ist; er liest die Uhr einmal und
  vergleicht eine Zahl je Takt. Kein Neuzeichnen, solange nichts fällig ist. _Verworfen:_ der
  einzelne Wecker; auf das Aufwachen des Rechners hören (ein zweiter Weg neben dem Wecker, der
  einen Sprung der Uhr nicht abdeckt).
- **D364 Die Kopie der synchronisierten Einstellungen heißt „Settings Copy“ (de:
  Einstellungskopie).** Der Begriff steht im Glossar, ADR 0010 und der Code benutzen ihn.
  _Gründe:_ „local copy“ stand in ADR 0010 und im Code, ohne Eintrag; der `Start Cache` ist etwas
  anderes, er malt nur das erste Bild. _Verworfen:_ kein Eintrag.

## Vorgemerkt

- **Typ der Zeitwerte im Entwurf eines Formulars:** ob die Schemas von `time` ihre Marke auch auf
  der Eingabe eines Vertrags verlangen. Vor #275. _Entschieden in D365._
- **Popovers der Datums- und Zeitfelder (#377):** vor dem Formular des Zeiteintrags.
- **Laden der Modulanzeige gegen das erste Bild:** vor #277, mit der Messung der Timer-Anzeige.
