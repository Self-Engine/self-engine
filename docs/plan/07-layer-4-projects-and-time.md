# Schicht 4: Projekte und Zeit

Stand: 2026-11-14 · Status: **entschieden** (D303–D316, Formular-Helfer D317–D326), Spec #271,
Issues #272–#277 sowie #109, #110 und #213

Schicht 4 ist der erste Fachmeilenstein: das erste, was in der App sichtbar und nutzbar ist. Sie
ist bewusst schmal. Der Owner nutzt die alte App weiter, bis die neue ihn überzeugt (D315).

## Entschieden

| Nr. | Thema | Entscheidung |
|---|---|---|
| L4.1 | Umfang | Eine Stufe: Projekte, Zeiteinträge von Hand, ein Timer, eine Wochenansicht (D303) |
| L4.2 | Module | `projects` und `time-tracking`; die Zeit importiert die Projekte, nie umgekehrt (D304) |
| L4.3 | Projekt | Weder Art noch Satz; Abrechnungsbedingungen kommen mit der Abrechnung (D305, ändert D153) |
| L4.4 | Löschen | Immer archivierbar, löschbar nur ohne ungelöschte Verweise; die Prüfung sitzt im Speicher-Rahmen; kein `CASCADE`, kein `SET NULL` (D306) |
| L4.5 | Schutz | Jede Regel sitzt im Datenprozess an der tiefsten Stelle, die sie sehen kann; ein Einhängepunkt für Verweis-Prüfung und Schutzregeln (D307) |
| L4.6 | Zeiteintrag | Ungerundete Zeitpunkte und daneben die zählende Dauer als eigene Zahl (D308) |
| L4.7 | Rundung | Nicht in Schicht 4; später je Projekt in `time-tracking`, auch für private Projekte (D309, ändert D153) |
| L4.8 | Timer | Eigene Zeile, Stoppen in einer Transaktion, einer zugleich als Regel der Operation (D310) |
| L4.9 | Überschneidungen | Gültige Daten, jede Summe zählt voll, Schicht 4 markiert nur (D311) |
| L4.10 | Formulare | Der Formular-Helfer (#213) kommt vor dem ersten Formular (D312); er prüft mit dem Eingabe-Schema des Vertrags, baut auf `@mantine/form` und liegt im Paket `forms` (D317–D326) |
| L4.15 | Bearbeiten | Eine Operation zum Bearbeiten bekommt nur die geänderten Felder; Felder, die eine Regel verbindet, reisen zusammen (D323) |
| L4.11 | Projektseite | Keine in Schicht 4; #201 wird mit ihr gegrillt (D313) |
| L4.12 | Hülle | Ein ständiger Platz, den ein Modul füllt; erster Nutzer ist der Timer (D314) |
| L4.13 | Platzhalter | Verlassen die App mit `projects`, bleiben Testobjekte; kein Modul-Abbau (D315) |
| L4.14 | Reihenfolge | Neun Schritte, `time-tracking` in zwei Paketen (D316) |

## Aufbau

```text
time-tracking             time_entries, timers; importiert projects (D304)
  ↓
projects                  projects; kennt die Zeiterfassung nicht
  ↓
storage                   Rahmen mit Einhängepunkt und Verweis-Prüfung (D306, D307)
  ↓
spaces, db, time          Schicht 2 und 3
```

Daneben bekommt die Hülle den ständigen Platz (D314). Der Formular-Helfer (#213) liegt im Paket
`forms` über `shell`, `data-client` und `ui`; beide Module importieren es, und nur `forms`
importiert `@mantine/form` und `@mantine/dates` (D325).

Was ein Zeiteintrag speichert (D308):

| Spalte | Bedeutung |
|---|---|
| `started_at`, `ended_at` | Wo der Eintrag im Tag liegt, wie gemessen oder eingetragen. Nie gerundet. |
| `duration_seconds` | Wie viel der Eintrag zählt. In Schicht 4 Ende minus Beginn; Rundung, Pausen und geteilte Zeit ändern später nur diese Zahl. |
| `project_id`, `note` | Verweis auf das Projekt und freier Text. |

## Arbeitspakete

Spec: [#271](https://github.com/Self-Engine/self-engine/issues/271). Die Reihenfolge stammt aus
D316. Jedes Paket außer dem ersten wird vor dem Bau gegrillt und trägt bis dahin `needs-grilling`;
die beiden Teile von `time-tracking` teilen sich ein Grilling. #109 und #110 bleiben Pakete der
Schicht 3 unter Spec #103.

| Nr. | Paket | Issue | Entscheidungen | Blocked by |
|---|---|---|---|---|
| 1 | Verbot von `CASCADE` und `SET NULL` in der Konventionsprüfung | #272 | D306 | – |
| 2 | Formular-Helfer | #213 | D312, D317–D326 | – |
| 3 | `projects`; die Platzhalter verlassen die App | #273 | D303–D306, D313, D315 | #213, #272 |
| 4 | Schutz-Paket: Einhängepunkt und Verweis-Prüfung | #274 | D306, D307 | #272 |
| 5 | Einstellungen in der Datenbank | #109 | D62, D113 ff. | – |
| 6 | Zeitzone und Wochenstart | #110, verkleinert | D147, D153, D316 | #109 |
| 7 | `time-tracking`, Teil 1: Einträge, Formular, Wochenansicht | #275 | D303, D304, D308, D311, D313 | #110, #273, #274 |
| 8 | Ständiger Platz in der Hülle | #276 | D314 | – |
| 9 | `time-tracking`, Teil 2: Timer und Markierung der Überschneidungen | #277 | D310, D311, D314 | #275, #276 |

Zwei Pakete tragen eine Messung als Abnahmekriterium: der ständige Platz (Start und Neuzeichnen,
D314) und die Wochenansicht (Abfragezeit mit erzeugten Daten von zwei Jahren, D193).

## Nach Schicht 4

- **Zeiterfassung:** Rundung je Projekt (D309), die Einstellung zu Überschneidungen und die Abläufe
  zum Auflösen (D311), Pausen und Phasen, Zeitklassen und Kategorien, geteilte Zeit, Pomodoro,
  parallele Timer, Serien, Tageslimit, Heatmap und Statistik, die „abgedeckte Zeit“.
- **Projekte:** die Projektseite mit den Erweiterungspunkten aus #201 (D313), Ordner, Favoriten,
  Reihenfolge von Hand, Tags (#111), Kunden als Modul unter `projects`, Aufgaben als Modul darüber.
- **Abrechnung:** Satz, Währung, Festpreis und Anstellung als Abrechnungsbedingungen, der
  Bezahlt-Zustand und Auszahlungen, mit `money` (#105) und Finanzen (D305).
- **Papierkorb:** endgültiges Löschen über eine benannte Operation, Fristen und eine Ansicht
  „Gelöscht“ (D306, D316).
- **Import:** Schicht 5 beginnt mit Projekten und Zeiteinträgen (D316).

## Offen

- Ein Import muss durch dieselben Operationen schreiben oder danach geprüft werden (D307, Schicht
  5).
- Eine Datenprüfung, die nach einem Abgleich verletzte Regeln findet und anzeigt (D307,
  Sync-Phase).
- Ein Modul samt Tabelle abbauen (#214): nötig, sobald ein echtes Modul mit Nutzerdaten
  verschwindet. Bis der Owner Daten anlegt, die nicht verloren gehen dürfen, darf eine Datenbank
  neu aufgesetzt werden (D315).
- Ob die gespeicherte Dauer im Glossar „Booked Duration“ heißt wie in der alten App; der Begriff
  entsteht beim Bau von `time-tracking`.
- Die Fragen für die Paket-Grillings stehen am Ende der
  [Runde 40](decisions/d303-d316-layer-4-projects-and-time.md).
