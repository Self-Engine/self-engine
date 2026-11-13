# Runde 31 (2026-11-12): Typisierte Abfragen mit Kysely und Zod (#31, verfeinert D87, D91, D187, D195)

- **D219 Die Zeilen-Map ist die einzige geschriebene Quelle der Spaltentypen.** Jedes Modul
  deklariert in `./data` eine Map aus Tabellennamen und Zod-Zeilenschemas mit Speichertypen
  (snake_case, `deleted_at` nullbar). Die Kysely-Typen leitet ein kleiner Typ `TablesOf` aus `db`
  daraus ab; `withTables` und jede Speicherfunktion nutzen ihn, und der Übereinstimmungstest
  liest dieselbe Map. Das geht, weil Zeilen keine Defaults haben (D140, D141) und damit beim
  Einfügen, Lesen und Ändern gleich aussehen; `Generated<>` und `ColumnType` entfallen. Ein
  abgeleiteter Typ ist immer ein `type`-Alias, die `interface`-Reibung des Durchstichs entfällt.
  _Preis:_ Die Zeilenschemas werden beim Laden von `./data` gebaut, aber nie geparst (D188).
  _Verworfen:_ handgeschriebener Kysely-Typ neben einem Zod-Schema (zwei Quellen, dritte
  Prüfung); `kysely-codegen` (erzeugte Datei pro Modul, Erzeugung muss durch Vite, D191).
- **D220 Spalten snake_case, Entitäten camelCase, eine handgeschriebene Abbildung pro Entität.**
  Sie liegt in `./data`, ist gegen die abgeleitete Zeile typisiert und macht auch die übrigen
  Umwandlungen (`0/1` zu `boolean`, Weglassen der Konventionsspalten). Gemessen: 0,39 ms pro
  10.000 Zeilen. _Verworfen:_ Kyselys `CamelCasePlugin` (zwei Namen für eine Spalte, rohe
  `sql`-Fragmente umgehen es, Kosten pro Zeile ohne Ersparnis bei der Abbildung); snake_case bis in
  die Entität.
- **D221 Eine Entität trägt `id`, `createdAt` und `updatedAt`, Gelöschtes verlässt den Port nur
  ausdrücklich.** `space_id` und `deleted_at` bleiben im Datenprozess: Der Space kommt aus dem
  Kontext (D195), und solange nur ein Space sichtbar ist, trüge jede Zeile denselben Wert. Braucht
  eine Ansicht später Spaces gemischt, kommt `spaceId` als additives Feld. Rückgängig beim Löschen
  (D79) braucht nur die `id` und `restore`; ein Papierkorb wäre eine eigene Operation mit eigener
  Entität samt `deletedAt`. `get` und jede Änderung auf eine gelöschte Id liefern „nicht gefunden“
  (D190). Jede Abfrage filtert selbst; #32 baut einen gemeinsamen Einstieg, der `space_id` und
  `deleted_at IS NULL` an einer Stelle setzt, und das Contract-Test-Kit legt neben die Zeilen in
  zwei Spaces eine gelöschte Zeile. Eindeutige Indizes auf synchronisierten Tabellen sind partiell
  auf `deleted_at IS NULL`, sonst blockiert ein gelöschter Name einen neuen; `checkConventions`
  prüft das. Ein Wiederherstellen in einen inzwischen vergebenen Wert ist ein Konflikt mit Grund
  (klärt #32). _Verworfen:_ eine View pro Tabelle (doppelt in unveränderlichen Migrationen, Lesen
  und Schreiben getrennt); nur Konvention ohne Prüfung.
- **D222 `custom` kommt erst mit den Nutzerfeldern (schärft D87).** Form, Prüfung und Oberfläche
  der Nutzerfelder sind nicht entworfen; jetzt eine Spalte festzulegen nähme dem Entwurf eine
  Antwort vorweg und kostete in jeder Zeile ein `JSON.parse`. Mit dem Feature ergänzt jedes Modul
  `ALTER TABLE … ADD COLUMN custom TEXT NOT NULL DEFAULT '{}'`, in SQLite eine reine
  Schemaänderung ohne Umschreiben der Tabelle; D140 verbietet `DEFAULT` nur auf den Zeitspalten.
  Ihr Platz ist die Zeilen-Map (`z.string()`) und die Abbildung (`JSON.parse`). _Preis:_ eine
  Migration pro Modul, wenn das Feature kommt.
- **D223 `time` entsteht jetzt mit nur `Instant`.** `./contracts` darf `db` nicht importieren
  (D187), braucht aber für D188 einen gebrandeten Zeitpunkt. `time` bekommt daher in #31 genau
  `Instant` mit Zod-Schema: exakte Form `2026-11-09T14:07:46.297Z`, Jahre 1000 bis 9999 (D149).
  `newTimestamp` in `db` liefert `Instant`. Name und Form folgen dem, was #104 aus der alten App
  übernimmt (D148); #104 baut das Paket aus, statt etwas zu ersetzen. _Verworfen:_ vorläufig in
  `db` mit Ausnahme in den Modulgrenzen (alles zöge nach #104 um); `string` bis #104 (gegen D188).
  _`newTimestamp` überholt durch D284: Die Uhr aus `time` liefert den `Instant` selbst, die
  Funktion ist mit #104 entfallen._
- **D224 Eine Id-Marke pro Entität.** `idSchema("Project")` prüft UUIDv7 und trägt die Marke
  `ProjectId`. Zeilen-Map, Kysely-Typen (über D219), Abbildung und Vertrag nutzen dieselben
  Schemas, auch für Fremdschlüssel; eine Abfrage auf `projects.id` liefert direkt `ProjectId`. Neue
  Ids entstehen nur über den Kontext, ohne Typumwandlung von Hand. Ein Fremdschlüssel auf ein
  anderes Modul importiert dessen `./contracts` und braucht seinen Eintrag in `ALLOWED_IMPORTS`.
  _Grund:_ `timeEntries.create({ projectId: task.id })` kompiliert sonst und fällt erst beim
  Commit oder gar nicht auf. Marken kosten zur Laufzeit nichts. _Verworfen:_ eine gemeinsame
  Marke `Id`; keine Marke.
- **D225 Ein reiner Einstieg `@self-engine/db/schema` (ergänzt D187).** Er enthält nur Zod-Schemas,
  die Zeile und Vertrag teilen: `idSchema` und `sqliteBoolean`. Die Kern-Reinheitsregel sichert ihn
  (kein Kysely, kein `uuid`, kein Treiber), und `./contracts` darf ihn importieren. _Verworfen:_
  ein eigenes Paket für eine Datei; Id-Schemas in jedem Modul.
- **D226 Der Übereinstimmungstest vergleicht die Zeilen-Map mit den echten Spalten.** Er kommt aus
  `@self-engine/db/testing`, liefert wie `checkConventions` eine Liste von Verstößen und lässt die
  Migrationen des Moduls allein auf einer frischen Datenbank laufen; jede Tabelle danach gehört dem
  Modul, ausgenommen die von Kysely und SQLite. Geprüft werden: Tabellen und Spalten als Menge
  gleich; nur erlaubte Formen (`z.string()` und alles darauf zu `TEXT`, `z.number().int()` zu
  `INTEGER`, `z.number()` zu `REAL`, `sqliteBoolean` als `0 | 1` zu `INTEGER`); `.nullable()` genau
  bei Spalten ohne `NOT NULL`; `.optional()` ist verboten. `z.boolean()` ist verboten, weil der
  Treiber `0`/`1` liefert und der abgeleitete Typ sonst lügt; die Spalte trägt `CHECK (x IN (0,
  1))`, den der Test nicht liest. Indizes, Fremdschlüssel und `STRICT` bleiben bei
  `checkConventions`.
- **D227 Jeder Index auf einer synchronisierten Tabelle beginnt mit `space_id`, ohne Ausnahmeliste
  (schärft D195).** Eine Prüfung kann nicht wissen, welcher Index einem Fenster dient, und ein
  Index ohne Fenster ist nicht in Sicht: Suchen nach `id` deckt der Primärschlüssel, „Aufgaben
  eines Projekts“ ist selbst ein Fenster. Der automatische Index des Primärschlüssels und lokale
  Tabellen sind ausgenommen. Mit D221 heißt das: Eindeutigkeit auf synchronisierten Tabellen läuft
  über `CREATE UNIQUE INDEX (space_id, …) WHERE deleted_at IS NULL`, nie über ein eingebettetes
  `UNIQUE`. `checkConventions` prüft beides. _Preis:_ eine Space-Id mehr pro Indexeintrag, bei
  100.000 Zeilen rund 3,6 MB pro Index (gerechnet). _Verworfen:_ nur Konvention; Ausnahmeliste.
- **D228 Kein `*OrThrow` im Speicher.** Kyselys `NoResultError` war im Bundle nicht am Namen zu
  erkennen. Abfragen nutzen `executeTakeFirst()`, und der Speicher macht aus `undefined`
  ausdrücklich „nicht gefunden“ (D190). Eine Lint-Regel im Repo-Plugin verbietet
  `executeTakeFirstOrThrow` und `takeFirstOrThrow` und nennt den Ersatz. _Verworfen:_ `instanceof
  NoResultError` (erwartete Fälle als Ausnahme, `try/catch` in jeder Funktion).
- **D229 `createTestSources(start)` in `@self-engine/db/testing`.** Liefert Uhr, `IdSources` und
  `advance(ms)` über eine gemeinsame Zeit, die nur bei `advance` weiterläuft (eine Zeit pro
  Transaktion, D195). Die Zufallsbytes sind ein Zähler: Ids sind eindeutig und steigen auch
  innerhalb einer Millisekunde in Anlegereihenfolge. Der Test-Kontext aus #32 baut darauf auf.
- **D230 Das Beispiel ist ein Testmodul in `db`.** Eine Tabelle `notes` nach allen Konventionen mit
  Zeilen-Map, partiellem eindeutigem Index, Abbildung und Entitäts-Schema; sein Test führt
  `checkConventions` und den Übereinstimmungstest aus und liest eine geschriebene Zeile gebrandet
  zurück. Das bestehende Migrations-Testmodul bleibt, wie es ist. Die absichtlich falschen Spalten
  stehen als Fixtures in den Tests des Übereinstimmungstests. Die Aufteilung in `./contracts` und
  `./data` zeigt erst #32. _Verworfen:_ eine Tabelle in `placeholder-alpha` vor dem Port-Muster;
  ein eigenes Paket.
