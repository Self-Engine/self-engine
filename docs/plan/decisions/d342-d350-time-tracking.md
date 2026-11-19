# Runde 45 (2026-11-19): `time-tracking` (#275, #277 und #332, ergänzt D147, schärft D308 und D310, füllt die Lücke aus ADR 0027, ändert die Reihenfolge aus D316)

Grundlage: der Stand auf `main` nach #330 und die alte App (nur gelesen, Pfad in
`research-layer-3-core.md`).

- **`time` heute:** fünf Zeitwerte (Zeitpunkt mit Millisekunden, Kalendertag, Uhrzeit in Minuten,
  Tagesspanne, Dauer in ganzen Sekunden). Jede Umrechnung bekommt die Zeitzone als Argument. Die
  Umrechnung von Tag und Uhrzeit in einen Zeitpunkt meldet, ob die Uhrzeit eindeutig ist,
  übersprungen wird oder doppelt vorkommt, und entscheidet nichts selbst (D283). Die Dauer zwischen
  zwei Zeitpunkten schneidet beide auf die Sekunde (D281).
- **Uhr heute:** Der Typ der Uhr gehört `time`, keine Funktion hat einen Standard dafür, und die
  Systemuhr lässt sich nur aus `apps/` laden. Außerhalb von `time` verbietet eine Lint-Regel `Date`
  und `Temporal`. Die Oberfläche hat noch keine Uhr; ADR 0027 hat die Frage auf die erste Ansicht
  vertagt, die „jetzt“ und „heute“ braucht.
- **Speicher-Rahmen heute:** Eine Transaktion darf mehrere Tabellen schreiben und löst genau eine
  Tabellenmeldung aus. Beim Anlegen reicht der Aufrufer die Id der Zeile.
- **Rückgängig heute:** Die Seite ruft nach einer Änderung die umgekehrte Operation auf
  (`projects`: Löschen und Wiederherstellen). Jede dieser Operationen schreibt eine Tabelle.
- **Alte App, Rundung:** eine Einstellung mit Intervall, Richtung (auf, ab, nächster Wert) oder
  Zeitabschnitten, mit Vorrang Timer vor Projekt vor Einstellungen. Der Standard ist „aufrunden
  auf 1 Minute“. Die Anzeige einer Dauer rundet die Minuten ebenfalls auf, ohne Einstellung.
- **Alte App, Mitternacht:** Ein Eintrag wird an der Tagesgrenze der Zeitzone geschnitten; die
  Dauer wird anteilig verteilt, und der letzte Teil bekommt den Rest.
- **Reihenfolge:** #275 hängt an #110 (Zeitzone und Wochenstart) und #110 an #109 (Einstellungen
  in der Datenbank). Beide sind noch nicht gegrillt.

- **D342 Ein Zeiteintrag bleibt ein genauer Zeitpunkt und merkt sich die Zeitzone, in der er
  entstand (ergänzt D147, beantwortet „Reisen“ aus Runde 36).** Tag, Uhrzeit und Woche eines
  Eintrags folgen weiter der aktuellen Zeitzone der Einstellung, wie in D147. Daneben speichert
  `time_entries` in einer eigenen Spalte den Namen der Zeitzone, die bei seinem Entstehen galt.
  Schicht 4 zeigt sie nicht an und rechnet nicht mit ihr. _Gründe:_ Der Owner: Ein Zeiteintrag ist
  ein genauer Zeitpunkt; die Zeitzone kann später interessant werden. Nachträglich lässt sie sich
  nicht mehr gewinnen: Käme die Spalte erst nach einem Jahr, bekämen alle alten Einträge eine
  geratene Zeitzone. Das wäre derselbe Fehler wie die gerundete Zeit der alten App (D308).
  _Beispiel:_ Ein Eintrag vom Sonntag, 15. November 2026, von 19 bis 21 Uhr in Berlin steht nach
  dem Wechsel auf Bangkok am Montag von 1 bis 3 Uhr und zählt zur nächsten Woche. Die Spalte hält
  `Europe/Berlin` fest. _Preis:_ Wochen- und Monatssummen der Vergangenheit können sich bei einem
  Wechsel der Zeitzone verschieben; der Owner nimmt das an. Eine Spalte, die vorerst niemand liest.
  _Laufzeit:_ keine; die Operation liest die Einstellung ohnehin. _Verworfen:_ Tag, Uhrzeit und
  Woche in der Zeitzone des Eintrags rechnen (meine Empfehlung; der Owner: der Zeitpunkt zählt,
  die Zeitzone ist nur für später); nur den Kalendertag speichern (unter „Sonntag“ stünde „1 bis
  3 Uhr“); nichts speichern.
- **D343 Ein Eintrag über Mitternacht bleibt eine Zeile und erscheint an jedem Tag, den er
  berührt, mit seinem Tagesanteil.** Jeder Tag zählt den Teil des Eintrags, der in ihm liegt, und
  zeigt den Eintrag mit einem Vermerk, dass er über Mitternacht läuft. Dasselbe gilt an der
  Wochengrenze. Die Anteile eines Eintrags ergeben zusammen immer genau seine Dauer. Löschen,
  Bearbeiten und Rückgängig treffen immer den ganzen Eintrag. Die Verteilung sitzt in einer
  einzigen Funktion; Schicht 4 hat dafür keine Einstellung. _Gründe:_ Der Owner: Der Eintrag soll
  nicht geteilt werden, aber an den verschiedenen Tagen erscheinen. _Beispiel:_ Sonntag 22 Uhr
  bis Montag 2 Uhr bei Wochenstart Montag: Sonntag 2:00, Montag 2:00; die alte Woche zählt 2:00,
  die neue 2:00. _Preis:_ Die Wochen-Abfrage holt jeden Eintrag, der das Fenster berührt, nicht
  nur die, die in ihm beginnen. Ein Eintrag kann in der Woche zweimal stehen. Sobald Rundung oder
  Pausen die Dauer von Ende minus Beginn abweichen lassen, braucht die Verteilung eine Regel; die
  entscheidet das Arbeitspaket zur Rundung. Fest steht nur, dass die Anteile zusammen die Dauer
  ergeben. _Laufzeit:_ je Eintrag ein Vergleich mit den Tagesgrenzen des Fensters, die `time`
  einmal je Abfrage rechnet. Nicht gemessen; die Messung der Wochenansicht mit Daten von zwei
  Jahren deckt es ab. _Verworfen:_ Der Eintrag zählt ganz zum Tag seines Beginns (meine
  Empfehlung; eine Nachtschicht von 22 bis 6 Uhr legte 8 Stunden auf den ersten Tag); der Tag des
  Endes; die Zeile beim Speichern teilen; die Wahl schon in Schicht 4 einstellbar machen (es wäre
  die erste Einstellung eines Moduls, die der Datenprozess bei jeder Abfrage liest, mit zwei
  Rechenwegen; siehe „Vorgemerkt“).
- **D344 Beginn und Ende liegen auf ganzen Sekunden, und das Ende liegt mindestens eine Sekunde
  nach dem Beginn (beantwortet die offene Frage aus D281, schärft D308).** Die Operation schneidet
  die Millisekunden beim Schreiben ab. Ein Timer, der in derselben Sekunde gestoppt wird, in der
  er begann, wird verworfen statt zu einem Eintrag, und der Hinweis sagt das. Summen rechnen mit
  Sekunden. _Gründe:_ Was gespeichert ist, ist genau das, was zählt: Die Dauer ist Ende minus
  Beginn, ohne dass beim Rechnen etwas abgeschnitten wird. _Beispiel:_ Die Uhr misst den Start um
  10:00:50,297 und den Stopp um 10:05:10,812; gespeichert wird 10:00:50 bis 10:05:10, und der
  Eintrag zählt 4:20. _Folge:_ Das Formular kennt Uhrzeiten nur in Minuten. Ein Feld, das der
  Nutzer nicht anfasst, behält seinen Zeitpunkt samt Sekunden (D319, D323). _Verworfen:_
  Millisekunden behalten (gespeichert stünde mehr, als je zählt); ganze Minuten (jeder
  Timer-Eintrag wäre an beiden Enden um bis zu 59 Sekunden verschoben, was „nie gerundet“ aus D308
  widerspricht, und ein Timer von 40 Sekunden wäre null).
- **D345 Schicht 4 rundet die zählende Dauer nicht; die Anzeige rundet auf die volle Minute auf
  (D309 bleibt).** Ein Timer von 4:20 zählt 4:20 und wird als „0:05“ angezeigt. Jede Dauer und
  jede Summe wird aus den Sekunden gerechnet und erst dann für die Anzeige aufgerundet. Nur der
  laufende Timer zeigt Sekunden. _Gründe:_ Der Owner: Normalerweise wird aufgerundet, und das
  soll eine Einstellung sein wie in der alten App. Diese Regel ist das Arbeitspaket zur Rundung
  (D309). Die Anzeige zeigt schon jetzt die Zahl, die der spätere Standard „aufrunden auf 1
  Minute“ aus dem Eintrag macht. Der Owner nutzt die alte App weiter (D315); die Einträge aus
  Schicht 4 sind bis dahin Testdaten, und die Regel lässt sich verlustfrei auf sie anwenden, weil
  die Zeitpunkte bleiben. _Preis:_ Die sichtbaren Zahlen ergeben nicht immer die sichtbare Summe:
  Zwei Timer-Einträge von 44:10 und 20:10 zeigen „0:45“ und „0:21“, ihre Summe von 64:20 aber
  „1:05“. Das betrifft nur Einträge aus einem Timer; von Hand eingetragene liegen auf vollen
  Minuten. _Verworfen:_ Schicht 4 rundet
  die zählende Dauer fest auf die volle Minute auf (Dauer und Zeitraum wichen sofort ab, das
  Formular müsste beide zeigen, die Verteilung aus D343 bräuchte ihre Regel jetzt, und D309 gälte
  nicht mehr); die Anzeige schneidet ab (mein erster Vorschlag).
- **D346 Die Dauer ist in Schicht 4 keine Eingabe.** Anlegen und Bearbeiten nehmen nur Beginn und
  Ende an. Die Operation rechnet die Dauer bei jedem Schreiben, und die Antwort liefert sie mit.
  Das Formular zeigt sie nur an. _Gründe:_ Eine von Hand gesetzte Dauer bräuchte sofort die
  Verteilungsregel aus D343, machte das Bearbeiten mehrdeutig (bleibt die Dauer, wenn sich das
  Ende verschiebt?) und verlangte eine Marke am Eintrag, dass sie von Hand gesetzt ist. Das Format
  verbaut nichts: `duration_seconds` ist nach D308 eine eigene Spalte. _Preis:_ Eine Pause wird
  bis dahin als zwei Einträge eingetragen. _Verworfen:_ ein Feld „Dauer“ im Formular.
- **D347 Das Formular löst eine Zeitumstellung ohne Nachfrage auf; eine übersprungene Uhrzeit ist
  kein Wert (beantwortet „doppelte Stunde“ aus Runde 36).**
  1. **Beim Bearbeiten** gilt der Zeitpunkt, der dem bisherigen Wert am nächsten liegt.
  2. **Bei einem neuen Wert** gilt der frühere der beiden Zeitpunkte. Nur wenn das Ende damit
     nicht nach dem Beginn läge, gilt der spätere.
  3. **Ein kleiner Vermerk am Feld** zeigt bei einer doppelten Uhrzeit, welche der beiden gemeint
     ist.
  4. **Eine übersprungene Uhrzeit** zeigt eine Meldung am Feld und sperrt das Speichern, wie
     „25:00“ (D319). Das Formular verschiebt nichts still.
  5. **Die Dauer ist immer die wirklich vergangene Zeit.** Das Formular zeigt sie vor dem
     Speichern.

  _Beispiele (Berlin):_ Am 25. Oktober 2026 gibt es 2:00 bis 3:00 Uhr zweimal. Ein Timer hat im
  zweiten 2:40 gestoppt; wer das Ende auf 2:45 korrigiert, bekommt das zweite 2:45. Ein neuer
  Eintrag mit Beginn 1:30 und Ende 2:30 ist eine Stunde lang. 1:00 bis 4:00 Uhr zählt an diesem
  Tag vier Stunden und am 28. März 2027, an dem 2:00 bis 3:00 Uhr fehlt, zwei. _Preis:_ Ein neuer
  Eintrag, der ganz in der zweiten der beiden Stunden liegt, lässt sich von Hand nicht eintragen;
  er landet eine Stunde zu früh, mit richtiger Dauer. Das betrifft eine Stunde im Jahr, und nur
  Zeitzonen mit Sommerzeit. _Verworfen:_ nachfragen; die übersprungene Uhrzeit still um eine
  Stunde verschieben.
- **D348 Die Oberfläche bekommt genau eine Uhr, und alles, was Zeit liest, rechnet oder taktet,
  liegt in `time` (füllt die Lücke aus ADR 0027, beantwortet „Uhr der Oberfläche“ aus Runde 36).**
  1. **Die App reicht der Oberfläche genau eine Uhr.** Das ist die dritte Stelle, an der die
     Systemuhr ins Programm kommt. Tests und Stories reichen eine feste Uhr.
  2. **Ansichten lesen die Zeit nur über zwei Hooks:** „jetzt“ mit einem Takt (Sekunde oder
     Minute) und „heute“ als Kalendertag. Kein Baustein ruft die Uhr selbst.
  3. **Ein gemeinsamer Taktgeber für alle Zuhörer.** Er läuft nur, solange jemand zuhört und das
     Fenster sichtbar ist. Jede Anzeige rechnet aus der Uhr und zählt nie Takte, also stimmt die
     Zeit nach dem Ruhezustand sofort wieder.
  4. **„Heute“ wechselt über einen einzelnen Wecker zum Tagesbeginn,** nicht über einen Takt.
  5. **Die Uhr der Oberfläche zeigt nur an und belegt vor.** Jeder gespeicherte Zeitpunkt kommt
     aus der Uhr des Datenprozesses: Beginn und Ende eines Timers setzt die Operation.

  In `time` liegen die Rechnung „wann ist der nächste Takt“ (nächste volle Sekunde, nächste
  Minute, nächster Tagesbeginn), die benannten Anzeigeformate für eine Dauer, die laufende Zeit
  eines Timers und einen Kalendertag, und der Taktgeber mit den beiden Hooks. Die Hooks bekommen
  einen eigenen Einstieg für React, wie `data-client` ihn hat; der Datenprozess lädt ihn nie. Die
  Zeitzone bleibt ein Argument: Der Hook für „heute“ bekommt sie gereicht, und woher die
  Oberfläche die Einstellung liest, baut #110. Der Timer tickt im Sekundentakt. _Gründe:_ Jedes
  spätere Modul kopiert das Muster. Der Owner: Es soll alles durch `time` abgesichert bleiben. Die
  Uhr zu vergessen ist dort ein Typfehler, und eine Ansicht kann die Zeit nicht an den Hooks
  vorbei lesen, weil die Lint-Regel `Date` verbietet. _Preis:_ `time` bekommt einen Einstieg, der
  React lädt; die Modulgrenzen müssen ihn vom Datenprozess fernhalten. _Laufzeit:_ Solange ein
  Timer läuft und sichtbar ist, feuert ein Wecker pro Sekunde und zeichnet einen kleinen Text
  neu. Ohne Zuhörer läuft nichts. Nicht gemessen; die Messung von #276 deckt das Neuzeichnen ab.
  _Verworfen:_ ein Paket über `time` für Taktgeber und Hooks (die Regel wäre kein einzelner Satz
  mehr); jede Anzeige mit eigenem Wecker.
- **D349 Stoppen schreibt zwei Tabellen: Der Eintrag bekommt die Id des Timers, und Rückgängig
  ist eine eigene Operation (schärft D310).**
  1. **Der Zeiteintrag bekommt die Id des Timers.** Ein zweites Stoppen findet den Eintrag vor,
     antwortet mit ihm und schreibt nichts. Zwei Geräte, die denselben Timer offline stoppen,
     erzeugen dieselbe Zeile. Die beiden Id-Typen bleiben getrennt; genau eine Funktion des Moduls
     macht aus der Timer-Id die Eintrags-Id.
  2. **Rückgängig ist eine eigene Operation in einer Transaktion.** „Stoppen zurücknehmen“ löscht
     den Eintrag weich und stellt den Timer wieder her. Die Oberfläche baut ein Rückgängig nie aus
     zwei Aufrufen zusammen. Das gilt als Muster für jede spätere Operation über zwei Tabellen,
     etwa eine Umbuchung in den Finanzen.
  3. **Jede Operation, die einen Timer laufen lässt, stoppt zuerst jeden anderen.** Das gilt für
     Starten, „Stoppen zurücknehmen“ und „Verwerfen zurücknehmen“. Durch eigene Aktionen laufen
     so nie zwei Timer.
  4. **Kein Zusatzfeld am Eintrag.** Dass ein Eintrag aus einem Timer stammt, steht nur in der
     gleichen Id.

  _Gründe:_ Drei Fälle. Ein Doppelklick oder zwei Geräte ergäben ohne Vorkehrung zwei Einträge.
  Baute die Oberfläche das Rückgängig aus zwei Aufrufen und scheiterte der zweite, wäre der
  Eintrag gelöscht und kein Timer liefe. Wer A stoppt, B startet und dann im Hinweis zu A auf
  „Rückgängig“ klickt, hat danach A wieder laufen und B als Eintrag. _Preis:_ Ein Klick auf
  „Rückgängig“ kann einen gerade gestarteten Timer beenden. Räumt der Papierkorb später die alten
  Timer-Zeilen ab, ist die Herkunft eines Eintrags weg. _Laufzeit:_ Stoppen schreibt zwei Zeilen
  in einer Transaktion und löst eine Tabellenmeldung aus. _Verworfen:_ das Rückgängig ablehnen,
  während ein anderer Timer läuft (der Knopf wäre sichtbar und täte nichts); eine Spalte am
  Eintrag für die Herkunft; eine neue Id für den Eintrag.
- **D350 Die Uhr der Oberfläche und die Felder für Datum und Uhrzeit werden ein eigenes
  Arbeitspaket vor #275 (ändert die Reihenfolge aus D316).** #332 baut die Uhr mit Taktgeber, Hooks
  und Anzeigeformaten in `time` (D348) und die Felder für Kalendertag, Uhrzeit und „Datum, Beginn,
  Ende“ in `forms` samt der Auflösung der Zeitumstellung (D347). Es hat keinen Blocker und braucht
  kein eigenes Grilling. #275 hängt daran. _Gründe:_ Die Grenze liegt bei rund 4.500 neuen Zeilen;
  die letzten Arbeitspakete lagen bei 4.121, 4.990, 5.885 und 6.152. #275 mit Modul, Uhr und
  Feldern läge geschätzt deutlich über 6.000. Ein Arbeitspaket hat einen Integrationszweig und
  einen Pull Request: Blieben Uhr und Felder in #275, landete nichts davon, bevor #109 und #110
  gegrillt und gebaut sind. Beide Teile bekommen die Zeitzone als Argument und lesen keine
  Einstellung. _Preis:_ #332 trägt eine höhere Nummer als #275 und blockiert es doch, wie #313
  (D340). Uhr und Felder entstehen vor ihrem ersten echten Nutzer und werden an Stories und Tests
  gezeigt. _Verworfen:_ alles in #275.

## Später, mit Vorschlag

Diese Fragen gehen mit ihrer vorgeschlagenen Antwort in die Spezifikationen von #275, #277 und
#332. Wer
baut, darf anders entscheiden und nennt es im Pull Request.

**Zeiteintrag und Formular (#275, das Feld für die Zeit in #332)**

- **Zeitzone am Eintrag:** Gespeichert wird die Zeitzone der Einstellung in dem Moment, in dem
  die Zeile entsteht, beim Timer also beim Stoppen. Die Spalte ist Pflicht, und ein Bearbeiten
  ändert sie nie.
- **Projekt:** optional; die Auswahl lässt sich leeren.
- **Feld für die Zeit:** ein Datum und zwei Uhrzeiten, gebunden an Beginn und Ende. Liegt die
  Ende-Uhrzeit nicht nach der Beginn-Uhrzeit, gilt sie als Folgetag, und das Feld zeigt „+1“. Für
  längere Einträge klappt ein eigenes Enddatum auf.
- **Vorbelegung:** das Datum des Tages, an dem in der Woche „Neu“ geklickt wurde, sonst heute; die
  Uhrzeiten sind leer.
- **Grenzen:** keine Höchstdauer; Einträge in der Zukunft sind erlaubt.
- **Löschen:** mit „Rückgängig“ im Hinweis. Ist das Projekt inzwischen gelöscht, lehnt der
  Speicher-Rahmen das Wiederherstellen ab und nennt das Projekt (D337).

**Wochenansicht (#275)**

- **Ansichten:** nur die Woche, mit vor, zurück und „heute“. Eine Liste aller Einträge wartet auf
  #137.
- **Aufbau:** sieben Tage untereinander. Jeder Tag zeigt die Einträge, die ihn berühren, nach
  Beginn sortiert, und seine Tagessumme. Daneben stehen die Wochensummen je Projekt und die
  Gesamtsumme. Kein Zeitraster.
- **Filter:** Die Gruppe zeigt die aktiven Projekte und „Ohne Projekt“; der Filter der Ansicht
  bietet auch archivierte an. Er wirkt auf Liste und Summen.
- **Adresse:** Der erste Tag der Woche und das Projekt stehen in der Adresse.
- **Abfrage:** Die Oberfläche nennt die Woche, der Datenprozess liefert Einträge, Tagesanteile und
  Summen fertig. Dazu je ein Index auf Beginn und Ende und die Messung mit Daten von zwei Jahren.

**Timer und Überschneidungen (#277)**

- **Überschneidung:** Zwei Einträge überschneiden sich, wenn sich ihre Zeiträume schneiden; direkt
  anschließende nicht. Jeder betroffene Eintrag bekommt einen Vermerk, ohne Ablauf zum Auflösen.
- **Laufender Timer:** Er erscheint nicht in der Woche, nur im ständigen Platz.
- **Starten:** über das Element und einen Befehl, mit Projekt und Notiz als freiwilligen Angaben.
- **Bearbeiten:** Beginn, Projekt und Notiz in einem kleinen Formular am Element; der Beginn liegt
  nie in der Zukunft.
- **Vergessener Timer:** „Stoppen um …“ nimmt ein Ende an, das nach dem Beginn und nicht in der
  Zukunft liegt.
- **Uhr vor dem Beginn:** Liegt die Uhr beim Stoppen vor dem Beginn, bleibt der Timer bestehen,
  und der Hinweis bietet „Stoppen um …“ an.
- **Erneutes Stoppen nach „Stoppen zurücknehmen“:** Die Operation stellt den weich gelöschten
  Eintrag mit derselben Id wieder her und schreibt das neue Ende hinein.
- **Zwei laufende Timer in der Datenbank:** Das Element zeigt den zuletzt gestarteten und eine
  Zahl.
- **Befehle:** „Zeiteintrag anlegen“, „Timer starten“ und „Timer stoppen“; ein Tastenkürzel
  schaltet den Timer um.
- **Hinweise:** Stoppen und Verwerfen zeigen einen Hinweis mit „Rückgängig“.

**Begriffe und Dokumente**

- **Glossar:** Time Entry (Zeiteintrag), Timer (Timer), Booked Duration (gebuchte Dauer) für die
  zählende Dauer wie in der alten App, und Day Share (Tagesanteil) für den Teil eines Eintrags,
  der an einem Tag zählt. Sie entstehen beim Bau.
- **Namen der Tabellen (D335):** „Zeiteintrag / Zeiteinträge“ und „Timer / Timer“, englisch "time
  entry / time entries" und "timer / timers".
- **ADRs beim Bau:** das Format des Zeiteintrags mit Zeitzone und Tagesanteilen, die Uhr der
  Oberfläche (ergänzt ADR 0027), die Operation über zwei Tabellen mit ihrem Rückgängig und die
  Klarstellung von ADR 0014 (D308).

## Vorgemerkt

- **Einstellung zu Mitternacht:** ob ein Eintrag über Mitternacht auf die Tage verteilt wird oder
  ganz zum Tag seines Beginns zählt (Wunsch des Owners, D343). Nach Schicht 4, zusammen mit der
  Einstellung zu Überschneidungen (D311). Sie schaltet die eine Funktion aus D343 um.
- **Rundung:** die Einstellung wie in der alten App (Intervall, Richtung, Zeitabschnitte, Vorrang
  Timer vor Projekt vor Einstellungen), Standard „aufrunden auf 1 Minute“ (Wunsch des Owners,
  D345). Dasselbe Arbeitspaket entscheidet, wie sich eine gerundete Dauer auf die Tage verteilt
  (D343).
- **Dauer von Hand:** zusammen mit den Pausen, weil erst dort klar ist, was eine abweichende Dauer
  bedeutet (D346).
- **Zeitzone eines Eintrags:** sie anzeigen, mit ihr rechnen oder sie ändern (D342).
- **Zeiteintrag und Sync:** was gilt, wenn zwei Geräte verschiedene Zeit haben (aus Runde 36).
  Sync-Phase.
