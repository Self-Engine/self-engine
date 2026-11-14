# Runde 41 (2026-11-14): Formular-Helfer (#213, verfeinert D188 und D251, führt D190 und D312 aus, verallgemeinert D294)

Grundlage: der Stand auf `main` nach #281.

- **Formular heute:** `placeholder-alpha` hält in seinem Bearbeiten-Drawer ein Textfeld mit drei
  Zuständen von Hand: Entwurf, Startwert und Konflikt-Text. Es kennt weder Enter zum Speichern noch
  eine Prüfung vor dem Absenden; „Speichern“ ist gesperrt, solange das Feld leer ist.
- **Operations-Hook:** Er gibt vier Ergebnisse als Werte zurück: Erfolg, Konflikt mit Feld und
  übersetztem Text, „nicht gefunden“ und unerwartet (D251). Eine ungültige Eingabe lehnt der
  Datenprozess ab; sie erscheint als unerwarteter Fehler mit der allgemeinen Meldung, nichts steht
  am Feld.
- **Zod im Start:** Der volle Build darf nicht in einem Start-Chunk liegen, der Build prüft das
  (D269, `apps/web/startup-rules.ts`). Dort steht auch die Messung: Der volle Build wiegt 85 KB,
  35 KB mehr als die Teile, die `zod/mini` braucht.
- **Drawer:** Ein Modul gibt seinen Bearbeiten-Drawer als `import()` an; er lädt erst beim Öffnen.
  Seine Verträge importiert die Oberfläche bisher nur als Typen.
- **`@mantine/form`:** Nicht installiert. Die Katalogversion 9.8.0 exportiert `schemaResolver`,
  das jedes Schema nach „Standard Schema“ annimmt, also auch Zod, ohne Zusatzpaket (geprüft an den
  Typen des Pakets). Mantine empfiehlt den Modus „uncontrolled“ seit 7.8 für alle Formulare: Der
  Entwurf liegt in einer Ref, ein Tastendruck zeichnet nichts neu. Ein Feld, das nur `value` und
  `onChange` kennt, braucht in diesem Modus eine Brücke.
- **Auswahlfelder:** Farbauswahl und das Feld für Icon und Emoji (#264) liegen in `ui` und kennen
  nur `value` und `onChange`. Das Emoji-Feld hält halb getippten Text schon heute selbst und gibt
  nur ein fertiges Emoji weiter.
- **Paketgrenzen:** `shell` importiert `data-client`, beide importieren `ui`. Ein Modul importiert
  alle drei. Mantines Datumsfelder dürfen `dayjs` intern nutzen (D148, ADR 0027).

- **D317 Ein Formular prüft seine Eingabe mit dem Eingabe-Schema des Vertrags; der Datenprozess
  prüft weiter jede Eingabe (verfeinert D188).** Der Drawer lädt den Vertrag seines Moduls und
  damit Zods vollen Build, wenn er sich öffnet. Der Satz „der Renderer prüft nie“ aus D188 gilt
  für Daten am Port, vor allem für Ausgaben und Listen, an denen er gemessen wurde. Ein Formular
  prüft für die Rückmeldung; die Stelle, die entscheidet, bleibt der Datenprozess (D307).
  _Gründe:_ Jede Regel steht an einer Stelle. Ändert sich eine Grenze im Vertrag, folgen Formular
  und Datenprozess zugleich. Eine Meldung verschwindet beim Korrigieren ohne Umweg. _Preis:_ Der
  erste Drawer einer Sitzung lädt Zods vollen Build und den Vertrag von der Platte; die Zeit wird
  gemessen (D326). _Verworfen:_ Das Formular prüft nicht, und der Datenprozess antwortet mit den
  Verstößen (kostet lokal etwa eine Millisekunde, braucht aber einen dritten erwarteten Fehler am
  Port, den D190 verworfen hat, und in einer Web-Version eine Netzwerk-Runde je Prüfung). Eigene
  Regeln je Formular (jede Regel stünde zweimal und liefe auseinander).
- **D318 Der Helfer baut auf `@mantine/form` im Modus „uncontrolled“, und Module importieren nur
  den Helfer.** Der Entwurf liegt außerhalb des React-Zustands. Tippen in einem Feld zeichnet kein
  anderes Feld neu; eine abhängige Anzeige wie die Dauer aus Beginn und Ende abonniert nur ihre
  Felder. Kein Modul importiert `@mantine/form` selbst (D325). _Gründe:_ Mantine zuerst: Die Felder
  von Mantine passen ohne Verdrahtung, und Listen im Formular, die Finanzen für Rechnungspositionen
  braucht, bringt das Paket mit. Weil Module nur den Helfer kennen, bleibt der Unterbau
  austauschbar. _Preis:_ Der Modus hat Fallstricke, die der Helfer einmal für alle verbirgt: Der
  zuletzt gelesene Entwurf ist nicht von selbst aktuell, ein per Code gesetzter Wert braucht einen
  Schlüssel am Feld, und ein Feld mit nur `value` und `onChange` braucht eine Brücke. In einer
  nativen App läuft Mantine nicht; sie bekäme ein eigenes Paket mit derselben Schnittstelle zu den
  Modulen. _Verworfen:_ der Modus „controlled“ (jeder Tastendruck zeichnet das ganze Formular samt
  Icon- und Farbauswahl neu); TanStack Form oder React Hook Form (eine weitere Abhängigkeit, jedes
  Mantine-Feld von Hand verdrahtet); ein eigener Hook (Listen, verschachtelte Felder und
  Änderungs-Erkennung wären selbst zu bauen und zu pflegen).
- **D319 Der Entwurf eines Formulars hat die Form der Eingabe, und jedes Feld nutzt die Auswahl
  seiner Art.** Drei Regeln:
  1. Der Entwurf trägt dieselben Feldnamen und Werte wie die Eingabe der Operation; jedes Feld darf
     noch leer sein. Eine Meldung des Schemas landet deshalb ohne Zuordnung am gleichnamigen Feld.
  2. Was halb getippt ist, hält das einzelne Feld selbst und gibt erst einen fertigen Wert ans
     Formular. Ein Feld, das Text hält, der kein Wert ist, zeigt eine Meldung, sperrt das Speichern
     und zählt als ungespeicherte Änderung. Der Helfer stellt das für jedes Feld sicher.
  3. Jedes Feld nutzt die passende Auswahl: Datumsauswahl für ein Datum, Uhrzeitauswahl für eine
     Uhrzeit, die Auswahl für Icon und Farbe. Freies Tippen bleibt möglich, ist aber nie der
     einzige Weg (Vorgabe des Owners).

  Daraus folgt die Aufteilung: Was aus Tastendrücken einen Wert macht, gehört ins Feld. Was eine
  Regel über die Daten ist, gehört in den Vertrag und gilt damit auch für den Import und einen
  späteren Assistenten. Ein Feld darf an zwei Werte gebunden sein, etwa „Datum, Beginn, Ende“ an
  `started_at` und `ended_at`. _Gründe:_ Ohne Regel 2 gäbe ein Feld mit „25:00“ keinen Wert
  weiter, und das Speichern schriebe unbemerkt den alten. _Preis:_ Die Felder tragen mehr, ein
  Zeitpunkt-Feld etwa die Zeitzone und den halb getippten Text. _Verworfen:_ ein Entwurf in freier
  Form mit einer Umrechnung und einer Zuordnung der Meldungen je Formular (mehr Code je Formular,
  und die Zuordnung kann falsch sein).
- **D320 Der Helfer bringt die Texte der Prüfmeldungen je Art des Verstoßes mit, das Modul ergänzt
  das Besondere (führt D190 aus).** Der Helfer kennt Texte wie „Pflichtfeld“ und „Höchstens 200
  Zeichen“; die Zahl kommt aus dem Verstoß. Für alles Unbekannte gibt es den Auffang „Ungültiger
  Wert“, nie einen Rohtext von Zod. Ein Modul darf den Text für ein Feld ersetzen. Eine Regel über
  mehrere Felder trägt im Vertrag einen Grund wie `end_before_start`, und das Modul legt dafür
  einen Text fest, wie bei Konflikten (D251). Fehlt er, erscheint der Auffang, und ein Test
  schlägt fehl. Die Texte sind Beschreibungen, die erst bei der Anzeige übersetzt werden, und
  folgen einem Sprachwechsel bei offenem Formular. _Gründe:_ Ein Pflichtfeld heißt in jedem Modul
  gleich, und der Text folgt der Regel, wenn sich eine Grenze ändert. _Preis:_ Die allgemeinen
  Sätze sind weniger persönlich als handgeschriebene, bis ein Modul sie ersetzt. _Verworfen:_ ein
  Text je Regel und Feld im Modul (viele gleiche Sätze, die auseinanderlaufen); Text im Schema
  (trüge Text und Übersetzung in den Datenprozess, gegen D190); Zods eigene Übersetzungen (für
  Entwickler geschrieben).
- **D321 Ein Formular prüft erst beim Speichern und danach bei jeder Änderung; „Speichern“ ist
  beim Bearbeiten gesperrt, solange nichts geändert ist.**
  - **Prüfen:** Vor dem ersten Speichern erscheint keine Meldung. Nach einem Fehlversuch prüft das
    Formular bei jeder Änderung das Ganze neu; eine Meldung am Ende verschwindet also auch, wenn
    der Beginn korrigiert wird. Das gilt beim Erstellen und beim Bearbeiten. Die eine Ausnahme ist
    halb getippter Text, den das Feld beim Verlassen meldet (D319).
  - **Knopf beim Erstellen:** immer klickbar. Ein Klick mit Fehlern ruft keine Operation auf, zeigt
    alle Meldungen und setzt den Cursor ins erste betroffene Feld. Ein Formular kann mit seinen
    Vorgaben schon gültig sein.
  - **Knopf beim Bearbeiten:** gesperrt, solange nichts geändert ist (Vorgabe des Owners).
  - **Ein Begriff von „geändert“:** Der Knopf und die Rückfrage „Änderungen verwerfen?“ fragen
    dieselbe Stelle. Verglichen werden die Werte mit dem gespeicherten Stand, nicht ob ein Feld
    berührt wurde. Wer ein Zeichen tippt und es wieder löscht, hat nichts geändert.
  - **Konflikt:** Er erscheint nach dem Aufruf am Feld und verschwindet, sobald sich das Feld
    ändert, wie heute.

  _Laufzeit:_ Vor dem ersten Speichern kostet Tippen keine Prüfung. Der Vergleich für „geändert“
  läuft bei jeder Änderung; der Knopf zeichnet sich nur neu, wenn „geändert“ umschlägt. _Preis:_
  Einen Fehler sieht man erst beim Speichern. _Verworfen:_ Prüfen beim Verlassen eines Feldes (der
  Titel wäre rot, weil jemand mit Tab daran vorbeiging); Prüfen von Anfang an; ein Knopf, der grau
  ist, bis alles gültig ist (er sagt nicht, welches Feld fehlt).
- **D322 Der Helfer übernimmt Ablauf und Rahmen eines Formulars, das Modul schreibt die Felder
  (verfeinert D251).** Das Modul nennt die Operationen und schreibt seine Felder als Bausteine.
  Vom Helfer kommt:
  - **Absenden:** prüfen, die Operation aufrufen, währenddessen Felder und Knopf sperren, ein
    zweites Absenden verhindern.
  - **Ergebnisse:** Erfolg schließt den Drawer. Ein Konflikt steht am Feld, der Drawer bleibt
    offen. „Nicht gefunden“ schließt ihn. Bei einem unerwarteten Fehler bleibt er offen, und die
    Eingaben bleiben stehen.
  - **Ungespeicherte Änderungen:** die Anmeldung beim Drawer.
  - **Rahmen:** „Speichern“ und „Abbrechen“, dazu ein Platz für Aktionen des Moduls wie „Löschen“
    oder „Archivieren“.
  - **Tasten:** Enter in einem einzeiligen Feld speichert, Strg/Cmd+Enter von überall. Escape
    bleibt bei der Hülle.

  Ein Formular außerhalb des Drawers, etwa die Notiz am laufenden Timer, nutzt denselben Ablauf
  ohne den Rahmen. _Gründe:_ Der Ablauf steht einmal und ist getestet; kein Modul kann die Sperre
  während des Speicherns vergessen. _Preis:_ Ein Formular, das vom Ablauf abweichen will,
  erweitert den Helfer, statt ihn zu umgehen. _Verworfen:_ nur der Zustand vom Helfer (rund dreißig
  Zeilen Ablauf je Formular, von Hand); ein Formular als Daten, das der Helfer ganz zeichnet
  (jedes Sonderfeld bräuchte eine Erweiterung des Helfers).
- **D323 Ein Bearbeiten schickt nur die geänderten Felder, und Felder, die eine Regel verbindet,
  reisen zusammen (verallgemeinert D294).** Die Eingabe trägt die Id und was sich geändert hat.
  Ein Feld, das fehlt, bleibt unberührt; ein Feld mit „leer“ wird geleert. Geprüft und geschrieben
  wird nur, was mitkommt. Ändert sich Beginn oder Ende eines Zeiteintrags, schickt das Formular
  beide, damit Formular und Datenprozess die Regel „Ende nach Beginn“ mit demselben Schema prüfen,
  ohne dass der Datenprozess erst die gespeicherte Zeile liest. Erstellen schickt alle Felder.
  Archivieren und Löschen bleiben benannte Operationen (D306) und sind nie ein Feld. Das Muster
  gilt für den Vertrag jedes Moduls; `projects` legt die Vorlage fest. _Gründe:_ Ein Icon, das
  diese Version nicht kennt, reist beim Umbenennen nicht mit und bleibt stehen (D294). Ein
  Formular mit veraltetem Stand schreibt keinen alten Titel zurück, wenn nur die Farbe geändert
  wurde. Eine Änderung, die nur ihre eigenen Felder nennt, ist die Voraussetzung dafür, im Sync
  zwei Änderungen am selben Eintrag zusammenzuführen. _Preis:_ Die Operation baut ihr Schreiben
  aus den Feldern, die mitkommen, und die Contract-Tests decken die Teilmengen ab, die eine Rolle
  spielen. „Fehlt“, „leer“ und „Wert“ müssen im Vertrag getrennt sein. _Verworfen:_ immer der
  ganze Eintrag (ein unbekanntes Icon ließe das Umbenennen scheitern); eine Operation je Feld
  (vier Aufrufe für ein Formular).
- **D324 Ändert sich der Eintrag bei offenem Formular, folgen unberührte Felder, und geänderte
  bleiben.** Ein Feld, das nicht angefasst wurde, zeigt den neuen gespeicherten Wert. Ein
  geändertes Feld behält seinen Text, und beim Speichern gewinnt er. „Geändert“ wird gegen den
  neuen Stand verglichen: Speichert jemand anderes denselben Wert, gilt das Feld nicht mehr als
  geändert. Wird der Eintrag gelöscht, bleibt das Formular mit dem getippten Text stehen, zeigt
  einen Hinweis und sperrt „Speichern“; wird das Löschen rückgängig gemacht, ist es wieder normal.
  Kein Hinweis, wenn dasselbe Feld von zwei Seiten geändert wurde: Das gehört zur Konfliktfrage
  des Syncs. _Gründe:_ In Schicht 4 ist der Fall selten, mit einem Assistenten, der über den
  lokalen MCP-Server schreibt (D85), und mit dem Sync wird er alltäglich. Der Helfer ist das
  Fundament jedes Formulars; ein späterer Umbau träfe alle Module zugleich. _Laufzeit:_ Die
  Abfrage lädt bei einer Änderung ohnehin neu; neu gezeichnet werden nur Felder, deren Wert sich
  ändert. _Preis:_ Der Abgleich je Feld ist der heikelste Teil des Helfers. Ein Feld, in dem der
  Cursor steht, darf beim Nachziehen weder Cursor noch Text verlieren; jeder Fall bekommt einen
  Test. _Verworfen:_ der Stand vom Öffnen (zeigt veraltete Werte, während die Liste dahinter die
  neuen zeigt); eine Rückfrage „neu laden?“ (unterbricht mitten im Tippen). Heute ersetzt „Eintrag
  nicht gefunden“ das Formular, und der getippte Text ist weg.
- **D325 Der Helfer liegt in einem eigenen Paket `forms`, und nur dieses Paket importiert
  `@mantine/form` und `@mantine/dates`.** `forms` liegt über `shell`, `data-client` und `ui`;
  Module importieren es. Die Grenzprüfung lehnt jeden anderen Import der beiden Bibliotheken ab,
  wie bei den Icon-Bibliotheken. Die Auswahlfelder bleiben in `ui` und sind dort ohne Formular
  nutzbar; `forms` enthält die Brücke, die sie an ein Formular bindet. Die Start-Prüfung aus D269
  bekommt `@mantine/form` und `@mantine/dates` als Einträge, die nie im Start liegen dürfen.
  _Preis:_ ein weiteres Paket mit eigenem Eintrag in den erlaubten Importen. _Verworfen:_ in
  `shell` (Start-Code und schon groß); in `ui` (darf weder `shell` noch `data-client` kennen); in
  `data-client` (hinge an Formularfeldern und käme an den Drawer trotzdem nicht heran).
- **D326 Umfang und Abnahme von #213.**
  - **Geliefert wird:** der Helfer aus D317 bis D324; vier gebundene Felder (Text, langer Text,
    das Feld für Icon und Emoji, Farbe); ein Beispielformular als Story mit erfundenem Vertrag,
    das die vier Felder, eine Regel über zwei Felder und einen Konflikt abdeckt; der Umzug des
    Formulars von `placeholder-alpha` auf den Helfer, dessen Tests gegen den echten Datenprozess
    laufen; ein Leitfaden unter `docs/development/`.
  - **Nicht geliefert wird:** Felder für Datum und Uhrzeit und die Projekt-Auswahl (mit
    `time-tracking`, #275, weil sie an der Zeitzone aus #110 hängen); Listen im Formular (mit dem
    ersten Modul, das sie braucht); Prüfungen, die den Datenprozess fragen (ein vergebener Name
    bleibt ein Konflikt der Operation).
  - **Abnahme:** Jedes Szenario aus D319 bis D324 ist ein Test. Eine Story zählt, dass Tippen in
    einem Feld kein anderes Feld neu zeichnet. Die Startgröße wächst nicht, und die Start-Prüfung
    kennt die neuen Einträge (D325). Die Zeit vom Klick bis zum sichtbaren Formular wird beim
    ersten Öffnen einer Sitzung in der gebauten App gemessen und steht im Pull Request; liegt sie
    über 100 ms, entscheidet der Owner vor dem Zusammenführen.

  _Gründe:_ Ohne den Umzug von `placeholder-alpha` träfe der Helfer den echten Datenprozess zum
  ersten Mal in `projects`, und ein Fehler im Fundament hielte das erste sichtbare Modul auf. Mit
  Datum und Uhrzeit wartete das Paket auf #109 und #110, und `projects` mit ihm.

## Später, mit Vorschlag

Diese Fragen gehen mit ihrer vorgeschlagenen Antwort in die Spezifikation von #213. Wer baut, darf
anders entscheiden und nennt es im Pull Request.

- **Scheiben:** vier. Kern mit Prüfung und Texten; Ablauf mit Rahmen und Tasten; Nachziehen bei
  Änderungen von außen; Umzug von `placeholder-alpha` mit Leitfaden und Messungen.
- **Gründe im Vertrag:** Eine Regel über mehrere Felder nennt ihren Grund und ihr Feld im Schema.
  Wie TypeScript oder ein Test einen Text je Grund verlangt, klärt der Bau; der Auffang aus D320
  gilt in jedem Fall.
- **Abschneiden und „leer“:** Leerzeichen am Rand schneidet das Eingabe-Schema ab; D188 verbietet
  Umwandlungen nur in Ausgabe-Schemas. Ein leeres Textfeld für einen freiwilligen Wert gibt „leer“
  weiter, nie einen leeren Text (D294, Regel 4).
- **Änderung ohne Felder:** Das Formular schickt sie nie (D321). Ob die Operation sie ablehnt oder
  nichts tut, legt `projects` mit der Vorlage fest.
- **Glossar:** Begriffe für den Entwurf, die Prüfung vor dem Absenden und den Unterschied zum
  Konflikt entstehen beim Bau, wie es der Arbeitsablauf vorsieht.
- **ADR:** Die Regel aus D317 ändert, was ADR und Leitfaden zum Port-Muster über das Prüfen sagen;
  sie werden beim Bau angepasst.

## Vorgemerkt

- **Einstellungsbereich:** Er hat eigene Eingaben. Ob er auf den Helfer umzieht, ist eine eigene
  Frage nach Schicht 4.
- **Zwei Änderungen am selben Feld:** ein Hinweis am Feld, mit der Konfliktfrage des Syncs.
- **Datum und Uhrzeit:** welche Auswahl das Zeitformular bekommt und ob „Datum, Beginn, Ende“ ein
  Feld ist, klärt das Grilling von `time-tracking`.
