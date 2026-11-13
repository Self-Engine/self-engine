# Runde 15 (2026-11-08): Schicht 2, Grundrichtung

Grundlage: [`research-layer-2-data.md`](../research-layer-2-data.md).

- **D86 (L2.1) Schicht 2 liefert nur das Fundament:** Datenbank im Desktop, Migrationen,
  das Muster für Speicher-Ports (ein Port pro Modul, In-Memory-Fake, Contract-Tests; Fake ersetzt durch D95),
  Einstellungen in der Datenbank (Fortsetzung von #15) sowie Sicherung und
  Wiederherstellung der Datenbankdatei. Fachliche Tabellen kommen erst in Schicht 3 und 4.
- **D87 (L2.2) Sync-taugliche Konventionen ab Tag 1, auch ohne Sync:** `id` als
  Text-Primärschlüssel mit UUIDv7, `created_at`/`updated_at` als UTC-Text, weiches Löschen
  über `deleted_at`, `space_id` an jeder Tabelle, die später synct. `STRICT`-Tabellen,
  Fremdschlüssel `DEFERRABLE INITIALLY DEFERRED`, `custom` als JSON-Text. Brückentabellen
  bekommen eine eigene `id` plus eindeutiges Paar (PowerSync kennt keine zusammengesetzten
  Schlüssel).
- **D88 (L2.3) Jede Änderung ist eine benannte Operation** (z. B. `timeEntry.stop`) durch
  den Port, kein freies `UPDATE`. Passt zu Befehlsregister (D75) und Agent (D85); später
  prüft der Server im Org-Space dieselbe Operation. Kein dauerhaftes Operations-Protokoll
  jetzt; Rückgängig beim Löschen (D79) läuft über weiches Löschen. Das Protokoll kommt mit
  Sync. _Verworfen:_ Protokoll ab Tag 1 (Verlauf, allgemeines Rückgängig).
- **D89 Schicht 2 bleibt unabhängig von jeder Sync-Engine; PowerSync ist nicht gesetzt.**
  In der alten Self-Engine kam PowerSync wegen TanStack DB; im neuen Plan war es Favorit,
  weil Schreibvorgänge über die eigene API laufen und der Server sie ablehnen kann (D11).
  Die Wahl fällt neu in der Sync-Phase. Nahtstelle: Port pro Modul (D11) + eigener
  Schreibweg (D88) + Änderungsereignis (D92). Keine Engine-Bibliothek und kein
  Engine-Spike in Schicht 2. Kriterien für die spätere Wahl: Server prüft Schreibvorgänge
  (Org-Policies), lange Offline-Phasen, SQLite auf Desktop, Web und Mobile, Selbsthosten,
  Lizenz passt zur AGPL (D18). Grenze: Engines mit eigenem Speichermodell (z. B. LiveStore)
  ersetzen die Speicher-Implementierung hinter den Ports, nicht Module und Oberfläche.
- **D90 (L2.4) Die Datenbank läuft in einem eigenen Electron-`utilityProcess`** (Datenprozess);
  der Renderer spricht ihn direkt über einen `MessagePort` an, mit typisierten Verträgen in
  einem eigenen Paket `contracts` (wie t3code). _Grund:_ better-sqlite3 ist synchron, im
  Hauptprozess würden Import oder Neuaufbau das Fenster blockieren. SQLite-Einstellungen
  wie t3code (WAL, `busy_timeout`, `foreign_keys=ON` …, siehe Recherche).
  _Verworfen:_ Hauptprozess, Worker-Thread im Hauptprozess.
- **D91 (L2.5) Abfragen mit Kysely, Migrationen als nummerierte, handgeschriebene SQL-Dateien**
  (nur vorwärts, D40). Kysely ist typisiertes SQL ohne ORM; für jede SQLite-Variante wird
  nur der Dialekt getauscht. Ein Test pro Modul prüft, dass Kysely-Typen, Zod-Schema und
  echte Spalten übereinstimmen. Zod 4 ist die Quelle für Entitäten und Operations-Eingaben.
  _Verworfen:_ Drizzle (Migrationsgenerator bringt bei handgeschriebenen `STRICT`-Tabellen
  wenig), reines SQL (keine Typen), Effect Schema (bringt den ganzen Effect-Stil mit).
- **D92 (L2.6) Oberfläche: TanStack Query hinter eigenen Hooks pro Modul** plus ein eigenes
  Ereignis `tablesChanged([...])`, das der Datenprozess nach jedem Commit sendet; Hooks laden
  betroffene Abfragen neu. Eine spätere Sync-Engine löst dasselbe Ereignis aus.
  _Verworfen:_ TanStack DB (erst RC, Kopplung an eine Engine im Renderer wie in der alten
  Self-Engine); in der Sync-Phase erneut ansehen.
- **D93 (L2.7) Verbindung Oberfläche ↔ Datenprozess über oRPC** mit Zod-Verträgen im Paket
  `contracts`, Message-Port-Adapter (`@orpc/server/message-port`, `@orpc/client/message-port`);
  `tablesChanged` als Event Iterator. Später derselbe Vertrag im Web über einen Worker.
  Geprüft: offizieller Electron-Weg über `MessagePortMain` aus dem Hauptprozess;
  Event Iterators gehen über Message Ports, nur nicht mit `experimental_transfer`.
  Nicht geprüft: Server im `utilityProcess` (Port vom Hauptprozess per `MessageChannelMain`
  weiterreichen) → erste Aufgabe im Issue für den Datenprozess, mit Rückfall auf eine
  eigene kleine RPC-Schicht. _Verworfen:_ eigene RPC-Schicht als Standard.
- **D94 (L2.8) Sicherung über die SQLite-Backup-Funktion**, nicht durch Dateikopie:
  automatisch täglich und vor jeder Migration, aufbewahrt werden 7 tägliche und 4
  wöchentliche, im Datenordner des Kanals. Im Einstellungsbereich „Daten“ (D80): „Sicherung
  jetzt erstellen“ und „Wiederherstellen“; vor dem Wiederherstellen wird die aktuelle
  Datenbank selbst gesichert.
- **D95 (L2.9) Tests gegen echtes SQLite statt handgeschriebenem Fake** (ändert D86): Module
  testen gegen den echten Port auf einer frischen `:memory:`-Datenbank mit allen
  Migrationen; Contract-Tests pro Port laufen dagegen. Ein Fake nur, wo gar keine
  Datenbank gebraucht wird (z. B. Storybook-Stories). _Grund:_ kein doppelter Code, Tests
  prüfen echtes SQL. In der alten Self-Engine war der Fake wegen PowerSync nötig.
- **D96 (L2.10) Keine eigene Verschlüsselung der Datenbankdatei** (kein SQLCipher); Verweis auf
  die Festplattenverschlüsselung des Betriebssystems (FileVault, BitLocker). _Gründe:_
  eigener better-sqlite3-Build, Schlüsselverwaltung, erschwert eine spätere Sync-Engine.
  Ende-zu-Ende-Verschlüsselung bleibt Q21 (Sync-Phase).
- **D97 (L2.11) Schicht 2 baut nur Desktop**, aber Verträge, Ports, Migrationen und
  Kysely-Abfragen plattformneutral. Web (wa-sqlite + OPFS im Worker) und Mobile (op-sqlite)
  kommen, wenn diese Plattformen anstehen; der Web-Build kompiliert weiter mit (D26).
- **D98 (L2.12) Schicht 2 jetzt in Issues zerlegen** (`layer:2`), siehe
  [`05-layer-2-data.md`](../05-layer-2-data.md).
