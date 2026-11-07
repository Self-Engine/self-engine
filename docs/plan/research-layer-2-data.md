# Recherche: Schicht 2 – Datenschicht

Stand: 2026-11-08 · Status: Recherche abgeschlossen, Entscheidungen offen

Bezug: [`00-decisions.md`](00-decisions.md) (D11 ein Speicher-Port pro Modul, D17 Electron,
D22 Tabellen pro Modul + `custom` + Brückentabellen, D33 better-sqlite3 13, D39 Kanäle mit
eigenem Datenordner, D75/D85 typisierte Befehle), [`02-storage-options.md`](02-storage-options.md),
[`prototypes/data-model/RESULTS.md`](../../prototypes/data-model/RESULTS.md).

Legende: **[verifiziert]** = in offizieller Doku, Quellcode, Release oder npm-Registry
nachgelesen · **[nicht verifiziert]** = plausibel, aber ohne Primärquelle oder nur gefolgert.

## Versionen (npm-Registry, 2026-11-08) [verifiziert]

| Paket | Version | Hinweis |
|---|---|---|
| `better-sqlite3` | 13.0.3 | SQLite 3.53.4 gebündelt (Prototyp) |
| `drizzle-orm` / `drizzle-kit` | 0.45.4 / 0.31.11 (`latest`) | 1.0 als `1.0.0-rc.5` (2026-10-21) |
| `kysely` | 0.29.8 | `0.30.0-beta.2` als `next` |
| `@powersync/node` / `web` / `react-native` | 1.3.0 / 2.6.0 / 2.4.0 | Node-SDK 1.0 seit 2026-09-02 |
| `@powersync/common` | 2.5.0 | |
| `@powersync/kysely-driver` | 2.0.3 (2026-11-02) | Kysely `^0.28 \|\| ^0.29` |
| `@powersync/drizzle-driver` | 0.8.0 (2026-07-21) | Peer **`drizzle-orm <1.0.0`** |
| `@tanstack/db`, `react-db`, `powersync-db-collection` | 1.0.0-rc.1.4 | RC seit 2026-10-29 |
| `@tanstack/electron-db-sqlite-persistence` | 1.0.0-rc.1.4 | |
| `@tanstack/react-query` | 5.107.1 | |
| `zod` / `valibot` / `drizzle-zod` | 4.6.7 / 1.5.0 / 0.8.3 | |
| `effect` | 4.1.2 | 4.0.0 seit 2026-10-01 |
| `uuid` | 14.0.3 | enthält `v7()` |

## 1. Wo läuft SQLite in Electron?

### Optionen

| Ort | Vorteile | Nachteile |
|---|---|---|
| **Main-Prozess** | am einfachsten; IPC direkt über `ipcMain` | better-sqlite3 ist synchron: ein Rebuild (1–2 s bei 200k, RESULTS §3) oder Import blockiert Fenster, Menüs und jede IPC-Nachricht. Ein Absturz reißt die App mit. |
| **Worker-Thread im Main** | blockiert die Event-Loop nicht | gleicher Prozess, also gleicher Absturzbereich; Renderer spricht nur über Main (doppelter Hop) |
| **`utilityProcess`** | eigener Node-Prozess; laut Electron-Doku kann er über `MessagePort` **direkt mit dem Renderer** sprechen; native Module laufen | etwas mehr Aufbau (Start, Neustart, Ports verteilen) |
| **Kindprozess mit `ELECTRON_RUN_AS_NODE`** (t3code) | volle Trennung, gleicher Code wie ein Server | Transport über HTTP/WebSocket, Auth-Token nötig, kein `MessagePort` |

Quellen: [utilityProcess](https://github.com/electron/electron/blob/main/docs/api/utility-process.md),
[Prozessmodell](https://github.com/electron/electron/blob/main/docs/tutorial/process-model.md#the-utility-process),
[better-sqlite3 threads.md](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/threads.md) [verifiziert].
better-sqlite3 hat **keinen Update-Hook** in der API (`docs/api.md` durchsucht) [verifiziert]:
Änderungs-Ereignisse muss unser Schreibpfad selbst melden.

PowerSync später: Die Demo [`example-electron-node`](https://github.com/powersync-ja/powersync-js/tree/main/demos/example-electron-node)
betreibt den Node-SDK **im Main-Prozess**, eigene Worker-Datei plus Kopie der
PowerSync-Erweiterung (`libpowersync_*.dylib`). Sie leitet `watch`-Ergebnisse über einen
`MessagePortMain` an den Renderer [verifiziert]. Der Node-SDK führt Abfragen selbst in einem
Pool von Worker-Threads aus (WAL, ein Schreiber, mehrere Leser), sein Standard-Treiber ist
better-sqlite3 (optional), alternativ `node:sqlite` ([Node-SDK](https://docs.powersync.com/client-sdks/reference/node)) [verifiziert].
Die Seite „Supported Platforms“ nennt für Electron noch den Web-SDK (WASQLite) mit
„Electron 28+ (TO BE VERIFIED)“ [verifiziert, Doku selbst unsicher]. Ob der Node-SDK in einem
`utilityProcess` läuft, ist **[nicht verifiziert]** → kleiner Spike.

### IPC-Form

Ein **Daten-Host** (Prozess mit der DB) und ein **Client** im Renderer sprechen über einen
`MessagePort`, mit einem typisierten Vertrag: Methodenname → Eingabe-Schema → Ausgabe-Schema,
dazu ein Ereignis-Strom (`tablesChanged`, später Sync-Status). Eingaben werden im Host
validiert, Ausgaben im Client nur typisiert. Vorteil: Dieselbe Form trägt auf allen
Plattformen, nur der Transport wechselt:

- Electron: Renderer ↔ `utilityProcess` per `MessagePort`.
- Web: Seite ↔ Dedicated/Shared Worker mit wa-sqlite bzw. PowerSync-Web per `MessagePort` [nicht verifiziert für unseren Aufbau].
- Mobile: direkter Funktionsaufruf im JS-Prozess (op-sqlite/expo-sqlite).

Das passt zum Befehlsregister (D75/D85): Ein Befehl mit Zod-Eingabe ist zugleich ein
RPC-Endpunkt. Nur Fachbefehle und deklarierte Abfragen gehen über den Vertrag, kein freies SQL
aus dem Renderer.

### So macht es t3code (geprüft 2026-11-08) [verifiziert]

- **Prozesse:** Electron-Main startet `apps/server/dist/bin.mjs` als Kindprozess mit
  `process.execPath` und `ELECTRON_RUN_AS_NODE=1` (`apps/desktop/src/backend/DesktopBackendConfiguration.ts`,
  `DesktopBackendManager.ts`); Startdaten kommen über fd3/stdin. Der Renderer ist `apps/web`.
- **SQLite:** `node:sqlite`, nicht better-sqlite3, eingepackt als Effect-`SqlClient`
  (`packages/shared/src/nodeSqliteClient.ts`) mit einem **Leser-Worker** und einem
  **Checkpoint-Worker** (`worker_threads`). Pragmas in `apps/server/src/persistence/Sqlite.ts`:
  `busy_timeout=5000`, `foreign_keys=ON`, `journal_mode=WAL`, `synchronous=NORMAL`,
  `checkpoint_fullfsync=ON`, `temp_store=MEMORY`, `journal_size_limit=128 MiB`,
  `auto_vacuum=INCREMENTAL` bei neuer DB.
- **Migrationen:** `effect/sql/Migrator`, nummerierte TS-Dateien (`Migrations/001_….ts` bis
  über 55, 111 Dateien im Ordner), handgeschriebenes SQL, nur vorwärts. Spalten wie
  `created_at TEXT`, `updated_at TEXT`, `deleted_at TEXT`, IDs als `TEXT PRIMARY KEY`.
- **RPC:** Effect RPC (`effect/rpc`), Verträge als `RpcGroup` mit Effect-Schema in
  `packages/contracts/src/rpc.ts`, Client in `packages/client-runtime/src/rpc` über **WebSocket**.
  Das Web nutzt Effect Atoms (`@effect/atom-react`) und Zustand, kein TanStack Query/DB.
- **Mobile:** `expo-sqlite` für lokale Persistenz (`apps/mobile/src/persistence`).
- Folgerung: t3code ist eine Server-App mit lokalem Server. Sein Weg (Kindprozess + WebSocket)
  ist für uns schwerer als nötig, weil wir keinen Remote-Zugriff auf den Desktop-Host brauchen.
  Übernehmen: Pragmas, Leser-Worker-Gedanke, nummerierte Vorwärts-Migrationen, Verträge in einem
  eigenen Paket.

## 2. Abfrageschicht: better-sqlite3 jetzt, PowerSync später

| | Drizzle | Kysely | Rohes SQL |
|---|---|---|---|
| better-sqlite3 | eigener Treiber | `SqliteDialect` eingebaut | direkt |
| Expo / op-sqlite / Web | Treiber `expo-sqlite`, `op-sqlite`, `sqlite-proxy` (Repo `main`) [verifiziert] | Community-Dialekte [nicht verifiziert] | direkt |
| PowerSync | `@powersync/drizzle-driver` 0.8.0, **nur Drizzle < 1.0**; Doku: Constraints (FK, unique, cascade) über PowerSync-Tabellen „currently not supported“ ([Doku](https://docs.powersync.com/client-sdks/orms/js/drizzle)) | `@powersync/kysely-driver` 2.0.3, gepflegt im Takt von `common` ([Doku](https://docs.powersync.com/client-sdks/orms/js/kysely)) | `db.execute/getAll/watch` |
| Migrationen | `drizzle-kit generate` erzeugt SQL aus dem TS-Schema-Diff | `Migrator` mit eigenem Provider, SQL von Hand | eigener Runner (~50 Zeilen, `user_version`) |
| Typen | aus dem Schema in TS | aus einer `Database`-Schnittstelle (von Hand oder `kysely-codegen`) | keine |
| Reife | 0.45 stabil, 1.0 als RC; Wechsel 0.x→1.0 steht bevor | 0.29, lange stabil, kleine API | – |

Alle drei Wege sind von PowerSync offiziell aufgeführt ([ORM-Übersicht](https://docs.powersync.com/client-sdks/orms/js/overview))
[verifiziert]. Wichtig für D22: Wir brauchen **Raw Tables** (siehe 5.), denn nur dort gibt es
Fremdschlüssel und Ausdrucks-Indizes. Bei Raw Tables schreiben wir die Migrationen **ohnehin
selbst**. Damit verliert der PowerSync-Drizzle-Treiber seinen Hauptvorteil (`toPowerSyncTable`
für verwaltete Views), behält aber die Versionsfalle (Drizzle 1.0). Drizzle über `sqlite-proxy`
auf PowerSyncs `execute` zu legen wäre ein Ausweg [nicht verifiziert].

Wichtig: PowerSync soll später **der einzige Besitzer der DB-Verbindung** sein, weil die
Upload-Trigger der Raw Tables Funktionen der PowerSync-Erweiterung aufrufen. Eine zweite,
eigene better-sqlite3-Verbindung, die schreibt, wäre riskant [nicht verifiziert, gefolgert aus
[Raw Tables](https://docs.powersync.com/client-sdks/advanced/raw-tables)]. Deshalb muss der
Query-Builder auf einem austauschbaren Ausführer sitzen: heute better-sqlite3, später
PowerSync. Kysely leistet das direkt (Dialekt tauschen).

## 3. Reaktivität im UI

| Weg | Stand | Passt zu Daten-Host im eigenen Prozess? |
|---|---|---|
| **TanStack Query + Invalidierung** | 5.107, stabil | Ja. Abfragen gehen über RPC; der Host meldet nach jedem Commit `tablesChanged([...])`, der Client invalidiert Abfragen, die diese Tabellen deklarieren. Später liefert PowerSync die Sync-Änderungen über `onChange`/`onChangeWithCallback` (Tabellenfilter) [verifiziert: API existiert in `CommonPowerSyncDatabase.ts`; ob Raw Tables die Meldung auslösen: nicht verifiziert]. |
| **TanStack DB** (`@tanstack/react-db`) | 1.0 RC seit 2026-10-29 | Nur teilweise. Collections halten Zeilen im Renderer-Speicher. Die PowerSync-Collection braucht ein `PowerSyncDatabase`-Objekt im selben JS-Kontext ([Doku](https://github.com/TanStack/db/blob/main/docs/collections/powersync-collection.md)), also PowerSync im Renderer. Es gibt `syncMode: 'on-demand'`. |
| TanStack DB **SQLite-Persistence** (Electron) | 1.0 RC | Nein als Wahrheit: Main stellt eine better-sqlite3-DB per IPC bereit, gespeichert werden **Collection-Zeilen in eigenen Cache-Tabellen** mit `schemaVersion`; bei Schema-Wechsel wird ein synchronisierter Cache verworfen, ohne `sync` gibt es einen Fehler ([Guide](https://github.com/TanStack/db/blob/main/docs/guides/sqlite-persistence.md)) [verifiziert]. Das ist ein Cache, nicht unser D22-Schema. |
| **PowerSync Watched Queries** | GA; inkrementell und differenziell (nur JS) ([Doku](https://docs.powersync.com/client-sdks/watch-queries)) | Ja, über `MessagePort` wie in der Electron-Node-Demo. Gibt es erst mit PowerSync. |

**Mit wenig Umbau ohne Sync starten:** Im UI nur ein eigener Hook
(`useModuleQuery(queryDef)`) mit TanStack Query. Jede deklarierte Abfrage nennt ihre Tabellen.
Die Quelle der Änderungs-Ereignisse liegt im Host: heute der eigene Schreibpfad, später
zusätzlich PowerSync `onChange`. UI, Ports und Abfragen bleiben gleich. TanStack DB bleibt eine
spätere Option hinter demselben Hook, etwa als eigene Collection, die von einem Watch-Strom über
IPC gefüttert wird [nicht verifiziert].

## 4. Validierung und Schema-Quelle

- **Zod 4** (4.6.7): Standard Schema, alte App und Prototyp nutzen es, Domänenregeln und
  Tests der alten App lassen sich mit Zod übernehmen. TanStack DB nimmt `StandardSchemaV1`
  [verifiziert].
- **Effect Schema** (in `effect` 4.1.2): t3code nutzt es durchgehend für Verträge und RPC,
  `zod` steht dort nur am Rand im Server (`apps/server/package.json`: `zod ^4.6.5`)
  [verifiziert]. Stark, zieht aber das ganze Effect-Programmiermodell nach sich.
- **Valibot** 1.5: kleinste Bundles, auf dem Desktop kein Vorteil.
- **drizzle-zod** 0.8.3: nur mit Drizzle. In Drizzle 1.0 liegen `zod`, `valibot` und
  `effect-schema` direkt in `drizzle-orm` (Branch `beta`) [verifiziert].
- Vorschlag: **Zod ist die Quelle für Entitäten und Befehlseingaben.** Das DB-Schema steht in
  den Migrationen. Ein Test pro Modul gleicht die Zod-Felder mit `pragma table_xinfo` ab, damit
  beide nicht auseinanderlaufen.

## 5. Sync-Tauglichkeit ab Tag 1

PowerSync-Fakten [verifiziert]:

- Jede synchronisierte Tabelle hat genau einen Primärschlüssel `id` als Text. Clients
  erzeugen UUIDs; **zusammengesetzte Primärschlüssel werden nicht unterstützt**
  ([Client ID](https://docs.powersync.com/sync/advanced/client-id)).
- Standard sind verwaltete Views über JSON (`ps_data__<table>`). **Raw Tables** sind echte
  SQLite-Tabellen mit FK, generierten Spalten und Ausdrucks-Indizes. Synchronisation über
  `put`/`delete`-Statements (meist automatisch abgeleitet), lokale Schreibvorgänge über Trigger
  (`powersync_create_raw_table_crud_trigger`). Migrationen schreiben wir selbst; neue Spalten
  brauchen Resync, `disconnectAndClear({ soft })` oder das `_extra`-Spaltenmuster
  ([Raw Tables](https://docs.powersync.com/client-sdks/advanced/raw-tables)). Verfügbar ab
  Node 0.18, React Native 1.31, Web 1.35.
- FKs auf Raw Tables müssen `DEFERRABLE INITIALLY DEFERRED` sein, weil die Reihenfolge der
  Sync-Zeilen nicht feststeht; keine FKs von Streams hoher zu niedriger Priorität;
  `pragma foreign_keys = on`.
- „Managed Tables“ (Alpha) speichern ebenfalls in Spalten, PowerSync migriert sie selbst
  ([Performance](https://docs.powersync.com/client-sdks/advanced/performance-optimization)).
  Ohne FK, daher nicht passend zu D22.
- Typen: Postgres `uuid`, `numeric`, `json/jsonb`, Arrays → `text`; `bool` → `integer`;
  `timestamptz` → `text` im Format `YYYY-MM-DD hh:mm:ss.sssZ` ([Type Mapping](https://docs.powersync.com/sync/types)).
- Local-only-Tabellen gibt es; der Wechsel lokal → synchronisiert ist ein Kopierschritt
  ([Local-only](https://docs.powersync.com/client-sdks/advanced/local-only-usage)).

Konventionen, die wir daraus ab Tag 1 übernehmen sollten:

1. **`id TEXT PRIMARY KEY`, UUIDv7** auf dem Client (`uuid` 14 `v7()`; Postgres hat
   `uuidv7()` nativ, [Doku](https://www.postgresql.org/docs/current/functions-uuid.html))
   [verifiziert]. PowerSync verlangt nur „UUID“ (Beispiel v4). v7 ist zeitlich sortiert, gut für
   B-Bäume, verrät aber die Anlagezeit. Kein `AUTOINCREMENT`, keine Integer-IDs.
2. **Brückentabellen mit eigener `id`** plus `UNIQUE(a_id, b_id)`, statt zusammengesetztem
   Primärschlüssel.
3. **Zeitpunkte als `TEXT` in UTC, ISO 8601 mit `Z`** (`created_at`, `updated_at`),
   Kalendertage als `YYYY-MM-DD` (Zeitmodul). Das passt zu `timestamptz` → `text`. Die genaue
   Schreibweise (`T` gegen Leerzeichen, Millisekunden) einmal zentral festlegen, damit
   Sortierung und Vergleich stimmen.
4. **Weiches Löschen über `deleted_at TEXT NULL`** für Nutzer-Entitäten (Rückgängig, D79),
   partielle Indizes `WHERE deleted_at IS NULL`, endgültiges Löschen später als eigener Job.
5. **`space_id TEXT NOT NULL`** an jeder später synchronisierten Tabelle, lokal zuerst ein
   persönlicher Space. Sync Streams filtern pro Space. Besitzer und Rechte hängen am Space, nicht
   an jeder Zeile.
6. **FKs immer `DEFERRABLE INITIALLY DEFERRED`**, `STRICT`-Tabellen, Booleans als `INTEGER` 0/1,
   Geld als ganze Zahl in kleinster Einheit, `custom TEXT NOT NULL DEFAULT '{}'` (JSON als Text,
   kein JSONB-Blob, weil der Sync JSON als Text überträgt).
7. **Rein lokale Tabellen klar trennen** (Präfix `local_`): Projektionen, Geräte-Einstellungen
   (D62), Caches. Sie werden nie synchronisiert und dürfen jederzeit neu aufgebaut werden.
8. **Ein Schreibpfad pro Modul** (Befehle → Port → Transaktion). Später wird daraus die
   Upload-Queue (`ps_crud`) und die Server-API, die dieselben Regeln prüft.

## 6. Alte Self-Engine (kurz) [verifiziert im lokalen Repo]

- **Aufbau:** PowerSync (Web 2.5, RN 2.3) + `@tanstack/powersync-db-collection` +
  `@tanstack/react-db` in `packages/db`. 45 `createCollection`-Aufrufe, kein `on-demand`.
  Alle Domänenschreibvorgänge laufen über den Persistence Port (ADR 0023,
  `packages/db/src/port/persistence-port.ts`, 599 Zeilen) mit drei Adaptern: PowerSync,
  In-Memory-Fake, Postgres. Dazu Contract-Suites und ein Grenztest
  (`persistence-boundary.test.ts`).
- **Was gut lief:** Port + Fake + Contract-Tests (Executors ohne Mock-Ketten, auch auf dem
  Server nutzbar); nicht interaktive Executors, die Konflikte als Ergebnis zurückgeben
  (`overlap-decision-required`); optimistische UI über Collections.
- **Was weh tat:** ein Port für alle fünf Domänen (Monolith, D11 korrigiert das); zwei
  Zugriffswege während der Migration (Expand/Contract mit Brücke `collectionsTransactionOf`);
  Domänentypen hängen an generierten Supabase-Row-Typen; 28 Query-Hooks direkt an
  TanStack DB/PowerSync; ein abgelehnter Datensatz bricht den ganzen Sync-Batch ab, deshalb ein
  eigener Marker `UNREADABLE_ROW` (`core/synced-collection-options.ts`); Upgrades von
  PowerSync/TanStack DB ziehen sich durch viele Dateien (#1215: 27 Dateien); Lebenszyklus-
  Basteleien (Reconnect bei Tab-Fokus, Init im Browser verschoben und zurückgenommen).
- **Lehre:** Port-Prinzip behalten, aber pro Modul. Keine Sync-Bibliothek in UI-Hooks oder
  Domänentypen.

## Empfehlung

**Stack:** better-sqlite3 13 in einem **`utilityProcess` als Daten-Host** → **Kysely** als
Query-Builder pro Modul (`Kysely<ModuleTables>` hinter dem Modul-Port) → **eigene nummerierte
SQL-Migrationen, nur vorwärts** (kleiner Runner, `user_version`, pro Kanal-Datenordner, D39) →
**typisierter RPC-Vertrag mit Zod über `MessagePort`** → im UI **TanStack Query** hinter einem
eigenen Hook, invalidiert durch `tablesChanged`-Ereignisse aus dem Host → Tabellen von Anfang an
als **PowerSync-taugliche Raw Tables** (Konventionen aus 5.). Mit Sync: PowerSync-Node-SDK
übernimmt im Host die Verbindung, Kysely wechselt auf `@powersync/kysely-driver`, `onChange`
speist zusätzlich die Invalidierung.

| Wahl | Hauptrisiko |
|---|---|
| `utilityProcess` | PowerSync-Node-SDK ist nur im Main-Prozess belegt; Worker und Erweiterung müssen im gepackten Utility-Prozess laden → **Spike vor der Festlegung**. Ausweg: Host im Main mit Worker-Thread. |
| Kysely | Keine Schema-DSL: Tabellentypen und Migrationen müssen von Hand gleich bleiben → Abgleichstest mit `pragma table_xinfo`. Alternative: Drizzle 1.0, sobald der PowerSync-Treiber es unterstützt. |
| Eigene SQL-Migrationen | Raw Tables verlangen Disziplin bei neuen Spalten (Resync oder `_extra`), sobald Sync läuft. Das jetzt in die Migrationsregeln schreiben. |
| RPC über `MessagePort` + Zod | Eigener Code (Fehler, Abbruch, Streams, Neustart des Hosts). Klein halten; Effect RPC wie in t3code nur, wenn wir Effect ohnehin wollen. |
| TanStack Query + Invalidierung | Grobe Invalidierung pro Tabelle lädt mehr neu als nötig; bei großen Listen messen. TanStack DB (noch RC) bleibt Option hinter dem Hook. |
| Raw-Table-Konventionen (UUIDv7, `space_id`, deferrable FK, `deleted_at`) | Kosten jetzt ohne Sync-Nutzen; FKs plus weiches Löschen brauchen klare Regeln (Kinder mitlöschen oder sperren). |
