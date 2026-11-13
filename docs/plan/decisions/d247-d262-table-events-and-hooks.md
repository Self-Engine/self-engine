# Runde 33 (2026-11-13): Tabellenmeldung und Hooks (#33, verfeinert D92, D190, D192–D194, D196, D240, D245)

Vor den Einzelfragen wurde die Bauweise noch einmal ganz geprüft, unabhängig vom Stand des Codes.
Zahlen aus dem Durchstich (Runde 27) sind als gemessen genannt; alles andere ist als nicht gemessen
markiert und wird beim Bau gemessen.

- **D247 Die Grundlage bleibt „fragen und neu laden“; eine Kopie in der Oberfläche gibt es nur
  gezielt pro Ansicht (bestätigt D92).** Verglichen wurden vier Bauweisen: (1) Daten in SQLite im
  Datenprozess, die Oberfläche stellt benannte Abfragen und lädt nach einer Meldung neu; (2) eine
  Kopie der Zeilen im Speicher der Oberfläche, die dort rechnet und Schreiben vorgreift (TanStack
  DB, Linear); (3) ein Ereignis-Protokoll, aus dem SQLite abgeleitet wird (LiveStore); (4) eine
  Sync-Engine, die Tabellen und Schreibwege vorgibt. Für diese App trägt (1): Die Daten wachsen
  über Jahre und werden viel summiert, das ist die Stärke von SQLite mit Indizes; der Speicher der
  Oberfläche wächst nicht mit; jede Sync-Engine kann später andocken (D89); Module bleiben über
  ihren Port getrennt (D241). Gemessen kostet das Holen 2 ms bei 1.000 und 12 ms bei 10.000 Zeilen,
  die spürbare Zeit liegt im Zeichnen. Die Schwäche von (1) ist direktes Anfassen (Ziehen, Häkchen,
  Zeitblöcke verschieben); dort darf eine einzelne Ansicht Bauweise (2) hinter ihrem Hook bekommen
  (D194, D249). _Neu prüfen, wenn:_ die gewählte Sync-Engine eine Kopie in der Oberfläche
  voraussetzt, oder sich nach #33 normale Formulare und Listen träge anfühlen. _Nicht gemessen:_
  TanStack DB in dieser App, weder Größe noch Geschwindigkeit. _Verworfen:_ (2) als Grundlage (der
  Port bräuchte einen allgemeinen Zeilen-Zugang statt benannter Abfragen, Joins liefen an den
  Lese-Bausteinen vorbei, jede Operation gäbe es zweimal); (3) und (4) (legen Datenmodell oder
  Engine sofort fest).
- **D248 Eine Abfrage erklärt die Tabellen, die sie liest, auf der Datenseite (verfeinert D92,
  D193).** Die Erklärung steht neben der Abfrage-Funktion. Das Kit führt die Abfrage aus und
  schlägt fehl, wenn sie eine nicht erklärte Tabelle liest. Der Datenprozess schickt dem Renderer
  bei jedem Verbinden einmal die Liste „Abfrage → Tabellen“; ein Hook nennt keine Tabellennamen.
  Die Liste sagt nebenbei, welche Einträge Abfragen sind: Der Baustein meldet im Dev-Build, wenn
  ein Abfrage-Hook auf einer Operation liegt. Feste Antworten (D255) brauchen die Liste nicht.
  _Preis:_ ein Feld pro Abfrage und einmal pro Verbindung eine kleine Liste, geschätzt wenige
  Kilobyte bei hundert Abfragen, nicht gemessen. _Verworfen:_ Tabellen von Hand im Hook (ein
  vergessener Name lässt eine Liste mit Join still veralten, und kein Test merkt es); Tabellen im
  Vertrag (oRPC typisiert `meta` nicht pro Eintrag, und der Renderer müsste den Vertrag zur
  Laufzeit laden); jede Antwort trägt ihre Tabellen mit (ändert die Form jeder Antwort).
- **D249 Nur ein gemeinsamer Baustein kennt TanStack Query (verfeinert D92, D196).** Er liegt als
  React-Einstieg im Paket `data-client`. Ein Modul schreibt pro Hook, welcher Eintrag seines
  Vertrags gemeint ist und ob er Abfrage oder Operation ist; Schlüssel, Neuladen und Fehlerwege
  sind für alle gleich. Eine Lint-Regel verbietet den direkten Import von TanStack Query in
  Modulen, wie bei den Tastenkürzeln. Die Hooks eines Moduls liegen im Modul neben seinen
  Ansichten und werden nur freigegeben, wenn ein anderes Modul sie braucht (D150). _Preis:_ Was
  der Baustein nicht kann, wird dort einmal ergänzt statt im Modul gelöst. Laufzeit: eine dünne
  Hülle, kein messbarer Unterschied erwartet, nicht gemessen. _Verworfen:_ TanStack Query direkt
  in Modulen (jedes Modul entschiede Schlüssel und Fehlerwege selbst, und D247 ließe sich nicht
  mehr hinter dem Hook umsetzen).
- **D250 Eine Antwort gilt, bis eine Tabellenmeldung ihre Tabellen trifft (verfeinert D193).** Ist
  die Abfrage sichtbar, lädt sie sofort neu, und der alte Stand bleibt bis zur Antwort stehen. Ist
  sie nicht sichtbar, wird sie nur markiert und lädt beim nächsten Anzeigen, wobei kurz der alte
  Stand zu sehen ist. Nach jedem Neuverbinden mit dem Datenprozess wird alles markiert, weil
  Meldungen verloren gegangen sein können. Fenster-Fokus und Zeitablauf lösen nichts aus.
  Antworten, die niemand mehr anzeigt, verfallen nach 5 Minuten. _Preis:_ Die Regel verlässt sich
  darauf, dass jede Änderung gemeldet wird (D243, D248). Speicherbedarf der 5 Minuten: nicht
  gemessen. _Verworfen:_ die Voreinstellungen von TanStack Query (laden bei jedem Anzeigen und bei
  Fokus neu, obwohl der Datenprozess Bescheid sagt); eine Ladeanzeige beim Anzeigen markierter
  Abfragen (bei wenigen Millisekunden stört sie als Flackern).
- **D251 Erwartete Fehler einer Operation sind Rückgabewerte (verfeinert D190).** Der
  Operations-Hook wirft für „Konflikt“ und „nicht gefunden“ nichts, sondern gibt sie zurück. Bei
  einem Konflikt bekommt das Formular den Grund; das Modul legt pro Grund einen übersetzten Text
  und ein Feld fest, und TypeScript verlangt einen Text für jeden Grund des Vertragseintrags. Der
  Drawer bleibt offen, es kommt keine Benachrichtigung. Bei „nicht gefunden“ zeigt der Baustein
  eine Benachrichtigung, und das Modul schließt den Drawer; ein Modul darf den Standard ersetzen.
  Bei einem unerwarteten Fehler zeigt der Baustein eine allgemeine Benachrichtigung über
  `notifyError()`, der Drawer bleibt offen. Der Hook meldet, solange die Operation läuft, damit
  der Knopf sich gegen doppeltes Absenden sperrt. _Nicht hier:_ ein allgemeiner Formular-Helfer
  mit Eingabeprüfung vor dem Absenden; er wird ein eigenes Ticket, sobald das erste echte Modul
  Formulare mit mehreren Feldern hat. Bis dahin prüft der Datenprozess jede Eingabe (D188).
  _Preis:_ ein Text pro Konflikt-Grund von Hand. _Verworfen:_ geworfene Fehler (ein Modul kann sie
  versehentlich übergehen).
- **D252 `placeholder-alpha` bekommt eine echte Tabelle, die überall ausgeliefert wird (verfeinert
  D240).** Die Liste startet leer, der Befehl für den Beispiel-Eintrag legt echte Zeilen an, und
  der absichtlich fehlschlagende Eintrag wandert in eine Story mit fester Antwort. So prüft der
  Smoke-Test der gebauten App den Weg, den echte Module gehen. Die Tabelle entsteht in jeder
  Datenbank, die diese Version startet; vor dem Ersatz der Platzhalter kommt kein Stable-Release.
  Der Nightly-Takt ist am 2026-11-13 abgestellt (Repo-Variable `NIGHTLY_SCHEDULE_ENABLED`), von
  Hand lässt sich weiter eine Nightly bauen; damit startet die gepackte App nicht mehr automatisch.
  _Offen:_ Wie ein Modul samt Tabelle verschwindet, klärt die Schicht, die den Platzhalter
  ersetzt. _Preis:_ eine Migration mehr beim ersten Start, nicht gemessen. _Verworfen:_ die
  Datenseite des Platzhalters nur im Dev-Build (die gebaute App hätte kein Modul auf dem Port, und
  es bräuchte eine Weiche, die es sonst nicht gibt).
- **D253 #33 baut den Abfrage-Hook und den Operations-Hook; der Seiten-Hook entsteht in #137
  (verfeinert D194).** Der Abfrage-Hook deckt Fenster, kleine Menge und einzelne Zeile ab.
  Nachladen, Verwerfen früher Seiten und das Neuladen geladener Seiten hängen an der Liste, die
  nur Sichtbares zeichnet, und werden mit ihr entworfen und gemessen. `placeholder-alpha` nutzt
  eine kleine Menge. _Preis:_ #137 wird größer, und bis dahin zeigt keine Ansicht mehr als ein
  Fenster oder eine kleine Menge. _Verworfen:_ der Seiten-Hook jetzt (ein Hook ohne Nutzer wird
  nach Vermutung entworfen).
- **D254 Vier Begriffe kommen ins Glossar.** _Operation_ (de: Operation): ein Eintrag eines Ports,
  der Daten ändert, ganz oder gar nicht. _Query_ (de: Abfrage): ein Eintrag eines Ports, der liest
  und nichts ändert. _Table Change_ (de: Tabellenmeldung): die Nachricht des Datenprozesses,
  welche Tabellen ein Commit geändert hat. _Fixed Answer_ (de: feste Antwort): was ein
  Port-Eintrag in einer Story oder einem Komponenten-Test liefert, ohne Datenprozess. Beim
  _Command_ steht „operation“ künftig nur noch als zu vermeidendes Wort für einen Befehl; ein
  Befehl kann eine Operation aufrufen. „Hook“ und „Zwischenspeicher“ sind Wörter der Umsetzung
  und kommen nicht ins Glossar. Die Einträge entstehen beim Bau.
- **D255 Feste Antworten werden gegen Typ und Schema des Vertrags geprüft (verfeinert D196).** Der
  Helfer prüft jede feste Antwort beim Rendern gegen das Ausgabe-Schema; ein Konflikt darf nur
  einen Grund nennen, den der Vertragseintrag aufzählt. Ruft eine Ansicht einen Eintrag auf, für
  den nichts festgelegt ist, schlägt die Story fehl und nennt ihn. „Laden“ hält die Story, solange
  sie will. Das Schema wird nur im Story- und Test-Code geladen. _Preis:_ Stories brauchen
  vollständige, gültige Beispieldaten; ein Beispiel-Erzeuger pro Modul hilft. Die Stories-Stufe
  wird etwas langsamer, nicht gemessen. _Verworfen:_ nur der Typ (eine Id in falscher Form oder
  ein ungültiger Zeitpunkt rutschte durch, und die Story bewiese nichts).
- **D256 Der Zeichen-Test im Gate: eine geänderte Zeile zeichnet genau eine Zeile neu (verfeinert
  D194).** Aufbau: 1.000 Einträge, gezeichnet wie in `placeholder-alpha`, im Chromium der
  Stories-Stufe; ein Eintrag wird umbenannt, die Tabellenmeldung kommt, die Liste lädt neu.
  Grenze: genau eine Zeile zeichnet neu, dazu einmal die Liste selbst; die Zahl ist fest, kein
  Prozentwert. Dafür behalten unveränderte Zeilen nach dem Neuladen dasselbe Objekt, und eine
  Zeile ist eine eigene Komponente, die ihre Zeile als Ganzes bekommt; die Regel steht im
  Leitfaden. Der Test prüft Baustein und Vorlage, nicht jede Liste jedes Moduls; `pnpm renders`
  bleibt zum Nachmessen. _Preis:_ Der Vergleich von alter und neuer Antwort wächst mit ihrer
  Größe, bei 1.000 Zeilen um eine Millisekunde erwartet, nicht gemessen; der Bau misst es.
- **D257 Abfragen zeigen die vorhandenen Zustands-Bausteine.** Erstes Laden: `LoadingState`, erst
  nach 200 ms. Neuladen: der alte Stand bleibt, ohne Ladeanzeige. Unerwarteter Fehler beim ersten
  Laden: `ErrorState` mit „Erneut versuchen“, ohne Benachrichtigung. Scheitert ein Neuladen,
  während Daten da sind: Der alte Stand bleibt, und eine Benachrichtigung sagt, dass er veraltet
  sein kann. Ohne Datenprozess warten Abfragen auf die neue Verbindung; den Zustand zeigt die App
  schon. Ein gemeinsamer Baustein in `@self-engine/ui` ordnet Zustand und Anzeige zu.
- **D258 Die neue Start-Grenze ist die gemessene Größe plus 6 %, aufgerundet auf volle KiB
  (verfeinert D192).** Dieselbe Regel wie bei der heutigen Grenze (851.968 Bytes). Die Messung
  steht im Pull Request und in `docs/development/performance.md`; die Zeit bis zur ersten Antwort
  im Smoke-Test zeigt, ob der Start spürbar länger wird.
- **D259 #33 räumt zwei Reste aus #32 ab (löst das „Offen“ in D245).** Der Modulname kommt in die
  Blätter-Marke, damit gleichnamige Seiten-Listen zweier Module ihre Marken nicht mehr gegenseitig
  annehmen. `windowList` und `smallSetList` leiten ihren Eingabe-Typ aus dem Vertrag ab. _Nicht
  hier:_ der Läufer für Brücken über mehrere Module (kommt mit der ersten Brücke, D152); die
  Grenzen der Seiten-Liste bei Sortierspalten und Reihenfolge (#137).
- **D260 Ein Speicher-Modul wird in zwei Schritten definiert (verfeinert D259).**
  `defineStorageModule({ name, contract, rowMap, migrations, conflicts? }).entries({ … })`: Erst
  stehen Name, Vertrag, Zeilen-Karte und Migrationen fest, dann werden die Einträge geprüft. So
  leiten `pageList`, `windowList` und `smallSetList` `tx` und `input` aus dem Vertrag ab, auch eine
  Seiten-Liste mit erweiterter Eingabe (`pageInputSchema.extend({ q })`). In einem einzigen
  Objekt prüft TypeScript den Aufruf eines Bausteins, bevor es den Vertrag aus demselben Objekt
  abgeleitet hat; `input` war dort `unknown`, und `pageList` fiel nur auf `PageInput` zurück.
  _Preis:_ keiner zur Laufzeit; jede Moduldefinition bekommt einen zweiten Aufruf.
  _Verworfen:_ die Bausteine für Fenster und kleine Mengen streichen und die Einträge als
  Objekt schreiben (`pageList` bliebe ohne Ableitung); den Vertragseintrag an den Baustein geben
  (`tx` bliebe von Hand typisiert).
- **D261 Jeder Befehl bekommt den Port-Zugang in seinem Kontext (verfeinert D174, D249).** Ein
  Befehl ruft eine Operation auf, läuft aber außerhalb von React und kann keinen Hook nutzen. Darum
  trägt der Kontext jeder Art (`page`, `open`, `input`) das Feld `data`: denselben Port-Zugang, den
  die App dem `DataProvider` gibt, zusammen mit dessen Weg für Benachrichtigungen
  (`useDataAccess()` → `{ access, notify }`, D265); die Hülle reicht beides an jeden Start weiter,
  ein späterer Agent ebenso. Der Baustein bietet neben dem Operations-Hook dessen Form als Funktion
  (`portHooks(…).run(eintrag, behandlung)` → `(daten, eingabe) => Ergebnis`), aus demselben Vertrag
  typisiert, mit demselben Ergebnis und denselben Standard-Benachrichtigungen über denselben Weg;
  Hook und Funktion teilen sich den Code dafür. Stories und Tests geben feste Antworten in dasselbe Feld. Die Hülle
  typisiert das Feld über einen reinen Typ-Import von `data-client` (Kante in `ALLOWED_IMPORTS` und
  `package.json`). _Preis:_ ein Feld mehr im Befehls-Kontext; zur Laufzeit nichts. _Verworfen:_ ein
  globaler Zugang des zuletzt eingehängten Providers (zwei Provider auf einer Seite überschreiben
  sich, ein Befehl vor dem ersten Provider hätte nichts); Befehle rufen noch keine Operationen
  (D252 wäre nicht erfüllt, die Frage käme mit dem ersten echten Modul wieder); das Feld als
  `unknown` mit Prüfung zur Laufzeit.
- **D262 Die Gruppen von `placeholder-alpha` filtern nicht mehr (verfeinert D252).** Die Kunden
  „Studio“ und „Garten“ bleiben als Vorlage für eine Suche, die sich die Ansichten eines Moduls
  teilen (`sharedSearch`); eine Gruppe ändert nur die Adresse und markiert sich. Echte Einträge
  gehören keinem Kunden, also zeigt die Liste alle. _Preis:_ In der App sieht man nach einem Klick
  auf eine Gruppe keine andere Liste. _Verworfen:_ nach Namensanfang filtern (eine erfundene Regel
  über Daten); die Gruppen entfernen (kein Modul zeigte mehr Gruppen, die App-Stories dazu müssten
  in die Hülle wandern).
