# Schicht 3: Gemeinsamer Kern

Stand: 2026-11-10 · Status: **entschieden** (D143–D154), Spec #103, Issues #104–#111 · Recherche:
[`research-layer-3-core.md`](research-layer-3-core.md)

## Entschieden

| Nr. | Thema | Entscheidung |
|---|---|---|
| L3.1 | Zuschnitt | Vier Pakete `time`, `money`, `spaces`, `tags`, kein `core`; Richtung nur nach unten (D143) |
| L3.2 | Spaces | Ein persönlicher Space ohne Oberfläche; `space_id` kommt als Port-Kontext (D144) |
| L3.3 | Geld | `INTEGER` in der kleinsten Einheit, eigener Katalog, einmal gerundet, keine Kurse (D145) |
| L3.4 | Geld | Eingabe und Anzeige in `money`, `_minor` im Namen, Zod-Schemas im Paket (D146) |
| L3.5 | Zeit | Eine Zeitzone als Synced Setting, keine Historie, Tageslogik nie in SQL (D147) |
| L3.6 | Zeit | Übernahme mit Pflicht-Uhr, Typen bis in die Zeile, Lint-Regeln (D148) |
| L3.7 | Zeit | Ergänzungen aus unabhängiger Prüfung (D149) |
| L3.8 | Tags | Tabelle `tags`, Brücken gehören den Modulen, weiches Löschen (D150) |
| L3.9 | Icon, Farbe | Name oder Emoji, Farbsatz-Name, vier neue Farbsätze, kein neues Paket (D151) |
| L3.10 | Abläufe | Brücken-Pakete über den Modulen, gemeinsame Transaktion, Schutzregeln (D152) |
| L3.11 | Einstellungen | Region aus der Sprache, Wochenstart, Standardwährung, Deklaration in `contracts` (D153) |
| L3.12 | Zuschnitt in Issues | Acht Arbeitspakete, jedes wird einzeln gegrillt (D154) |

## Aufbau

```text
Brücken (billing, …)      Abläufe über mehrere Module, eigene Tabellen (D152)
  ↓
Fachmodule, contracts     Schicht 4 ff.; einseitige Importe nur wenn fachlich zwingend
  ↓
spaces, tags              eigene Tabellen, Port, Migrationen
  ↓
db                        Schicht 2
  ↓
time, money               reine Werte, importieren kein Paket des Repos
```

Daneben erweitert Schicht 3 die vorhandenen Pakete `theme` und `icons` um Farbsätze, das
Icon-Verzeichnis und reine Einstiege ohne React (D151).

## Issues

Spec: [#103](https://github.com/GwydionBr/self-engine-next/issues/103). Jedes Paket außer #107 wird
vor dem Bau gegrillt und trägt bis dahin `needs-grilling` (D155), danach wird es in Teil-Tickets
geschnitten. Gebaut wird in Nummernreihenfolge.

| Issue | Paket | Entscheidungen | Blocked by |
|---|---|---|---|
| #104 | `time` mit Uhr und Lint-Regeln | D148, D149 | – |
| #105 | `money` | D145, D146, D153 | – |
| #106 | Icon und Farbe an Entitäten | D151 | – |
| #107 | ADR und Glossar für Brücken | D152 | – |
| #108 | `spaces` | D144 | #29, #32 |
| #109 | Einstellungen in der Datenbank (ersetzt #34) | D62, D113 ff. | #33, #108 |
| #110 | Eine Zeitzone und die Kern-Einstellungen | D147, D153 | #21, #23, #104, #105, #109 |
| #111 | `tags` mit Brücken der Module | D150 | #33, #108 |

## Offen

- Name des Zeitmoduls in Schicht 4: `time` ist durch das Wert-Paket belegt.
- Sonderfall doppelter Mitternacht in historischen Zeitzonen; Prüfung auf Hermes (Mobile-Phase).
- Wie eine Brücken-Aktion in der Oberfläche eines Moduls erscheint (mit der ersten Brücke).
- Zusammenführen offline angelegter gleicher Tags, Umschreiben der `space_id` (Sync-Phase).
- Wiederkehrende Buchungen ohne Server-Cron (mit dem Finanzmodul).
