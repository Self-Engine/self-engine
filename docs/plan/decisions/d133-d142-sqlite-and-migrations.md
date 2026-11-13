# Runde 21 (2026-11-09): SQLite, Konventionen und Migrationen (#30)

- **D133 Paket `@self-engine/db` mit drei Einstiegen:** der Kern (Migrationen, Runner, Id- und
  Zeit-Helfer, Typen) ohne better-sqlite3, durch eine Kern-Reinheitsregel in den Modulgrenzen
  gesichert; `@self-engine/db/better-sqlite3` mit Verbindung und Kysely-Dialekt, nur für den
  Datenprozess und Tests; `@self-engine/db/testing` für die Konventionsprüfung. Kysely kommt schon
  hier statt in #31, weil sein Migrator der Runner ist.
- **D134 Pragmas der Verbindung:** `journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON`,
  `synchronous=NORMAL`, `checkpoint_fullfsync=ON`, `temp_store=MEMORY`, `journal_size_limit` von
  128 MiB und `auto_vacuum=INCREMENTAL` bei neuer Datenbank.
- **D135 Migrationen pro Modul:** Kyselys Migrator mit eigenem Provider für handgeschriebenes
  SQL, nur vorwärts. Name `<modul>/<nummer>`, vierstellig pro Modul (`time/0003`), doppelte Namen
  sind ein Fehler. Der Aufrufer stellt die Liste zusammen, das Paket kennt kein Modul.
  `allowUnorderedMigrations` ist an, weil die erste Migration eines neuen Moduls vor bereits
  gelaufenen Namen sortieren kann. Kyselys eigene zwei Tabellen behalten ihre Namen.
- **D136 Eine Migration liest und schreibt nur die Tabellen ihres Moduls.** Fremdschlüssel auf
  Tabellen anderer Module sind erlaubt, weil SQLite sie vor der Elterntabelle annimmt. Sonst
  unterscheidet sich eine Neuinstallation von einer gewachsenen Datenbank: Ein Nachtragen von
  Daten könnte eine Spalte suchen, die eine spätere Migration eines anderen Moduls schon
  umbenannt hat. Daten zwischen Modulen zu verschieben geht nicht über eine Migration.
- **D137 Eine Transaktion pro Lauf** (ändert „eine pro Datei“ aus #30). Kysely hält SQLite für
  nicht transaktionsfähig bei DDL und liefe ohne Transaktion; ein kleiner Adapter meldet die
  Fähigkeit, und Kysely legt den ganzen Lauf in eine Transaktion. Ein gescheiterter Lauf lässt
  die Datenbank vollständig auf ihrem alten Stand.
- **D138 Eine neuere Datenbank wird abgewiesen:** Kyselys Prüfung auf eine gelaufene, aber
  unbekannte Migration beendet den Lauf mit einem Fehler, der sie nennt. Die Anzeige kommt in
  #29. Der Runner meldet außerdem, ob Migrationen ausstehen, damit nur dann gesichert wird.
- **D139 SQL-Dateien kommen per `import.meta.glob` mit `?raw` ins Bundle.** Jedes Modul übergibt
  seine `<vier Ziffern>.sql`-Dateien an `defineMigrations`, Vitest und Vite-Build laden sie
  gleich. Eine Datei darf mehrere Anweisungen enthalten: Sie läuft über `exec` des Treibers auf
  derselben Verbindung wie Kysely und damit in dessen Transaktion. `vp pack` lädt `?raw` nicht
  von selbst und braucht für den Datenprozess in #29 ein kleines Plugin.
- **D140 Konventionsprüfung gegen das Schema nach den Migrationen:** jede Tabelle `STRICT`, jeder
  Fremdschlüssel `DEFERRABLE INITIALLY DEFERRED`; außerhalb lokaler Tabellen Text-`id` als
  Primärschlüssel, `created_at`/`updated_at` als Text ungleich NULL, `deleted_at` als Text mit
  NULL, `space_id` als Text ungleich NULL; kein SQL-`DEFAULT` auf den Zeitspalten. Eine lokale
  Tabelle trägt das Präfix `local_` und ist nur von den Pflichtspalten befreit, eine
  Ausnahmeliste gibt es nicht. Eine synchronisierte Tabelle darf nicht auf eine lokale verweisen,
  umgekehrt schon.
- **D141 Ids und Zeitpunkte nur aus Helfern:** UUIDv7 aus `uuid`; Zeitpunkte immer UTC in genau
  der Form `2026-11-09T14:07:46.297Z`, weil SQLite Text zeichenweise vergleicht und `…:46Z` hinter
  `…:46.297Z` sortiert. Eine Migration nutzt beim Nachtragen
  `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`. Tests können Uhr und Zufall vorgeben.
- **D142 Gemergte Migrationen sind unveränderlich:** Eine Prüfung in `pnpm verify` schlägt fehl,
  wenn eine Datei, die auf `main` liegt, geändert, gelöscht oder umbenannt wurde. „Auf `main`“
  steht für „schon irgendwo gelaufen“, weil jeder Stand von `main` als Nightly ausgeht. Ohne die
  nötige Git-Historie schlägt sie fehl, statt still zu bestehen. _Verworfen:_ Prüfsumme beim
  App-Start (träfe Nutzer statt Entwickler, schon bei einem geänderten Kommentar).
