# Schicht 4: Projekte und Zeit

Stand: 2026-11-20 · Status: **entschieden** (D303–D316, Formular-Helfer D317–D326, `projects`
D327–D330, Schutzregeln D331–D341, `time-tracking` D342–D350, Einstellungen D351–D356, Modulanzeige D357–D360), Spec #271, Issues #272–#277, #313 und #332 sowie #109, #110 und #213

Schicht 4 ist der erste Fachmeilenstein: das erste, was in der App sichtbar und nutzbar ist. Sie
ist bewusst schmal. Der Owner nutzt die alte App weiter, bis die neue ihn überzeugt (D315).

## Entschieden

| Nr. | Thema | Entscheidung |
|---|---|---|
| L4.1 | Umfang | Eine Stufe: Projekte, Zeiteinträge von Hand, ein Timer, eine Wochenansicht (D303) |
| L4.2 | Module | `projects` und `time-tracking`; die Zeit importiert die Projekte, nie umgekehrt (D304) |
| L4.3 | Projekt | Weder Art noch Satz; Abrechnungsbedingungen kommen mit der Abrechnung (D305, ändert D153) |
| L4.4 | Löschen | Immer archivierbar; jetzt löschbar nur ohne ungelöschte Verweise; die Prüfung sitzt im Speicher-Rahmen; kein `CASCADE`, kein `SET NULL` (D306, geändert durch D338) |
| L4.5 | Schutz | Jede Regel sitzt im Datenprozess an der tiefsten Stelle, die sie sehen kann (D307); Regeln über gespeicherten Zustand sind Schutzregeln in einem System (D331) |
| L4.6 | Zeiteintrag | Ungerundete Zeitpunkte und daneben die zählende Dauer als eigene Zahl (D308) |
| L4.7 | Rundung | Nicht in Schicht 4; später je Projekt in `time-tracking`, auch für private Projekte (D309, ändert D153) |
| L4.8 | Timer | Eigene Zeile, Stoppen in einer Transaktion, einer zugleich als Regel der Operation (D310) |
| L4.9 | Überschneidungen | Gültige Daten, jede Summe zählt voll, Schicht 4 markiert nur (D311) |
| L4.10 | Formulare | Der Formular-Helfer (#213) kommt vor dem ersten Formular (D312); er prüft mit dem Eingabe-Schema des Vertrags, baut auf `@mantine/form` und liegt im Paket `forms` (D317–D326) |
| L4.15 | Bearbeiten | Eine Operation zum Bearbeiten bekommt nur die geänderten Felder; Felder, die eine Regel verbindet, reisen zusammen (D323) |
| L4.16 | Archiv | `archived_at` ist ein Baustein des Speicher-Rahmens: unabhängig vom Löschen, sperrt nichts, doppeltes Archivieren ändert nichts (D327) |
| L4.17 | Titel | Zwei Projekte dürfen denselben Titel tragen; `projects` hat keinen Konflikt (D328) |
| L4.18 | Muster des Bearbeitens | Fehlt, leer, Wert; unbekannte Felder sind ein Eingabefehler; eine Änderung ohne Felder tut nichts (D329) |
| L4.19 | Projekt-Verweis | Id, Titel, Icon, Farbe, Archiv- und Lösch-Marke; die Auswahl bekommt die aktuelle Wahl gereicht; archivierte zu verstecken ist Anzeige, keine Regel (D330) |
| L4.20 | Schutzregeln | Eine Regel gehört zu einer Tabelle und einer Art von Schreiben, liest nur und antwortet für eine Menge von Zeilen; sie verhindert, gibt Auskunft und dient später der Datenprüfung; durchgesetzt wird sie an den Schreibwegen des Rahmens (D331–D333) |
| L4.21 | Ablehnung | Ein dritter erwarteter Fehler neben „nicht gefunden“ und dem Konflikt; jeder Grund ist typisiert definiert, und die App kompiliert nur, wenn jeder einen Text hat; jedes Modul benennt seine Tabellen (D334, D335) |
| L4.22 | Auskunft | Außerhalb eines Formulars kommt die Ablehnung nach dem Klick; das Bearbeitungsformular fragt beim Öffnen und zeigt Gesperrtes vorab; die Auskunft fragt nach Tabelle und Art des Schreibens und liest nur (D336, D339) |
| L4.23 | Verweise | Die Verweis-Prüfung schützt Löschen des Ziels, Wiederherstellen und Anlegen oder Ändern mit Verweis; ein Verweis schützt, geht mit oder bleibt, jetzt schützt jeder (D337, D338) |
| L4.24 | Zeitzone am Eintrag | Ein Zeiteintrag bleibt ein genauer Zeitpunkt, den die aktuelle Zeitzone einordnet, und speichert daneben die Zeitzone, in der er entstand (D342, ergänzt D147) |
| L4.25 | Mitternacht | Ein Eintrag bleibt eine Zeile und erscheint an jedem Tag, den er berührt, mit seinem Tagesanteil; die Anteile ergeben zusammen seine Dauer (D343) |
| L4.26 | Genauigkeit | Beginn und Ende auf ganzen Sekunden, das Ende mindestens eine Sekunde nach dem Beginn; Schicht 4 rundet die Dauer nicht, die Anzeige rundet auf die volle Minute auf (D344, D345) |
| L4.27 | Dauer | Keine Eingabe: Die Operation rechnet sie aus Beginn und Ende (D346) |
| L4.28 | Zeitumstellung | Das Formular löst die doppelte Stunde ohne Nachfrage auf; eine übersprungene Uhrzeit ist kein Wert (D347) |
| L4.29 | Uhr der Oberfläche | Eine Uhr von der App, zwei Hooks für „jetzt“ und „heute“, ein gemeinsamer Taktgeber; alles liegt in `time` mit einem eigenen Einstieg für React (D348) |
| L4.30 | Stoppen | Der Eintrag bekommt die Id des Timers; Rückgängig ist eine eigene Operation in einer Transaktion; wer einen Timer laufen lässt, stoppt zuerst jeden anderen (D349) |
| L4.31 | Abfrage der Woche | Die Seite rechnet die Woche und nennt eine Spanne von Kalendertagen; der Datenprozess liest nur die Zeitzone, in der Transaktion über den Kontext (D352, D354) |
| L4.11 | Projektseite | Keine in Schicht 4; #201 wird mit ihr gegrillt (D313) |
| L4.12 | Hülle | Ein ständiger Platz, den ein Modul füllt; erster Nutzer ist der Timer (D314) |
| L4.32 | Modulanzeige | Der ständige Platz heißt Modulanzeige und steht rechts in der Kopfzeile des Inhalts, in voller Form oder Kurzform; sie darf eine Fläche der Hülle öffnen; das Modul reicht beide als später ladenden Code im Hüllen-Beitrag (D357–D360) |
| L4.13 | Platzhalter | Verlassen die App mit `projects`, bleiben Testobjekte; kein Modul-Abbau (D315) |
| L4.14 | Reihenfolge | Neun Schritte, `time-tracking` in zwei Paketen (D316); das Schutz-Paket ist in Datenprozess und Oberfläche geteilt (D340); die Uhr der Oberfläche und die Felder für Datum und Uhrzeit sind ein eigenes Paket vor #275 (D350) |

## Aufbau

```text
time-tracking             time_entries, timers; importiert projects (D304)
  ↓
projects                  projects; kennt die Zeiterfassung nicht
  ↓
storage                   Rahmen mit Archiv (D327), Schutzregeln und Verweis-Prüfung (D331–D339)
  ↓
spaces, db, time          Schicht 2 und 3
```

Daneben bekommt die Hülle den ständigen Platz (D314). Der Formular-Helfer (#213) liegt im Paket
`forms` über `shell`, `data-client` und `ui`; beide Module importieren es, und nur `forms`
importiert `@mantine/form` und `@mantine/dates` (D325).

Was ein Zeiteintrag speichert (D308):

| Spalte | Bedeutung |
|---|---|
| `started_at`, `ended_at` | Wo der Eintrag im Tag liegt, wie gemessen oder eingetragen. Nie gerundet, auf ganzen Sekunden (D344). |
| `duration_seconds` | Wie viel der Eintrag zählt. In Schicht 4 Ende minus Beginn; Rundung, Pausen und geteilte Zeit ändern später nur diese Zahl. |
| `project_id`, `note` | Verweis auf das Projekt und freier Text. |
| Zeitzone | Der Name der Zeitzone, die beim Entstehen galt. Schicht 4 liest sie nicht (D342). |

## Arbeitspakete

Spec: [#271](https://github.com/Self-Engine/self-engine/issues/271). Die Reihenfolge stammt aus
D316. Jedes Paket außer dem ersten wird vor dem Bau gegrillt und trägt bis dahin `needs-grilling`;
die beiden Teile von `time-tracking` teilen sich ein Grilling. #109 und #110 bleiben Pakete der
Schicht 3 unter Spec #103.

| Nr. | Paket | Issue | Entscheidungen | Blocked by |
|---|---|---|---|---|
| 1 | Verbot von `CASCADE` und `SET NULL` in der Konventionsprüfung | #272 | D306 | – |
| 2 | Formular-Helfer | #213 | D312, D317–D326 | – |
| 3 | `projects`; die Platzhalter verlassen die App | #273 | D303–D306, D313, D315, D327–D330 | #213, #272 |
| 4 | Schutzregeln im Datenprozess: Schreibwege, Ablehnung, Verweis-Prüfung, Auskunft | #274 | D306, D307, D331–D340 | #272 |
| 4b | Ablehnung und Auskunft in der Oberfläche; die Projekt-Schublade | #313 | D334–D336, D339, D340 | #274 |
| 5 | Einstellungen in der Datenbank | #109 | D62, D113 ff., D351, D352 | – |
| 6 | Zeitzone und Wochenstart | #110, verkleinert | D147, D153, D316, D353–D356 | #109 |
| 6b | Uhr der Oberfläche und Felder für Datum und Uhrzeit | #332 | D344, D345, D347, D348, D350 | – |
| 7 | `time-tracking`, Teil 1: Einträge, Formular, Wochenansicht | #275 | D303, D304, D308, D311, D313, D342–D346, D352–D354 | #110, #273, #274, #313, #332 |
| 8 | Ständiger Platz in der Hülle (Modulanzeige) | #276 | D314, D357–D360 | – |
| 9 | `time-tracking`, Teil 2: Timer und Markierung der Überschneidungen | #277 | D310, D311, D314, D344, D345, D348, D349, D357–D359 | #275, #276 |

Drei Pakete tragen eine Messung als Abnahmekriterium: die Schutzregeln (Prüfungen mit 50.000
Zeilen, D332), der ständige Platz (Start und Neuzeichnen, D314) und die Wochenansicht (Abfragezeit
mit erzeugten Daten von zwei Jahren, D193).

#313 und #332 tragen eine höhere Nummer als #275 und kommen doch davor (D340, D350).

## Nach Schicht 4

- **Zeiterfassung:** Rundung als Einstellung wie in der alten App, mit dem Standard „aufrunden auf
  1 Minute“, samt der Verteilung einer gerundeten Dauer auf die Tage (D309, D343, D345), die
  Einstellung, ob ein Eintrag über Mitternacht verteilt wird (D343), die Dauer von Hand mit den
  Pausen (D346), die Zeitzone eines Eintrags anzeigen oder ändern (D342), die Einstellung zu
  Überschneidungen und die Abläufe zum Auflösen (D311), Pausen und Phasen, Zeitklassen und Kategorien, geteilte Zeit, Pomodoro,
  parallele Timer, Serien, Tageslimit, Heatmap und Statistik, die „abgedeckte Zeit“.
- **Projekte:** die Projektseite mit den Erweiterungspunkten aus #201 (D313), Ordner, Favoriten,
  Reihenfolge von Hand, Tags (#111), Kunden als Modul unter `projects`, Aufgaben als Modul darüber.
- **Abrechnung:** Satz, Währung, Festpreis und Anstellung als Abrechnungsbedingungen, der
  Bezahlt-Zustand und Auszahlungen, mit `money` (#105) und Finanzen (D305). Die Schutzregel „ein
  ausgezahlter Zeiteintrag ist nicht löschbar“ meldet die Brücke an (D331). Dieses Arbeitspaket
  baut zuerst die Freigabe, über die eine Regel von oben ihre Typen bekommt (D341).
- **Papierkorb:** endgültiges Löschen über eine benannte Operation, Fristen und eine Ansicht
  „Gelöscht“ (D306, D316). Hier entscheidet sich, ob die Zeiteinträge eines Projekts beim Löschen
  mitgehen, mit Warnung (D338).
- **Schutzregeln:** Warnungen mit Bestätigung, Feldsperren, Regeln mit Aufrufer und Schreibwege für
  viele Zeilen, je mit dem ersten echten Fall (D340); ein Verweis, der beim Löschen seines Ziels
  stehen bleibt, mit den Tags (#111, D338); die Freigabe einer Tabelle für Regeln von oben mit der
  ersten solchen Regel (D341).
- **Import:** Schicht 5 beginnt mit Projekten und Zeiteinträgen (D316).

## Offen

- Ein Import muss durch dieselben Operationen schreiben oder danach geprüft werden (D307, Schicht
  5).
- Eine Datenprüfung, die nach einem Abgleich verletzte Regeln findet und anzeigt (D307,
  Sync-Phase). Sie nutzt dieselben Schutzregeln (D331, D333).
- Ein Modul samt Tabelle abbauen (#214): nötig, sobald ein echtes Modul mit Nutzerdaten
  verschwindet. Bis der Owner Daten anlegt, die nicht verloren gehen dürfen, darf eine Datenbank
  neu aufgesetzt werden (D315).
- Ob die gespeicherte Dauer im Glossar „Booked Duration“ heißt wie in der alten App; Runde 45
  schlägt es vor, der Begriff entsteht beim Bau von `time-tracking`.
- Die Fragen für die Paket-Grillings stehen am Ende der
  [Runde 40](decisions/d303-d316-layer-4-projects-and-time.md); die zu `projects` sind in
  [Runde 42](decisions/d327-d330-projects-module.md) beantwortet, die zum Schutz-Paket in
  [Runde 43](decisions/d331-d340-protection-rules.md), die zu `time-tracking` in
  [Runde 45](decisions/d342-d350-time-tracking.md).
- Was ein Abgleich mit zwei Zeilen macht, die ein eindeutiger Index nicht beide zulässt (D328,
  Sync-Phase).
