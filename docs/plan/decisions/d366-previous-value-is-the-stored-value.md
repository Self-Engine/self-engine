# Runde 50 (2026-11-21): Der bisherige Wert beim Bearbeiten in der doppelten Stunde (schärft D361)

Grundlage: der Stand auf `main` nach #383 und die Prüfung von #383 in den Stories des Feldes
„Datum, Beginn, Ende“.

- **Regel heute (D361):** Liegt der bisherige Wert in der doppelten Stunde, bleibt eine Korrektur
  auf derselben Seite der Zeitumstellung.
- **Feld heute:** Das Zeitfeld von Mantine meldet jeden Tastendruck. Wer „0255“ über 2:45 tippt,
  läuft über 0:45. Als bisheriger Wert galt der Wert, den der Entwurf gerade hält, also auch
  dieser Zwischenstand.
- **Befund:** Der Eintrag endet im zweiten 2:45 (UTC+1), das Enddatum ist offen. Nach „0255“ stand
  das erste 2:55 (UTC+2): Von 0:45 aus liegt es näher. D361 griff nur, wenn allein die Minuten
  geändert wurden. So war es schon vor D361.

- **D366 Beim Bearbeiten ist der bisherige Wert der Wert, mit dem das Feld gezeichnet wurde, nie
  ein Zwischenstand beim Tippen (schärft D361).** In einem Bearbeitungsformular ist das der
  gespeicherte Wert, oder der Wert, der zuletzt von außen kam (D324). Hält das Feld dort keinen
  Wert, gilt die Regel für einen neuen Wert (D347.2). _Gründe:_ Das Ergebnis darf nicht davon
  abhängen, welche Ziffern auf dem Weg getippt wurden. _Beispiel (Berlin, 25. Oktober 2026):_ Der
  gespeicherte Wert ist das zweite 2:40. „0255“ läuft über 0:40 und ergibt das zweite 2:55.
  _Preis:_ In einem Bearbeiten lässt sich die Seite der Zeitumstellung nicht mehr wechseln; der
  Umweg aus D361, die Uhrzeit erst aus der doppelten Stunde herauszuschieben, entfällt. Ein Eintrag
  in der zweiten der beiden Stunden entsteht nur durch einen Timer, wie schon für neue Einträge
  nach D347. _Laufzeit:_ keine. _Verworfen:_ der Wert, den der Entwurf gerade hält (das Ergebnis
  hängt vom Tippweg ab).

## Vorgemerkt

- **Ende auf eine frühere Uhrzeit in der doppelten Stunde (#384):** Das Feld legt es auf den
  Folgetag, obwohl das zweite Vorkommen am selben Tag nach dem Beginn liegt.
