# Runde 47 (2026-11-20): Die Modulanzeige, der ständige Platz in der Hülle (#276, führt D314 aus)

Grundlage: der Stand auf `main` nach #331.

- **Hülle heute:** Sie zeigt nur das aktive Modul: seine Ansichten, seine Gruppen und seine
  Hauptaktion. Nichts lässt ein Modul etwas zeigen, während ein anderes aktiv ist.
- **Bereiche heute:** Die Navbar zeigt auf der mittleren Layoutstufe nur Icons und steckt auf der
  schmalen Stufe und am Handy in einer Schublade. Die Leiste unten gibt es nur am Handy. Die
  Kopfzeile des Inhalts ist der einzige Bereich, der auf allen vier Stufen sichtbar ist. Ihr
  rechtes Ende ist frei; den Platz dort nutzen nur Stories. Der Seitentitel kürzt auf eine Zeile.
- **Code eines Moduls heute:** Ansichten, Gruppen und der Inhalt des Bearbeiten-Drawers sind
  Einträge im Hüllen-Beitrag, die Code bei Bedarf laden. Ein Fehler darin bleibt in seinem
  Bereich und bietet „Erneut versuchen“ an.
- **Ungespeicherte Eingaben heute:** Der Bearbeiten-Drawer fragt nach, bevor Eingaben verloren
  gehen. Ein Formular meldet sie der Hülle über einen Hook, der nur im Drawer funktioniert.
- **Start heute:** Eine Prüfung hält die Startgröße unter einer Grenze und bestimmten Code aus dem
  Start. Code für das erste Öffnen der Palette lädt in einem ruhigen Moment nach dem Start.
- **Entschieden vor dieser Runde (D314, D348):** ein Element je Modul, ohne einstellbare
  Reihenfolge; die Hülle bestimmt den Ort, das Modul den Inhalt; der Code lädt nach dem ersten
  Bild; nichts springt, wenn er ankommt; das Element zeichnet nur sich selbst neu; eine Messung
  ist Abnahmekriterium. Der Timer tickt über die Uhr der Oberfläche aus `time`.

- **D357 Die Modulanzeige steht rechts in der Kopfzeile des Inhalts, in voller Form oder in
  Kurzform.** Auf der breiten und der mittleren Layoutstufe zeigt sie die volle Form, beim Timer
  etwa Projekt, laufende Zeit und Stopp. Auf der schmalen Stufe und am Handy zeigt sie die
  Kurzform, beim Timer die laufende Zeit und Stopp. Wird es eng, kürzt zuerst der Seitentitel.
  _Gründe:_ Die Kopfzeile ist auf allen vier Stufen sichtbar, und ihr rechtes Ende ist frei. Ein
  Ort genügt für alle Stufen. _Preis:_ Braucht eine Ansicht später eigene Aktionen in der
  Kopfzeile, teilen sie sich die Zeile mit der Anzeige. _Laufzeit:_ Der Ort kostet nichts.
  _Verworfen:_ unten in der Navbar (auf der mittleren Stufe 68 px breit, auf der schmalen Stufe
  und am Handy in der Schublade, also bräuchte es einen zweiten Ort); eine eigene Statusleiste am
  unteren Rand (kostet auf jeder Seite eine Zeile Höhe und stößt am Handy an die Leiste unten).
- **D358 Die Modulanzeige darf eine Fläche öffnen, und die Fläche gehört der Hülle.** Das Modul
  meldet neben der Anzeige den Inhalt der Fläche an. Die Anzeige bekommt eine Funktion, die sie
  öffnet. Die Hülle zeigt die Fläche als Popover unter der Anzeige und am Handy als Blatt von
  unten. Sie regelt den Fokus, Escape, dass nur eine Fläche offen ist, und die Nachfrage bei
  ungespeicherten Eingaben wie beim Bearbeiten-Drawer. Das Stoppen mit einem Klick bleibt in der
  Anzeige selbst (D314). _Gründe:_ Der Timer braucht ein kleines Formular für Projekt, Notiz und
  Beginn, „Stoppen um …“ und „Verwerfen“ (#277). Öffnete jedes Modul selbst, müsste es die
  Layoutstufen kennen und Fokus und ungespeicherte Eingaben selbst lösen, und zwei Module
  verhielten sich verschieden. _Preis:_ Die Hülle bekommt einen zweiten Baustein an nur einem
  Nutzer. _Laufzeit:_ Beim Start nichts. Das erste Öffnen lädt den Code der Fläche; die Hülle
  kann ihn in einem ruhigen Moment vorladen. _Verworfen:_ Das Modul öffnet selbst, was es will;
  nichts Größeres, ein Klick führt in die Ansicht des Moduls (dann ließe sich ein Timer nur in
  „Zeit“ bearbeiten).
- **D359 Ein Modul reicht der Hülle zwei Bausteine als Code, der später lädt; die Anzeige holt
  ihre Daten selbst.** Der Hüllen-Beitrag bekommt einen Eintrag nach dem Muster des
  Bearbeiten-Drawers: die Anzeige und, wenn das Modul eine will, der Inhalt der Fläche. Die Hülle
  sagt der Anzeige, welche Form gilt, und gibt ihr die Funktion zum Öffnen. Die Anzeige holt ihre
  Daten über die Hooks ihres Moduls, beim Timer mit einer Abfrage der laufenden Timer, die über
  die Tabellenmeldung neu lädt. Bis der Code da ist, zeichnet die Hülle an der Stelle das Icon des
  Moduls. Eine Fläche ohne Anzeige lässt sich nicht deklarieren. Der Inhalt der Fläche bekommt
  dieselben Funktionen wie der Inhalt des Bearbeiten-Drawers: abbrechen, fertig, nachfragen.
  _Gründe:_ Der Timer braucht eine tickende Dauer, einen Zähler, einen Leerlauf mit „Starten“ und
  einen Stopp-Knopf. Eine Beschreibung als Daten müsste das alles kennen, und der zweite Nutzer
  erweiterte sie wieder. Das Icon steht schon im Hüllen-Beitrag und kostet beim Start kein Byte.
  _Preis:_ Jedes Modul zeichnet seine Anzeige selbst; nur gemeinsame Bausteine und die feste Höhe
  sichern ein einheitliches Bild. _Laufzeit:_ ein kleines Stück Code je Modul mit Anzeige,
  geladen in einem ruhigen Moment nach dem ersten Bild; eine Abfrage über wenige Zeilen (das
  Neuladen einer Abfrage ist mit 2 ms bei 1.000 Zeilen gemessen); im Sekundentakt zeichnet nur die
  Anzeige neu. _Verworfen:_ Das Modul beschreibt mit Daten, die Hülle zeichnet.
- **D360 Der Baustein heißt „Module Indicator“ (Modulanzeige), seine Fläche „Indicator Panel“
  (Anzeige-Panel).** Der Name nennt den Ort nicht, denn den bestimmt die Hülle (D314). Zu
  vermeiden: widget, status bar item, tray, badge. Der Glossar-Eintrag entsteht beim Bau.
  _Gründe:_ Der Name sagt, was der Baustein tut: zeigen, was im Modul gerade läuft. _Preis:_
  Mantine hat eine Komponente `Indicator`, einen Punkt an einer Ecke. Die App nutzt sie nicht, und
  der Name ist immer zweiteilig. _Verworfen:_ „Status Element“ („Status“ meint später auch den
  Status einer Aufgabe oder eines Projekts); „Widget“ (unscharf, und der Begriff fehlte dann für
  Bausteine einer späteren Übersichtsseite).

## Später, mit Vorschlag

Diese Fragen gehen mit ihrer vorgeschlagenen Antwort in die Spezifikation von #276. Wer baut, darf
anders entscheiden und nennt es im Pull Request.

**Die Anzeige**

- **Laden:** Der Code der Anzeige ist ein eigener Einstieg des Moduls ohne dessen Ansichten. Die
  Hülle lädt ihn in einem ruhigen Moment nach dem ersten Bild. Eine Regel der Startprüfung hält
  ihn aus dem Start; dafür liegt er in jedem Modul im selben Ordner.
- **Form:** Die Hülle leitet die Form aus der Layoutstufe ab und reicht sie der Anzeige. Ein Modul
  liest die Layoutstufe dafür nicht selbst.
- **Reservierung:** Die Kopfzeile behält ihre Höhe. Jede Form hat eine Höchstbreite; Text in der
  Anzeige kürzt, eine laufende Zeit nie. Kommt der Code an, ändert sich nur der Raum des
  Seitentitels.
- **Immer da:** Die Anzeige ist auf jeder Seite sichtbar, auch im eigenen Modul und in den
  Einstellungen. Ein Modul blendet sie nicht aus.
- **Leere Anzeige:** Ob eine Anzeige nichts zeigen darf, entscheidet der zweite Nutzer. Der Timer
  zeigt im Leerlauf „Starten“.
- **Fehler:** Scheitert der Code, zeigt der Platz eine kleine Marke mit „Erneut versuchen“, nicht
  den großen Fehlerzustand. Der Fehler geht in den Fehlerbericht wie bei jedem Code eines Moduls.
- **Farbe:** Die Anzeige zeichnet im Farbsatz ihres Moduls.
- **Mehrere Anzeigen:** in der Reihenfolge der Modulliste. Was bei Platzmangel passiert,
  entscheidet der zweite Nutzer.
- **Tastatur:** erreichbar mit Tab. Der Platz bekommt kein eigenes Kürzel; Starten und Stoppen
  laufen über Befehle (#351).
- **Fenster ziehen:** Die Kopfzeile ist Ziehfläche des Fensters; die Anzeige ist davon
  ausgenommen wie die Kanal-Marke.
- **Der freie Platz von heute:** Die Anzeigen ersetzen den ungenutzten Platz am Ende der
  Kopfzeile.

**Die Fläche**

- **Form:** auf der breiten, mittleren und schmalen Stufe ein Popover unter der Anzeige mit fester
  Breite, am Handy ein Blatt von unten. Der Inhalt rollt, wenn er höher ist.
- **Schließen:** Escape, ein Klick daneben, ein zweiter Klick auf die Anzeige und „fertig“ aus
  dem Inhalt. Der Fokus geht beim Öffnen in die Fläche und beim Schließen zurück zur Anzeige.
- **Ungespeicherte Eingaben:** Der Hook, mit dem ein Formular sie meldet, funktioniert in der
  Fläche wie im Bearbeiten-Drawer, damit `forms` unverändert bleibt. Jeder Weg hinaus fragt
  dieselbe Frage, auch ein Wechsel der Seite.
- **Nicht in der Adresse:** Die Fläche gehört zu keiner Seite. Ein Neuladen schließt sie.
- **Von anderswo öffnen:** Ein Befehl oder die Aktion eines Hinweises öffnet die Fläche des
  eigenen Moduls über eine Funktion der Hülle. Welchen Teil sie zeigt, ist Zustand des Moduls. Der
  Timer braucht das für den Hinweis, der „Stoppen um …“ anbietet.
- **Typen:** Eine Anzeige ohne Fläche bekommt keine Funktion zum Öffnen; die beiden Formen sind
  eine Vereinigung.
- **Vorladen:** Die Hülle lädt den Code der Fläche in einem ruhigen Moment, nachdem die Anzeige
  da ist. Das erste Öffnen wartet dann nicht.
- **Zusammen mit dem Bearbeiten-Drawer und der Palette:** Die Palette liegt über allem, und
  Escape gehört ihr. Der Drawer verdeckt die Kopfzeile mit seiner Abdeckung; ein Befehl, der die
  Fläche öffnet, während er offen ist, legt sie darüber.

**Nachweise**

- **Messung:** Startgröße und Startzeit vorher und nachher, in `docs/development/performance.md`.
- **Neuzeichnen:** Eine Story zählt, dass eine Anzeige im Sekundentakt nichts anderes neu
  zeichnet. Sie braucht die Uhr aus #332 nicht; ein Zähler der Story genügt.
- **Testnutzer:** `placeholder-alpha` bekommt eine Anzeige mit Fläche für die Stories.

## Vorgemerkt

- **Platzmangel:** was passiert, wenn mehrere Anzeigen nicht in die Kopfzeile passen. Mit dem
  zweiten Nutzer.
- **Titelleiste unter Windows und Linux (#167):** Die Fensterknöpfe sollen dort oben rechts in der
  Kopfzeile schweben. Das Grilling von #167 muss sie neben die Anzeigen legen.
- **Aktionen einer Ansicht in der Kopfzeile:** teilen sich die Zeile mit der Anzeige (D357). Mit
  der ersten Ansicht, die welche braucht.
- **Einstellbare Reihenfolge oder Ausblenden:** bleibt wie in D314 ausgeschlossen, bis ein Nutzer
  danach fragt.
