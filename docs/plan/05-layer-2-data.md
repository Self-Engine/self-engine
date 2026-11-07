# Schicht 2: Datenschicht

Stand: 2026-11-08 · Status: **entschieden** (D86–D98) · Recherche:
[`research-layer-2-data.md`](research-layer-2-data.md)

## Entschieden

| Nr. | Thema | Entscheidung |
|---|---|---|
| L2.1 | Umfang | Nur Fundament: DB im Desktop, Migrationen, Port-Muster, Einstellungen in der DB, Sicherung; Fachtabellen ab Schicht 3/4 (D86) |
| L2.2 | Konventionen | UUIDv7 als Text-`id`, `created_at`/`updated_at` UTC-Text, `deleted_at`, `space_id`, `STRICT`, verzögerte FKs, `custom` als JSON, Brücken mit eigener `id` (D87) |
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

## Aufbau

```text
Renderer (React)
  └─ Modul-Hooks (TanStack Query) ──oRPC über MessagePort──┐
                                                           ▼
Datenprozess (utilityProcess)
  ├─ Ports pro Modul: benannte Operationen + Abfragen (Kysely, Zod-Eingaben)
  ├─ nach jedem Commit: tablesChanged([...]) → Renderer invalidiert
  ├─ Migrationen (SQL, nur vorwärts) + Sicherung
  └─ better-sqlite3 (WAL, foreign_keys=ON, …)
Hauptprozess: startet den Datenprozess, reicht den Port an den Renderer weiter
```

Später ersetzt oder ergänzt eine Sync-Engine nur die Implementierung hinter den Ports und
löst dasselbe `tablesChanged` aus (D89).

## Offen

- oRPC-Server im `utilityProcess` (erste Aufgabe im Datenprozess-Issue)
- Web- und Mobile-Treiber (mit diesen Plattformen)
- Wahl der Sync-Engine (Sync-Phase, Kriterien in D89), Operations-Protokoll (mit Sync)

## Issues (angelegt 2026-11-08, Label `layer:2`)

#30 SQLite + Konventionen + Migrationen (nach #4, #5) → #31 Kysely + Zod → #32 Port-Muster;
#29 Datenprozess + oRPC (nach #6, #7); #29 + #32 → #33 Änderungsereignis + Hooks →
#34 Einstellungen in der DB (nach #15); #35 Sicherung (nach #29, #30, #23). Abhängigkeiten
stehen jeweils als „Blocked by“ im Issue.
