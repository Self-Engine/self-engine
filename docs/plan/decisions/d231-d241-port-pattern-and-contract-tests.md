# Runde 32 (2026-11-12): Port-Muster und Contract-Test-Kit (#32, verfeinert D152, D188–D190, D193, D221, ändert D135 und D230)

Geprüft vor der Runde: oRPC 1.16.2 hat keinen Schalter für die Ausgabeprüfung, `validateOutput`
läuft immer, sobald ein Ausgabe-Schema da ist. better-sqlite3 13.0.3 bietet keinen Update-Hook.
Kysely 0.29.8 reicht einem Plugin in `transformQuery` den Abfragebaum, und `withPlugin` gibt es
auch auf einer Transaktion. Gebaut oder gemessen wurde in dieser Runde nichts; wo eine Zahl steht,
ist sie geschätzt und so benannt.

- **D231 Die Transaktion merkt sich selbst, welche Tabellen sie geschrieben hat.** Ein
  Kysely-Plugin liest aus jedem Abfragebaum das Ziel von `INSERT`, `UPDATE` und `DELETE` und
  sammelt die Tabellennamen; nach dem Commit meldet die obere Lage (D189) genau diese Menge. Kein
  Modul zählt Tabellen von Hand auf. Rohes SQL ist im Speicher verboten, weil das Plugin es nicht
  lesen kann; eine Lint-Regel sichert das. Das Contract-Test-Kit prüft den Mechanismus: Die
  gemeldeten Tabellen stimmen mit den wirklich geänderten überein. _Preis:_ ein Durchlauf über den
  Abfragebaum pro Schreibbefehl, nicht gemessen. _Verworfen:_ Tabellen pro Operation von Hand
  angeben (eine vergessene Tabelle heißt: Die Liste lädt nicht neu, und kein Test merkt es); ein
  Update-Hook des Treibers (gibt es nicht).
- **D232 Der Rahmen der oberen Lage wird einmal gebaut.** Er prüft die Eingabe, baut den Kontext
  (D195), öffnet die Transaktion, meldet die Tabellen (D231), rollt bei einem Fehler zurück und
  übersetzt ihn (D238). Ein Modul liefert pro Vertragseintrag eine Funktion `(tx, kontext,
  eingabe) => ergebnis` der unteren Lage und markiert sie als Abfrage oder Operation. Eine Abfrage
  bekommt einen Zugang, der nur lesen kann. Brücken (D152) rufen dieselben Funktionen. Sonderfälle
  wie ein langer Import mit Fortschritt oder ein Strom werden von Hand geschrieben, wie `health`
  und `tablesChanged` heute. _Verworfen:_ jedes Modul schreibt den Rahmen selbst (die Regeln aus
  D188, D190 und D195 lägen in jeder Datei noch einmal).
- **D233 Die Modulliste der Datenseite liegt in `data-process`, die Bausteine in einem neuen Paket
  `@self-engine/storage` (ändert D135).** Bisher stellt die Desktop-App die Migrationen zusammen.
  Künftig hält `data-process` eine Liste der Daten-Einstiege aller Module und baut daraus
  Migrationen und Router; jede App, die den Datenprozess startet, bekommt dieselbe Liste. Was ein
  Modul für seinen Speicher braucht (Markierungen für Abfrage und Operation, Kontext,
  Listen-Bausteine, gemeinsamer Einstieg, Test-Kit), liegt in `storage`, denn ein Modul darf
  `data-process` nicht importieren, wenn `data-process` die Module importiert
  ([ADR 0006](../../adr/0006-module-boundaries-are-enforced-three-ways.md)). `db` kennt weiter kein
  Modul. _Verworfen:_ jede App setzt selbst zusammen (Desktop, Mobile und MCP-Server liefen
  auseinander, wie in D187); Bausteine in `db` (zöge oRPC und den Vertrag in das Treiber-Paket).
- **D234 Die Ausgabeprüfung schaltet der Rahmen, nicht oRPC (beantwortet die offene Frage aus
  D188).** Module schreiben normale Zod-Ausgabe-Schemas in den Vertrag. Der Rahmen bekommt beim
  Start die Option „Ausgaben prüfen“; ist sie aus, arbeitet er auf einer Kopie des Vertrags ohne
  Ausgabe-Schemas. Tests und der Dev-Build prüfen, die gepackte App nicht; ein Test hält beide
  Fälle fest. Das Kit prüft, dass kein Ausgabe-Schema etwas umwandelt. _Verworfen:_ ein
  ungeprüftes Schema wie im Durchstich (der Vertrag verlöre die Form der Ausgabe, auch für Stories
  nach D196).
- **D235 Der gemeinsame Einstieg bietet `live(tabelle)` und vier einzeilige Standard-Schreibwege.**
  `live` setzt `space_id` aus dem Kontext und `deleted_at IS NULL` (D221). Anlegen, Ändern,
  Löschen (weich) und Wiederherstellen setzen die Konventionsspalten und liefern „nicht gefunden“
  nach D221. Beides gilt nur für synchronisierte Tabellen. Alles andere (Verbindungen, Summen,
  Änderungen an mehreren Zeilen) bleibt freies Kysely; die Filter setzt dort das Modul, und das Kit
  prüft sie. _Verworfen:_ ein vollständiger Abfrage-Baukasten über Kysely (eine zweite
  Abfragesprache, die jede Ausnahme nachbauen müsste).
- **D236 Eine Seiten-Liste blättert mit einer undurchsichtigen Marke, die Größe bestimmt der Port
  (schärft D193).** Der Datenprozess gibt mit jeder Seite eine Marke für davor und danach mit, der
  Renderer reicht sie unverändert zurück und kennt ihren Inhalt nicht. Sie entsteht aus dem
  Sortierwert und der `id`; jede Seiten-Liste hat eine feste Reihenfolge mit der `id` als letztem
  Kriterium. Eine Seite hat 100 Zeilen, eine einzelne Liste darf das im Speicher auf höchstens 500
  setzen, der Renderer wählt die Größe nie. Das Kit liest den Abfrageplan und schlägt fehl, wenn
  eine Seiten-Abfrage ohne Index sortiert. Die Gesamtzahl der Zeilen klärt #137. _Verworfen:_ der
  Renderer baut die Marke aus der letzten Zeile (jede Liste der Oberfläche müsste die Sortierung
  kennen); Größe pro Aufruf (eine Komponente könnte alles verlangen).
- **D237 Fenster und kleine Menge bleiben unbegrenzt, der Dev-Build warnt ab 1.000 Zeilen.** Beide
  liefern immer alles. Prüft der Rahmen Ausgaben (D234), schreibt er ab 1.000 Zeilen eine Warnung
  mit dem Namen der Abfrage ins lokale Fehlerprotokoll. Die Zahl ist geschätzt, nicht gemessen.
  _Preis:_ Die Warnung fällt nur auf, wenn jemand mit vielen Daten entwickelt; den großen
  Testdatensatz plant #33 mit den Zeitmessungen ein. _Verworfen:_ nur die Markierung (niemand
  erfährt, wenn die Menge wächst); eine harte Grenze (ein Auswahlfeld ginge kaputt, das nur
  langsam gewesen wäre).
- **D238 Das Modul hinterlegt, welcher eindeutige Index welcher Konflikt ist, der Rahmen übersetzt
  (schärft D190, klärt D221).** Pro eindeutigem Index nennt das Modul den Grund (`name_taken`). Der
  Rahmen fängt die Verletzung aus SQLite und macht daraus „Konflikt“ mit diesem Grund; eine
  Verletzung ohne Eintrag ist unerwartet und geht ins Fehlerprotokoll. Es gibt keine Abfrage vor
  dem Schreiben, die Regel steht nur im Index. Das Kit prüft, dass jeder eindeutige Index eines
  Moduls einen Eintrag hat, und löst jeden Grund einmal aus. Wiederherstellen in einen inzwischen
  vergebenen Wert meldet denselben Konflikt wie Anlegen; die Oberfläche entscheidet, was sie
  anbietet. Gründe, die kein Index ausdrückt (`already_billed`), wirft die Funktion der unteren
  Lage weiter selbst. _Verworfen:_ vorher nachfragen (eine Abfrage mehr pro Schreibvorgang, die
  Regel doppelt); beim Wiederherstellen umbenennen (ändert Daten ungefragt und wäre für eine
  Rechnungsnummer falsch).
- **D239 Das Contract-Test-Kit ist ein Aufruf pro Modul.** Das Modul übergibt seinen
  Daten-Einstieg, eine Funktion, die Beispieldaten anlegt, und pro Vertragseintrag eine gültige
  Beispiel-Eingabe; fehlt eine, schlägt der Test fehl. Das Kit läuft gegen echtes SQLite in
  `:memory:` (D95) und prüft für jeden Eintrag: gemeldete gegen geänderte Tabellen (D231);
  Abfragen schreiben nichts (D232); Ausgabe-Schemas wandeln nichts um und die Ausgabe passt zum
  Vertrag (D188, D234); keine Zeile aus einem zweiten Space und keine gelöschte Zeile (D195,
  D221); Seiten-Abfragen nutzen einen Index (D236); jeder eindeutige Index hat seinen Grund
  (D238); ungültige Eingaben werden abgewiesen. Die Fachlogik testet das Modul selbst.
  _Verworfen:_ ein Werkzeugkasten, aus dem jedes Modul seine Prüfungen zusammensetzt (eine
  vergessene Prüfung fällt nicht auf).
- **D240 Das Beispiel `notes` zieht nach `storage` und wird zur Vorlage (ändert D230).** Es bekommt
  `./contracts` und `./data`, Abfragen in allen drei Listen-Arten, Operationen und seinen
  eindeutigen Index, läuft durch das Kit und ist das Muster, von dem Module abschreiben. In der App
  taucht es nicht auf. Der Durchstich durch die echte App (`placeholder-alpha` auf dem Port) ist
  die erste Aufgabe von #33, weil er die Hooks braucht; dort entsteht auch der Helfer für feste
  Antworten (D196). _Verworfen:_ `placeholder-alpha` schon in #32 umstellen (#32 wäre ohne die
  offenen Entscheidungen von #33 nicht baubar).
- **D241 Ein Modul liest fremde Daten nur über freigegebene Lese-Bausteine, nie über fremde
  Tabellen (verfeinert D152).** Das besitzende Modul exportiert in `./data` einen Baustein mit
  wenigen festen Spalten (etwa Id, Name und Farbe eines Projekts) und eingebautem Space-Filter.
  Ein Modul, das nach D152 darauf aufbauen darf, verbindet ihn in einer Abfrage und kann so danach
  sortieren und filtern. Der Baustein liefert auch gelöschte Zeilen und markiert sie, damit ein
  Zeiteintrag nicht verschwindet, weil sein Projekt gelöscht ist. Eine Brücke liest über die
  Abfragen der Module oder über diese Bausteine. Die Zeilen-Map eines fremden Moduls zu
  importieren verbietet eine Lint-Regel; geschrieben wird in fremde Tabellen nie. Die Regel
  dahinter: Ein Modul kennt nur Module, auf denen es aufbaut. _Preis:_ Das besitzende Modul pflegt
  den Baustein. _Offen:_ Wie ein Modul in der Oberfläche etwas in die Seite eines anderen einhängt
  (das Zeitmodul eine Karte „Aufgenommene Zeit“ in die Projektseite), ist nicht entschieden und
  gehört zu Schicht 4. _Verworfen:_ nur über die Abfragen des anderen Moduls (kein Sortieren und
  Filtern über beide Seiten); freier Zugriff auf fremde Tabellen (jede Spaltenänderung bricht das
  lesende Modul, die Filter stünden doppelt).
