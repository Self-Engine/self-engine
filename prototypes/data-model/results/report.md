# Messwerte (3 Läufe)

| Lauf | Datum | Node | SQLite | better-sqlite3 | CPU | Load avg Start → Ende |
|---|---|---|---|---|---|---|
| 1 | 2026-11-07T09:53:09.475Z | v26.13.0 | 3.53.4 | 13.0.3 | Apple M3 Pro, 11 Kerne, 18 GiB | 11.8 15.1 12.3 → 17.1 17.6 14 |
| 2 | 2026-11-07T09:56:26.499Z | v26.13.0 | 3.53.4 | 13.0.3 | Apple M3 Pro, 11 Kerne, 18 GiB | 17.1 17.6 14 → 10.7 15.4 13.7 |
| 3 | 2026-11-07T09:58:26.804Z | v26.13.0 | 3.53.4 | 13.0.3 | Apple M3 Pro, 11 Kerne, 18 GiB | 10.7 15.4 13.7 → 16.2 15.4 13.9 |

Wiederholungen je Abfrage: 15, Timer-Stopps je Lauf: 300. Zellen: Median über die Läufe, klein: min–max über die Läufe.

## 50.000 Zeiteinträge

Objekte: project 60, time_entry 50000, payout 2777, task 15000, appointment 10000, cashflow 15000, habit_log 10000; Brücken-Links 37828.


### Abfragen (ms, Median)

| | V1 | V2 | V3 |
|---|---|---|---|
| hoursAll — ohne ANALYZE | 19 <sub>(19–23)</sub> | 49 <sub>(49–50)</sub> | 19 <sub>(18–63)</sub> |
| hoursAll — mit ANALYZE | 18 <sub>(18–19)</sub> | 20 <sub>(20–45)</sub> | 23 <sub>(18–34)</sub> |
| hoursYear — ohne ANALYZE | 4.3 <sub>(4.1–4.3)</sub> | 22 <sub>(21–24)</sub> | 4.3 <sub>(4.1–8.2)</sub> |
| hoursYear — mit ANALYZE | 3.7 <sub>(3.6–4.0)</sub> | 4.1 <sub>(4.0–7.0)</sub> | 5.3 <sub>(3.7–8.3)</sub> |
| overlap — ohne ANALYZE | 0.86 <sub>(0.85–0.92)</sub> | 9.7 <sub>(9.5–9.8)</sub> | 0.79 <sub>(0.73–1.6)</sub> |
| overlap — mit ANALYZE | 0.37 <sub>(0.35–0.37)</sub> | 0.41 <sub>(0.41–0.78)</sub> | 0.57 <sub>(0.32–0.74)</sub> |
| openHours — ohne ANALYZE | 4.0 <sub>(3.9–4.5)</sub> | 24 <sub>(23–34)</sub> | 0.92 <sub>(0.81–1.6)</sub> |
| openHours — mit ANALYZE | 4.0 <sub>(3.9–4.3)</sub> | 32 <sub>(31–62)</sub> | 0.87 <sub>(0.81–1.5)</sub> |
| backlinks — ohne ANALYZE | 0.54 <sub>(0.51–0.58)</sub> | 0.23 <sub>(0.20–0.32)</sub> | 0.23 <sub>(0.22–0.37)</sub> |
| backlinks — mit ANALYZE | 0.58 <sub>(0.50–0.61)</sub> | 0.22 <sub>(0.22–0.32)</sub> | 0.25 <sub>(0.21–0.47)</sub> |
| customer — ohne ANALYZE | 21 <sub>(18–21)</sub> | 5.2 <sub>(4.3–5.8)</sub> | 4.6 <sub>(4.1–20)</sub> |
| customer — mit ANALYZE | 3.6 <sub>(3.6–3.7)</sub> | 4.4 <sub>(4.2–5.8)</sub> | 4.9 <sub>(4.1–15)</sub> |
| customer — mit Ausdrucks-Index | 0.33 <sub>(0.33–0.35)</sub> | 0.43 <sub>(0.39–0.87)</sub> | 0.43 <sub>(0.39–1.1)</sub> |
| hoursAll über View v_time_entry — ohne ANALYZE | – | 53 <sub>(49–56)</sub> | – |
| hoursAll über View v_time_entry — mit ANALYZE | – | 20 <sub>(20–25)</sub> | – |
| hoursYear über View — ohne ANALYZE | – | 22 <sub>(21–35)</sub> | – |
| hoursYear über View — mit ANALYZE | – | 4.3 <sub>(3.9–4.6)</sub> | – |
| Report Umsatz/Projekt/Jahr (mit ANALYZE) | 18 <sub>(18–28)</sub> | 26 <sub>(24–28)</sub> | 19 <sub>(18–32)</sub> |
| hoursAll nach Rebuild + ANALYZE | 18 <sub>(18–31)</sub> | 23 <sub>(20–25)</sub> | 19 <sub>(18–34)</sub> |

### Schreiben (ms)

| | V1 | V2 | V3 |
|---|---|---|---|
| Timer-Stopp (Rundung, zod, Overlap, Projektion, Op-Log) — Median | 0.06 <sub>(0.06–0.06)</sub> | 0.08 <sub>(0.07–0.10)</sub> | 0.09 <sub>(0.09–0.15)</sub> |
| Timer-Stopp — p95 | 0.11 <sub>(0.09–0.24)</sub> | 0.16 <sub>(0.09–0.29)</sub> | 0.19 <sub>(0.17–0.53)</sub> |
| Timer-Start — Median | 0.06 <sub>(0.05–0.06)</sub> | 0.08 <sub>(0.06–0.10)</sub> | 0.09 <sub>(0.09–0.15)</sub> |
| Import kompletter Datensatz (eine Transaktion) | 738 <sub>(637–824)</sub> | 1184 <sub>(1058–1671)</sub> | 5975 <sub>(5613–13977)</sub> |
| ANALYZE | 24 <sub>(23–27)</sub> | 64 <sub>(61–157)</sub> | 71 <sub>(66–289)</sub> |

### Wartung (ms)

| Variante | Schritt | ms |
|---|---|---|
| V1 | rebuild: reindex time_entries | 88 <sub>(87–149)</sub> |
| V2 | rebuild: links_index | 192 <sub>(159–261)</sub> |
| V2 | rebuild: reindex module indexes | 98 <sub>(92–151)</sub> |
| V3 | rebuild: links_index | 202 <sub>(199–481)</sub> |
| V3 | rebuild: rm_* tables (drop, fill, index) | 164 <sub>(161–325)</sub> |
| V1 | moduleField: ALTER TABLE add column | 0.92 <sub>(0.37–1.2)</sub> |
| V2 | moduleField: ADD VIRTUAL column | 0.48 <sub>(0.40–0.61)</sub> |
| V2 | moduleField: optional: partial index on it | 48 <sub>(40–50)</sub> |
| V2 | moduleField: optional: eager upcast of all time entries | 355 <sub>(288–415)</sub> |
| V3 | moduleField: ALTER rm_time_entry + backfill from objects | 42 <sub>(38–68)</sub> |
| V1 | customField: insert field definition | 0.14 <sub>(0.05–0.15)</sub> |
| V1 | customField: optional: expression index (time_entries) | 2.9 <sub>(2.4–5.5)</sub> |
| V2 | customField: insert field definition | 0.71 <sub>(0.50–0.73)</sub> |
| V2 | customField: optional: expression index (objects) | 5.6 <sub>(4.7–6.2)</sub> |
| V3 | customField: insert field definition | 0.16 <sub>(0.13–0.23)</sub> |
| V3 | customField: optional: expression index (objects) | 5.5 <sub>(4.6–9.4)</sub> |

### Größe (MiB)

| | V1 | V2 | V3 |
|---|---|---|---|
| DB-Datei nach Import + Checkpoint | 16.1 | 34.2 | 38.3 |
| nach allen Schritten (Indizes, Felder, Timer) | 16.1 | 36.1 | 38.8 |

### Kontrollsummen (Lauf 1, müssen je Zeile gleich sein)

| Abfrage | V1 | V2 | V3 |
|---|---|---|---|
| hoursAll | 3598 rows, Σnum=78725.23 | 3598 rows, Σnum=78725.23 | 3598 rows, Σnum=78725.23 |
| hoursYear | 720 rows, Σnum=15724.60 | 720 rows, Σnum=15724.60 | 720 rows, Σnum=15724.60 |
| overlap | 3 rows, Σnum=0.00 | 3 rows, Σnum=0.00 | 3 rows, Σnum=0.00 |
| openHours | 60 rows, Σnum=19211.63 | 60 rows, Σnum=19211.63 | 60 rows, Σnum=19211.63 |
| backlinks | 944 rows, Σnum=0.00 | 944 rows, Σnum=0.00 | 944 rows, Σnum=0.00 |
| customer | 789 rows, Σnum=0.00 | 789 rows, Σnum=0.00 | 789 rows, Σnum=0.00 |
| report | 360 rows, Σnum=5758591.04 | 360 rows, Σnum=5758591.04 | 360 rows, Σnum=5758591.04 |

### Query-Pläne (Lauf 1)


**V1**

- `hoursAll`: SCAN time_entries USING COVERING INDEX te_project_start | USE TEMP B-TREE FOR GROUP BY
- `hoursYear`: ohne ANALYZE: SEARCH time_entries USING COVERING INDEX te_start (start_at>? AND start_at<?) | USE TEMP B-TREE FOR GROUP BY → **mit:** SEARCH time_entries USING COVERING INDEX te_project_start (ANY(project_id) AND start_at>? AND start_at<?) | USE TEMP B-TREE FOR GROUP BY
- `overlap`: SEARCH time_entries USING INDEX te_end (end_at>?)
- `openHours`: SEARCH time_entries USING INDEX te_payout (payout_id=?) | USE TEMP B-TREE FOR GROUP BY
- `backlinks`: COMPOUND QUERY | LEFT-MOST SUBQUERY | SEARCH time_entries USING INDEX te_project_start (project_id=?) | UNION ALL | SEARCH payouts USING INDEX payouts_project (project_id=?) | UNION ALL | SEARCH tasks USING INDEX tasks_project (project_id=?) | UNION ALL | SEARCH appointments USING INDEX appointments_project (project_id=?)
- `customer`: ohne ANALYZE: COMPOUND QUERY | LEFT-MOST SUBQUERY | SCAN projects | UNION ALL | SCAN time_entries USING INDEX te_end | UNION ALL | SCAN payouts USING INDEX payouts_project | UNION ALL | SCAN tasks USING INDEX tasks_project | UNION ALL | SCAN appointments USING INDEX appointments_project | UNION ALL | SCAN cashflows | UNION ALL | SCAN habit_logs → **mit:** COMPOUND QUERY | LEFT-MOST SUBQUERY | SCAN projects | UNION ALL | SCAN time_entries | UNION ALL | SCAN payouts | UNION ALL | SCAN tasks | UNION ALL | SCAN appointments | UNION ALL | SCAN cashflows | UNION ALL | SCAN habit_logs
- `report`: SCAN p USING INDEX sqlite_autoindex_projects_1 | SEARCH t USING COVERING INDEX te_project_start (project_id=?) | USE TEMP B-TREE FOR GROUP BY
- `customer (Index)`: COMPOUND QUERY | LEFT-MOST SUBQUERY | SEARCH projects USING INDEX projects_customer (<expr>=?) | UNION ALL | SEARCH time_entries USING INDEX time_entries_customer (<expr>=?) | UNION ALL | SEARCH payouts USING INDEX payouts_customer (<expr>=?) | UNION ALL | SEARCH tasks USING INDEX tasks_customer (<expr>=?) | UNION ALL | SEARCH appointments USING INDEX appointments_customer (<expr>=?) | UNION ALL | SEARCH cashflows USING INDEX cashflows_customer (<expr>=?) | UNION ALL | SEARCH habit_logs USING INDEX habit_logs_customer (<expr>=?)

**V2**

- `hoursAll`: ohne ANALYZE: SEARCH objects USING INDEX objects_type (type=? AND deleted=?) | USE TEMP B-TREE FOR GROUP BY → **mit:** SCAN objects USING INDEX ix_time_entry_0 | USE TEMP B-TREE FOR GROUP BY
- `hoursYear`: ohne ANALYZE: SEARCH objects USING INDEX objects_type (type=? AND deleted=?) | USE TEMP B-TREE FOR GROUP BY → **mit:** SEARCH objects USING INDEX ix_time_entry_0 (ANY(time_entry__project_id) AND time_entry__start_at>? AND time_entry__start_at<?) | USE TEMP B-TREE FOR GROUP BY
- `overlap`: ohne ANALYZE: SEARCH objects USING INDEX objects_type (type=? AND deleted=?) → **mit:** SEARCH objects USING INDEX ix_time_entry_2 (time_entry__end_at>?)
- `openHours`: ohne ANALYZE: SEARCH o USING INDEX objects_type (type=? AND deleted=?) | CORRELATED SCALAR SUBQUERY 1 | SEARCH l USING COVERING INDEX links_from (from_id=? AND kind=?) | USE TEMP B-TREE FOR GROUP BY → **mit:** SCAN o USING INDEX ix_time_entry_0 | CORRELATED SCALAR SUBQUERY 1 | SEARCH l USING COVERING INDEX links_from (from_id=? AND kind=?)
- `backlinks`: SEARCH links_index USING PRIMARY KEY (to_id=?)
- `customer`: SCAN objects
- `hoursAll (view)`: ohne ANALYZE: SEARCH objects USING INDEX objects_type (type=? AND deleted=?) | USE TEMP B-TREE FOR GROUP BY → **mit:** SCAN objects USING INDEX ix_time_entry_0 | USE TEMP B-TREE FOR GROUP BY
- `hoursYear (view)`: ohne ANALYZE: SEARCH objects USING INDEX objects_type (type=? AND deleted=?) | USE TEMP B-TREE FOR GROUP BY → **mit:** SEARCH objects USING INDEX ix_time_entry_0 (ANY(time_entry__project_id) AND time_entry__start_at>? AND time_entry__start_at<?) | USE TEMP B-TREE FOR GROUP BY
- `report`: SEARCH objects USING INDEX objects_type (type=? AND deleted=?) | SEARCH objects USING INDEX ix_time_entry_0 (time_entry__project_id=?) | USE TEMP B-TREE FOR GROUP BY
- `customer (Index)`: SEARCH objects USING INDEX objects_customer (<expr>=?)

**V3**

- `hoursAll`: SCAN rm_time_entry USING COVERING INDEX rm_time_entry_0 | USE TEMP B-TREE FOR GROUP BY
- `hoursYear`: ohne ANALYZE: SEARCH rm_time_entry USING COVERING INDEX rm_time_entry_1 (start_at>? AND start_at<?) | USE TEMP B-TREE FOR GROUP BY → **mit:** SEARCH rm_time_entry USING COVERING INDEX rm_time_entry_0 (ANY(project_id) AND start_at>? AND start_at<?) | USE TEMP B-TREE FOR GROUP BY
- `overlap`: SEARCH rm_time_entry USING INDEX rm_time_entry_2 (end_at>?)
- `openHours`: SCAN rm_time_entry USING INDEX rm_time_entry_open
- `backlinks`: SEARCH links_index USING PRIMARY KEY (to_id=?)
- `customer`: SCAN objects
- `report`: SCAN p USING INDEX sqlite_autoindex_rm_project_1 | SEARCH t USING COVERING INDEX rm_time_entry_0 (project_id=?) | USE TEMP B-TREE FOR GROUP BY
- `customer (Index)`: SEARCH objects USING INDEX objects_customer (<expr>=?)

## 200.000 Zeiteinträge

Objekte: project 60, time_entry 200000, payout 2788, task 60000, appointment 40000, cashflow 60000, habit_log 40000; Brücken-Links 153416.


### Abfragen (ms, Median)

| | V1 | V2 | V3 |
|---|---|---|---|
| hoursAll — ohne ANALYZE | 75 <sub>(74–223)</sub> | 362 <sub>(216–740)</sub> | 75 <sub>(70–95)</sub> |
| hoursAll — mit ANALYZE | 78 <sub>(75–197)</sub> | 82 <sub>(81–135)</sub> | 74 <sub>(74–75)</sub> |
| hoursYear — ohne ANALYZE | 24 <sub>(17–37)</sub> | 85 <sub>(84–639)</sub> | 17 <sub>(17–18)</sub> |
| hoursYear — mit ANALYZE | 25 <sub>(15–27)</sub> | 16 <sub>(15–24)</sub> | 14 <sub>(14–15)</sub> |
| overlap — ohne ANALYZE | 7.0 <sub>(3.4–12)</sub> | 36 <sub>(36–279)</sub> | 3.3 <sub>(3.2–3.7)</sub> |
| overlap — mit ANALYZE | 3.3 <sub>(1.3–3.6)</sub> | 1.6 <sub>(1.6–3.1)</sub> | 1.3 <sub>(1.3–1.3)</sub> |
| openHours — ohne ANALYZE | 39 <sub>(17–39)</sub> | 89 <sub>(88–303)</sub> | 3.2 <sub>(3.0–3.3)</sub> |
| openHours — mit ANALYZE | 26 <sub>(18–46)</sub> | 217 <sub>(198–270)</sub> | 2.9 <sub>(2.7–2.9)</sub> |
| backlinks — ohne ANALYZE | 9.9 <sub>(2.8–31)</sub> | 1.1 <sub>(0.78–3.2)</sub> | 0.86 <sub>(0.79–1.1)</sub> |
| backlinks — mit ANALYZE | 3.5 <sub>(3.2–12)</sub> | 0.77 <sub>(0.77–0.80)</sub> | 0.80 <sub>(0.80–0.84)</sub> |
| customer — ohne ANALYZE | 128 <sub>(120–331)</sub> | 18 <sub>(18–41)</sub> | 21 <sub>(19–22)</sub> |
| customer — mit ANALYZE | 29 <sub>(17–35)</sub> | 19 <sub>(18–19)</sub> | 19 <sub>(19–19)</sub> |
| customer — mit Ausdrucks-Index | 4.2 <sub>(1.9–6.1)</sub> | 2.6 <sub>(2.3–3.0)</sub> | 2.7 <sub>(2.6–5.5)</sub> |
| hoursAll über View v_time_entry — ohne ANALYZE | – | 211 <sub>(204–305)</sub> | – |
| hoursAll über View v_time_entry — mit ANALYZE | – | 81 <sub>(80–86)</sub> | – |
| hoursYear über View — ohne ANALYZE | – | 90 <sub>(85–135)</sub> | – |
| hoursYear über View — mit ANALYZE | – | 16 <sub>(15–23)</sub> | – |
| Report Umsatz/Projekt/Jahr (mit ANALYZE) | 105 <sub>(78–191)</sub> | 103 <sub>(102–167)</sub> | 74 <sub>(72–74)</sub> |
| hoursAll nach Rebuild + ANALYZE | 123 <sub>(76–161)</sub> | 80 <sub>(76–83)</sub> | 75 <sub>(73–76)</sub> |

### Schreiben (ms)

| | V1 | V2 | V3 |
|---|---|---|---|
| Timer-Stopp (Rundung, zod, Overlap, Projektion, Op-Log) — Median | 0.08 <sub>(0.06–0.16)</sub> | 0.08 <sub>(0.07–0.10)</sub> | 0.10 <sub>(0.09–0.14)</sub> |
| Timer-Stopp — p95 | 0.32 <sub>(0.15–0.76)</sub> | 0.18 <sub>(0.10–0.52)</sub> | 0.31 <sub>(0.17–1.2)</sub> |
| Timer-Start — Median | 0.07 <sub>(0.06–0.15)</sub> | 0.08 <sub>(0.06–0.09)</sub> | 0.10 <sub>(0.09–0.15)</sub> |
| Import kompletter Datensatz (eine Transaktion) | 2874 <sub>(2811–9310)</sub> | 10249 <sub>(8369–17369)</sub> | 24205 <sub>(18980–1261386)</sub> |
| ANALYZE | 94 <sub>(91–239)</sub> | 268 <sub>(261–882)</sub> | 289 <sub>(277–325)</sub> |

### Wartung (ms)

| Variante | Schritt | ms |
|---|---|---|
| V1 | rebuild: reindex time_entries | 677 <sub>(399–2619)</sub> |
| V2 | rebuild: links_index | 795 <sub>(645–908)</sub> |
| V2 | rebuild: reindex module indexes | 477 <sub>(473–530)</sub> |
| V3 | rebuild: links_index | 770 <sub>(749–830)</sub> |
| V3 | rebuild: rm_* tables (drop, fill, index) | 941 <sub>(721–943)</sub> |
| V1 | moduleField: ALTER TABLE add column | 0.87 <sub>(0.40–1.2)</sub> |
| V2 | moduleField: ADD VIRTUAL column | 0.40 <sub>(0.29–0.52)</sub> |
| V2 | moduleField: optional: partial index on it | 115 <sub>(112–783)</sub> |
| V2 | moduleField: optional: eager upcast of all time entries | 1260 <sub>(1231–4507)</sub> |
| V3 | moduleField: ALTER rm_time_entry + backfill from objects | 240 <sub>(220–413)</sub> |
| V1 | customField: insert field definition | 0.13 <sub>(0.05–0.16)</sub> |
| V1 | customField: optional: expression index (time_entries) | 21 <sub>(9.6–22)</sub> |
| V2 | customField: insert field definition | 0.38 <sub>(0.37–3.8)</sub> |
| V2 | customField: optional: expression index (objects) | 24 <sub>(24–36)</sub> |
| V3 | customField: insert field definition | 0.42 <sub>(0.41–0.53)</sub> |
| V3 | customField: optional: expression index (objects) | 23 <sub>(23–43)</sub> |

### Größe (MiB)

| | V1 | V2 | V3 |
|---|---|---|---|
| DB-Datei nach Import + Checkpoint | 64.6 | 136.9 | 153.1 |
| nach allen Schritten (Indizes, Felder, Timer) | 64.6 | 144.2 | 154.1 |

### Kontrollsummen (Lauf 1, müssen je Zeile gleich sein)

| Abfrage | V1 | V2 | V3 |
|---|---|---|---|
| hoursAll | 3600 rows, Σnum=314657.52 | 3600 rows, Σnum=314657.52 | 3600 rows, Σnum=314657.52 |
| hoursYear | 720 rows, Σnum=62155.63 | 720 rows, Σnum=62155.63 | 720 rows, Σnum=62155.63 |
| overlap | 18 rows, Σnum=0.00 | 18 rows, Σnum=0.00 | 18 rows, Σnum=0.00 |
| openHours | 60 rows, Σnum=73426.38 | 60 rows, Σnum=73426.38 | 60 rows, Σnum=73426.38 |
| backlinks | 3734 rows, Σnum=0.00 | 3734 rows, Σnum=0.00 | 3734 rows, Σnum=0.00 |
| customer | 3316 rows, Σnum=0.00 | 3316 rows, Σnum=0.00 | 3316 rows, Σnum=0.00 |
| report | 360 rows, Σnum=22912374.44 | 360 rows, Σnum=22912374.44 | 360 rows, Σnum=22912374.44 |

### Query-Pläne (Lauf 1)


**V1**

- `hoursAll`: SCAN time_entries USING COVERING INDEX te_project_start | USE TEMP B-TREE FOR GROUP BY
- `hoursYear`: ohne ANALYZE: SEARCH time_entries USING COVERING INDEX te_start (start_at>? AND start_at<?) | USE TEMP B-TREE FOR GROUP BY → **mit:** SEARCH time_entries USING COVERING INDEX te_project_start (ANY(project_id) AND start_at>? AND start_at<?) | USE TEMP B-TREE FOR GROUP BY
- `overlap`: SEARCH time_entries USING INDEX te_end (end_at>?)
- `openHours`: SEARCH time_entries USING INDEX te_payout (payout_id=?) | USE TEMP B-TREE FOR GROUP BY
- `backlinks`: COMPOUND QUERY | LEFT-MOST SUBQUERY | SEARCH time_entries USING INDEX te_project_start (project_id=?) | UNION ALL | SEARCH payouts USING INDEX payouts_project (project_id=?) | UNION ALL | SEARCH tasks USING INDEX tasks_project (project_id=?) | UNION ALL | SEARCH appointments USING INDEX appointments_project (project_id=?)
- `customer`: ohne ANALYZE: COMPOUND QUERY | LEFT-MOST SUBQUERY | SCAN projects | UNION ALL | SCAN time_entries USING INDEX te_end | UNION ALL | SCAN payouts USING INDEX payouts_project | UNION ALL | SCAN tasks USING INDEX tasks_project | UNION ALL | SCAN appointments USING INDEX appointments_project | UNION ALL | SCAN cashflows | UNION ALL | SCAN habit_logs → **mit:** COMPOUND QUERY | LEFT-MOST SUBQUERY | SCAN projects | UNION ALL | SCAN time_entries | UNION ALL | SCAN payouts | UNION ALL | SCAN tasks | UNION ALL | SCAN appointments | UNION ALL | SCAN cashflows | UNION ALL | SCAN habit_logs
- `report`: SCAN p USING INDEX sqlite_autoindex_projects_1 | SEARCH t USING COVERING INDEX te_project_start (project_id=?) | USE TEMP B-TREE FOR GROUP BY
- `customer (Index)`: COMPOUND QUERY | LEFT-MOST SUBQUERY | SEARCH projects USING INDEX projects_customer (<expr>=?) | UNION ALL | SEARCH time_entries USING INDEX time_entries_customer (<expr>=?) | UNION ALL | SEARCH payouts USING INDEX payouts_customer (<expr>=?) | UNION ALL | SEARCH tasks USING INDEX tasks_customer (<expr>=?) | UNION ALL | SEARCH appointments USING INDEX appointments_customer (<expr>=?) | UNION ALL | SEARCH cashflows USING INDEX cashflows_customer (<expr>=?) | UNION ALL | SEARCH habit_logs USING INDEX habit_logs_customer (<expr>=?)

**V2**

- `hoursAll`: ohne ANALYZE: SEARCH objects USING INDEX objects_type (type=? AND deleted=?) | USE TEMP B-TREE FOR GROUP BY → **mit:** SCAN objects USING INDEX ix_time_entry_0 | USE TEMP B-TREE FOR GROUP BY
- `hoursYear`: ohne ANALYZE: SEARCH objects USING INDEX objects_type (type=? AND deleted=?) | USE TEMP B-TREE FOR GROUP BY → **mit:** SEARCH objects USING INDEX ix_time_entry_0 (ANY(time_entry__project_id) AND time_entry__start_at>? AND time_entry__start_at<?) | USE TEMP B-TREE FOR GROUP BY
- `overlap`: ohne ANALYZE: SEARCH objects USING INDEX objects_type (type=? AND deleted=?) → **mit:** SEARCH objects USING INDEX ix_time_entry_2 (time_entry__end_at>?)
- `openHours`: ohne ANALYZE: SEARCH o USING INDEX objects_type (type=? AND deleted=?) | CORRELATED SCALAR SUBQUERY 1 | SEARCH l USING COVERING INDEX links_from (from_id=? AND kind=?) | USE TEMP B-TREE FOR GROUP BY → **mit:** SCAN o USING INDEX ix_time_entry_0 | CORRELATED SCALAR SUBQUERY 1 | SEARCH l USING COVERING INDEX links_from (from_id=? AND kind=?)
- `backlinks`: SEARCH links_index USING PRIMARY KEY (to_id=?)
- `customer`: SCAN objects
- `hoursAll (view)`: ohne ANALYZE: SEARCH objects USING INDEX objects_type (type=? AND deleted=?) | USE TEMP B-TREE FOR GROUP BY → **mit:** SCAN objects USING INDEX ix_time_entry_0 | USE TEMP B-TREE FOR GROUP BY
- `hoursYear (view)`: ohne ANALYZE: SEARCH objects USING INDEX objects_type (type=? AND deleted=?) | USE TEMP B-TREE FOR GROUP BY → **mit:** SEARCH objects USING INDEX ix_time_entry_0 (ANY(time_entry__project_id) AND time_entry__start_at>? AND time_entry__start_at<?) | USE TEMP B-TREE FOR GROUP BY
- `report`: SEARCH objects USING INDEX objects_type (type=? AND deleted=?) | SEARCH objects USING INDEX ix_time_entry_0 (time_entry__project_id=?) | USE TEMP B-TREE FOR GROUP BY
- `customer (Index)`: SEARCH objects USING INDEX objects_customer (<expr>=?)

**V3**

- `hoursAll`: SCAN rm_time_entry USING COVERING INDEX rm_time_entry_0 | USE TEMP B-TREE FOR GROUP BY
- `hoursYear`: ohne ANALYZE: SEARCH rm_time_entry USING COVERING INDEX rm_time_entry_1 (start_at>? AND start_at<?) | USE TEMP B-TREE FOR GROUP BY → **mit:** SEARCH rm_time_entry USING COVERING INDEX rm_time_entry_0 (ANY(project_id) AND start_at>? AND start_at<?) | USE TEMP B-TREE FOR GROUP BY
- `overlap`: SEARCH rm_time_entry USING INDEX rm_time_entry_2 (end_at>?)
- `openHours`: SCAN rm_time_entry USING INDEX rm_time_entry_open
- `backlinks`: SEARCH links_index USING PRIMARY KEY (to_id=?)
- `customer`: SCAN objects
- `report`: SCAN p USING INDEX sqlite_autoindex_rm_project_1 | SEARCH t USING COVERING INDEX rm_time_entry_0 (project_id=?) | USE TEMP B-TREE FOR GROUP BY
- `customer (Index)`: SEARCH objects USING INDEX objects_customer (<expr>=?)

## Import von 50 000 Zeiteinträgen in eine DB mit nur Projekten (ms)

| Pfad | ms |
|---|---|
| V1 | 310 <sub>(290–420)</sub> |
| V2 | 596 <sub>(554–1003)</sub> |
| V3 | 3539 <sub>(3296–4233)</sub> |
| V3 (bulk path: truth, then rebuild) | 543 <sub>(506–601)</sub> |
