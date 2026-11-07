# Ergebnis: Datenmodell-Prototyp (D19)

Stand: 2026-11-07 · Frage: Welche Speichervariante für die local-first, modulare App?
Rohdaten: [`results/report.md`](results/report.md) (alle Tabellen, Query-Pläne, Kontrollsummen),
[`results/*.json`](results/) (drei Läufe), [`results/loc.md`](results/loc.md) (Codezeilen).

## Kurzfassung

**Empfehlung: V3 — `objects` als synchronisierte Wahrheit + lokale Lese-Tabellen `rm_<typ>`**,
in derselben Transaktion gepflegt und jederzeit neu aufbaubar. Dazu zwei Bedingungen: Der
Erst-Import und der Erst-Sync bauen die Lese-Tabellen **mengenbasiert** neu auf, statt sie Zeile
für Zeile zu pflegen. Und alle Abfragen kommen aus generiertem Code, nie handgeschrieben.

Begründung in einem Satz: V3 ist bei den Fachauswertungen **so schnell wie echte Tabellen (V1)**,
und die Überschneidungsprüfung und die offenen Stunden über die Brücke sind sogar die schnellsten.
Dabei hat V3 die **Modularität von V2**: keine Server-Migration für neue Modulfelder oder -typen,
ein generischer Sync, Brücken als eigene Links. V2 ist nicht schlechter wegen JSON an sich,
sondern weil SQLite einen Index auf generierte Spalten **nie als deckenden Index** nutzt und weil
die Brücken-Abfrage ohne Projektion einen korrelierten Lookup pro Zeile braucht.

## Umgebung und Grenzen der Messung

| | |
|---|---|
| Maschine | Apple M3 Pro, 11 Kerne, 18 GiB, macOS (Darwin 27.2.0, arm64) |
| Laufzeit | Node v26.13.0 (natives TS-Type-Stripping), better-sqlite3 13.0.3 |
| SQLite | **3.53.4** (in better-sqlite3 gebündelt; JSONB ≥ 3.45 und generierte Spalten ≥ 3.31 sind erfüllt) |
| DB | Datei, WAL, `synchronous=NORMAL`, 64 MiB Page-Cache, Daten nach dem Import warm im Cache |
| Wiederholungen | 3 komplette Läufe; pro Lauf Median aus 15 Wiederholungen je Abfrage (nach 2 Aufwärmläufen), 300 Timer-Stopps |

**Ehrliche Einschränkungen:**

- **Die Maschine war stark ausgelastet**: Load Average 11–17 durch andere Node-Prozesse, dazu
  Kaspersky (`kavd`, bis 130 % CPU) beim Schreiben von Dateien. Deshalb gilt in jeder Zelle der
  Median über die Läufe, mit min–max in den Rohdaten. Einzelne Ausreißer sind Störungen: Ein
  V3-Import bei 200k brauchte einmal 21 Minuten statt 19–24 s. Unterschiede unter ~1,5× bei
  Werten unter 1 ms sind Rauschen.
- Nur Desktop. Web (OPFS) und Mobile sind langsamer und **nicht gemessen** (D19).
- Synthetische Daten: 60 Projekte, Zeiteinträge 10 min bis 3 h, zufällig über 5 Jahre verteilt.
  **Überschneidungen sind erlaubt**, weil eine Person nicht 200 000 Einträge ohne Überlappung
  erzeugen kann. Dazu Payouts pro Projekt und Monat (80 % der Monate, die älter als 3 Monate
  sind) und Rauschen (Tasks, Termine, Cashflows, Habit-Logs) in gleicher Anzahl wie die
  Zeiteinträge. Keine echten Self-Engine-Daten importiert.
- Monate werden in UTC berechnet, die Zeitzone des Kontos ist ignoriert (für den Vergleich egal).
- `synchronous=NORMAL` im WAL bedeutet kein fsync pro Commit. Die Schreib-Latenzen sind also
  CPU- und Seiten-Cache-Kosten, keine Kosten der Platte.
- Die Variantencodes liefern bei allen Abfragen **identische Ergebnisse** (Kontrollsummen in
  `results/report.md`). Die Zahlen vergleichen also gleiche Arbeit.

## 1. Abfragen (ms, mit ANALYZE; in Klammern: ohne ANALYZE)

| Abfrage | V1 50k | V2 50k | V3 50k | V1 200k | V2 200k | V3 200k |
|---|---|---|---|---|---|---|
| Stunden/Projekt/Monat, alle | 18 (19) | 20 (**49**) | 23 (19) | 78 (75) | 82 (**362**) | 74 (75) |
| Stunden/Projekt/Monat, ein Jahr | 3.7 (4.3) | 4.1 (**22**) | 5.3 (4.3) | 25 (24) | 16 (**85**) | 14 (17) |
| Überschneidungsprüfung (1 h-Fenster) | 0.37 (0.86) | 0.41 (**9.7**) | 0.57 (0.79) | 3.3 (7.0) | 1.6 (**36**) | 1.3 (3.3) |
| Offene Stunden/Projekt (Payout-Brücke) | 4.0 (4.0) | **32** (24) | **0.87** (0.92) | 26 (39) | **217** (89) | **2.9** (3.2) |
| Backlinks eines Projekts | 0.58 (0.54) | 0.22 (0.23) | 0.25 (0.23) | 3.5 (9.9) | 0.77 (1.1) | 0.80 (0.86) |
| Nutzerfeld „Kunde = X“, typübergreifend, ohne Index | 3.6 (**21**) | 4.4 (5.2) | 4.9 (4.6) | 29 (**128**) | 19 (18) | 19 (21) |
| … mit Ausdrucks-Index (V1: 7 Indizes, V2/V3: 1) | 0.33 | 0.43 | 0.43 | 4.2 | 2.6 | 2.7 |
| Neuer Report Umsatz/Projekt/Jahr | 18 | 26 | 19 | 105¹ | 103 | 74 |

¹ V1-Report bei 200k streut stark (78–191 ms). Der Plan ist identisch mit dem von V3, also ist
der Wert eine Störung. Realistisch liegt er bei ~75 ms.

**Was die Zahlen zeigen:**

1. **Bei 50 000 Einträgen ist alles unkritisch** (≤ 50 ms, auch im schlechtesten Fall). Bei
   200 000 trennen sich die Varianten.
2. **Die Planner-Falle ist real und trifft nur V2.** Ohne Statistiken nimmt SQLite für die
   gemischte Tabelle den allgemeinen Index `objects_type(type, deleted)` und wertet dann JSON
   pro Zeile aus. Das ist 4–25× langsamer (Überschneidungsprüfung 50k: 9,7 statt 0,4 ms;
   Monatsreport 200k: 362 statt 82 ms). V1 und V3 haben eigene Tabellen und kaum ein
   Planner-Risiko.
3. **Neuer Befund: Indizes auf generierten Spalten sind nie deckend.** In SQLite 3.53.4 zeigt
   der Plan für V2 immer `USING INDEX`, nie `USING COVERING INDEX`, auch mit STORED-Spalten
   und auch mit `type`/`deleted` als Indexspalten (`node src/probe-covering.ts`). Dieselbe
   Index-Form auf normalen Spalten ist deckend (V1, V3). Folge: Jede Aggregation über V2 liest
   für jeden Eintrag zusätzlich die Tabellenzeile, und zwar in Index-Reihenfolge, also verstreut.
   Deshalb ist V2 *mit* ANALYZE bei „offene Stunden“ sogar langsamer als ohne (217 statt 89 ms).
   Ob der Planner hier den Index oder den Typ-Index nimmt, ist Glückssache.
4. **Die Brücke als Link kostet in V2 viel** (offene Stunden 200k: 217 ms, gegen 26 ms in V1 und
   2,9 ms in V3). V3 löst das, weil das Brückenmodul eine Spalte `payout_id` zur Lese-Tabelle
   beiträgt und ein partieller Index `where payout_id is null` greift. V1 hätte denselben Index
   (`te_open`), der Planner nimmt aber `te_payout`. Auch das ist eine kleine Planner-Falle.
5. **Generische Abfragen sind in V2/V3 besser**: Backlinks über `links_index` sind 4× schneller
   als die UNION über 4 Tabellen in V1. Der typübergreifende Nutzerfeld-Filter braucht einen
   Index statt sieben, und ohne Index ist er ohne Statistiken robust (V1 ohne ANALYZE: 128 ms).
6. **Views über die generierten Spalten** (`v_time_entry`) behalten die Index-Nutzung von V2
   (partielles Prädikat wird inlined), lösen aber weder Punkt 2 noch Punkt 3.

## 2. Schreiben

| | V1 | V2 | V3 |
|---|---|---|---|
| Timer-Stopp (Laden, Rundung, zod, Overlap-Check, Wahrheit, Links/Projektion, Op-Log), Median 50k / 200k | 0.06 / 0.08 ms | 0.08 / 0.08 ms | 0.09 / 0.10 ms |
| Timer-Stopp p95 50k / 200k | 0.11 / 0.32 ms | 0.16 / 0.18 ms | 0.19 / 0.31 ms |
| Import 50 000 Zeiteinträge (zod je Eintrag, eine Transaktion) | 310 ms | 596 ms | 3 539 ms Zeile für Zeile · **543 ms** mengenbasiert |
| Import kompletter Datensatz 50k (103k Objekte + 38k Brücken) | 738 ms | 1 184 ms | 5 975 ms² |
| Import kompletter Datensatz 200k (403k Objekte + 153k Brücken) | 2,9 s | 10,2 s | 24,2 s² |

² Nur der Pfad „Zeile für Zeile“. Mit dem mengenbasierten Pfad liegt V3 etwa bei V2 plus Rebuild
(siehe 3.), bei 200k also grob 11–12 s. Das wurde für den Gesamtdatensatz nicht gemessen.

- **Ein Timer-Stopp ist in allen Varianten < 0,4 ms (p95)**, das ist zwei bis drei
  Größenordnungen unter jeder Wahrnehmungsgrenze. Die Pflege der Projektion in derselben
  Transaktion kostet in V3 ~0,02 ms.
- **V3 Zeile für Zeile ist der teure Weg** (~6× V2): je Objekt ein `delete` und ein
  `insert … select` in die Lese-Tabelle, je Brücke ein Refresh des Zeiteintrags. Für Import und
  Erst-Sync ist der mengenbasierte Weg (Wahrheit schreiben, dann `rebuildProjections`) genauso
  schnell wie V2 (543 statt 596 ms). → **Pflicht für die Umsetzung.**

## 3. Wartung

### Neuaufbau (ms)

| | V1 | V2 | V3 |
|---|---|---|---|
| `links_index` aus Feldern + Brücken | – | 192 / 795 | 202 / 770 |
| Projektionen/Indizes | REINDEX 88 / 677 | REINDEX Modul-Indizes 98 / 477 | `rm_*` löschen, füllen, indizieren 164 / 941 |
| Gesamt 50k / 200k | ~0,1 / ~0,7 s | ~0,3 / ~1,3 s | ~0,4 / ~1,7 s |

Ein kompletter Rebuild von V3 dauert bei 200 000 Einträgen < 2 s auf dem Desktop. Damit ist
„jederzeit neu aufbaubar“ eine echte Option (Schema-Update, Reparatur, nach dem Erst-Sync).

### Neues Modulfeld (`billable` am Zeiteintrag, filterbar)

| | V1 | V2 | V3 |
|---|---|---|---|
| Handgeschriebene Zeilen | ~9 Stellen in 4 Artefakten: zod, Mapping, 4× Repo (select/mapping/update/bind), Client-Migration, Server-Migration, Sync-Regel | **2**: zod-Feld + Feld-Deklaration | **2**: zod-Feld + Feld-Deklaration |
| Client-Schritte | versionierte Migration ausliefern, Repo anpassen, Typen neu generieren | keine Migration von Hand: VIRTUAL-Spalte (+ ggf. Index) aus der Deklaration; `schema_version` + Upcaster (lazy über `coalesce`-Default) | keine Migration von Hand: Spalte an `rm_time_entry` + Nachfüllen aus `objects` (oder Rebuild der Tabelle) |
| Server-Schritte | Postgres-Migration **vor** den Clients deployen, Sync-Regeln anpassen, alte Clients behandeln | keine Sync-Migration; neuen Modulcode im Prüfdienst deployen; optional Ausdrucks-Index in Postgres | wie V2; Lese-Tabellen sind rein lokal |
| Kosten auf dem Gerät 50k / 200k | ALTER 0,9 / 0,9 ms | ADD VIRTUAL 0,5 / 0,4 ms; + Index 48 / 115 ms; optional eager Upcast 355 / 1 260 ms | ALTER + Nachfüllen 42 / 240 ms |

Ehrlich angemerkt: Die Framework-Logik, die in V2/V3 die Deklaration mit dem Ist-Schema vergleicht
(`pragma table_xinfo`, Projektions-Version) und die DDL erzeugt, ist **nicht gebaut**. Gemessen
sind die erzeugten Statements. Geschätzt sind das einmalig 30–60 Zeilen Framework-Code. Der
Generator für die DDL selbst existiert (`moduleDdl`, `tableDdl`, `projectSql`).

### Neues Nutzerfeld („Invoice ref“ an Zeiteinträgen, filterbar)

In **allen drei Varianten 0 Zeilen Code und keine Migration**: Die Felddefinition ist ein Datensatz
(V1: `field_defs`, V2/V3: Objekt `field_def`), die Werte stehen in `custom`. Optional erzeugt die App
lokal einen Ausdrucks-Index (21–24 ms bei 200k). Der Unterschied liegt woanders: V1 braucht eine
`custom`-Spalte in **jeder** Tabelle, einen Index **pro Tabelle**, und typübergreifende Filter als
UNION. **Nutzerdefinierte Typen** (Ebene 2) bräuchten in V1 zusätzlich eine generische
`records`-Tabelle, also ohnehin V2/V3 durch die Hintertür.

## 4. Ergonomie und Typsicherheit

- **Codezeilen eines neuen Reports:** in allen Varianten 6 Zeilen (eine SQL-Abfrage + Typ). V3 und
  die V2-Views lesen sich wie V1 (`rm_time_entry.start_at` statt `time_entry__start_at`).
- **Typen:** In V2/V3 entstehen die TS-Typen aus den Modul-Deklarationen: `ModuleData<'time_entry'>`
  (aus zod), `ProjectionRow<'time_entry'>` (Spalten der Lese-Tabelle/View) und `genCol()`
  (Spaltenname als Literal-Typ). `src/reports/types-check.ts` prüft per `@ts-expect-error`, dass
  falsche Feld- und Spaltennamen nicht kompilieren. Ein typisierter Query-Builder (z. B. Kysely)
  könnte `ProjectionRow` direkt als Tabellen-Typ nehmen. V1 braucht dafür Codegen aus der DDL
  (wie heute `supabase.types.ts`).
- **SQL-Strings selbst sind in allen Varianten ungeprüft.** Typsicherheit über Spaltennamen
  hinaus braucht einen Builder. Das ist eine eigene Entscheidung.
- **Planner-Robustheit:** V2 verlangt, dass jede Abfrage exakt `type = '…' and deleted = 0`
  enthält (sonst greift der partielle Index nicht) und dass Statistiken existieren. V3 hat diese
  Bedingung nicht, weil die Lese-Tabelle nur lebende Objekte eines Typs enthält.
- **Codeumfang des Kerns:** V1 146 Zeilen, V2 121 Zeilen + 108 Zeilen gemeinsamer `objects`-Kern,
  V3 147 Zeilen + derselbe Kern. V3 ist am größten, aber generisch: Jeder neue Typ kostet nur
  die Deklaration.

## 5. Dateigröße

| | V1 | V2 | V3 |
|---|---|---|---|
| 50k (103k Objekte) | 16,1 MiB | 34,2 MiB | 38,3 MiB |
| 200k (403k Objekte) | 64,6 MiB | 136,9 MiB | 153,1 MiB |

V2/V3 sind ~2,1–2,4× so groß wie V1. Gründe: Feldnamen in jedem JSONB-Dokument, Text-IDs in
`links` + `links_index` (zwei Zeilen je Verweis) und in V3 die doppelte Ablage der
projizierten Felder. Auf dem Desktop ist das egal (150 MiB bei einem extremen Datenbestand), auf
Mobile beobachten.

## Empfehlung

**V3 nehmen**, mit diesen Auflagen:

1. **Wahrheit = `objects` + `links`** (synchronisiert, generisch). `links_index` und `rm_<typ>`
   sind rein lokal, aus der Modul-Deklaration erzeugt, per Versionsnummer gesteuert und jederzeit
   neu aufbaubar.
2. **Projektionen nur für Typen mit Fachauswertungen** (Zeiteinträge, Payouts, Projekte, später
   Cashflows). Alles andere fragt `objects` direkt oder über `links_index` ab.
3. **Brückenmodule dürfen Spalten zu fremden Lese-Tabellen beitragen** (hier `payout_id`). Das ist
   der wichtigste Geschwindigkeitsgewinn und hält die Wahrheit trotzdem entkoppelt.
4. **Import und Erst-Sync mengenbasiert**: zuerst die Wahrheit schreiben, dann
   `rebuildProjections`. Laufende Änderungen pflegen die Projektion in derselben Transaktion.
5. **`ANALYZE`/`PRAGMA optimize`** nach Import/Rebuild und periodisch. Bei V3 ist das eine
   Absicherung, bei `objects`-Abfragen (Nutzerfelder, Backlinks) bleibt es wichtig.
6. **Alle SQL-Abfragen aus generiertem Code** (Spaltennamen aus der Deklaration). Ein typisierter
   Builder auf Basis von `ProjectionRow` lohnt sich zu prüfen.

**Warum nicht V2:** gleiche Modularität wie V3, aber bei Aggregationen über viele Einträge
strukturell langsamer (kein deckender Index), planner-empfindlich und bei Brücken-Abfragen
um eine Größenordnung langsamer. V2 bleibt sinnvoll für **Nutzerfelder** und leichte Filter: ein
Ausdrucks-Index auf `objects` für ein vom Nutzer als filterbar markiertes Feld (in V3 genauso
nutzbar).

**Warum nicht V1:** am schnellsten beim Import und am kleinsten, bei Abfragen aber nicht
schneller als V3. Jedes Modulfeld und jeder Modultyp kostet Migrationen auf Client **und**
Server und eine Anpassung der Sync-Regeln. Nutzerdefinierte Typen gehen gar nicht ohne einen
generischen Speicher. Das widerspricht dem Ziel „modular, Plugins, Nutzer-Typen“.

## Offene Fragen

1. **Mobile und Web messen** (op-sqlite auf einem echten Android-Mittelklassegerät, wa-sqlite/OPFS):
   Wie lange dauert der mengenbasierte Rebuild bei 200k dort? Das ist der entscheidende Wert
   für den Erst-Sync. Prüfen, ob dort ebenfalls SQLite ≥ 3.45 vorliegt.
2. **PowerSync-Passung:** `objects` und `links` als Raw Tables mit Upload-Trigger. Wie fügen sich
   die lokalen `rm_*`-Tabellen ein, wenn Sync-Änderungen außerhalb unseres Schreibpfads ankommen?
   Trigger auf `objects`, oder ein Hook nach dem Sync-Batch mit Rebuild der betroffenen IDs?
   **Das ist der größte offene Punkt**, weil die Pflege in derselben Transaktion nur für lokale
   Schreibvorgänge gemessen ist.
3. **SQLite-Trigger statt JS für die Projektionspflege?** Das würde Frage 2 lösen
   (Sync-Schreibvorgänge pflegen die Projektion automatisch). Kosten und Debugbarkeit sind nicht
   gemessen.
4. **Größe auf Mobile:** ~2,4× V1. Lohnt sich Kompression der Feldnamen (kurze Schlüssel bzw.
   Feld-IDs, ohnehin geplant) oder ein Integer-Rowid statt Text-IDs in `links_index`?
5. **Konflikt-Granularität** für `data` und `custom` (ganzes Objekt vs. pro Feld) ist hier nicht
   berührt worden.
6. **Typisierter Query-Builder** (Kysely o. ä.) über `ProjectionRow`: lohnt der Abhängigkeits- und
   Lernaufwand gegenüber generierten SQL-Strings?
7. **Überschneidungsprüfung mitten in der Historie** ist nur über `end_at > start` indiziert.
   Bei 200k reicht das (1,3 ms). Für sehr lange Historien wäre eine obere Schranke für die
   Dauer (`start_at > newStart - maxDauer`) oder ein R-Tree eine Option.
8. Die Messungen auf einer ruhigen Maschine wiederholen, um die Streuung zu verkleinern. Die
   Rangfolge der Varianten ist über alle drei Läufe stabil.
