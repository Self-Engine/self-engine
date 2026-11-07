# Prototyp: Datenmodell (D19)

Wegwerf-Prototyp zur Frage: **Welche Speichervariante soll die local-first, modulare App nutzen?**
Nur Desktop: Node + `better-sqlite3` (der Treiber, den Electron nutzen würde). Kein UI.
Ergebnisse und Empfehlung: [`RESULTS.md`](RESULTS.md).

## Varianten

| | Wahrheit | Auswertung | Verweise / Brücke |
|---|---|---|---|
| **V1** [`src/v1/v1.ts`](src/v1/v1.ts) | Tabellen pro Entität + `custom` JSONB je Tabelle | direktes SQL | FK-Spalten, `time_entries.payout_id` |
| **V2** [`src/v2/v2.ts`](src/v2/v2.ts) | `objects` (`data`/`custom` JSONB) | VIRTUAL-Spalten + partielle Indizes aus der Modul-Deklaration, optional Views `v_<typ>` | Feld + abgeleiteter `links_index`; Brücke als Zeile in `links` (Besitzer: Modul `payout`) |
| **V3** [`src/v3/v3.ts`](src/v3/v3.ts) | wie V2 | Lese-Tabellen `rm_<typ>`, in derselben Transaktion gepflegt, komplett neu aufbaubar | wie V2; die Brücke trägt `rm_time_entry.payout_id` bei |

Gemeinsam: Modul-Deklarationen mit zod-Schemas ([`src/shared/modules.ts`](src/shared/modules.ts)),
`objects`-Kern für V2/V3 ([`src/shared/objects.ts`](src/shared/objects.ts)), ein Schreibpfad für den
Timer-Stopp mit Rundung, Validierung, Überschneidungsprüfung, Projektion und Op-Log
([`src/shared/variant.ts`](src/shared/variant.ts)), deterministische Testdaten
([`src/shared/data.ts`](src/shared/data.ts)).

Änderungs-Szenarien: [`src/changes/`](src/changes/) (Modulfeld `billable`, Nutzerfeld „Invoice ref“).
Neue Auswertung „Umsatz pro Projekt und Jahr“: [`src/reports/`](src/reports/).

## Ausführen

Voraussetzung: Node ≥ 23.6 (führt `.ts` direkt aus, Type-Stripping), Bun als Paketmanager.

```sh
bun install
bun run typecheck          # tsc, inkl. Typprüfung der generierten Projektions-Typen
bun run bench:quick        # 50 000 Einträge, wenige Wiederholungen (~1 min)
bun run bench              # 50 000 und 200 000 Einträge (~4–5 min pro Lauf)
bun run report > .temp/report.md   # Median über alle Läufe in .temp/runs/
bun run loc                # Codezeilen pro Variante / Änderung / Report
bun run probe:covering     # zeigt: Indizes auf generierten Spalten sind nie deckend
```

Jeder `bench`-Lauf schreibt `.temp/runs/<zeitstempel>.json`; `report` bildet den Median über alle
vorhandenen Läufe (mehrere Läufe glätten Störungen durch andere Prozesse). Datenbanken liegen als
Dateien in `.temp/db/` (WAL, `synchronous=NORMAL`, 64 MiB Page-Cache).

Das Benchmark muss auf **Node** laufen (nicht `bun run src/bench.ts` direkt mit Bun-Runtime), weil
`better-sqlite3` ein Node-Addon ist; die `bun run`-Skripte rufen `node` auf.

Die für `RESULTS.md` verwendeten Läufe liegen als Schnappschuss in `results/` (JSON + gerendertes `report.md`).
