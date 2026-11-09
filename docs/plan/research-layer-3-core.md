# Recherche Schicht 3: Gemeinsamer Kern

Stand: 2026-11-08 · Quelle: alte Self-Engine (`/Users/gwydion/Projekte/self-engine`, nur gelesen).
Bezug: [`00-decisions.md`](00-decisions.md) (D22, D36, D75, D85, D86–D95).

Frage: Was teilen die Module wirklich, und was hat die alte App dabei gelernt? Pfade beziehen
sich auf die alte Codebase. Was nicht geprüft wurde, steht unter „Nicht geprüft“.

## Kurzfassung

- **Zeit** ist der reifste Teil: `packages/time` ist fast 1:1 übernehmbar, die Regeln aus ADR 0046
  ebenfalls. Offen ist, was „eine Konto-Zeitzone“ ohne Server bedeutet.
- **Geld** ist der schwächste Teil: Beträge liegen als `double precision`, Rundung ist mehrfach
  von Hand kopiert, Währungen mit 0 oder 3 Nachkommastellen werden nicht behandelt. Das Modell
  ohne Kurse und ohne Basiswährung (ADR 0002) hat sich dagegen bewährt.
- **Spaces** gibt es in der alten App nicht. Jede Tabelle gehört einem `user_id`.
- **Tags** sind ein Konzept, das schon zusammengeführt wurde. Sie liegen aber falsch in `finance`.
  Die anderen „Kategorien“ sind eigene Fachbegriffe, keine Tags.
- **Verknüpfungen:** Alle sind modulspezifisch. Die einzige generische (`habit_link`) wurde nach
  elf Tagen wieder entfernt. Die Zyklen zwischen Fachbereichen löst heute nichts verbindlich auf.

## 1. Zeit

**`packages/time`:** Keine Laufzeit-Abhängigkeiten, 1.791 Zeilen Quellcode (438 davon Zonenliste),
991 Testzeilen, 96 Testblöcke. Berechnet Offsets über `Intl.DateTimeFormat#formatToParts`.
Temporal wurde wegen Hermes verworfen, `@date-fns/tz` liefert dort falsche Offsets.
Vorbehalte bei der Übernahme: `testing.ts` importiert Vitest, `legacy.ts` dient nur der alten
Migration, die Zonenliste wird von Hand gepflegt.

**ADR 0046, vier Arten von Zeitwerten**, je eine Speicherform:

| Art | Bedeutung | Alt gespeichert |
|---|---|---|
| Instant | Zeitpunkt | `timestamptz` |
| Calendar day | Tag ohne Uhrzeit | `date` |
| Wall-clock time | Uhrzeit ohne Tag | `HH:MM` als Text |
| Day span | zwei Calendar days | zwei `date` |

- Eine Konto-Zeitzone entscheidet über „heute“, Mitternacht und Wochengrenzen, auf jedem Gerät.
  Sie wird nur durch den Nutzer geändert; ein Gerät in anderer Zeitzone bietet den Wechsel an oder
  folgt, wenn das eingeschaltet ist. Wochenstart ist eine eigene, synchronisierte Einstellung.
- Entitäten tragen keine eigene Zeitzone. Nach einem Wechsel rutschen vergangene Instants
  rechnerisch auf andere Tage, Calendar days bleiben.
- Die Zeitzone wird nie global gelesen, sondern an jede Funktion übergeben.
- `Clock { now(): Instant }` macht die Uhr testbar. Die Übernahme blieb halb: rund 278 Treffer
  von `Date.now()`/`new Date()` in 135 Dateien außerhalb der Tests.

**Lehren:** Früher gab es drei Quellen für „heute“ und etwa acht UTC-Abschnitte; Mitternacht-UTC-Tage
wanderten um einen Tag, einige Altdaten sind nicht mehr reparierbar. Fünf Lint-Regeln
(`scripts/lint/time-rules.mjs`) sichern das ab, verbieten `new Date()` aber nicht. Tests laufen
absichtlich in einer anderen Prozess-Zeitzone als die Testdaten (Pacific/Chatham gegen Berlin).

**Geteilte Logik außerhalb von `packages/time`:** Dauer-Formatierung (`packages/i18n`), Rundung der
Arbeitszeit (`packages/core`, `workHelperFunctions.ts`), Wochenstart und Auflösung der Zeitzone
(`packages/db/.../settings/account-calendar.ts`), Wiederholungsregeln, handgeschrieben ohne rrule
(`packages/db/src/utils/recurring-cashflow.ts`, 1.223 Zeilen).

**Schwächen für Local-first:**

- Die Konto-Zeitzone ist eine Zeile mit „letzter gewinnt“; Offline-Geräte können sich beim
  „heute“ bis zum Abgleich uneinig sein.
- SQL-Logik hat ohne Server kein Zuhause: `now()`-Defaults, `account_today`, Trigger, der
  Cron für wiederkehrende Buchungen.
- Fallbacks unterscheiden sich (Gerät im Client, UTC im SQL).
- Uhrenabweichung zwischen Geräten wird nicht behandelt.
- Laufende Timer über einen Zeitzonenwechsel und eine Historie der Zeitzone sind nicht entschieden.

## 2. Währungen und Geldbeträge

**Speicherung:** Nirgends ganzzahlige Cent. `double precision` bei `single_cashflow.amount`,
`recurring_cashflow.amount`, `bank_account.saldo`, `work_project.salary`,
`work_time_entry.salary`; `numeric` bei `finance_project.start_amount`, Korrekturbeträgen und
`payout.source_value`. Lokal `real`, `numeric` kommt als Text an. In TypeScript durchgehend
`number`, `Currency = string`.

**Währung:** Ursprünglich ein Postgres-Enum, später geprüfter Text mit aktiven ISO-4217-Codes (die
Umstellung brauchte ein Wartungsfenster). Die Codeliste existiert dreimal. Träger sind Konto,
Kontakt, Buchung, Dauerbuchung, Zeiteintrag (Kopie vom Projektkonto) und Payout. Projekte haben
keine eigene Währung, sie folgt aus dem Konto.

**Umrechnung (ADR 0002):** Keine gespeicherten Kurse, keine Basiswährung, kein Kursanbieter. Summen
gibt es nur pro Währung. Eine Umrechnung sind zwei verbundene Buchungen; der Kurs steckt in den
beiden Beträgen. Das funktioniert offline ohne weiteres.

**Rundung:** `normalizeMoneyAmount` und `subtractMoneyAmounts` in `packages/core` mit festen zwei
Nachkommastellen; außerhalb von `core` nutzt sie niemand, weil `db` unter `core` liegt, deshalb gibt
es Kopien von Hand (`pending-payout.selectors.ts`, `payout-change.selectors.ts`,
`opening-day.move.ts`). Verdienst wird ungerundet berechnet und erst nach der Summe gerundet. Ein
Nachbau der Formatierung ergab: JPY 1000,5 erscheint als `¥1,000.5`, KWD 1,234 als `KWD 1.23`,
USD 1,005 als `$1`, während `normalizeMoneyAmount` 1,01 liefert.

**Formatierung und Eingabe:** `packages/i18n/src/format/` (`formatMoney`, `parseAmount`). Deutsche
Eingaben sind eine Fehlerquelle: `"12.5"` wird als 125 gelesen.

**Lehren:** Fließkomma-Fehler bei Saldo-Korrekturen; doppelt gehaltene Payout-Felder liefen
auseinander und erzwangen eine harte Umstellung (ADR 0016); ein direkt gesetzter Saldo verlor
Buchungen desselben Tages, seitdem gilt Eröffnungssaldo plus Buchungen (ADR 0047).

**Einordnung:** Im Kern gehören Währungskatalog, Betrags-Typ, Rundung, Eingabe und Formatierung.
Fachlogik wie Salden, Payouts und Auswertungen bleibt in Finanzen.

## 3. Spaces

Kein Konzept in der alten App. Alle Tabellen tragen `user_id`, die Zugriffsregeln hängen daran.
Clerk-Organisationen werden nicht genutzt, `friendships` und `profiles` wurden entfernt.
`work_folder` ist nur ein verschachtelbarer Ordner für Projekte, „Workspace“ bezeichnet UI-Tabs
(ADR 0010). Für das neue Modell gibt es also nichts zu übernehmen.

## 4. Tags und Kategorien

**Tags:** Eine Tabelle `tag` mit Titel, Beschreibung und `modules` (JSON-Text; leer heißt überall).
Keine Farbe, kein Icon, keine Hierarchie, kein eindeutiger Titel. Sechs Brückentabellen mit eigener
`id`: Aufgabe, Gewohnheit, Arbeitsprojekt, Finanzprojekt, Buchung, Dauerbuchung. Eindeutige Paare
gibt es nur bei dreien, die fehlende Regel erzwang eine Bereinigung. Der Code liegt in
`entities/finance/tag`, genutzt wird er von vier Bereichen. Starter-Tags (work, personal, home,
health) werden nach Bekanntwerden der Sprache einmalig mit festen IDs angelegt (ADR 0011, 0017).

**Kategorie-artige Begriffe:**

| Begriff | Modul | Wie Tags? |
|---|---|---|
| Zeitkategorie mit fester Klasse (ADR 0028) | Arbeit | Nein, beeinflusst die Bezahlung |
| Aufgabenstatus mit sechs festen Kategorien (ADR 0031) | Aufgaben | Nein, steuert Verhalten |
| Ordner | Arbeit | Nein, Baumstruktur |
| Finanz-Kategorien | Finanzen | Ja, schon in `tag` aufgegangen |

Echte Dopplung gibt es nicht, nur ein gemeinsames Muster: Eigene Bezeichnungen über einer festen
Klasse und Starter-Daten (`shared/starter-catalog.ts`).

**Icon und Farbe:** `icon` + `color` an Arbeitsprojekt, Gewohnheit, Konto, Dauerbuchung und
Aufgabenstatus. Geteilte Helfer in `packages/core` (`classifyEntityIcon`, `entityColors`) und
`packages/icons`. Gespeichert sind Mantine-Farbnamen.

## 5. Verknüpfungen zwischen Modulen

| Verknüpfung | Speicherung | Kardinalität | Beim Löschen |
|---|---|---|---|
| Zeiteintrag ↔ Termin | Tabelle `calendar_event_time_entry`, Eintrag eindeutig | Termin 1:n | beide Seiten kaskadieren |
| Zeiteintrag → Projekt | FK am Eintrag, optional | n:1 | gesperrt + Guard |
| Zeiteintrag → Aufgabe | FK | n:1 | `SET NULL` |
| Payout ↔ Einträge | `entry.payout_id` | 1:n | `SET NULL` |
| Payout ↔ Buchung | `single_cashflow.payout_id`, eindeutig | 1:1 | kaskadiert |
| Aufgabe → Projekt | FK | n:1 | gesperrt |
| Termin → Projekt | FK an Termin und Metadaten | n:1 | `SET NULL` |
| Timer → Termin/Aufgabe | FK | n:1 | `SET NULL` |
| Gewohnheit ↔ Projekt | Tabelle, eindeutiges Paar | n:m | kaskadiert |
| Buchung → Dauerbuchung | FK | n:1 | `SET NULL` |
| Projekt → Dauerbuchung (Gehalt) | FK | n:1 | `SET NULL` |

**Zyklen** liegen auf Fachbereichs-Ebene in `packages/db/src/entities`: Arbeit legt Dauerbuchungen
an und liest Konten; Finanzen liest Zeiteinträge für Payouts; Arbeit und Kalender schreiben
gegenseitig Verknüpfungen. Bewältigt wird das mit reinen Typ-Importen, reinen „Planern“
(`appointment-link.plan.ts`), einem kleinen Port und gemeinsamen Transaktionen. Eine verbindliche
Richtung gibt es nicht.

**Was eine Abstimmung über Modulen leisten muss** (`calendar.executors.ts:773-850`, Zeiteintrag aus
Termin): Termin, Projekt und Rundung lesen; Überschneidungen lösen, interaktiv oder als Rückfrage an
Agenten; Eintrag, Verknüpfung und Metadaten in einer Transaktion schreiben; prüfen, dass nicht
parallel schon umgewandelt wurde. Payouts brauchen das Gleiche.

**Lehren:** Das generische `habit_link` (`target_type`, `target_id`) wurde nach elf Tagen entfernt.
Die Verknüpfung Eintrag ↔ Termin wurde erst n:m gebaut und später auf einen Termin begrenzt
(ADR 0022). Eine generische Oberfläche „verknüpfte Einträge“ gibt es nicht.

## 5a. Prüfung von `packages/time` vor der Übernahme

Unabhängige Prüfung mit Testläufen (Node 26.13, ICU 79.1, tzdata 2026e); Maßnahmen in D139.

- **In Ordnung:** DST- und Datumsgrenzen-Auflösung über 419 Zonen und 20.806 Umstellungen
  (1970–2040), ISO-Wochen über 73.049 Tage, Sortierung kanonischer Instants.
- **Fehler:** Zeitzonen-Namen sind nicht stabil (`Asia/Calcutta` statt `Asia/Kolkata`, die Laufzeit
  kennt `Europe/Kiev`, aber nicht `Europe/Kyiv` und `UTC` nicht in ihrer Liste). `Date.UTC` bildet
  die Jahre 0–99 auf 19xx ab. `formatRelativeInstant` rechnet in 24-Stunden-Blöcken statt
  Kalendertagen.
- **Leistung:** `calendarDayOf` für 50.000 Instants in Berlin: 151 ms mit dem vorhandenen
  Formatter-Cache. Reicht auf Node; Hermes ist nicht gemessen.

## 6. Paketrichtung in der alten App

`packages/core` umfasst rund 23.000 Zeilen in gut 20 Bereichen, darunter Finanzen, Habits, Tasks,
Auth und Rechtstexte. 153 Dateien darin importieren `@self-engine/db`, umgekehrt keine einzige.
Deshalb erreicht `db` die Geld-Helfer nicht (siehe Abschnitt 2). `packages/time` liegt als eigenes
Paket ohne Abhängigkeiten darunter und wird von `db` (88 Dateien), `core` (70), `apps/web` (139) und
`apps/mobile` (45) genutzt, ohne Kopien. ADR 0046 nennt genau das als Grund für das eigene Paket.

## Folgen für den Plan

1. `contracts` (D90) braucht die Zeit- und Geld-Typen in seinen Zod-Schemas, im Renderer ebenso wie
   im Datenprozess. Diese Typen dürfen also keine Datenbank mitziehen.
2. Der Conventions-Test aus #30 und das Contract-Kit aus #32 setzen `space_id` voraus; Schicht 3
   muss die Tabelle dazu liefern, bevor das erste Fachmodul entsteht.
3. Eine Migration für Geldbeträge ist nachträglich teuer, also vor der ersten Fachtabelle entscheiden.
4. Ein Modul darf laut #32 keine fremden Tabellen importieren. Abläufe über mehrere Module brauchen
   deshalb einen eigenen Platz.
5. Der Import (Schicht 5) muss alte Fließkommawerte auf die neue Form runden.

## Nicht geprüft

- Stundensätze in echten Daten nur teilweise: Von 23 aktiven Projekten wurden die 11 mit
  Arbeitsbezug gelesen, nur eines hat einen Satz (40 USD). Archivierte Projekte und die Sätze an
  alten Zeiteinträgen sind nicht geprüft. Die Konten nutzen EUR, USD und THB.
- Nachkommastellen je Währung: `Intl` (ICU 79.1, CLDR 49) nennt 32 Währungen mit 0 Stellen, darunter
  HUF, IDR, COP und IQD, für die ISO 4217 nach bisherigem Wissen 2 bzw. 3 Stellen festlegt. Die
  offizielle ISO-Liste ist beim Bau gegenzuprüfen.
- In welchem Textformat PowerSync Instants lokal ablegt.
- Wie Termine in der App gelöscht werden (es gibt Spalten für weiches Löschen).
- Die Zahl der Testblöcke in `packages/time` stammt aus dem Quelltext, die Tests liefen hier nicht.
