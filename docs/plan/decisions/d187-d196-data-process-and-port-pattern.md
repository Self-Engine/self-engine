# Runde 27 (2026-11-10): Datenprozess, Port-Muster und Hooks (#29, #31, #32, #33, verfeinert D88, D90–D93, D95)

Grundlage ist ein Wegwerf-Durchstich durch alle vier Pakete: ein Platzhalter-Modul mit Tabelle,
Speicher, oRPC über `MessagePort` im `utilityProcess` und Hooks. Die Zahlen sind Mediane aus fünf
Starts der gepackten App auf einem Apple M3 Pro, die Einzelwerte stehen in den Kommentaren der vier
Issues. oRPC 1.16.2 läuft im `utilityProcess` mit Sandbox und `contextIsolation`, die eigene
RPC-Schicht aus D93 entfällt.

- **D187 Die Schemas eines Ports liegen im Modul, `contracts` setzt nur zusammen (ändert #29).**
  Jedes Modul hat einen Einstieg `./contracts` mit seinen Zod-Schemas und seinem oRPC-Vertrag. Das
  Paket `contracts` baut daraus den einen Gesamtvertrag und besitzt selbst nur Übergreifendes:
  `health`, `tablesChanged`, die Deklaration der Einstellungen (D153). Die Richtung ist
  `contracts → Modul`, ein Modul importiert `contracts` nie. `./contracts` bleibt rein: nur Zod,
  `@orpc/contract` und die Wert-Pakete `time` und `money`, gesichert durch eine Regel in den
  Modulgrenzen. Der Renderer importiert den Gesamtvertrag nur als Typ. _Preis:_ `contracts` hängt
  von jedem Modul ab. _Verworfen:_ alle Schemas zentral (jeder fachliche PR ändert `contracts`, die
  Typen lägen nicht beim Modul, dem die Tabelle gehört); jede App setzt selbst zusammen (Desktop,
  Mobile und MCP-Server liefen auseinander).
- **D188 Eingaben prüft immer der Datenprozess, Ausgaben nur Tests und der Dev-Build.** Der Renderer
  prüft nie. Gemessen kostet ein Listenaufruf mit 10.000 Zeilen ungeprüft 12 ms und mit Zod auf
  beiden Seiten 28 ms, die Prüfung im Datenprozess allein 4,9 ms bei 3,8 ms für die Abfrage. Was
  die Ausgabeprüfung fände, fangen der Übereinstimmungstest (D91) und die Contract-Tests (D95)
  vorher. Bedingung: Ausgabe-Schemas wandeln nichts um, also kein `transform` und kein `default`;
  Zeit- und Geldwerte gehen als gebrandete Texte und Zahlen über den Port. _Preis:_ In der gepackten
  App erreicht eine falsch geformte Zeile die Oberfläche unbemerkt, die übrigen Zeilen bleiben
  sichtbar. _Offen:_ #32 klärt als Erstes, ob oRPC die Ausgabeprüfung je Build abschalten kann. Mit
  dem Sync wird die Frage für fremde Zeilen neu gestellt. _Verworfen:_ immer im Datenprozess prüfen
  (eine einzige falsche Zeile sperrt die ganze Liste); auf beiden Seiten (doppelt, und im Thread
  der Oberfläche).
- **D189 Port, Vertrag und Speicher sind drei Begriffe, der Speicher hat zwei Lagen.** Der Port ist
  alles, was ein Modul mit seinen Daten anbietet, und der einzige Weg an seine Tabellen. Der Vertrag
  beschreibt ihn (`./contracts`), es gibt genau einen pro Modul und keine zweite handgeschriebene
  Schnittstelle. Der Speicher setzt ihn gegen SQLite um (`./data`). Untere Lage: Funktionen, die
  eine laufende Transaktion, den Kontext (D195) und die Eingabe bekommen und selbst nichts öffnen
  oder melden. Obere Lage: der Aufruf aus dem Renderer, der die Eingabe prüft, die Transaktion
  öffnet und danach die geänderten Tabellen meldet. Eine Brücke (D152) ruft Funktionen der unteren
  Lage aus mehreren Modulen in ihrer eigenen Transaktion und schreibt nie selbst in fremde Tabellen.
  Die drei Begriffe kommen mit #32 ins Glossar. _Verworfen:_ Brücken rufen über den Vertrag (jeder
  Aufruf hätte seine eigene Transaktion).
- **D190 Ein Port kennt zwei erwartete Fehler, alles andere ist unerwartet.** „Nicht gefunden“ und
  „Konflikt“ mit einem Grund, den das Modul festlegt (`name_taken`, `already_billed`). Jede Operation
  zählt ihre Gründe im Vertrag auf. Ein Fehler trägt einen Code und nie Text, der Renderer übersetzt
  ihn. Der Speicher übersetzt Datenbank-Fehler selbst; was er nicht übersetzt, ist unerwartet und
  geht mit allen Details ins lokale Fehlerprotokoll (D99–D101), die Oberfläche zeigt dafür eine
  allgemeine Meldung. Bei jedem Fehler ist nichts geschrieben und nichts gemeldet. Ein abgestürzter
  Datenprozess ist kein Fehler des Ports, sondern ein Zustand der Verbindung (#29). Kein Effect in
  Schicht 2: oRPC typisiert die Fehler im Vertrag schon, der Datenprozess arbeitet synchron, und
  Effect brächte eigene Schemas und ein eigenes RPC neben Zod und oRPC. _Preis:_ In der unteren Lage
  sieht TypeScript geworfene Fehler nicht, die Contract-Tests lösen deshalb jeden Grund einmal aus.
  _Offen:_ Effect für Sync und Import neu bewerten, dort hinter dem Vertrag einsetzbar.
  _Verworfen:_ eigene Codes für ungültige Eingabe (das fängt das Formular, sonst ist es ein
  Programmierfehler) und fehlende Berechtigung (erst mit Organisations-Spaces).
- **D191 D139 bleibt: Der Build sammelt die SQL-Dateien ein.** Der Durchstich las sie stattdessen zur
  Laufzeit und musste jede Datei einzeln zum Kopieren eintragen, was beim ersten Versuch scheiterte.
  Folge: Alles, was den Speicher eines Moduls lädt, läuft durch Vite; ein Skript direkt unter Node
  kann das nicht. _Offen:_ Kann das Build-Werkzeug von Mobile nicht einsammeln, erzeugt dort ein
  Skript eine TypeScript-Datei aus denselben SQL-Dateien, und das Gate prüft, dass sie aktuell ist.
- **D192 Die Datenschicht gehört zum Start, die Grenze wird einmal angehoben.** TanStack Query und
  der oRPC-Client kosten im Durchstich rund 70 KB, damit blieben 43 KB bis zur Grenze. #33 setzt sie
  neu, mit Messung, wie `docs/development/performance.md` es verlangt. Der Smoke-Test der gepackten
  App in #29 bekommt eine Zeitgrenze für „erste Daten“, weil Bytes nur ein Ersatzmaß sind (gemessen:
  erstes Bild nach 221 ms, erste Antwort nach 253 ms). Ein eigenes Ticket untersucht ein Paket von
  112 KB mit Zod im Start. _Verworfen:_ den Datenclient nachladen (das Budget sähe besser aus, die
  Daten kämen später).
- **D193 Keine Abfrage wächst mit der Datenmenge.** Der Vertrag kennt nur drei Arten von Listen:
  Fenster (ein fachlicher Ausschnitt wie eine Woche oder ein Projekt), Seiten (höchstens N Zeilen,
  dann weiter ab einer Marke) und kleine Menge (ganze Tabelle, ausdrücklich so markiert, etwa
  Projekte oder Tags). Das Muster in #32 bietet nur diese drei Bausteine an. Summen, Zählungen und
  Gruppierungen liefert der Port fertig; wo D147 SQL verbietet, rechnet der Datenprozess in
  JavaScript. Neu geladen wird pro Tabelle (D92) und nur, was sichtbar ist, alles andere wird als
  veraltet markiert. Eine Transaktion löst genau eine Meldung aus. Gemessen dauert ein Umbenennen
  bis zur aktuellen Liste 49 ms bei 1.000 und 257 ms bei 10.000 Zeilen, davon entfallen 2 und 12 ms
  auf das Holen. _Preis:_ Suchen und Sortieren laufen im Datenprozess, und eine „kleine Menge“ mit
  tausenden Zeilen wird langsam. _Verworfen:_ Meldungen pro Zeile (deutlich aufwendiger, bei
  begrenzten Abfragen ohne spürbaren Gewinn).
- **D194 Die Oberfläche zeichnet nur, was sich geändert hat, und wartet auf den Datenprozess.**
  Seiten-Listen zeichnen nur die sichtbaren Zeilen, mit TanStack Virtual in einem gemeinsamen
  Baustein in `@self-engine/ui`, weil Mantine dafür nichts mitbringt; früh geladene Seiten werden
  wieder verworfen. Fenster und kleine Mengen zeichnen normal. Eine geänderte Zeile zeichnet eine
  Zeile neu: Im Durchstich waren es bei 1.000 Zeilen rund 4.150 Komponenten, #33 klärt die Ursache
  und hält das Ergebnis mit einem Test im Gate fest. Standard ist Warten auf die Antwort, das
  dauert mit begrenzten Abfragen ein bis drei Bilder. Vorgreifen gibt es nur bei direktem Anfassen
  (Ziehen, Häkchen) und wird pro Fall entschieden. _Verworfen:_ Vorgreifen als Standard (jede
  Operation gäbe es ein zweites Mal im Renderer, und nichts prüft, dass beide dasselbe tun).
- **D195 Uhr, Id-Erzeuger und Space kommen als ein Kontext aus dem Datenprozess.** Die obere Lage
  baut ihn pro Aufruf und reicht ihn an jede Funktion der unteren Lage, keine holt sich Zeit oder
  Ids selbst (D141). Der Renderer schickt nichts davon und bekommt nach dem Anlegen den fertigen
  Eintrag zurück. Die Zeit wird einmal pro Transaktion gelesen, alles daraus trägt denselben
  Zeitpunkt. Jede Abfrage filtert nach `space_id`, das Contract-Test-Kit prüft das mit Zeilen in zwei
  Spaces, und jeder Index für ein Fenster beginnt mit `space_id`. Bis #108 liefert der Kontext einen
  festen persönlichen Space, bis #104 den Zeitpunkt aus `db`; danach ersetzt die Uhr aus `time`
  (D148) den Typ, es bleibt bei einer Uhr. Das beantwortet die offene Frage aus #32.
- **D196 Stories und Komponenten-Tests bekommen feste Antworten.** Eine Story legt fest, was ein
  Aufruf liefert: Daten, Laden, einen Fehler, einen Konflikt. Ein Helfer baut den Ersatz aus dem
  Vertrag, er enthält keine Logik und liegt nur im Test- und Story-Code. Die Hooks bekommen den
  Zugang zum Port von außen gereicht, und die App stellt einen einzigen Zwischenspeicher für alle
  Module bereit. Die Web-App im Browser ohne Datenprozess zeigt bis zum Web-Treiber denselben
  Zustand wie bei einem abgestürzten Datenprozess. _Preis:_ Keine Story spielt einen Ablauf durch.
  _Verworfen:_ ein nachgebauter Speicher pro Modul (zweite Fassung jeder Operation, im Durchstich
  wäre er samt Beispieldaten ausgeliefert worden); echtes SQLite im Browser (das ist der
  Web-Treiber).
