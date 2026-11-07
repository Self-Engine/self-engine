# Recherche: Wie speichern vergleichbare Apps ihre Daten? (zu D16 / Q22)

Stand: 2026-11-07 · Status: Recherche abgeschlossen, Entscheidung offen

Bezug: [`02-storage-options.md`](02-storage-options.md) (Kandidat „typisierte Objekte auf
generischem Kern“), [`00-decisions.md`](00-decisions.md) (D8, D11, D15, D16).

Legende: **[verifiziert]** = im Quellcode oder in offizieller Doku nachgelesen ·
**[sekundär]** = nur über Dritte (Blog, Code-Tour, Community-Tool) · **[nicht verifiziert]** =
plausibel, aber keine Primärquelle gefunden.

---

## Kurzfassung

1. **Fast alle Apps mit nutzerdefinierten Typen speichern generisch** (Objekt/Knoten/Block +
   Schlüssel-Wert-Eigenschaften). Typen und Felder sind dort selbst Datensätze. Das bestätigt
   die Richtung des Kandidaten.
2. **Die eine große Ausnahme ist Twenty CRM:** Es erzeugt aus Metadaten echte Postgres-Spalten
   pro Workspace (DDL zur Laufzeit). Das geht, weil Twenty nur _eine_ Datenbank pro Workspace
   hat. Bei uns gibt es N Client-Datenbanken plus Server; Laufzeit-DDL auf allen Replikaten
   widerspricht dem Ziel „keine Migrationen für neue Typen“. Twenty ist aber das beste Vorbild
   für die **Metadaten-Schicht** (Objekt-/Feld-Metadaten, Feld-ID ≠ Spaltenname, zusammengesetzte
   Feldtypen wie Währung = Betrag + Code, Metadaten-Version als Cache-Schlüssel).
3. **Stabile Feld-IDs statt Feldnamen** sind überall Standard (Notion-Property-IDs,
   AppFlowy-`field_id`, Anytype-Relation-Keys, Twenty-Field-Metadata-ID, Tana-Field-Definition-Knoten).
4. **Verweise werden fast überall als eigene, indizierte Struktur geführt** (Anytype hat eine
   eigene `links`-Collection als abgeleiteten Index; Logseq `:block/refs`; Notion `parent` +
   `content`). Wichtig: bei Anytype ist der Links-Index **abgeleitet** und neu aufbaubar.
5. **Sync-Lehre von Logseq (2026) und Notion:** Nicht nur rohe Datenänderungen
   synchronisieren, sondern die **Absicht (semantische Operation)** mitschicken und auf dem
   Server bzw. beim Rebase erneut ausführen. Notion lässt den Server jede Transaktion prüfen und
   ablehnen – genau unser Org-Space-Modell.
6. **Eigene Mini-Messung (SQLite 3.54, 50 000 Zeiteinträge + 150 000 andere Objekte):** JSONB
   mit generierten Spalten und partiellem, deckendem Index ist bei Monats-/Jahresauswertungen
   **gleich schnell wie eine echte Tabelle** (~5–7 ms für ein Jahr) – aber nur, wenn der
   Query-Planner den richtigen Index nimmt. Ohne `ANALYZE`/`INDEXED BY` wählte er den
   generischen `type`-Index und war 3–6× langsamer. Ein Join über `links` statt eines
   Feldes kostete Faktor ~6.

**Empfehlung in einem Satz:** Kandidat beibehalten, aber mit drei Änderungen – (a) Felder per
stabiler ID und in getrennten Namensräumen (Modul vs. Nutzer), (b) Verweise, die einem Objekt
gehören, im Feld speichern und `links` daraus ableiten; nur modulübergreifende Brücken sind
eigenständige Link-Objekte, (c) Auswertungen über modul-deklarierte, lokal erzeugte
Projektionen (generierte Spalten oder neu aufbaubare Lese-Tabellen), nie über rohes JSON.

---

## 1. Die Apps im Einzelnen

### 1.1 Anytype (any-sync, anytype-heart, any-store)

- **Datenmodell:** Jedes Objekt ist ein eigener Baum signierter, verschlüsselter Änderungen
  (DAG) innerhalb eines Space. „data in any-sync is stored as encrypted Directed Acyclic Graphs
  (DAGs)“; Änderungen sind CRDT-basiert und kryptografisch signiert. **[verifiziert]**
  ([any-sync README](https://github.com/anyproto/any-sync))
- **Typen und Felder:** Typen („Object Types“) und Felder („Relations“) sind selbst Objekte im
  Space. Mitgelieferte Relations stehen als JSON im Code
  (`pkg/lib/bundle/relations.json`, `types.json`, `systemRelations.json`), mit `key`,
  `format` (text, number, date, tag, object …), `maxCount` und `source`
  (`details` = gespeichert, `derived` = berechnet, z. B. `createdDate`). **Relations sind
  global pro Space**, nicht pro Typ – ein Typ referenziert nur, welche Relations er
  empfiehlt. **[verifiziert]**
  ([relations.json](https://github.com/anyproto/anytype-heart/blob/main/pkg/lib/bundle/relations.json))
- **System- vs. Nutzer-Schema:** System-Typen/-Relations (z. B. Task, Done, Name) sind für Nutzer
  nicht änderbar, „because application business logic depends on their content“. Updates laufen
  über ein `Revision`-Feld und einen „System Object Reviser“; bei nicht-System-Relations wird
  ein Umbenennen durch den Nutzer respektiert (nur überschrieben, wenn der lokale Name noch ein
  früherer mitgelieferter Name ist). **[verifiziert]**
  ([docs/Flow.md](https://github.com/anyproto/anytype-heart/blob/main/docs/Flow.md))
- **Abfragen/Index:** Der lokale Objekt-Store ist ein **abgeleiteter Index** in `any-store`
  (dokumentenorientiert, Mongo-artige Queries, Indizes zur Laufzeit anlegbar). Pro Space gibt es
  die Collections `objects` und `links`; der Index merkt sich pro Objekt den zuletzt indizierten
  DAG-Stand (`SaveLastIndexedHeadsHash`) und kann neu aufgebaut werden. Backlinks sind eine
  abgeleitete Relation (`backlinks`), die ein Watcher aktuell hält. **[verifiziert]**
  ([spaceindex/store.go](https://github.com/anyproto/anytype-heart/blob/main/pkg/lib/localstore/objectstore/spaceindex/store.go),
  [Flow.md](https://github.com/anyproto/anytype-heart/blob/main/docs/Flow.md))
- **Speicher-Engine:** `any-store` v2 ist inzwischen eine eigene B-Baum/WAL-Engine „derived from
  SQLite (aligned with its design, not a literal port)“, pure Go. Frühere Versionen liefen auf
  SQLite. **[verifiziert]** ([any-store README](https://github.com/anyproto/any-store))
- **Sync:** E2E-verschlüsselt, Sync-Knoten können nichts lesen → **Server kann Writes nicht
  fachlich prüfen**. Für unsere Org-Spaces daher kein Vorbild, für persönliche Spaces schon.
- **Lehren für uns:** globale Felder mit stabilem Key; System-Schema mit Revision und
  respektvollem Update; Index/Backlinks als neu aufbaubare Ableitung; Trennung „gespeichert“
  vs. „abgeleitet“ direkt in der Felddefinition.

### 1.2 Tana

- **Datenmodell:** „Everything is a node“ – auch Felder, Views, Commands, Supertags. **[verifiziert,
  Doku]** ([Nodes and references](https://tana.inc/docs/nodes-and-references),
  [Intro](https://tana.inc/articles/intro-to-nodes-fields-and-supertags))
- **Typen/Felder:** Supertags sind Knoten vom Typ `tagDef`; ihre Kinder sind „Tupel“-Knoten
  `[Feld-Label, Default]`. Ein Feldwert an einem Knoten ist ebenfalls ein Tupel-Knoten
  `[Felddefinition, Wert1, Wert2 …]`. Supertags können voneinander erben. Über die Input-API
  werden Tags/Felder per System-IDs (`SYS_T01`, `SYS_T02`) angelegt.
  **[sekundär]** (Export-Format aus
  [supertag-cli Doku](https://github.com/jcfischer/supertag-cli/blob/main/docs/TANA-FIELD-STRUCTURES.md);
  [Input API](https://outliner.tana.inc/learn/features/input-api))
- **Abfragen:** Wird als Graph mit Suchknoten beschrieben; interne Speicherung (Cloud, Format)
  ist **[nicht verifiziert]** – keine Engineering-Publikation gefunden.
- **Lehren:** Maximal generisch (Triple-artig, Feldwert = eigener Knoten). Das Community-Tool muss
  für jede Auswertung mehrfach über `nodes` joinen und `json_extract` auf `_docType` anwenden –
  ein gutes Beispiel, **warum EAV/Triples für SQL-Auswertungen unhandlich sind**. Außerdem:
  `_sourceId` (Verweis Wert → Felddefinition) fehlt laut Tool „often“ – Inkonsistenz, sobald
  das Schema nicht hart erzwungen wird.

### 1.3 Logseq (DB-Version)

- **Datenmodell:** Datascript (Datalog, Triple/Datoms: Entität–Attribut–Wert). Seiten und
  Blöcke sind „Nodes“; Schema mit `:block/parent`, `:block/page`, `:block/refs`, `:block/tags`
  (cardinality many) usw. Schema-Version derzeit `65.35`. **[verifiziert]**
  ([schema.cljs](https://github.com/logseq/logseq/blob/master/deps/db/src/logseq/db/frontend/schema.cljs))
- **Persistenz:** SQLite dient **nur als Key-Value-Speicher** für Datascripts B-Baum-Knoten:
  `create table if not exists kvs (addr INTEGER primary key, content TEXT, addresses JSON)`.
  Abfragen laufen in Datascript im Speicher, nicht in SQL. **[verifiziert]**
  ([sqlite.cljs](https://github.com/logseq/logseq/blob/master/deps/db/src/logseq/db/common/sqlite.cljs))
- **Typen/Felder:** Tags = Klassen (mit Vererbung), Properties = typisierte Entitäten (Text,
  Number, Date, Checkbox, URL, Node). **[sekundär]**
- **Sync (RTC/db-sync):** Eigener Server (Cloudflare Worker + Node-Adapter zum Selbsthosten),
  pro Graph ein SQLite-`tx_log`. Status laut README: DB-Version Beta, RTC/Mobile Alpha, „data
  loss is possible“. **[verifiziert]** ([README](https://github.com/logseq/logseq),
  [db-sync](https://github.com/logseq/logseq/tree/master/deps/db-sync))
- **Wichtigste Lehren (ADRs 2026):**
  - ADR 0004: Batches sind geordnete Einträge, jeder mit seiner `:outliner-op` (Absicht), die
    der Server persistiert – damit Fehler auf genau eine Operation zeigen.
  - ADR 0010: Rebase über rohe Datom-Chirurgie war „hard to reason about“; neu werden
    **semantische Operationen** gespeichert und nach dem Einspielen fremder Änderungen erneut
    ausgeführt. Die Operationsmenge wurde dafür auf wenige kanonische Ops reduziert
    (`insert-blocks`, `save-block`, `move-blocks`, `delete-blocks`, `transact`).
  - ADR 0009: Löschen ist je nach Art verschieden – Inhalte in den Papierkorb, **Schema-Objekte
    (Tags, Properties, Auswahlwerte) hart löschen**, weil „gelöschte“ Schema-Objekte sonst in
    Aufzählungen und Sync-Reparaturen durchsickern.
  ([docs/adr](https://github.com/logseq/logseq/tree/master/docs/adr)) **[verifiziert]**
- **Für uns:** Datascript-im-Speicher skaliert schlecht auf Mobile und große Finanzhistorien und
  macht SQL-Auswertungen unmöglich → nicht übernehmen. Die Sync-ADRs aber unbedingt.

### 1.4 Notion

- **Block-Modell:** Jeder Block hat `id` (UUIDv4), `type`, `properties`, `content` (geordnete
  Kind-IDs) und `parent` („only used for permissions“). Typwechsel lässt Properties stehen;
  unbenutzte werden ignoriert (Werte überleben Hin- und Herwechseln). **[verifiziert]**
  ([The data model behind Notion's flexibility](https://www.notion.com/blog/data-model-behind-notion))
- **Datenbanken:** Zeilen sind Seiten-Blöcke mit nutzerdefinierten Properties. Das Schema hängt
  an der „Collection“, Werte werden per **Property-ID** (nicht Name) gespeichert, Umbenennen ist
  daher billig. **[teilweise verifiziert]** – die öffentliche API liefert Property-IDs; das
  interne Collection-Schema ist **[nicht verifiziert]**. Per-Datenbank-Felder, nicht global.
- **Schreiben/Sync:** Jede Nutzeraktion → Operationen auf einzelnen Datensätzen, gebündelt in
  Transaktionen, die „committed (or rejected) by the server as a group“ werden. Der Client wendet
  sofort lokal an, Warteschlange in IndexedDB/SQLite, `/saveTransactions`; der Server lädt den
  Vorher-Zustand, wendet an, **prüft Rechte und Kohärenz**, committet. **[verifiziert]** (gleicher
  Artikel)
- **Skalierung:** Block-Tabelle in Postgres, nach Workspace-ID in 480 logische Shards geteilt;
  >200 Mrd. Blöcke (2024). **[verifiziert/sekundär]**
  ([Sharding Postgres at Notion](https://www.notion.com/blog/sharding-postgres-at-notion))
- **SQLite im Browser:** Nur als **Cache**, über OPFS (SyncAccessHandle-Pool-VFS) in genau einem
  Tab, andere Tabs über SharedWorker; mehrere schreibende Tabs führten zu **Korruption**.
  Ergebnis +20 % schnellere Navigation. **[verifiziert]**
  ([WASM SQLite](https://www.notion.com/blog/how-we-sped-up-notion-in-the-browser-with-wasm-sqlite))
- **Lehren:** Generisches Modell trägt riesige Mengen; Server-geprüfte Transaktionen sind genau
  unser Org-Space-Muster; Web-SQLite braucht „ein Schreiber pro Origin“ (relevant für unsere
  Web-Variante).

### 1.5 Capacities

- **Modell:** Objekt-Typen mit Properties (Name, Beschreibung, Icon, Typ); „Object select“ als
  Relation zu anderen Typen; Default-Properties existieren technisch an allen Typen; Labels pro
  Typ, Tags typübergreifend. **[verifiziert, Doku]**
  ([Properties](https://docs.capacities.io/reference/properties))
- **Speicherung/Sync:** Keine öffentliche technische Doku; laut Dritten Cloud-zentriert, nicht
  local-first. **[nicht verifiziert]**
- **Lehre:** Gleiches Nutzerbild wie unsere Ebene 2 (Typen + Properties + Objekt-Relationen);
  „Default-Properties an allen Typen“ entspricht unseren Kernspalten (Titel, Zeitstempel, Tags).

### 1.6 Obsidian (Properties, Bases, Dataview)

- **Speicherung:** Properties als YAML-Frontmatter in der Markdown-Datei. „Once a property type
  is assigned to a property name, all properties with that name across your vault will use the
  same type.“ → **globale Felder pro Vault, Typ hängt am Namen**. **[verifiziert]**
  ([Properties](https://obsidian.md/help/properties))
- **Bases:** `.base`-Dateien (YAML) mit Filtern, Formeln, Views; greifen auf `note.<prop>` und
  `file.*` zu; Ergebnis ist eine Abfrage über einen In-Memory-Index der Vault-Metadaten.
  **[verifiziert]** ([Bases-Syntax](https://help.obsidian.md/bases/syntax))
- **Lehren:** Feldtyp am _Namen_ führt zu Konflikten (zwei Plugins wollen `status` mit
  verschiedenen Typen) → bei uns Namespaces bzw. IDs. Views als eigene, deklarative Objekte
  (Filter/Sortierung/Formeln) sind ein gutes Muster für Ebene 2.

### 1.7 AppFlowy (Collab, Datenbanken)

- **Datenmodell:** Alles sind Yrs-(Yjs-in-Rust-)Dokumente („collab“). Eine Datenbank-Collab hält
  Felder und Views; **jede Zeile ist eine eigene Collab** (`DatabaseRow { row_id, collab, body }`)
  mit `cells`, `meta`, `comment`, `created_at` usw. **[verifiziert]**
  ([row.rs](https://github.com/AppFlowy-IO/AppFlowy-Collab/blob/main/collab/src/database/rows/row.rs))
- **Felder:** `Cells = HashMap<String, Cell>` (Schlüssel = Feld-ID), `Cell = HashMap<String, Any>`
  und **jede Zelle trägt ihren `field_type`** – so bleibt ein Wert nach einem Feldtyp-Wechsel
  interpretierbar. Typ-Optionen pro Feldtyp in einer Map. **[verifiziert]**
  ([cell.rs](https://github.com/AppFlowy-IO/AppFlowy-Collab/blob/main/collab/src/database/rows/cell.rs))
- **Sync:** CRDT → Server kann nicht ablehnen (für uns ausgeschlossen, siehe 02-storage-options).
- **Lehren:** Zeile = Sync-Einheit; Feldtyp am Wert gegen Typwechsel-Probleme; Filter/Sort/Gruppen
  werden im Client über alle Zeilen berechnet – bei großen Datenbanken bekanntermaßen ein
  Performance-Thema **[nicht verifiziert, nur Community-Berichte]**.

### 1.8 AFFiNE / BlockSuite

- **Datenmodell:** Stark typisierter Blockbaum direkt auf Yjs; ein Doc = Yjs-Subdokument, Blöcke
  in einer `Y.Map` nach Block-ID; Block-„Flavours“ (`affine:page`, `affine:note`, …) werden in
  einem Schema registriert. **[sekundär/Doku WIP]**
  ([BlockSuite Store](https://blocksuite.io/guide/store), [docs.affine.pro](https://docs.affine.pro/blocksuite-wip/store/))
- **Datenbank-Block:** In der Featureliste noch „in progress“; Schema-Details nicht gefunden.
  **[nicht verifiziert]**
- **Lehre:** Block-Schemas als Code-Registrierung (wie unsere Modultypen), aber CRDT als Wahrheit →
  für Org-Policies ungeeignet.

### 1.9 Twenty CRM (am relevantesten für die Metadaten-Schicht)

- **Metadaten:** Objekte und Felder sind Zeilen in Metadaten-Tabellen (`objectMetadata`,
  `fieldMetadata`, `DataSource`), Standard-Objekte (Company, Person) laufen über **denselben
  Weg** wie nutzerdefinierte. **[verifiziert]**
  ([Custom objects](https://docs.twenty.com/developers/contribute/capabilities/backend-development/custom-objects.md))
- **Physische Speicherung:** **Pro Workspace ein eigenes Postgres-Schema** (Name aus der
  Workspace-ID), **echte Spalten pro Feld**. Zusammengesetzte Feldtypen (CURRENCY, ADDRESS,
  FULL_NAME, LINKS, EMAILS, PHONES, ACTOR, RICH_TEXT) werden auf mehrere Spalten verteilt:
  `computeCompositeColumnName` = `${feldname}${PascalCase(teilfeld)}`, z. B. Währungsfeld
  `amount` → `amountAmountMicros` + `amountCurrencyCode`; Fremdschlüssel → `${name}Id`.
  **[verifiziert im Code]**
  ([composite-type-definitions.ts](https://github.com/twentyhq/twenty/blob/main/packages/twenty-shared/src/types/composite-types/composite-type-definitions.ts),
  [currency.composite-type.ts](https://github.com/twentyhq/twenty/blob/main/packages/twenty-shared/src/types/composite-types/currency.composite-type.ts),
  [compute-column-name.util.ts](https://github.com/twentyhq/twenty/blob/main/packages/twenty-server/src/engine/metadata-modules/field-metadata/utils/compute-column-name.util.ts));
  Schema pro Workspace laut Code-Tour **[sekundär]**
  ([Twenty Metadata Engine Source Tour](https://pyshine.com/Twenty-Metadata-Engine-Source-Tour/))
- **Schema-Änderung:** Metadaten-Änderungen schreiben kein SQL direkt, sondern erzeugen eine
  „Workspace-Migration“: Diff alter/neuer Metadaten → Aktionsliste (plus Seiteneffekte wie
  Views, Suchvektoren, Relations-Gegenstücke) → Runner führt DDL aus, invalidiert Caches,
  erhöht eine **Metadaten-Version**, an der das pro Workspace generierte GraphQL-Schema hängt.
  **[sekundär, Pfade im Repo vorhanden]**
  ([workspace-migration](https://github.com/twentyhq/twenty/tree/main/packages/twenty-server/src/engine/workspace-manager/workspace-migration))
- **Lehren:** Bestes Vorbild für **Metadaten als Wahrheit + generierte physische Form**. Echte
  Spalten geben volle SQL-Kraft und DB-Garantien – aber nur, weil es genau eine Datenbank gibt,
  die zentral migriert wird. Unser Gegenstück dazu: **lokal** aus Metadaten generierte
  Projektionen (siehe 3.3), während die _synchronisierte_ Form generisch bleibt.

### 1.10 CMS: Directus, Payload, Strapi (kurz)

- **Directus:** „Collections are database tables with additional metadata“; Zusatzinfos in
  `directus_collections`, `directus_fields`, `directus_relations`; kann bestehende Tabellen
  introspektieren („Datenbank-Spiegel“). **[verifiziert]**
  ([Collections](https://directus.com/docs/guides/data-model/collections))
- **Payload:** Schema im Code; bei Postgres/SQLite in der Entwicklung Drizzle-`push`, für
  Produktion aus der Config generierte Migrationen; bei MongoDB Migrationen nur bei
  Datenumformung nötig. **[verifiziert]** ([Migrations](https://payloadcms.com/docs/database/migrations))
- **Strapi:** Content-Types als `schema.json` im Code, DB-Schema wird beim Start angeglichen.
  **[nicht verifiziert in dieser Runde]**
- **Lehre:** Alle drei trennen „Metadaten für UI/Validierung“ von „physischem Schema“. Payload
  zeigt die Spannung, die wir vermeiden wollen: relational = Migrationen, Dokument = keine.

### 1.11 PowerSync (unser Sync-Favorit) – wie es intern speichert

- Standard: pro Tabelle `ps_data__<table>` mit **JSON-Spalte**, darüber eine View, die Spalten
  per `CAST(data ->> '$.col' AS TEXT)` extrahiert; neue Spalten ändern die Speicherstruktur
  nicht. Unbekannte Tabellen landen in `ps_untyped`. **[verifiziert]**
  ([Client Architecture](https://docs.powersync.com/architecture/client-architecture))
- Einschränkung: „The client-side schema only supports indexes on plain columns.“ Für
  Ausdrucks-Indizes, generierte Spalten, Fremdschlüssel → **Raw Tables** (selbst anlegen und
  migrieren, `put`/`delete`-Statements, Upload-Trigger auf `powersync_crud`; Fremdschlüssel nur
  `DEFERRABLE INITIALLY DEFERRED`, da Reihenfolge der Zeilen nicht steuerbar). „Managed tables“
  sind Alpha. **[verifiziert]**
  ([Raw Tables](https://docs.powersync.com/client-sdks/advanced/raw-tables))
- **Folge für uns:** PowerSync ist intern selbst ein „records mit JSON“-System. Eine
  `objects`-Tabelle passt gut – am besten als **eine Raw Table** (dann eigene generierte
  Spalten/Indizes möglich), sonst entsteht JSON-in-JSON (`data.fields`).

### 1.12 SQLite-Muster (JSON1/JSONB, generierte Spalten, Ausdrucks-Indizes, EAV)

- **Generierte Spalten:** `VIRTUAL` (beim Lesen berechnet) oder `STORED`. **Nur VIRTUAL lässt
  sich per `ALTER TABLE ADD COLUMN` nachrüsten** – also ohne Tabellen-Neuaufbau. Ein Index auf
  einer VIRTUAL-Spalte ist ein Ausdrucks-Index. Nur deterministische Funktionen. **[verifiziert]**
  ([Generated Columns](https://sqlite.org/gencol.html))
- **Ausdrucks-Indizes:** Werden nur genutzt, wenn der Ausdruck in WHERE/ORDER BY **exakt
  gleich** geschrieben ist („The query planner does not do algebra“). **[verifiziert]**
  ([Indexes on Expressions](https://sqlite.org/expridx.html)) → Abfragen müssen aus einem
  zentralen Query-Builder kommen, nie handgeschrieben.
- **JSONB (ab 3.45):** binäres JSON, kleiner und schneller als Text-JSON, Zugriff aber weiterhin
  O(n) in der Dokumentgröße. **[sekundär]**
  ([Dolthub, 2024](https://dolthub.com/blog/2024-11-18-json-sqlite-vs-dolt))
- **EAV:** Ohne passende Indizes deutlich langsamer als JSON, mit Indizes konkurrenzfähig, aber
  jede Auswertung braucht einen Self-Join pro Feld. Benchmarks gibt es nur für Postgres
  ([Postgres Weekly / EAV vs JSONB](https://postgresweekly.com/link/8041/web)) **[sekundär]**;
  Tana-Export-Tools zeigen dasselbe Ergonomie-Problem in SQLite.

---

## 2. Querschnitt: Muster und Gegensätze

| Frage | Varianten in der Praxis | Wer | Bewertung für uns |
|---|---|---|---|
| Wahrheit | Änderungs-DAG / CRDT | Anytype, AppFlowy, AFFiNE | Server kann nicht prüfen → nein |
| | Datensätze + server-geprüfte Transaktionen | Notion, Logseq db-sync, PowerSync | **ja** |
| Physische Form | ein generischer Speicher (Blocks/Nodes/JSON) | Notion, Tana, Anytype, Logseq, PowerSync | ja für Sync |
| | echte Spalten aus Metadaten | Twenty, Directus | nur lokal als Projektion |
| Felder | global pro Space/Vault | Anytype, Obsidian, Tana, Logseq | gut für Nutzer-Felder |
| | pro Typ/Datenbank | Notion, AppFlowy, Twenty | gut für Modulfelder |
| Feldschlüssel | stabile ID, Name nur Anzeige | alle außer Obsidian | **Pflicht** |
| Verweise | eigener Index (abgeleitet) | Anytype (`links`), Logseq (`refs`) | ja, abgeleitet |
| | FK-Spalte | Twenty, Directus | lokal in Projektion |
| Schema-Pflege | Revision + Reviser für mitgelieferte Typen | Anytype | übernehmen |
| | Schema-Version + Migrationen | Logseq (65.x!), Twenty | Upcaster pro Typ |
| Sync-Einheit | Zeile/Objekt | AppFlowy, Notion, PowerSync | Objekt |
| Sync-Inhalt | semantische Operation + Daten | Logseq (ADR 0004/0010), Notion | **übernehmen** |

Bemerkenswert: **Keine** der Apps mit tiefer Fachlogik (Rundung, Überschneidungen, Finanzen)
ist dabei – die meisten sind Notiz-/Wissens-Apps. Twenty ist die einzige mit
„Business-Objekten“ und wählt dafür echte Spalten. Das spricht dafür, Fachmodule nicht über
generische JSON-Abfragen auswerten zu lassen, sondern über typisierte Projektionen.

---

## 3. Bewertung unseres Kandidaten

### 3.1 Eigene Mini-Messung (indikativ)

Skript: Bun + `bun:sqlite`, SQLite 3.54.0, In-Memory, Apple Silicon. 40 Projekte,
50 000 Zeiteinträge über 4 Jahre, zusätzlich 150 000 andere Objekte in derselben
`objects`-Tabelle. Abfrage: Summe Stunden pro Projekt und Monat. Jeder Wert = Mittel über 20
Läufe; zwischen zwei Gesamtläufen schwankten einzelne Werte um bis zu Faktor 2.

| Variante | alle Monate | ein Jahr |
|---|---|---|
| A: echte Tabelle `time_entries` (ohne Index) | ~27 ms | ~7 ms |
| B: JSONB, nur Index auf `type` | ~50 ms | – |
| B: JSONB + partieller Ausdrucks-Index auf `startAt` | – | ~12 ms |
| C: JSONB + VIRTUAL-Spalten + partieller, deckender Index | 77–165 ms (Planner nimmt falschen Index) | ~5–6 ms |
| C nach `ANALYZE` | ~57 ms | – |
| C mit `INDEXED BY` | **~23 ms** | – |
| D: Projekt-Zuordnung per Join über `links` | ~151 ms | – |
| E: neu aufgebaute Lese-Tabelle `rm_time_entries` + Index | – | **~5 ms** |
| Neuaufbau der Lese-Tabelle aus 50 000 Objekten | ~51 ms | |
| 5 000 Updates per `jsonb_set` (mit Generated-Column-Index) | ~29 ms gesamt | |

Schlüsse (mit Vorsicht, Mobile/OPFS sind langsamer und **nicht gemessen**):

- Die Größenordnung ist bei 50 000 Einträgen in **allen** Varianten unkritisch (< 200 ms).
  Das eigentliche Risiko ist nicht JSON an sich, sondern **der Query-Planner**: bei einer
  gemischten Tabelle wählt er ohne Statistiken den allgemeinen `type`-Index und wertet dann JSON
  pro Zeile aus. Gegenmittel: `ANALYZE`/`PRAGMA optimize`, partielle Indizes und
  generierter SQL-Code aus einem Query-Builder (ggf. `INDEXED BY`).
- **Verweise, die man auswertet, gehören nicht nur in `links`.** Der Join über `links` war
  Faktor ~6 langsamer als das Feld in derselben Zeile.
- Lese-Tabellen sind am schnellsten und billig neu aufzubauen (50 ms für 50 000 Zeilen).

### 3.2 Stärken des Kandidaten (bestätigt durch die Recherche)

1. **Passt zu PowerSync und zu Notion-artiger Server-Prüfung:** eine generische Objekttabelle,
   ein Sync Stream pro Space, der Server prüft Transaktionen – wie Notion.
2. **Neue Modul-/Plugin-Typen ohne Migration** – wie Anytype/Tana/Logseq; die Metadaten-Schicht
   à la Twenty liefert Ebene 2 (eigene Typen) fast geschenkt, weil Modultypen und Nutzertypen
   denselben Weg gehen (Twenty: Standard-Objekte = gleicher Pfad wie Custom).
3. **Brücken als Links** lösen den work↔finance-Zyklus aus Self-Engine sauber.
4. **Schema als Daten** ist erprobter Standard, mit bekannten Mustern für Updates
   (Anytype-Revision) und Löschung (Logseq-Hybrid).

### 3.3 Schwächen und Risiken

1. **Doppelte Wahrheit bei Verweisen:** Steht `projectId` im JSON _und_ ein Link in `links`,
   können sie auseinanderlaufen (siehe Tana `_sourceId` „often missing“). Steht er _nur_ in
   `links`, werden Auswertungen langsam (Messung D) und Pflichtverweise lassen sich schwerer
   prüfen.
2. **Auswertungen direkt auf JSON sind planner-empfindlich** und brauchen exakt gleiche Ausdrücke.
3. **Keine DB-Garantien:** keine Fremdschlüssel, kein `NOT NULL`, keine Unique-Constraints über
   JSON (außer Ausdrucks-Unique-Index). Alles hängt an Executors – auf dem Server müssen dieselben
   Executors laufen (gemeinsamer Code in TS → Server muss TS ausführen können).
4. **PowerSync-Detail:** Mit den Standard-JSON-Views keine Ausdrucks-Indizes; `objects` muss Raw
   Table werden (eigene Migrationen dieser _einen_ Tabelle, Upload-Trigger selbst pflegen).
5. **Feld-Kollisionen:** Wenn Modulfelder und Nutzerfelder im selben JSON-Namensraum leben,
   kann ein Nutzerfeld `status` ein Modulfeld überschreiben (Obsidian-Problem).
6. **Feldtyp-Wechsel bei Nutzerfeldern** (Text → Zahl) macht alte Werte ungültig
   (AppFlowy löst das mit `field_type` an jeder Zelle).
7. **Upcaster pro Objekt** sind bei Logseqs Tempo (Schema 65.x) auf Dauer viel Code; ohne
   Hintergrund-Anhebung lesen alle Clients ewig alte Formen.

### 3.4 Vorgeschlagene Änderungen

1. **Zwei Feld-Namensräume pro Objekt**:
   `data` (Modulfelder, Schlüssel im Code, vom Modul-Executor validiert, an Fachregeln
   beteiligt) und `custom` (Nutzerfelder, Schlüssel = generierte Feld-ID wie `fld_8kq2…`,
   generisch validiert). Fachregeln (Rundung, Überschneidung, Payout) lesen **nie** `custom`.
   Damit koexistieren Fachlogik und Nutzer-Generik ohne gegenseitige Störung. Wenn Nutzerfelder
   später Regeln beeinflussen sollen, nur über explizite Erweiterungspunkte des Moduls (z. B.
   „Abrechenbar“-Flag, das das Modul selbst als Feld anbietet).
2. **Feld-Definitionen global pro Space, Zuordnung zu Typen per Link** (Anytype/Obsidian-Stil):
   ein Nutzerfeld „Kunde“ kann an Projekten _und_ Aufgaben hängen und typübergreifend gefiltert
   werden. Modulfelder bleiben pro Typ und im Code definiert (Twenty/Notion-Stil). Feldwerte in
   `custom` tragen ihren Feldtyp mit (`{ "fld_x": { "t": "number", "v": 3 } }`) oder ein
   Typwechsel erzeugt ein neues Feld – im Prototyp entscheiden.
3. **Verweise: Besitz entscheidet, wo sie stehen.**
   - Verweise, die zu einem Objekt _gehören_ (Zeiteintrag → Projekt, Aufgabe → Projekt), stehen
     im Feld (`data.projectId`) – eine Wahrheit, schnell auswertbar. `links` wird daraus vom
     Speicher-Layer **abgeleitet** (wie Anytypes `links`-Collection) und ist neu aufbaubar.
   - Modulübergreifende **Brücken**, die keinem der beiden Objekte gehören (Zeiteintrag →
     Payout, Termin → Zeiteintrag), sind eigene Link-Zeilen _mit eigener Identität_ und
     gehören dem Brückenmodul (Finanzen). So bleibt die Modulgrenze sauber und das Arbeitsmodul
     muss Finanzen nicht kennen.
4. **Auswertungen nur über Projektionen.** Jedes Modul deklariert für seine Typen eine
   Projektion (z. B. `time_entry: { projectId: ref, startAt: instant, endAt: instant }`); der
   Speicher-Layer erzeugt daraus **lokal** entweder VIRTUAL-Spalten + partielle Indizes oder
   eine Lese-Tabelle. Projektionen sind lokal, versioniert und jederzeit aus `objects` neu
   aufbaubar (Twenty-Idee „Metadaten → physische Form“, aber nur auf dem Gerät, nicht im Sync).
   Der Server (Postgres) bekommt dieselben Deklarationen als `jsonb`-Ausdrucks-Indizes.
5. **Schreib-API = semantische Operationen** (`work.startTimer`, `work.splitEntry`,
   `finance.createPayout`), nicht „setze Felder“. Jede Operation wird mit Namen und Eingabe im
   Upload-/Operations-Log gespeichert (Logseq ADR 0004/0010). Der Server führt im Org-Space
   denselben Executor aus und lehnt ab (Notion-Muster). Die Menge der _replay-fähigen_ Operationen
   klein halten; generisches `object.patch` für Nutzerfelder.
6. **Mitgelieferte Typen mit Revision** (Anytype): Modul-Typdefinitionen liegen im Code, ihre
   Spiegelung als Schema-Objekte im Space trägt eine `revision`; Nutzer-Anpassungen (z. B.
   Umbenennen, zusätzliche Felder) werden beim Update respektiert.
7. **Löschsemantik getrennt** (Logseq ADR 0009): Inhalte weich löschen (Papierkorb),
   Schema-Objekte hart löschen bzw. archivieren mit klaren Regeln für verwaiste Werte.
8. **Schema-Version pro Typ statt pro Objekt-Formular**: `schema_version` am Objekt bleibt, aber
   zusätzlich ein Hintergrundlauf, der nach einem App-Update alle Objekte anhebt und dann die
   Projektionen neu baut – damit Upcaster nach N Versionen gelöscht werden können.
9. **Kernspalten echt halten:** `id`, `space_id`, `type`, `created_at`, `updated_at`,
   `deleted_at`, ggf. `title` als echte Spalten (Capacities-„Default-Properties“), alles
   Fachliche in `data`.

Skizze:

```sql
create table objects (
  id text primary key, space_id text not null, type text not null,
  schema_version int not null, revision int not null default 0,   -- für Konflikterkennung
  title text, data blob not null,      -- JSONB, Modulfelder
  custom blob,                          -- JSONB, Nutzerfelder (Feld-ID → Wert)
  created_at int not null, updated_at int not null, deleted_at int
);
-- vom Speicher-Layer aus Modul-Deklarationen erzeugt (lokal, neu aufbaubar):
alter table objects add column p_te_project text as (data->>'$.projectId');
alter table objects add column p_te_start   int  as (data->>'$.startAt');
alter table objects add column p_te_end     int  as (data->>'$.endAt');
create index p_te on objects(space_id, p_te_start, p_te_end, p_te_project)
  where type = 'work.time_entry' and deleted_at is null;
-- abgeleitet, nicht synchronisiert:
create table links_index (from_id, to_id, kind, primary key (from_id, kind, to_id));
```

---

## 4. Ergebnis

### 4.1 Empfehlung

Den Kandidaten „typisierte Objekte auf generischem Kern“ weiterverfolgen – als **synchronisierte
Wahrheit**. Nicht übernehmen: Twentys Laufzeit-DDL als Sync-Form, Logseqs Datascript-im-Speicher,
CRDT-Dokumente. Übernehmen: Twentys Metadaten-Schicht (Objekt-/Feld-Metadaten, zusammengesetzte
Feldtypen, Metadaten-Version), Anytypes globale Felder + abgeleiteten Link-Index + Revisionen,
Notions server-geprüfte Transaktionen, Logseqs semantische Operationen und hybride Löschung.
Für Fachauswertungen **lokal generierte Projektionen** statt JSON-Abfragen. Ob Projektionen als
generierte Spalten oder als Lese-Tabellen umgesetzt werden, entscheidet der Prototyp.

### 4.2 Varianten für den Wegwerf-Prototyp

Alle drei mit denselben Daten: wiederholbarer Import realer Self-Engine-Daten, zusätzlich
synthetisch auf 50 000 / 200 000 Zeiteinträge hochskaliert, 5 Jahre Finanzhistorie.

| | V1 Tabellen pro Entität (Baseline) | V2 `objects` + generierte Spalten | V3 `objects` + Lese-Tabellen |
|---|---|---|---|
| Wahrheit | `projects`, `time_entries`, … + `custom` JSON-Spalte je Tabelle + `records` für Plugins | `objects` (JSONB) | `objects` (JSONB) |
| Auswertung | direktes SQL | VIRTUAL-Spalten + partielle Indizes aus Modul-Deklaration | `rm_<typ>`-Tabellen, im selben Write-Transaktion gepflegt, neu aufbaubar |
| Verweise | FK-Spalten | Feld + abgeleiteter `links_index` | Feld + abgeleiteter `links_index` |

**Messen:**

1. Abfragen: Stunden pro Projekt/Monat (alle, ein Jahr), **Überschneidungsprüfung** beim
   Anlegen eines Eintrags (`start < neuEnde and ende > neuStart`), offene, nicht ausgezahlte
   Stunden pro Projekt (Brücke zu Payouts), Backlinks eines Projekts, typübergreifender Filter
   über ein Nutzerfeld („Kunde = X“).
2. Schreiben: Latenz eines Timer-Stopps inkl. Rundung, Validierung, Projektion und Op-Log; Import
   von 50 000 Einträgen.
3. Wartung: Neuaufbau von Projektionen/Indizes; Kosten, ein Feld zu einem Modultyp und ein
   Nutzerfeld hinzuzufügen (Codezeilen, Migrationsschritte Client _und_ Server).
4. Plattformen: dieselben Messungen auf Electron (better-sqlite3/node), Web (wa-sqlite/OPFS,
   ein Schreiber) und einem echten Android-Mittelklassegerät (op-sqlite). Kaltstart und DB-Größe.
5. Ergonomie: Wie typsicher sind Abfragen (generierte TS-Typen aus Modulschemas)? Wie viel Code
   braucht eine neue Auswertung? Merkt der Query-Builder sich Ausdrücke exakt (Planner-Falle)?
6. Sync-Passung: `objects` als PowerSync Raw Table mit Upload-Trigger; Server-Gegenstück in
   Postgres (`jsonb` + Ausdrucks-Indizes) und Prüfung einer abgelehnten Operation.

### 4.3 Offene Fragen

1. Sollen Projektionen rein lokal sein (Server baut eigene) oder als eigene Tabellen mitsynchronisiert
   werden? Lokal ist einfacher für Sync, kostet aber CPU beim Erst-Sync auf Mobile.
2. Feldwert-Format für Nutzerfelder: Typ an jedem Wert (AppFlowy) oder neues Feld bei Typwechsel?
3. Werden Feld-Definitionen wirklich global pro Space geteilt, oder reicht „pro Typ“ für Ebene 2?
   (Global = mächtiger, aber Konflikte zwischen Plugins/Org-Policies.)
4. Wie läuft derselbe Executor-Code auf dem Server (TS in einem Node-Dienst neben PowerSync)? Gilt
   das auch für Plugins Dritter – oder dürfen Plugins in Org-Spaces nur deklarative Regeln?
5. Welche SQLite-Version liefern die Plattform-Treiber (JSONB braucht ≥ 3.45, generierte Spalten
   ≥ 3.31)? **[nicht verifiziert]** für op-sqlite, wa-sqlite und das PowerSync-SDK.
6. Volltextsuche: FTS5 über `title` + ausgewählte JSON-Felder als weitere Projektion?
7. Granularität von Konflikten: ganzes Objekt (Last-Write-Wins pro Zeile, PowerSync-Standard) oder
   pro Feld? Bei Nutzerfeldern in `custom` könnten zwei Geräte verschiedene Felder ändern.
8. Tana- und Capacities-Interna sowie Notions internes Collection-Schema konnten nicht aus
   Primärquellen verifiziert werden; für die Entscheidung voraussichtlich nicht nötig.

---

## Quellen

- Anytype: [any-sync README](https://github.com/anyproto/any-sync) ·
  [any-store README](https://github.com/anyproto/any-store) ·
  [anytype-heart docs/Flow.md](https://github.com/anyproto/anytype-heart/blob/main/docs/Flow.md) ·
  [relations.json](https://github.com/anyproto/anytype-heart/blob/main/pkg/lib/bundle/relations.json) ·
  [spaceindex/store.go](https://github.com/anyproto/anytype-heart/blob/main/pkg/lib/localstore/objectstore/spaceindex/store.go) ·
  [Glossar](https://doc.anytype.io/anytype-docs/basics/glossary)
- Tana: [Nodes and references](https://tana.inc/docs/nodes-and-references) ·
  [Intro to nodes, fields and supertags](https://tana.inc/articles/intro-to-nodes-fields-and-supertags) ·
  [Input API](https://outliner.tana.inc/learn/features/input-api) ·
  [supertag-cli: Tana Field Structures](https://github.com/jcfischer/supertag-cli/blob/main/docs/TANA-FIELD-STRUCTURES.md) (Drittquelle)
- Logseq: [README](https://github.com/logseq/logseq) ·
  [schema.cljs](https://github.com/logseq/logseq/blob/master/deps/db/src/logseq/db/frontend/schema.cljs) ·
  [sqlite.cljs](https://github.com/logseq/logseq/blob/master/deps/db/src/logseq/db/common/sqlite.cljs) ·
  [docs/adr (0004, 0009, 0010)](https://github.com/logseq/logseq/tree/master/docs/adr) ·
  [deps/db-sync](https://github.com/logseq/logseq/tree/master/deps/db-sync)
- Notion: [The data model behind Notion's flexibility](https://www.notion.com/blog/data-model-behind-notion) ·
  [Sharding Postgres at Notion](https://www.notion.com/blog/sharding-postgres-at-notion) ·
  [How we sped up Notion in the browser with WASM SQLite](https://www.notion.com/blog/how-we-sped-up-notion-in-the-browser-with-wasm-sqlite) ·
  [ByteByteGo: Notion's Data Lake](https://blog.bytebytego.com/p/storing-200-billion-entities-notions) (Drittquelle)
- Capacities: [Properties](https://docs.capacities.io/reference/properties)
- Obsidian: [Properties](https://obsidian.md/help/properties) · [Bases-Syntax](https://help.obsidian.md/bases/syntax)
- AppFlowy: [row.rs](https://github.com/AppFlowy-IO/AppFlowy-Collab/blob/main/collab/src/database/rows/row.rs) ·
  [cell.rs](https://github.com/AppFlowy-IO/AppFlowy-Collab/blob/main/collab/src/database/rows/cell.rs) ·
  [Database View (ältere Doku)](https://docs.appflowy.io/docs/documentation/software-contributions/architecture/frontend/database-view)
- AFFiNE/BlockSuite: [BlockSuite Store](https://blocksuite.io/guide/store) ·
  [docs.affine.pro Store](https://docs.affine.pro/blocksuite-wip/store/)
- Twenty: [Custom objects](https://docs.twenty.com/developers/contribute/capabilities/backend-development/custom-objects.md) ·
  [composite-type-definitions.ts](https://github.com/twentyhq/twenty/blob/main/packages/twenty-shared/src/types/composite-types/composite-type-definitions.ts) ·
  [compute-column-name.util.ts](https://github.com/twentyhq/twenty/blob/main/packages/twenty-server/src/engine/metadata-modules/field-metadata/utils/compute-column-name.util.ts) ·
  [workspace-migration](https://github.com/twentyhq/twenty/tree/main/packages/twenty-server/src/engine/workspace-manager/workspace-migration) ·
  [Metadata Engine Source Tour](https://pyshine.com/Twenty-Metadata-Engine-Source-Tour/) (Drittquelle)
- CMS: [Directus Collections](https://directus.com/docs/guides/data-model/collections) ·
  [Payload Migrations](https://payloadcms.com/docs/database/migrations)
- PowerSync: [Client Architecture](https://docs.powersync.com/architecture/client-architecture) ·
  [Raw Tables](https://docs.powersync.com/client-sdks/advanced/raw-tables)
- SQLite: [Generated Columns](https://sqlite.org/gencol.html) ·
  [Indexes on Expressions](https://sqlite.org/expridx.html) ·
  [Dolthub: JSON in SQLite vs Dolt](https://dolthub.com/blog/2024-11-18-json-sqlite-vs-dolt) ·
  [EAV vs JSONB (Postgres)](https://postgresweekly.com/link/8041/web)
