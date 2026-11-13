# Runde 36 (2026-11-14): Paket `time` (#104, ändert D148 und D149)

Grundlage: Messungen dieser Runde in Node 26.13 (V8 14.6, ICU 79.1) und in Electron 45.2.3
(V8 15.6, ICU 78.2), beide mit tzdata 2026e, und die Prüfung des alten Pakets in
[`research-layer-3-core.md`](../research-layer-3-core.md), Abschnitt 5a.

- **D279 `time` wird für die neue App geschnitten, nicht Datei für Datei übernommen (ersetzt den
  Übernahme-Teil von D148).** Jede Funktion braucht einen Nutzer in Sicht: Projekte, das Zeitmodul
  oder #110. Der alte Code ist Vorlage, kein Ausgangspunkt: Jede Funktion wird neu geschrieben oder
  bewusst übernommen, ohne die Uhr mit Standardwert, die Postgres-Formen, die Raster-Rundung und
  die Kleinteile alter Ansichten. Die alten Tests sind Prüfmaterial: Ihre Fälle zu Zeitumstellungen
  und Datumsgrenzen laufen gegen das neue Paket. Was erst Kalender, Assistent oder Mobile brauchen
  (Datumswörter, Geräte-Brücke, iCal-Helfer), bringt deren Paket mit eigener Begründung mit.
  Reihenfolge der Arbeitspakete, vom Owner gewählt: #104, #108, dann Schicht 4 mit Projekten als
  erstem Modul; #105, #106 und #111 folgen, sobald ein Modul sie braucht, #109 und #110 mit dem
  Zeitmodul. _Gründe:_ Das alte Paket trägt Altlasten der alten App (278 Stellen an der Uhr vorbei,
  Zeitzone als ungeprüfter Text, relative Anzeige in 24-Stunden-Blöcken), und der Zeiterfassung
  fehlt darin die Dauer. _Preis:_ Spätere Ergänzungen laufen über eigene Pull Requests an `time`.
- **D280 `time` rechnet mit Temporal, nach außen gibt es nur eigene Werte (ersetzt „Temporal statt
  `Intl`“ unter _Verworfen_ in D148).** Kein Temporal-Objekt verlässt das Paket; eine Lint-Regel
  verbietet `Temporal` außerhalb von `time` (D284). _Gemessen:_ Temporal ist im Datenprozess, in der
  Oberfläche und in den Tests vorhanden. Temporal und der `Intl`-Weg der alten App stimmen an
  20.806 Zeitumstellungen in 418 Zeitzonen von 1970 bis 2040 überein (104.030 Vergleiche, keine
  Abweichung, in beiden Laufzeiten). Der Tag eines Zeitpunkts kostet 50.000-mal 39 ms mit Temporal
  und 103 ms über `Intl` (Electron), also rund eine Mikrosekunde pro Umrechnung samt Einlesen des
  Textes; ein Zwischenspeicher entfällt. _Gründe:_ Rund 500 Zeilen eigener Rechenlogik für Offsets,
  Zeitumstellung und Kalender werden zu Aufrufen, und die Entscheidung bleibt umkehrbar, weil nur
  `time` Temporal sieht. _Folge für Web und Mobile:_ Laut Recherche vom 2026-11-14 fehlt Temporal im
  stabilen Safari (27.2) und in Hermes; `temporal-polyfill` (rund 19 kB gepackt) rüstet es nach,
  auf Hermes unbelegt. Wo Temporal fehlt, lädt die App den Ersatz beim Start, und das Prüfprogramm
  aus D285 muss auf dieser Laufzeit bestehen, bevor sie ausgeliefert wird. Der `Intl`-Weg wäre auf
  Hermes ebenso unbelegt. _Verworfen:_ eigener Code über `Intl` (mehr eigene Logik an der
  heikelsten Stelle, `Intl` macht aus `Asia/Kolkata` still `Asia/Calcutta`); Temporal direkt in
  allen Modulen (die Werte reisen als Text durch SQLite und zwischen den Prozessen, jedes Modul
  müsste umwandeln und hinge an Temporal).
- **D281 Fünf Zeitwerte, jeder mit einer gespeicherten Form.** Zeitpunkt `Instant`: Text in UTC mit
  Millisekunden, `2026-11-14T07:30:27.297Z` (besteht seit D223). Kalendertag `CalendarDay`: Text
  `2026-11-14`, ohne Uhrzeit und Zeitzone. Uhrzeit `WallClockTime`: Text `14:30`, nur Minuten
  (D149). Tagesspanne `DaySpan`: erster und letzter Tag, beide eingeschlossen, in zwei Spalten.
  Dauer `Duration`: ganze Zahl in Sekunden, nie negativ, Spalten enden auf `_seconds`. Alle Werte
  gelten für die Jahre 1000 bis 9999 und sind in TypeScript geprüfter Text bzw. geprüfte Zahl mit
  eigenem Typ und Zod-Schema. Der Abstand zweier Zeitpunkte schneidet beide erst auf die ganze
  Sekunde ab und zieht dann ab: Anschließende Einträge ergeben so zusammen genau die Dauer vom
  ersten Beginn bis zum letzten Ende. Ein Zeitraum aus Zeitpunkten endet offen: „1. bis
  30. November“ in Berlin ist alles ab `2026-10-31T23:00:00.000Z` und vor
  `2026-11-30T23:00:00.000Z`, ein Eintrag genau um Mitternacht gehört zu genau einem Tag.
  _Gründe:_ D145 rechnet Geld als Satz mal Sekunden durch 3600; bei 13 € pro Stunde ist eine
  Sekunde 0,36 Cent, und einzeln gerundete Abstände könnten bei 1.000 Einträgen bis zu 3,61 €
  verlieren. _Verworfen:_ Dauer in Millisekunden (unlesbar, verschiebt die Rundung in die
  Geldrechnung), Dauer in Minuten (ein Timer von 40 Sekunden wäre null oder eine Minute).
- **D282 Eine Zeitzone ist ein Name, den die Laufzeit kennt (ersetzt die Zweitnamen-Regel aus
  D149).** Gespeichert wird der Name, wie er gewählt wurde, in der offiziellen Schreibweise: Aus
  `europe/berlin` wird `Europe/Berlin`, `Asia/Kolkata` bleibt `Asia/Kolkata`. Zwei Zeitzonen
  vergleicht nur `time`, nie ein Textvergleich: `Asia/Calcutta` vom Gerät und `Asia/Kolkata` in der
  Einstellung sind dieselbe Zeitzone. Ein Abstand wie `+02:00` ist keine Zeitzone und wird
  abgelehnt. Der Typ `TimeZone` entsteht nur über eine Auflösungsfunktion; in der Datenbank steht
  ein Name als Text und geht beim Lesen durch sie. Kennt die Laufzeit den Namen nicht, gilt die
  Gerätezeitzone, und die Funktion meldet das dem Aufrufer (D147). _Gemessen:_ Die Liste der
  Laufzeit führt `Asia/Calcutta` und `Europe/Kiev`, aber weder `Asia/Kolkata` noch `Europe/Kyiv`
  noch `UTC`; Temporal nimmt alle an, behält den gegebenen Namen und erkennt Zweitnamen als gleich.
  _Grund:_ Die eigene Liste mit 438 Zeilen war die Antwort auf den `Intl`-Fehler und entfällt mit
  D280. _Preis:_ In der Datenbank können zwei Schreibweisen derselben Zeitzone stehen. Die
  Auswahlliste mit lesbaren Namen kommt mit #110.
- **D283 Die Umrechnung nennt den Fall der Zeitumstellung.** Aus Tag, Uhrzeit und Zeitzone entsteht
  ein Zeitpunkt und dazu der Fall: eindeutig, übersprungen oder doppelt, im doppelten Fall mit
  beiden Zeitpunkten. Ohne weitere Wahl gilt die übliche Regel: Von zwei Zeitpunkten der frühere,
  eine übersprungene Uhrzeit rückt um die Lücke vor (aus 02:30 wird 03:30). Der Beginn eines Tages
  hat eine eigene Funktion und ist nicht immer 00:00 (Kairo, 24. April 2026: 01:00). Tage werden
  nur an Kalendertagen gezählt; „plus ein Tag“ auf einem Zeitpunkt gibt es nicht, weil ein Tag 23,
  24 oder 25 Stunden hat. `time` fragt nie nach: Es gibt dem Aufrufer die Information, was ein
  Formular daraus macht, entscheidet Schicht 4. _Grund:_ Wer am 25. Oktober 2026 in Berlin ein
  Ende im zweiten 02:40 auf 02:45 korrigiert, verlöre mit der stillen Regel eine Stunde.
  _Verworfen:_ still die übliche Regel; Ablehnen mit Fehler (jeder Aufrufer müsste ihn behandeln).
- **D284 Die Uhr hat keinen Standardwert, `Date` und `Temporal` gibt es nur in `time` (ersetzt die
  Lint-Regeln aus D148 und D149).** Die Uhr ist eine Funktion, die einen Zeitpunkt liefert, und
  gehört `time`; `db` und `storage` nutzen sie von dort. Die Systemuhr hat einen eigenen Einstieg,
  den nur Code in `apps/` lädt; die drei Standardwerte von heute (`db`, Öffnen der Datendateien,
  Start des Datenprozesses) fallen weg. Die Lint-Regeln verbieten in `packages/` und `apps/`
  außerhalb von `time`, auch in Tests: `new Date` in jeder Form, `Date.now`, `Date.parse`,
  `Date.UTC`, `Temporal`, `Intl.DateTimeFormat`, `toLocaleDateString` und `toLocaleTimeString`.
  Das Importverbot für `date-fns`, `dayjs` und `luxon` aus D148 bleibt. Ein `Date` aus einer fremden
  Schnittstelle wird an der Grenze durch eine Funktion in `time` zum Zeitpunkt. Ein Modul sieht im
  Datenprozess weiter nur `now`, einmal pro Transaktion gelesen (D195). _Grund:_ Die sechs engeren
  Regeln erlaubten `new Date(ms)`, und `.getDate()` darauf liefert den Tag in der Zeitzone des
  Geräts; die strenge Regel passt in einen Satz und hat diese Lücke nicht. _Preis:_ #104 stellt
  13 Dateien und 16 Testdateien um, `backup` eingeschlossen; die Liste der Sicherungen zeigt ihren
  Zeitpunkt heute über `Intl.DateTimeFormat` ohne Zeitzone.
- **D285 Vier Prüfungen bei jedem `verify`, eine davon in Electrons Laufzeit (ersetzt die zweite
  Test-Zeitzone aus D148).** Erstens feste Fälle mit ausgeschriebenem Ergebnis, übernommen aus den
  Tests des alten Pakets, dazu Kairo und die doppelte Stunde. Zweitens vier Eigenschaften über
  zufällige Eingaben mit festem Startwert (`fast-check`): hin und zurück, Tage schließen lückenlos
  an, Textreihenfolge ist Zeitreihenfolge, Dauern addieren sich. Drittens der Vergleich von
  Temporal mit `Intl` an jeder Zeitumstellung aller Zeitzonen. Viertens ein kleines Prüfprogramm
  ohne Testläufer, das Vergleich, Zonennamen und feste Fälle in Electrons Laufzeit ausführt, in
  der Stufe `smoke`; Oberfläche und Datenprozess teilen sich diese Laufzeit. Dasselbe Programm ist
  später der Beweis für Web und Mobile (D280). Die Tests laufen wie alle in Pacific/Chatham; der
  zweite Lauf der Dateien `.tz.test.ts` in Los Angeles entfällt. _Größe:_ geschätzt 100 bis 150
  Tests neben den 2.103 von heute und rund eine Sekunde in der Stufe `test` (heute 25 s), dazu rund
  eine Sekunde in `smoke`, die bei unveränderter gebauter App aus dem Cache kommt. _Gründe:_ Die
  Tests laufen mit ICU 79.1, die App mit ICU 78.2, und bei den Zonennamen lagen die alten Fehler.
  Die zweite Zeitzone bräuchte einen zweiten Start des Testläufers und fängt nichts, was Chatham
  und D284 nicht fangen: Außerhalb von `time` kann die Gerätezeitzone nicht mehr einsickern, und
  innerhalb bekommt jede Funktion die Zeitzone als Argument, mit Zeitzonen westlich und östlich
  von UTC in den Testdaten. _Grenze:_ Temporal und `Intl` lesen dieselben Zeitzonen-Daten; ändert
  ein Land seine Zeitumstellung kurzfristig, kennt die App die Regel erst mit dem nächsten
  Electron-Update. Gespeicherte Zeitpunkte bleiben richtig. _Verworfen:_ nur Tests in Node; alle
  Tests zusätzlich in Electron (der Testläufer verlangt Node 26, Electron bringt 24.22 mit);
  Mindestabdeckung und Mutationstests (Aufwand ohne eigene Fehlerquelle).

## Vorgemerkt für spätere Grillings

Keine Entscheidungen, sondern Fragen, die diese Runde gefunden hat.

- **Zeiteintrag (Schicht 4), Reisen:** D147 lässt vergangene Zeitpunkte in der aktuellen Zeitzone
  erscheinen. Ein Eintrag von 19 bis 21 Uhr in Berlin steht nach dem Wechsel auf Bangkok am
  Folgetag von 1 bis 3 Uhr, und Tagessummen der Vergangenheit ändern sich. Neu prüfen. `time`
  trägt beide Antworten, weil jede Funktion die Zeitzone als Argument bekommt.
- **Zeiteintrag, doppelte Stunde:** Vorschlag: Das Formular löst ohne Nachfrage auf (beim Ändern
  der Zeitpunkt nächst dem bisherigen Wert, bei einem neuen Eintrag das Ende nach dem Beginn) und
  zeigt höchstens einen kleinen Hinweis.
- **Zeiteintrag, Zurückschreiben:** Ein Formular schreibt nur geänderte Felder zurück, sonst
  verliert ein Timer seine Sekunden (D281, Uhrzeit nur in Minuten). Dazu die Frage, ob Zeiteinträge
  Zeitpunkte auf ganzen Sekunden tragen.
- **Erste Ansicht, Uhr der Oberfläche:** woher eine Ansicht „jetzt“ und „heute“ bekommt; dazu die
  benannten Anzeigeformate.
- **Zeiteintrag und Sync:** was gilt, wenn die Systemuhr zurückspringt oder zwei Geräte
  verschiedene Zeit haben.
