# Runde 39 (2026-11-14): Schicht 4, Projekte und Zeit (ändert D153, schärft D152 und D172, klärt die offenen Punkte aus D241 und D252)

Grundlage: der Stand auf `main` nach #263 und die alte App (nur gelesen, Pfad in
`research-layer-3-core.md`):

- **Größe der alten App:** Projekte und Zeit sind zusammen rund 50.000 Zeilen Produktionscode und
  30.000 Zeilen Tests, die Zeit etwa viermal so groß wie die Projekte.
- **Projekt der alten App:** Art (Hobby, Stundensatz, Festpreis, Anstellung, nach dem Anlegen
  unveränderlich), Satz, Währung über das Bankkonto, Kontakt, Ordner, Tags, Favoriten, Archiv,
  eigene Rundung und Standard-Zeitkategorie. Löschen ist gesperrt, sobald Aufgaben, Zeiteinträge,
  Auszahlungen oder ein laufender Timer am Projekt hängen; dann bleibt nur das Archivieren. Im
  echten Bestand ist die Mehrzahl der Projekte privat und trägt keinen Satz.
- **Zeiteintrag der alten App:** Gespeichert wird der bereits gerundete Zeitraum; die gemessene
  Zeit ist danach nicht mehr vorhanden. Dazu `paid` und `payout_id` am Eintrag. Timer liegen in
  einer eigenen Tabelle, bis zu zehn, einer je Projekt, mit Phasen und Pomodoro. Überschneidungen
  sind gültige Daten; die „gebuchte Dauer“ zählt jeden Eintrag voll. Drei Rundungsarten
  (gewöhnliche Rundung, Zeitabschnitts-Rundung, exakte Speicherung), aufgelöst über Timer, Projekt
  und Einstellungen.
- **Hülle der neuen App:** feste Ansichten je Modul, der Bearbeiten-Drawer für einen Eintrag und
  Gruppen, die die Ansichten über die Adresse filtern. Es gibt keinen Ort, den ein Modul füllt,
  während ein anderes aktiv ist, und keine Seite für einen einzelnen Eintrag.
- **Konventionsprüfung:** Sie verlangt für jeden Fremdschlüssel `DEFERRABLE INITIALLY DEFERRED`
  und verbietet Aktionen nur am Verweis auf `spaces` (D286). `ON DELETE CASCADE` und
  `ON DELETE SET NULL` an jedem anderen Verweis lehnt sie nicht ab.
- **Formulare:** `placeholder-alpha` hält Entwurf, Änderungs-Erkennung und Konflikt-Anzeige von
  Hand. Eine ungültige Eingabe kommt aus dem Datenprozess als unerwarteter Fehler zurück, nicht als
  Meldung am Feld (#213).
- **Platzhalter:** `placeholder-alpha` und `placeholder-beta` sind in der App eingehängt. 26
  Dateien außerhalb der beiden Pakete nutzen sie: Stories der Hülle, Tests des Rahmens und die
  Skripte, die Neuzeichnungen messen.

- **D299 Schicht 4 hat eine Stufe: Projekte, Zeiteinträge von Hand, ein Timer und eine
  Wochenansicht.** Projekte lassen sich anlegen, bearbeiten, archivieren und löschen, mit Titel,
  Beschreibung, Icon und Farbe. Zeiteinträge entstehen von Hand mit Beginn, Ende, Projekt und
  Notiz. Ein Timer lässt sich starten und stoppen und ist in jedem Modul sichtbar. Eine
  Wochenansicht zeigt Summen je Tag und Projekt und markiert Überschneidungen. _Gründe:_ Der Owner
  will das erste sichtbare und nutzbare Modul, damit spätere Bauten an echten Abläufen geprüft
  werden statt an erdachten. Die Zeit der alten App ist zu groß für einen Schritt. _Nach Schicht
  4:_ Rundung, Pausen und Phasen, Zeitklassen und Kategorien, Aufgaben, Kunden, Ordner, Favoriten
  und Tags, geteilte Zeit, Pomodoro, parallele Timer, Abrechnung mit Bezahlt-Zustand und
  Auszahlungen, Festpreis und Anstellung, Terminverknüpfung, Heatmap und Statistik, Serien,
  Tageslimit. _Verworfen:_ eine zweite Stufe mit Satz, Rundung und Erlösen (D301 und D305 nehmen
  ihr den Inhalt; übrig bliebe nur die Markierung aus D307).
- **D300 Zwei Module: `projects` und `time-tracking` (klärt den offenen Namen aus Schicht 3).**
  `time-tracking` importiert `projects`, nie umgekehrt (D152). Der Timer gehört zu `time-tracking`.
  Für `time-tracking` gilt: Vertrags-Namensraum `timeTracking`, Adresse `/time-tracking/<ansicht>`,
  Tabellen `time_entries` und `timers`, im Glossar **Time Tracking** (de: _Zeiterfassung_), in der
  Navbar „Zeit“ und "Time". _Gründe:_ `time` ist durch das Wert-Paket belegt. Die Modul-Id ist
  zugleich Adress-Segment und Präfix der Befehle, deshalb ein Name, der sich lesen lässt. _Folge
  für später:_ Aufgaben werden ein eigenes Modul über `projects`, Kunden eines unter `projects`.
  _Verworfen:_ ein Paket `work` für beides (die alte App hatte so die Zyklen, die D152 beendet);
  der Timer als eigenes Paket (er schreibt in derselben Transaktion wie der Zeiteintrag).
- **D301 Ein Projekt hat in Schicht 4 weder Art noch Satz; Abrechnungsbedingungen kommen mit der
  Abrechnung (ändert D153).** Satz, Währung, Festpreis und Anstellung werden zusammen mit der
  Abrechnung entworfen, die Finanzen braucht. Ob sie dann am Projekt oder in der
  Abrechnungs-Brücke liegen, entscheidet jene Runde. _Gründe:_ Ohne Abrechnung bewirkt ein Satz
  nur einen Betrag neben den Stunden. Die Art der alten App mischt Abrechnungsform und Zweck in
  einem unveränderlichen Feld. _Folgen:_ `money` (#105) ist keine Voraussetzung für Schicht 4. Der
  Satz „Standard-Stundensatz und Rundung gehören in Schicht 4“ aus D153 gilt nicht mehr: Der
  Standard-Stundensatz gehört zur Abrechnung, die Rundung regelt D305. Die Frage, ob ein
  Zeiteintrag eine Kopie des Satzes trägt, gehört ebenfalls zur Abrechnung. _Verworfen:_ ein
  optionaler Satz mit Währung am Projekt schon jetzt.
- **D302 Ein Projekt ist immer archivierbar und nur löschbar, solange nichts Ungelöschtes darauf
  zeigt (schärft D172).** Archiviert heißt: aus der aktiven Liste und aus den Auswahlen
  verschwunden, eigene Ansicht „Archiv“, jederzeit zurückholbar. Archivieren sperrt nichts;
  Zeiteinträge eines archivierten Projekts bleiben sichtbar und änderbar. Gespeichert wird
  `archived_at` als Zeitpunkt. Löschen lehnt der Speicher-Rahmen ab, solange eine nicht gelöschte
  Zeile auf das Projekt verweist, und nennt, was daran hängt; die Oberfläche bietet dann das
  Archivieren an. Die Prüfung sitzt einmal im Rahmen und liest die Verweise aus der Datenbank,
  kein Modul schreibt dafür Code, und kein unteres Modul kennt ein oberes. Ein Verweis kann sich
  ausnehmen; das erklärt das Modul, dem er gehört (Tags bleiben nach D150 samt Zuordnungen
  löschbar). Dazu zwei Grundsätze: Kein Fremdschlüssel einer synchronisierten Tabelle trägt
  `CASCADE` oder `SET NULL`, die Konventionsprüfung lehnt beides ab. Endgültig gelöscht wird nur
  über eine benannte Operation, die mit dem Papierkorb-Paket kommt. _Gründe:_ Ohne die Prüfung
  entstünde ein gelöschtes Projekt mit Hunderten sichtbaren Einträgen und ohne Weg zurück, sobald
  der Hinweis mit „Rückgängig“ verschwunden ist. Die Regel „was Verlauf hat, wird archiviert“ gilt
  genauso für Konten mit Buchungen und Aufgaben mit Zeiteinträgen. _Preis:_ ein Nachsehen über
  einen Index je verweisender Tabelle pro Löschen. _Grenzen:_ Unter Sync kann ein Gerät ein Projekt
  löschen, während ein anderes offline einen Eintrag darauf schreibt; dafür bleibt die Markierung
  gelöschter Ziele aus D241 nötig. Das Wiederherstellen einer Zeile muss prüfen, ob ihr Ziel noch
  lebt. _Verworfen:_ jederzeit löschbar ohne Sperre (meine erste Empfehlung; der Owner: Es soll
  nichts Dummes möglich sein); die Sperre in jedem Modul einzeln (`projects` sieht die
  Zeiteinträge nicht).
- **D303 Jede Regel sitzt im Datenprozess, an der tiefsten Stelle, die sie sehen kann; das gilt
  für die ganze App (schärft D152).** Vier Stellen: die Datenbank (Pflichtfelder, Eindeutigkeit,
  gültige Verweise, D302), der Speicher-Rahmen (nichts Ungelöschtes zeigt auf Gelöschtes, D302),
  die Operation des Moduls (Regeln im eigenen Modul, etwa „Ende liegt nach dem Beginn“) und die
  Schutzregel einer Brücke (Regeln, die ein Modul nicht kennen kann, ADR 0023). Die Oberfläche
  spiegelt eine Regel nur, etwa mit einem ausgegrauten Knopf. So gilt sie für Befehle, einen
  späteren Assistenten und jeden anderen Aufrufer. Die Verweis-Prüfung und die Schutzregeln der
  Brücken brauchen denselben Einhängepunkt vor dem Schreiben; ein eigenes Arbeitspaket baut ihn
  mit der Verweis-Prüfung als erster Regel. _Offen:_ Ein Import muss durch dieselben Operationen
  schreiben oder danach geprüft werden (Schicht 5). Was ein Abgleich hereinbringt, verhindert
  keine Regel; die Sync-Phase braucht eine Datenprüfung, die verletzte Regeln findet und anzeigt.
- **D304 Ein Zeiteintrag speichert, wo er liegt und wie viel er zählt, getrennt.** `started_at`
  und `ended_at` sind die Zeitpunkte, wie gemessen oder eingetragen; sie werden nie gerundet.
  `duration_seconds` ist die Zeit, die zählt, als ganze Zahl. In Schicht 4 setzt die Operation sie
  auf Ende minus Beginn. Rundung, Pausen und geteilte Zeit ändern später nur diese Zahl. Dazu
  `project_id` und `note`; kein Satz und kein Bezahlt-Zustand (D22, D301). _Gründe:_ Die alte Form
  verliert die Messung und lässt die Rundung Überschneidungen erzeugen (zwei Anrufe von 10:00 bis
  10:05 und 10:06 bis 10:12 werden aufgerundet zu überlappenden Viertelstunden). Eine gespeicherte
  Zahl bleibt stehen, wenn sich eine Regel ändert, und Summen sind eine Addition ohne
  Regel-Auswertung beim Lesen. _Preis:_ Ein Eintrag hat zwei Angaben, die voneinander abweichen
  dürfen; das Formular zeigt beide, sobald sie es tun. _Zum Verweis:_ `project_id` ist eine
  Spalte in `time_entries`. ADR 0014 sagt wörtlich, ein Fremdschlüssel auf ein anderes Modul liege
  in einer Link-Tabelle; gemeint ist nach ADR 0003, dass das untere Modul keine Spalte für das
  obere trägt. Der Bau von `time-tracking` stellt ADR 0014 so klar. _Verworfen:_ gerundete
  Zeiten wie in der alten App; nur Beginn und Ende speichern und beim Anzeigen runden (jede Summe
  müsste die Regel kennen, und eine geänderte Regel veränderte alte Monate).
- **D305 Schicht 4 rundet nicht; die Rundung ist eine Eigenschaft der Zeiterfassung je Projekt
  (ändert D153).** Sie kommt nach Schicht 4 als eigenes Paket und gilt auch für private Projekte,
  unabhängig von der Abrechnung (der Owner: Wer will, rundet auch private Projekte auf fünf
  Minuten). _Folgen:_ Die Regel je Projekt liegt in einer Tabelle von `time-tracking`, nicht in
  `projects`. Die gerundete Zahl steht am Zeiteintrag in `duration_seconds`; die Abrechnung liest
  sie und rundet nur das Geld einmal (D145). Alle drei Arten der alten App passen in das Format
  aus D304: Die gewöhnliche Rundung ändert nur die Dauer, die Zeitabschnitts-Rundung ergibt die
  Summe der berührten Abschnitte, die exakte Speicherung lässt Ende minus Beginn stehen. Weil die
  Zeitpunkte bleiben, lässt sich eine Regel später verlustfrei auf vorhandene Einträge anwenden.
  _Verworfen:_ eine Regel für die ganze App schon in Schicht 4; Rundung als Teil der
  Abrechnungsbedingungen (meine Empfehlung, vom Owner korrigiert).
- **D306 Ein laufender Timer ist eine eigene Zeile, und Stoppen ist eine Transaktion.** Die
  Tabelle `timers` hält je laufendem Timer Beginn, Projekt und Notiz. Stoppen legt in einer
  Operation den Zeiteintrag an und löscht die Timer-Zeile weich; Verwerfen löscht nur die
  Timer-Zeile. Schicht 4 startet einen Timer zugleich: Wer einen zweiten startet, stoppt den
  laufenden. Diese Regel sitzt in der Operation, nicht in einem eindeutigen Index, und Format und
  Anzeige vertragen mehrere Timer. _Gründe:_ Ein Zeiteintrag bleibt immer abgeschlossen, mit
  Beginn, Ende und Dauer als Pflichtfeldern; keine Summe und keine Ansicht kennt ein fehlendes
  Ende. Der Timer bekommt später eigene Zustände (Pausen, Pomodoro). Gespeichert ist nur der
  Beginn, also läuft der Timer weiter, wenn die App geschlossen ist, und nichts schreibt im
  Sekundentakt. Unter Sync können zwei Geräte offline je einen Timer starten; ein eindeutiger
  Index ließe den Abgleich scheitern. _Preis:_ Jeder Lauf hinterlässt eine weich gelöschte Zeile,
  grob 2.000 bis 4.000 im Jahr; der Papierkorb räumt sie ab, weil nichts auf sie zeigt.
  _Verworfen:_ ein offener Zeiteintrag ohne Ende; dauerhafte Timer-Plätze je Projekt wie in der
  alten App.
- **D307 Überschneidungen sind gültige Daten, jede Summe zählt jeden Eintrag voll, und Schicht 4
  markiert nur.** Keine Datenbank-Regel und keine Operation lehnt einen überlappenden Eintrag ab;
  Überschneidungen sind kein Fall für D303. Betroffene Einträge bekommen in der Wochenansicht
  einen Hinweis, nie einen Fehler. _Gründe:_ Ein Verbot bräche am Import (die alte App enthält
  erlaubte Überschneidungen und geteilte Zeit), am Sync (zwei Geräte tragen offline dieselbe
  Stunde ein) und an parallelen Timern. _Preis:_ Die App hält niemanden davon ab, eine Stunde
  doppelt zu buchen, und eine Tagessumme kann über 24 Stunden liegen. _Nach Schicht 4:_ die
  Abläufe zum Auflösen (nur die freie Zeit erfassen, Eintrag teilen), die „abgedeckte Zeit“ als
  zusätzliche Kennzahl und, auf Wunsch des Owners, eine Einstellung, ob Überschneidungen
  zugelassen werden, für die ganze App und je Projekt. Diese Einstellung wird eine Regel der
  Operation für Eingaben auf dem eigenen Gerät; was Import und Sync bringen, bleibt gültig und
  wird markiert. Die Regel je Projekt liegt in derselben Tabelle wie die Rundung (D305).
- **D308 Der Formular-Helfer (#213) wird vor `projects` gebaut.** Sein Grilling nimmt die beiden
  Formulare aus Schicht 4 als Maßstab; das Projekt-Formular wird die Vorlage für jedes weitere
  Modul. _Gründe:_ Das erste Formular wird kopiert; von Hand gebaut, müssten später zwei Formulare
  umgebaut werden. Die Felder stehen fest (Text, langer Text, Icon, Farbe, zwei Zeitpunkte,
  Projekt-Auswahl), und das Zeiteintrags-Formular bringt die Prüfung über zwei Felder mit, die am
  Projekt-Formular allein fehlte. _Preis:_ Das erste sichtbare Modul kommt ein Paket später.
  _Verworfen:_ das Projekt-Formular von Hand, der Helfer beim zweiten Formular.
- **D309 Schicht 4 hat keine Seite für ein einzelnes Projekt; #201 wird mit dieser Seite gegrillt
  (klärt den offenen Punkt aus D241 für Schicht 4).** Ein Projekt wird über die Liste und den
  Bearbeiten-Drawer bearbeitet. Seine Zeiten zeigt die Zeit-Ansicht, gefiltert über eine Gruppe
  „Projekte“ in der Modul-Sidebar von `time-tracking`. Die Projektseite kommt, sobald ein zweites
  Modul etwas zu einem Projekt zeigt, als Seite von `projects`, auf der Module darüber Abschnitte
  beitragen. Schicht 4 baut keinen Erweiterungspunkt zwischen Modulen: Die Projekt-Auswahl
  exportiert `projects`, Name und Farbe am Zeiteintrag kommen über den Lese-Baustein (D241), der
  Timer über D310. _Gründe:_ Eine Projektseite könnte in Schicht 4 nur Zeiteinträge zeigen, also
  dieselbe Liste an einem zweiten Ort. Der Erweiterungspunkt entstünde an einem einzigen Fall,
  und die Seite für einen Eintrag ist ein Baustein der Hülle, den jedes Modul kopiert. _Preis:_
  Vom Projekt führt kein Sprung zu seinen Zeiten, und die Projektliste zeigt keine Stundensumme.
  _Verworfen:_ die Projektseite mit einem ersten Erweiterungspunkt schon jetzt.
- **D310 Die Hülle bekommt einen ständigen Platz, den ein Modul über seinen Hüllen-Beitrag
  füllt.** Ein Modul meldet ein kleines Element an; die Hülle bestimmt den Ort, das Modul den
  Inhalt. Je Modul ein Element, ohne einstellbare Reihenfolge. Erster Nutzer ist der Timer: Das
  Element zeigt Projekt und laufende Zeit und stoppt mit einem Klick; läuft nichts, bietet es das
  Starten an. Ein eigenes Arbeitspaket mit eigenem Grilling, gebaut vor dem Timer. _Gründe:_ Wer
  außerhalb von „Zeit“ nicht sieht, dass ein Timer läuft, vergisst ihn. Ein fest eingebauter
  Timer bräche den Grundsatz, dass die Hülle nichts über ein Modul weiß (D74). _Preis:_ Das
  Muster entsteht an einem Nutzer; absehbar folgen Sync-Zustand, Pomodoro und Assistent.
  _Laufzeit:_ Der Code des Elements lädt nach dem ersten Bild und gehört nicht zum Start; er
  enthält nur die Timer-Abfrage und die Anzeige, nicht die Ansichten des Moduls. Dazu kommt eine
  Abfrage beim Start. Die Anzeige zeichnet nur sich selbst neu. Der Platz ist reserviert, bevor
  der Code da ist, damit nichts springt. Das Paket bekommt eine Messung als Abnahmekriterium.
  _Verworfen:_ nur Befehle zum Starten und Stoppen ohne Anzeige.
- **D311 Die Platzhalter verlassen die App, wenn `projects` eingehängt wird, und bleiben
  Testobjekte; ein Modul-Abbau wird dafür nicht gebaut (klärt den offenen Punkt aus D252).**
  `placeholder-alpha` und `placeholder-beta` verschwinden aus Navbar, Modulliste des
  Datenprozesses und App-Vertrag. Sie bleiben im Repo für die Stories der Hülle und die Tests des
  Rahmens. Die Vorlage im Leitfaden zum Port-Muster wird `projects`. Entwicklungs-Datenbanken
  werden einmal neu angelegt; #214 bleibt offen, bis ein echtes Modul mit Nutzerdaten abgebaut
  wird. _Gründe:_ Die Tabelle des Platzhalters gibt es nur in Entwicklungs-Datenbanken (D252). Ein
  allgemeiner Abbau müsste Export, Sicherung und den Besitz der löschenden Migration klären; das
  lässt sich an einem Modul ohne Nutzerdaten nicht entwerfen. Hingen die Stories der Hülle an
  `projects`, fasste jede fachliche Änderung Hüllen-Tests an. _Bedingung:_ Der Owner nutzt die alte
  App weiter, bis er wechselt. Bis er Daten anlegt, die nicht verloren gehen dürfen, darf eine
  Datenbank neu aufgesetzt werden; danach nie wieder, und spätestens dann braucht jeder Abbau
  #214. _Preis:_ zwei Pakete ohne Fachnutzen, die mit dem Rahmen mitziehen.
- **D312 Schicht 4 wird in neun Schritten gebaut.**
  1. Die Konventionsprüfung verbietet `CASCADE` und `SET NULL` an jedem Fremdschlüssel (D302),
     ohne Grilling.
  2. Formular-Helfer (#213, D308).
  3. `projects`; die Platzhalter verlassen die App (D311).
  4. Schutz-Paket: der Einhängepunkt im Rahmen und die Verweis-Prüfung (D302, D303).
  5. Einstellungen in der Datenbank (#109).
  6. Zeitzone und Wochenstart (#110, verkleinert).
  7. `time-tracking`, Teil 1: Zeiteinträge, Formular, Wochenansicht, Filter nach Projekt.
  8. Der ständige Platz in der Hülle (D310).
  9. `time-tracking`, Teil 2: Timer und Markierung der Überschneidungen.

  Jeder Schritt außer dem ersten wird vorher gegrillt; die beiden Teile von `time-tracking` teilen
  sich ein Grilling. _Gründe:_ Das Verbot muss vor der ersten echten Migration stehen, der Schutz,
  bevor etwas auf Projekte zeigt, und Zeitzone und Wochenstart vor der Wochenansicht (D147). Nur
  der Timer braucht den ständigen Platz; der Schnitt hält `time-tracking` unter der Grenze von
  4.500 Zeilen je Paket. _Folgen:_ #110 wird geteilt: Die Standardwährung wandert zu `money`,
  damit #110 nicht an #105 hängt. `money` (#105) und `tags` (#111) folgen nach Schicht 4. Eine
  Ansicht „Gelöscht“ kommt mit dem Papierkorb-Paket; bis dahin bleibt nach dem Löschen der
  Hinweis mit „Rückgängig“. Der Import bleibt Schicht 5 und beginnt mit Projekten und
  Zeiteinträgen. _Verworfen:_ eine frühe Ansicht „Gelöscht“; ein vorgezogener Import von
  Projekten.

## Später, mit Vorschlag

Diese Fragen gehen mit ihrer vorgeschlagenen Antwort in die Spezifikationen der Arbeitspakete. Ein
Paket-Grilling sortiert sie neu; wer baut, darf anders entscheiden und nennt es im Pull Request.

**`projects`**

- **Titel:** eindeutig je Space unter nicht gelöschten Projekten, wie der Name in
  `placeholder-alpha`.
- **Icon und Farbe:** nach dem Muster aus D294; das Standard-Icon gibt `projects` vor.
- **Ansichten:** „Aktiv“ und „Archiv“.
- **Projekt-Auswahl:** ein Baustein, den `projects` exportiert; der Einstieg des Pakets dafür wird
  im Paket-Grilling benannt.
- **Nach Schicht 4:** Ordner, Favoriten, Reihenfolge von Hand, Tags (mit #111) und die Spalte
  `custom` (mit den Nutzerfeldern).

**`time-tracking`**

- **Projekt am Zeiteintrag:** optional.
- **Ansichten:** die Woche mit Summen je Tag und Projekt; ob daneben eine Liste aller Einträge
  kommt, klärt das Paket-Grilling.
- **Gruppe:** Die Modul-Sidebar zeigt die aktiven Projekte. Der Filter der Ansicht bietet auch
  archivierte an.
- **Summen:** Fenster-Abfragen je Woche oder Monat, gerechnet im Datenprozess (D147, D193); keine
  Local Table ohne Messung.
- **Messung:** Abfragezeit der Wochenansicht mit erzeugten Daten von zwei Jahren, als
  Abnahmekriterium.
- **Befehle:** Timer starten und stoppen und einen Eintrag anlegen sind Befehle, die auch ein
  späterer Assistent aufruft (D85).
- **Doppeltes Stoppen:** Der Zeiteintrag bekommt die Id des Timers; stoppen zwei Geräte denselben
  Timer, entsteht dieselbe Zeile.
- **Vergessener Timer:** ein „Stoppen um …“.

**Schutz-Paket**

- Wie der Rahmen die Verweise liest und wie ein Modul einen Verweis ausnimmt.
- Dass das Wiederherstellen prüft, ob das Ziel noch lebt.
- Wie eine Ablehnung unter den Konflikt-Gründen des Vertrags erscheint (offen in ADR 0023) und wie
  die Oberfläche benennt, was an einer Zeile hängt.

**Formular-Helfer (#213)**

- Aufbau auf `@mantine/form`.
- Die Prüfung nutzt das Eingabe-Schema des Vertrags; der Datenprozess prüft weiter jede Eingabe.
  D188 („der Renderer prüft nie“) meint Daten am Port und wird dort verfeinert.
- Zod lädt mit dem ersten geöffneten Formular, nie im Start (D269).
- Wie eine Prüfmeldung übersetzt wird, wenn ein Fehler nur einen Code trägt (D190).

**Ständiger Platz**

- Der Ort je Layoutstufe und die knappe Form auf schmalen Fenstern.
- Der Name des Bausteins für das Glossar.

## Für die Paket-Grillings vorgemerkt, mit dem Owner

Diese Fragen betreffen ein gespeichertes Format oder die Richtigkeit von Zeit und gehören nach
`docs/agents/workflow.md` auf die Liste des Owners.

- **Sekunden oder Minuten:** ob Beginn und Ende auf ganzen Sekunden liegen (offen seit der Runde zu
  `time`, D281). Bei
  Sekunden ergeben zwei angezeigte Einträge von 0:45 und 0:21 zusammen manchmal 1:05.
- **Mitternacht:** zu welchem Tag ein Eintrag zählt, der über Mitternacht läuft.
- **Dauer von Hand:** ob jemand die Dauer überschreiben darf, ohne Beginn oder Ende zu ändern.
- **Zeitumstellung im Formular:** die offenen Punkte aus der Runde zu `time` (D279–D285).
- **Archiv als Muster:** ob `archived_at` und seine Bedeutung für jedes Modul gleich gelten.
