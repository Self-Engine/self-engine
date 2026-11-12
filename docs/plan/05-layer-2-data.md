# Schicht 2: Datenschicht

Stand: 2026-11-12 · Status: **entschieden** (D86–D98, D133–D142, D187–D196, D219–D241) · Recherche:
[`research-layer-2-data.md`](research-layer-2-data.md)

## Entschieden

| Nr. | Thema | Entscheidung |
|---|---|---|
| L2.1 | Umfang | Nur Fundament: DB im Desktop, Migrationen, Port-Muster, Einstellungen in der DB, Sicherung; Fachtabellen ab Schicht 3/4 (D86) |
| L2.2 | Konventionen | UUIDv7 als Text-`id`, `created_at`/`updated_at` UTC-Text, `deleted_at`, `space_id`, `STRICT`, verzögerte FKs, `custom` als JSON erst mit den Nutzerfeldern, Brücken mit eigener `id` (D87, D222) |
| L2.3 | Schreiben | Benannte Operationen durch den Port, kein Operations-Protokoll vor Sync (D88) |
| – | Sync-Engine | Schicht 2 bleibt engine-neutral, PowerSync nicht gesetzt; Nahtstelle Port + Schreibweg + Änderungsereignis (D89) |
| L2.4 | Datenprozess | Electron-`utilityProcess`, Renderer direkt per `MessagePort`, Verträge in `contracts` (D90) |
| L2.5 | Abfragen | Kysely + nummerierte SQL-Migrationen, Zod 4 als Quelle, Übereinstimmungstest (D91) |
| L2.6 | Oberfläche | TanStack Query hinter Modul-Hooks + Ereignis `tablesChanged` (D92) |
| L2.7 | RPC | oRPC mit Message-Port-Adapter; `utilityProcess` zuerst prüfen, sonst eigene kleine RPC-Schicht (D93) |
| L2.8 | Sicherung | SQLite-Backup täglich + vor Migration, 7 täglich / 4 wöchentlich, Sichern/Wiederherstellen von Hand (D94) |
| L2.9 | Tests | Echtes SQLite in `:memory:` statt Fake; Contract-Tests pro Port (D95) |
| L2.10 | Verschlüsselung | Keine eigene, OS-Festplattenverschlüsselung; E2E bleibt Q21 (D96) |
| L2.11 | Plattformen | Nur Desktop, Code plattformneutral (D97) |
| L2.12 | Issues | Jetzt zerlegen, `layer:2` (D98) |
| L2.13 | Verträge | Schemas im Modul unter `./contracts`, `contracts` setzt nur zusammen (D187) |
| L2.14 | Prüfen | Eingaben immer im Datenprozess, Ausgaben nur in Tests und im Dev-Build, der Renderer nie (D188) |
| L2.15 | Port | Port, Vertrag, Speicher; ein Vertrag pro Modul, der Speicher in zwei Lagen (D189) |
| L2.16 | Fehler | „Nicht gefunden“ und „Konflikt“ mit Grund, alles andere unerwartet; kein Effect (D190) |
| L2.17 | Migrationen | D139 bleibt, der Build sammelt die SQL-Dateien ein (D191) |
| L2.18 | Start | Grenze einmal anheben, Zeitgrenze im Smoke-Test (D192) |
| L2.19 | Abfragen | Fenster, Seiten, kleine Menge; gerechnet wird im Datenprozess; eine Meldung pro Transaktion (D193) |
| L2.20 | Zeichnen | Seiten-Listen zeichnen nur Sichtbares, eine Zeile pro Änderung, Warten als Standard (D194) |
| L2.21 | Kontext | Uhr, Id-Erzeuger und Space als ein Kontext aus dem Datenprozess (D195) |
| L2.22 | Stories | Feste Antworten statt nachgebautem Speicher (D196) |
| L2.23 | Zeilen | Zeilen-Map aus Zod pro Modul als einzige Quelle, Kysely-Typen abgeleitet (D219) |
| L2.24 | Abbildung | Spalten snake_case, Entitäten camelCase, eine handgeschriebene Abbildung pro Entität (D220) |
| L2.25 | Entitäten | `id`, `createdAt`, `updatedAt`; Gelöschtes nur über eigene Operation; eindeutige Indizes partiell (D221) |
| L2.26 | Typen | `Instant` jetzt aus `time`, eine Id-Marke pro Entität, reiner Einstieg `db/schema` (D223–D225) |
| L2.27 | Prüfungen | Übereinstimmungstest gegen die echten Spalten; jeder Index mit `space_id` vorn; kein `*OrThrow` (D226–D228) |
| L2.28 | Testhilfen | `createTestSources` für Uhr und Ids, Beispiel als Testmodul in `db` (D229, D230) |
| L2.29 | Rahmen | Die obere Lage wird einmal gebaut, die Transaktion merkt sich ihre Tabellen, die Ausgabeprüfung schaltet der Rahmen (D231, D232, D234) |
| L2.30 | Pakete | Modulliste der Datenseite in `data-process`, Bausteine für Module in `storage` (D233) |
| L2.31 | Einstieg | `live(tabelle)` und vier einzeilige Standard-Schreibwege, sonst freies Kysely (D235) |
| L2.32 | Listen | Seiten mit undurchsichtiger Marke, 100 Zeilen, Index geprüft; Fenster und kleine Menge warnen im Dev-Build ab 1.000 (D236, D237) |
| L2.33 | Konflikte | Eindeutiger Index zu Grund pro Modul, der Rahmen übersetzt; Wiederherstellen meldet denselben Konflikt (D238) |
| L2.34 | Contract-Tests | Ein Kit-Aufruf pro Modul; `notes` zieht als Vorlage nach `storage` (D239, D240) |
| L2.35 | Fremde Daten | Lesen nur über freigegebene Lese-Bausteine, Schreiben nie (D241) |

## Aufbau

```text
Renderer (React)
  └─ Modul-Hooks (TanStack Query) ──oRPC über MessagePort──┐
                                                           ▼
Datenprozess (utilityProcess)
  ├─ Ports pro Modul: Vertrag im Modul, Speicher in zwei Lagen (D187, D189)
  ├─ nach jedem Commit: tablesChanged([...]) → Renderer invalidiert
  ├─ Migrationen (SQL, nur vorwärts) + Sicherung
  └─ better-sqlite3 (WAL, foreign_keys=ON, …)
Hauptprozess: startet den Datenprozess, reicht den Port an den Renderer weiter
```

Später ersetzt oder ergänzt eine Sync-Engine nur die Implementierung hinter den Ports und
löst dasselbe `tablesChanged` aus (D89).

## Offen

- Warum im Durchstich jede Zeile neu gezeichnet wurde (erste Aufgabe in #33, D194)
- Effect für Sync und Import (Sync-Phase, D190); Prüfung fremder Zeilen (Sync-Phase, D188)
- Migrationen im Build von Mobile (D191)
- Wie ein Modul in der Oberfläche etwas in die Seite eines anderen einhängt (Schicht 4, D241)
- Web- und Mobile-Treiber (mit diesen Plattformen)
- Wahl der Sync-Engine (Sync-Phase, Kriterien in D89), Operations-Protokoll (mit Sync)

## Issues (angelegt 2026-11-08, Label `layer:2`)

#30 SQLite + Konventionen + Migrationen (nach #4, #5) → #31 Kysely + Zod → #32 Port-Muster;
#29 Datenprozess + oRPC (nach #6, #7); #29 + #32 → #33 Änderungsereignis + Hooks →
#34 Einstellungen in der DB (nach #15); #35 Sicherung (nach #29, #30, #23). Abhängigkeiten
stehen jeweils als „Blocked by“ im Issue.
