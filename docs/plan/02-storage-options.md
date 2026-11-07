# Vertiefung: Wie werden Daten gespeichert? (Q22)

Stand: 2026-11-07 · Status: in Diskussion

## Zwei Arten von „generisch“

Zuerst muss man auseinanderhalten, wofür etwas generisch sein soll:

1. **Generisch für Module und Plugins:** Ein neues Modul bringt neue Entitäten mit, ohne
   Datenbank-Migration und ohne neue Sync-Konfiguration.
2. **Generisch für Nutzer:** Nutzer fügen eigene Felder hinzu, bauen eigene Typen und
   Ansichten (wie bei Notion-Datenbanken oder Tana-Supertags).

(1) ist eine Frage der Speicherform. (2) verlangt zusätzlich, dass das **Schema selbst aus
Daten besteht**: Typen und Felder sind dann selbst Einträge, die man anlegen und syncen
kann.

## SQL oder etwas anderes?

Man muss die Speicher-Engine vom Datenmodell trennen.

- **Engine:** SQLite ist auf Desktop, Web (OPFS) und Mobile praktisch alternativlos.
  Es ist robust, schnell, überall verfügbar und wird von allen ernsthaften Sync-Engines
  genutzt. Die Alternativen sind schwächer: IndexedDB ist langsam und hat keine
  Abfragesprache, Datalog- und Graph-Engines in JS (Datascript, Cozo) sind auf Mobile kaum
  erprobt.
- **Datenmodell:** Hier liegt die eigentliche Wahl. Auf SQLite lassen sich sehr
  unterschiedliche Modelle bauen.

## Die Optionen für das Datenmodell

| Modell | Idee | Vorbilder | Stärken | Schwächen |
|---|---|---|---|---|
| **A. Tabellen pro Entität** | `projects`, `time_entries`, … | Self-Engine heute | Starke DB-Garantien, einfache SQL-Auswertungen | Jedes Modul/Plugin braucht Migrationen auf Client **und** Server; eigene Felder schwer |
| **B. Dokumente (`records`)** | Eine Tabelle, Daten als JSON, Typ als Spalte | PowerSync intern, Firestore | Keine Migrationen für neue Typen, Sync generisch | Abfragen über JSON brauchen Indizes; Verweise prüft die DB nicht |
| **C. Triples / EAV** | Jede Eigenschaft ist eine Zeile: (Objekt, Attribut, Wert) | Datomic, Logseq (DB-Version), Tana | Maximal flexibel, Felder sind global wiederverwendbar, feiner Sync pro Feld | Abfragen umständlich und langsam in SQL, viele Zeilen |
| **D. Event Sourcing** | Gespeichert werden Ereignisse, Tabellen sind daraus berechnete Ansichten | LiveStore | Volle Historie, Audit, Schema-Änderung durch Neuberechnen, gut prüfbar | Ereignisse müssen für immer lesbar bleiben; mehr Konzepte |
| **E. CRDT-Dokumente** | Jede Entität ist ein mergebares Dokument | Automerge, Yjs | Konfliktfrei, gut für Text | Server kann nicht ablehnen (Org-Policies unmöglich) → ausgeschlossen |

## Vorschlag: „Typisierte Objekte auf generischem Kern“

Eine Kombination aus B, einem Teil von C und optional D:

1. **Alles ist ein Objekt** in einer Tabelle `objects`: `id`, `space_id`, `type`,
   `fields` (JSON), `schema_version`, Zeitstempel, gelöscht-Flag.
2. **Verknüpfungen sind eigene Zeilen** in `links`: `from`, `to`, `kind`. Damit kann die DB
   Verweise indizieren, es gibt Backlinks und Graph-Ansichten, und **Brücken zwischen
   Modulen sind einfach Link-Arten** (z. B. `time_entry → payout`). Das löst genau das
   Problem aus Self-Engine, wo Payout-Felder am Zeiteintrag kleben.
3. **Schema als Daten:** Typen und Felddefinitionen sind selbst Objekte. Module liefern
   ihre Typen im Code mit (inkl. Fachregeln), Nutzer können Feldern hinzufügen oder eigene
   Typen anlegen. Felder sind global wiederverwendbar (Idee aus C / Anytype-Relations).
4. **Schnelle Abfragen** über Indizes auf JSON-Felder, die ein Modul als „indiziert“
   deklariert, oder über berechnete Lese-Tabellen pro Typ (z. B. `time_entries_view` für
   Auswertungen), die aus `objects` neu aufgebaut werden können.
5. **Fachlogik bleibt in den Modulen:** Executors prüfen jede Änderung (Schema-Validierung
   + Regeln wie Rundung, Überschneidungen). Später prüft der Server im Org-Space dieselben
   Regeln.
6. **Schema-Änderungen pro Objekt:** `schema_version` am Objekt und kleine
   Umwandlungsfunktionen (Upcaster), die alte Objekte beim Lesen oder in einem Hintergrund-
   lauf anheben.

Optional (D): Schreibvorgänge zusätzlich als **Operationen-Log** speichern. Das gibt
Historie und Undo und passt zur späteren Server-Prüfung, kostet aber Komplexität. Kann
später ergänzt werden, wenn die Schreibschnittstelle von Anfang an aus Operationen besteht.

## Offene Risiken

- Auswertungen (z. B. Stunden pro Projekt und Monat über 50 000 Einträge) müssen mit JSON
  plus Indizes oder Lese-Tabellen schnell genug sein → mit echten Datenmengen messen.
- Typsicherheit in TypeScript muss aus den Modul-Schemas generiert werden.
- Nutzerdefinierte Typen (Ebene 2) sind ein großes Feature; das Modell muss sie erlauben,
  gebaut werden müssen sie nicht sofort.

## Nächste Schritte (zur Entscheidung)

- Klären, wie generisch es für Nutzer werden soll (Q26).
- Recherche, wie Anytype, Tana, Logseq (DB-Version), Notion und Capacities das intern lösen.
- Wegwerf-Prototyp: Variante A gegen den Vorschlag oben, mit realistischen Datenmengen aus
  Self-Engine, verglichen nach Abfrage-Ergonomie und Geschwindigkeit.
