# Runde 22 (2026-11-09): Schicht 3, gemeinsamer Kern

Grundlage: [`research-layer-3-core.md`](../research-layer-3-core.md).

- **D143 (L3.1) Der gemeinsame Kern besteht aus vier Paketen, ein Paket `core` gibt es nicht.**
  `time` und `money` sind reine Werte und importieren kein anderes Paket des Repos. `spaces` und
  `tags` haben eigene Tabellen, Port und Migrationen (`spaces/0001`, `tags/0001`) und liegen über
  `db`. Fachmodule und `contracts` importieren nach unten, nie umgekehrt. Einstiege wie bei
  `settings`: `.`, bei Bedarf `./react` und `./testing`. „Gemeinsamer Kern“ bleibt nur der Name
  der Schicht. _Gründe:_ Das alte `packages/core` wurde mit rund 23.000 Zeilen zum Sammelbecken;
  153 seiner Dateien importieren `db`, umgekehrt keine, deshalb entstanden Kopien der Rundung in
  `db`. `time` lag als eigenes Paket ganz unten und blieb ohne Kopien. _Verworfen:_ `time`, `money`
  und ein `core` für Spaces und Tags (lädt wieder zum Sammeln ein), ein einziges Paket mit
  mehreren Einstiegen (Werte lägen über `db`). _Lage und Port von `spaces` überholt durch D287._
- **D144 (L3.2) Schicht 3 baut genau einen persönlichen Space, ohne Oberfläche.** Tabelle `spaces`
  mit `kind` (vorerst nur `personal`); die Zeile trägt ihre eigene `id` als `space_id` und besteht
  so die Konventionsprüfung aus #30 ohne Ausnahme. Das Paket `spaces` legt sie beim Start nach den
  Migrationen an, mit zufälliger UUIDv7 und nur falls keine existiert; ein eindeutiger Index
  erlaubt höchstens einen persönlichen Space. Der Port bekommt den Space beim Erzeugen als Kontext,
  Operationen nehmen ihn nicht als Eingabe, jede Abfrage filtert danach; das Contract-Kit (#32)
  prüft, dass fremde Spaces unsichtbar bleiben. Jede Fachtabelle hat einen Fremdschlüssel auf
  `spaces`, Verweise zwischen Zeilen bleiben innerhalb eines Space. _Folge für Sync:_ Das erste
  Gerät behält seine ID, ein weiteres mit Offline-Daten schreibt seine `space_id` einmalig in einer
  Transaktion um. _Verworfen:_ `spaceId` in jeder Operation (ein vergessener Filter bliebe
  unbemerkt), feste ID per Migration (kollidiert auf dem Server, jedes Gerät müsste umschreiben),
  sichtbare Spaces jetzt schon (wird mit Sync und Organisationen entschieden). _Der eindeutige
  Index überholt durch D288, der Port von `spaces` durch D287._
- **D145 (L3.3) Geld wird ganzzahlig gespeichert und einmal gerundet.** Beträge sind `INTEGER` in
  der kleinsten Einheit plus Währung als ISO-4217-Text, geprüft im Code statt per SQL-`CHECK`; in
  TypeScript eine sichere Ganzzahl mit eigenem Typ, ohne `BigInt`. `money` führt einen eigenen
  Katalog aus Währungscode und Stellenzahl: Neue Währungen dürfen dazukommen, die Stellen einer
  vorhandenen ändern sich nie (ein Test sichert das). Stundensätze werden genauso gespeichert
  (13,00 €/h als `1300`). `money` hat genau eine Funktion für Satz × Sekunden / 3600, ganzzahlig
  und kaufmännisch gerundet; gerundet wird einmal auf die Summe der Sekunden einer Abrechnung, nie
  pro Eintrag. ADR 0002 der alten App gilt weiter: keine Kurse, keine Basiswährung, Summen nur pro
  Währung. _Folge für den Import:_ Alte Fließkommawerte werden gerundet, jede Abweichung wird
  gemeldet. _Verworfen:_ `REAL` (Rundungsfehler), Dezimal als Text (SQLite kann nicht summieren),
  Sätze mit zwei Extrastellen (zweite, verwechselbare Einheit, in den geprüften Daten kein Bedarf),
  Stellenzahl aus `Intl` (weicht von ISO 4217 ab und hängt an der Laufzeit).
- **D146 (L3.4) Eingabe, Anzeige und Benennung von Geld.** `parseAmount` und `formatMoney` liegen
  in `money`, das Gebietsschema ist immer ein Parameter; `i18n` bleibt reine Übersetzung. Ein
  Trennzeichen, das als Tausendergruppe gültig ist, folgt dem Gebietsschema; eines, das keine
  gültige Gruppe sein kann, gilt als Dezimaltrenner (`12.5` im Deutschen ist 12,50). Mehr Stellen,
  als die Währung hat, sind ein Eingabefehler; ob null erlaubt ist, entscheidet die Operation. Die
  Anzeige nutzt den Katalog aus D145, glatte Beträge bleiben ohne Nachkommastellen. Spalten und
  Felder in der kleinsten Einheit enden auf `_minor` bzw. `Minor`, über die Grenze zur Oberfläche
  gehen sie als `{ amountMinor, currency }`. `money` liefert die Zod-Schemas selbst mit. Das
  Eingabefeld entsteht mit dem ersten Modul, das eines braucht, auf Basis von Mantines
  `NumberInput`. _Grund:_ In der alten App wurde `12.5` im Deutschen still zu 125. _Verworfen:_
  Formatierung in `i18n`, strenges Ablehnen von `12.5`, Spaltenname `amount` ohne Einheit.
- **D147 (L3.5) Eine Zeitzone ohne Server, ADR 0046 der alten App gilt weiter.** Eine Zeitzone als
  Synced Setting entscheidet über „heute“, Mitternacht und Wochengrenzen; der Wochenstart ist eine
  eigene Einstellung. Beim ersten Start kommt sie still vom Gerät, beim Import aus der alten App.
  Sie ändert sich nur durch den Nutzer: Ein abweichendes Gerät bietet den Wechsel an, „dem Gerät
  folgen“ ist eine Option (aus); „nicht mehr fragen“ ist eine Device Setting; die Entscheidung
  liegt rein in `time`. Keine Historie: Vergangene Zeitpunkte erscheinen in der aktuellen Zeitzone
  und können auf einen anderen Tag rutschen, Calendar days bewegen sich nie. Tageslogik nie in SQL,
  weil SQLite keine IANA-Zeitzonen kennt: `time` rechnet Tagesgrenzen im Datenprozess um, gruppiert
  wird in TypeScript; der Datenprozess liest die Einstellung pro Operation und übergibt sie
  ausdrücklich. Eine einzige Funktion löst die Zeitzone auf; kennt die Laufzeit den Namen nicht,
  gilt die Gerätezeitzone und das Fehlerprotokoll bekommt einen Eintrag. _Verworfen:_ Historie der
  Zeitzone (jede Tagesberechnung bräuchte sie, Sync-Konflikte verschöben Tage rückwirkend; kann
  später ergänzt werden), Gerätezeitzone als Autorität, Zeitzone an jedem Eintrag.
- **D148 (L3.6) `time` wird Datei für Datei übernommen, mit Pflicht-Uhr und Typen bis in die
  Zeile.** Übernommen werden Typen, Uhr, Zonen, Kalender, relative Tage, Formatierung,
  Geräte-Brücke und Zonenliste mit ihren Tests; `legacy.ts` entfällt; die Testuhr kommt nach
  `./testing`; die Wochenstart-Vorgabe je Region wandert aus dem alten `i18n` nach `time`. Die Uhr
  ist ein Pflichtargument ohne Standardwert, der Port bekommt sie als Kontext neben dem Space
  (D144), `systemClock` wird nur beim Zusammenbau der App gesetzt. `time` liefert Zod-Schemas für
  `Instant`, `CalendarDay` und `WallClockTime`, die Entitäten benutzen sie; gespeichert wird nur die
  kanonische Form. Das Repo-Plugin bekommt die fünf alten Lint-Regeln, neu ein Verbot von
  `Date.now()` und `new Date()` ohne Argument, gültig in `packages/` und `apps/` außer `time`, und
  ein Verbot direkter Importe von `date-fns`, `dayjs` und `luxon`; Mantines Datumsfelder dürfen
  `dayjs` intern nutzen. Dateien mit `.tz.test.ts` laufen zusätzlich in Los Angeles. #91 bleibt wie
  geplant; das `time`-Issue übernimmt als Abnahmekriterium, dass der Helfer in `db` danach auf
  `time` aufsetzt. _Verworfen:_ 1:1 mit optionaler Uhr, #91 auf `time` warten lassen (bräche die
  Reihenfolge der Issue-Nummern), Temporal statt `Intl` (Polyfill auf Hermes). _Übernahme Datei für
  Datei überholt durch D279, das Verwerfen von Temporal durch D280, die Lint-Regeln durch D284, der
  Lauf in Los Angeles durch D285._
- **D149 (L3.7) Ergänzungen zu D148 aus einer unabhängigen Prüfung.** `TimeZone` wird ein geprüfter
  Typ mit Zod-Schema; die Auflösung aus D147 ist der einzige Weg dorthin, führt Aliasse auf einen
  festen Namen zurück und lehnt Offsets ab; die Auswahlliste nutzt immer die eigene Zonenliste.
  Gültig sind nur die Jahre 1000 bis 9999, geprüft in Konstruktoren und Parsern; `addDays` und
  `addMonths` nehmen nur ganze Zahlen. `instantRangeOf(span, zone)` kommt sofort,
  `splitIntervalByDay` und `groupByCalendarDay` mit dem ersten Nutzer, ein Cache nur nach Messung.
  Uhrzeiten sind nur `HH:MM`, Zod-Schemas prüfen nur die kanonische Form, das tolerante
  `parseInstant` bleibt für Import und Sync. Explizite Exporte statt `export *`; `now()` entfällt;
  `fixedClock` kommt nach `./testing`; `systemClock` bekommt einen eigenen Einstieg nur für den
  Zusammenbau der App. Die relative Anzeige rechnet mit Kalendertagen; ein `today`, das um
  Mitternacht umspringt, kommt mit der ersten Oberfläche nach `./react`. Die Lint-Regeln verbieten
  zusätzlich `new Date(y, m, d)`, Zeitangaben ohne Offset, `toLocale*String` und
  `Intl.DateTimeFormat` ohne `timeZone`. Tests: `fast-check` mit festem Seed, Parser als Tabellen
  gegen die Zod-Schemas, der Test mit der echten Uhr entfällt. Von der Wochenstart-Tabelle werden
  nur `de-DE` und `en-US` übernommen. _Zurückgestellt:_ doppelte Mitternacht in historischen
  kanadischen Zeitzonen, Prüfung auf Hermes. _Zweitnamen und eigene Zonenliste überholt durch D282,
  die Lint-Regeln durch D284._
- **D150 (L3.8) Tags hängen über Brücken der Module an Einträgen.** Tabelle `tags` mit Titel,
  optionaler Beschreibung und `modules` als JSON-Text mit Modul-IDs (leer heißt überall). Der Titel
  ist pro Space eindeutig, über eine in TypeScript berechnete Spalte `normalized_title` mit
  eindeutigem Index für nicht gelöschte Zeilen, weil SQLites `lower()` nur ASCII kennt. Jedes Modul
  besitzt seine Brücke (z. B. `project_tags`) mit eigener `id`, Fremdschlüssel auf `tags` und
  eindeutigem Paar; `tags` liefert eine gemeinsame Funktion zum Setzen und ein Contract-Kit in
  `./testing`. Module lesen nur Tag-IDs aus ihrer Brücke und filtern darüber, die Oberfläche löst
  Titel über einen Hook aus `tags/react` auf. Löschen ist weich und per Rückgängig samt Zuordnungen
  umkehrbar; eine entfernte und neu gesetzte Zuordnung belebt dieselbe Zeile wieder. Farbe, Icon,
  Hierarchie und Starter-Tags sind vorerst nicht dabei; Starter-Tags gehören zum Onboarding.
  _Folgen:_ Der Import führt doppelte Titel zusammen und meldet das; das Zusammenführen offline
  angelegter gleicher Tags gehört in die Sync-Phase. _Verworfen:_ generische Tabelle `taggings`
  (keine Prüfung der Verweise, siehe `habit_link`), `tags` besitzt alle Brücken (dreht die Richtung
  aus D143 um), `modules` weglassen (D9).
- **D151 (L3.9) Icon und Farbe an Entitäten, ohne neues Paket.** Zwei optionale Textspalten `icon`
  und `color`, nur wo nötig. `icon` hält einen Namen oder genau ein Emoji, unterschieden am
  Zeichentyp (Muster aus ADR 0009 der alten App). `color` ist der Name eines Farbsatzes und wird
  wie die Modulfarben dargestellt, nie als Farbwert; `theme` bekommt die fehlenden Farbsätze `red`,
  `cyan`, `lime` und `yellow` unter derselben Kontrastprüfung, die Akzentfarben-Auswahl bleibt.
  `icons` bekommt ein gemeinsames Verzeichnis aus Name und Icon für alle Entitäten, mit den alten
  Namen, und einen Einstieg ohne React mit Erkennung und Zod-Schema; `theme` liefert ein Schema für
  Farbsätze. Geschrieben werden nur bekannte Namen und genau ein Emoji; beim Lesen zeigt ein
  unbekannter Wert das Standard-Icon oder die neutrale Farbe. _Verworfen:_ alte Farben beim Import
  umbiegen (verändert Daten), Listen je Entität, eigene Spalte für Emoji.
- **D152 (L3.10) Abläufe über mehrere Module laufen über Brücken.** Ein Modul importiert ein anderes
  nur, wenn die Abhängigkeit fachlich zwingend und einseitig ist (das Zeitmodul darf `projects`
  importieren). Alles andere läuft über ein eigenes Brücken-Paket über den beteiligten Modulen,
  benannt nach seinem Zweck (etwa `billing`); es besitzt die Brückentabellen und benannten
  Operationen, die Module kennen es nicht. Jede Operation gibt es auch in einer Form, die eine
  laufende Transaktion annimmt; die Brücke öffnet sie, `tablesChanged` meldet alle betroffenen
  Tabellen zusammen. Eine Brücke liest über die Abfragen der Module, nie aus ihren Tabellen.
  Operationen öffnen keine Dialoge, sondern geben einen typisierten Konflikt mit Optionen zurück und
  werden mit der Wahl erneut aufgerufen. Schutzregeln (etwa „abgerechnet nicht löschen“) meldet die
  Brücke beim Zusammenbau der App an, sie laufen in derselben Transaktion. Schicht 3 baut keine
  Brücke: Sie liefert die Regeln als ADR und die Transaktions-Form in #32; die erste Brücke kommt
  mit Finanzen oder Kalender. _Verworfen:_ feste Reihenfolge aller Module ohne Brücken (Arbeit und
  Kalender brauchen sich gegenseitig), Ereignisse statt Aufrufe (keine Transaktion über beide
  Seiten), Brückentabellen im „größeren“ Modul (bringt die alten Zyklen zurück).
- **D153 (L3.11) Einstellungen des Kerns.** Die Region folgt vorerst über genau eine Funktion aus
  der Sprache (`de` → `de-DE`, `en` → `en-US`); eine eigene Regionen-Einstellung lässt sich dort
  später ergänzen. Der Wochenstart ist eine Synced Setting mit dem Wert „automatisch“, der der
  Region folgt. Die Standardwährung ist eine Synced Setting, die nur vorbelegt und nie umrechnet;
  sie kommt beim ersten Start aus der Region (`EUR`, `USD`), beim Import aus der alten App.
  Einstellungen, die Oberfläche und Datenprozess beide lesen (Zeitzone, „dem Gerät folgen“,
  Wochenstart, Standardwährung), werden in `contracts` deklariert, reine Oberflächen-Einstellungen
  bleiben in `apps/web`. `formatMoney` hält `Intl.NumberFormat`-Objekte pro Gebietsschema und
  Währung vor. Standard-Stundensatz und Rundung gehören in Schicht 4. _Verworfen:_ eigene
  Regionen-Einstellung sofort, Standardwährung fest auf `USD`, doppelte Deklaration.
- **D154 (L3.12) Schicht 3 wird in acht Arbeitspakete geschnitten, jedes wird einzeln gegrillt.**
  Spec #103 mit den Unter-Issues #104 bis #111; aus jedem entstehen nach seinem Grilling Spec und
  Teil-Tickets, wie bei #14 bis #20 und #30. Nur #107 (ADR und Glossar) braucht kein Grilling. Alle
  tragen `ready-for-agent` und `layer:3`, die erste Zeile verlangt das Grilling vor dem Bau. #34
  wird durch #109 ersetzt, weil es eine echte Space-Zeile aus #108 braucht und jedes Issue nur von
  kleineren Nummern abhängen darf. _Verworfen:_ 13 feine Tickets (dreizehn Grillings, teils für sehr
  kleine Teile), `needs-triage` statt `ready-for-agent` (nach jedem Grilling Umstellung von Hand),
  #34 behalten (bräche die Reihenfolge). _Label-Teil überholt durch D155._
