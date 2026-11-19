# Runde 46 (2026-11-20): Einstellungen in der Datenbank, Zeitzone und Wochenstart (#109 und #110, ändert D153, ergänzt D113, D147 und D342, ändert die Wochen-Abfrage aus Runde 45)

Grundlage: der Stand auf `main` nach #331.

- **Store heute:** Der Einstellungs-Store lebt in der Seite. Er lädt einmal vor dem ersten Render
  und liest danach synchron aus einem Abbild im Speicher (ADR 0010). Beide Geltungen,
  synchronisiert und Gerät, liegen in `localStorage`.
- **Datenprozess heute:** Er kennt keine Einstellungen. Der Kontext einer Operation trägt Uhr,
  Space und Schutzregeln. Beim Start führt er die Migrationen aus und stellt den persönlichen
  Space sicher, bevor er den ersten Aufruf beantwortet.
- **Start heute:** Die erste Antwort des Datenprozesses kam in den Messungen im Median nach 142
  bis 205 ms, im schlechtesten Lauf nach 379 ms; die Hülle erscheint nach 165 ms
  (`docs/development/performance.md`). Der Sprachkatalog lädt erst nach den Einstellungen.
- **Neuladen heute:** Eine Query nennt auf der Datenseite die Tabellen, die sie liest. Nach einer
  Tabellenmeldung lädt die Seite jede sichtbare Query neu, die diese Tabelle nennt (ADR 0021).
  Das Contract-Kit sieht das ausgeführte SQL und meldet eine gelesene Tabelle, die nicht genannt
  ist.
- **Web-App:** Sie hat keinen Datenprozess (D263).
- **`contracts` heute:** Das Paket importiert den Contract jedes Moduls; nur die Modulliste der
  Desktop-App lädt es.
- **Wochenstart heute:** `weekOf` in `time` nimmt den ersten Tag der Woche als Zahl mit Sonntag
  als 0, wie die alte App und Mantines Datumsauswahl. Temporal und `Intl` zählen Sonntag als 7.
  Gespeichert ist nichts.
- **Sprache heute:** Die App-Sprache hat den Wert „System“ und folgt dann den Sprachen des
  Browsers. Der Datenprozess kennt sie nicht.
- **Zweitnamen:** D282 hat entschieden, dass der Name einer Zeitzone gespeichert wird, wie er
  gewählt wurde, und dass nur `time` zwei Zeitzonen vergleicht. Das gilt auch für die Zeile eines
  Zeiteintrags (D342).

- **D351 Der erste Render liest die synchronisierten Einstellungen aus einer lokalen Kopie; die
  Datenbank ist die Wahrheit (ergänzt D113, füllt die Lücke aus ADR 0010).** Die Seite hält eine
  Kopie der synchronisierten Einstellungen in `localStorage` und rendert daraus sofort. Sobald der
  Datenprozess antwortet, übernimmt der Store dessen Werte; weicht die Kopie ab, gewinnt die
  Datenbank. Der Start wartet nie auf den Datenprozess. _Gründe:_ Das Warten hinge den ersten
  Render hinter die erste Antwort des Datenprozesses und den Sprachkatalog dahinter. Antwortete
  der Datenprozess nicht, startete die App nach einem Zeitlimit in der Systemsprache und im
  Standard-Theme; das Abnahmekriterium aus #109, dass sie auch dann in der gespeicherten Sprache
  startet, erfüllt nur die Kopie. _Preis:_ Weicht die Kopie von der Datenbank ab, startet die App
  im alten Aussehen und wechselt etwa 0,15 s später; bei der Sprache erscheinen die Texte kurz in
  der alten Sprache. Das passiert nach einer Wiederherstellung und später, wenn ein anderes Gerät
  per Sync etwas geändert hat. _Laufzeit:_ ein Schreibzugriff auf `localStorage` pro geänderter
  Einstellung, wie heute. _Verworfen:_ auf den Datenprozess warten, mit Zeitlimit.
- **D352 Der Datenprozess liest eine Einstellung in der Transaktion über den Kontext, und eine
  Query, die das tut, nennt die Tabelle der Einstellungen als gelesen (führt D147 aus).** Der
  Kontext jeder Operation und Query bekommt eine typisierte Lesefunktion für eine deklarierte
  Einstellung. Sie liest die Zeile in derselben Transaktion wie die Daten, prüft sie mit dem
  Schema der Deklaration und liefert bei fehlender oder kaputter Zeile den Standardwert. Eine
  Query, die eine Einstellung liest, nennt die Tabelle der Einstellungen unter ihren gelesenen
  Tabellen und folgt einer Änderung damit über die bestehende Tabellenmeldung. Jedes Modul, das
  eine Einstellung braucht, kopiert dieses Muster. _Gründe:_ Daten und Einstellung stammen aus
  demselben Stand der Datenbank. Der Datenprozess bleibt die Autorität über einen Wert, der in
  Zeilen steht (D342). Es entsteht kein neuer Mechanismus, und das Contract-Kit merkt eine
  vergessene Angabe von selbst. _Beispiel:_ Die Wochenansicht ist offen, und der Nutzer stellt
  die Zeitzone von Berlin auf Bangkok. Das Speichern schreibt die Tabelle der Einstellungen, der
  Datenprozess meldet sie, die Query der Woche lädt neu und rechnet die Tagesgrenzen in Bangkok.
  _Preis:_ Die Meldung gilt für die ganze Tabelle: Ändert der Nutzer den Akzent, lädt auch die
  sichtbare Query der Woche einmal neu. Ihre Antwort ist dieselbe, und unveränderte Zeilen
  behalten ihre Identität (ADR 0021), also zeichnet nichts neu. _Laufzeit:_ pro Aufruf ein
  Zeilenzugriff über den Index je gelesener Einstellung, im selben Prozess wie die Datenbank
  (zum Vergleich: eine Seiten-Query über 100.000 Zeilen maß 0,07 ms); pro Änderung einer
  Einstellung ein Neuladen der sichtbaren Queries, die die Tabelle nennen (gemessen 2 ms bei
  1.000 Zeilen). Der Zeilenzugriff ist nicht gemessen; die Messung gehört zu #109. _Verworfen:_
  Die Seite übergibt die Zeitzone bei jedem Aufruf (ein Fenster, das die Umstellung noch nicht
  kennt, schriebe die alte Zone in eine Zeile, und jeder spätere Aufrufer ohne Seite müsste sie
  erst erfragen; widerspricht D147); ein Abbild der Einstellungen im Speicher des Datenprozesses
  (eine zweite Wahrheit neben der Transaktion, die ein späterer Sync nicht nachzieht).
- **D353 Der Datenprozess schreibt die Zeitzone des Geräts beim Start, wenn sie fehlt; bei einem
  unbekannten Namen steht in der Zeile eines Zeiteintrags die Zeitzone, mit der gerechnet wurde
  (führt D147 aus, ergänzt D342).**
  1. **Beim Start:** Fehlt die Zeile der Zeitzone, schreibt der Datenprozess die Zeitzone des
     Geräts, im selben Schritt, in dem er den persönlichen Space sicherstellt. Jede Operation
     findet danach einen Wert.
  2. **Die Gerätezone ist eine Quelle wie Uhr und Ids.** Die App reicht die echte hinein, ein Test
     eine feste. So läuft ein Modultest in Berlin oder in einer Zone westlich von UTC.
  3. **Unbekannter Name:** Kennt die Laufzeit den gespeicherten Namen nicht, gilt nach D147 die
     Gerätezone, das Fehlerprotokoll bekommt einen Eintrag, und die Einstellung bleibt unberührt.
     Ein neuer Zeiteintrag speichert dann den Namen, mit dem gerechnet wurde, also die Gerätezone.

  _Gründe:_ Der Datenprozess liest die Zeitzone bei jeder Operation (D352), also muss sie vor dem
  ersten Aufruf da sein. Schriebe die Seite sie, fände eine Operation davor keine Zeile, und zwei
  Fenster schrieben beide. Die Spalte am Eintrag heißt „Zeitzone, in der er entstand“; das ist
  die Zone, in der der Nutzer die Uhrzeiten gesehen hat. _Laufzeit:_ ein Schreibzugriff beim
  Start, wenn die Zeile fehlt, danach keiner. _Verworfen:_ Die Seite schreibt beim ersten Laden;
  der unbekannte Name aus der Einstellung in der Zeile des Eintrags (dort stünde eine Zone, mit
  der nie gerechnet wurde).
- **D354 Der Datenprozess liest den Wochenstart nicht: Die Abfrage nimmt eine Spanne von
  Kalendertagen, und die Seite rechnet die Woche (ändert D153 und die Wochen-Abfrage aus Runde 45,
  Spec #275).** Die Seite berechnet die Woche mit `weekOf` aus „heute“ und dem Wochenstart und
  nennt der Abfrage den ersten und den letzten Tag. Der Datenprozess liest nur die Zeitzone und
  rechnet daraus die Tagesgrenzen, Tagesanteile und Summen. _Gründe:_ Der Wochenstart hat den Wert
  „automatisch“ und folgt dann der Region; die Region kommt aus der App-Sprache; die App-Sprache
  hat den Wert „System“ und folgt den Sprachen des Geräts, die nur die Seite kennt. Anders als die
  Zeitzone steht der Wochenstart nie in einer Zeile: Er entscheidet nur, welche sieben Tage eine
  Ansicht zeigt. Dieselbe Abfrage dient später einer Monatsansicht oder einem Bericht über einen
  freien Zeitraum. Stellt der Nutzer Wochenstart oder Sprache um, ändert sich die Eingabe der
  Abfrage, und sie lädt von selbst neu. _Preis:_ Ein späterer Aufrufer ohne Seite, etwa ein
  Assistent, der „diese Woche“ meint, muss die Woche selbst bestimmen. Die Spec von #275 und der
  Slice #341 ändern sich: Die Eingabe ist eine Spanne mit einer Obergrenze, nicht ein Tag.
  _Laufzeit:_ ein Lesezugriff weniger pro Abfrage. _Verworfen:_ Der Datenprozess löst
  „automatisch“ selbst auf (er läse drei Einstellungen statt einer und bräuchte die Sprachen des
  Geräts als weitere Quelle; Seite und Datenprozess könnten die Systemsprache unterschiedlich
  bestimmen und verschiedene Wochen meinen).
- **D355 Der Wochenstart ist gespeichert und im Code der Name des Tages (beantwortet die offene
  Frage aus #104).** Gespeichert wird `"automatic"` oder `"monday"` bis `"sunday"`. Der Typ
  `FirstDayOfWeek` in `time` wechselt von der Zahl zum Namen: `weekOf(day, "monday")`. Eine
  Funktion in `time` liefert die Zahl, die Mantines Datumsauswahl verlangt. _Gründe:_ Drei Stellen
  zählen denselben Tag verschieden (Sonntag als 0 oder als 7), und „automatisch“ ist keine Zahl.
  Mit dem Namen lässt der Compiler keine Verwechslung der Zählweisen mehr durch, und wer die Zeile
  liest, braucht keine Zählweise zu kennen. _Laufzeit:_ ein Nachschlagen in einer Tabelle mit
  sieben Einträgen. _Verworfen:_ die Zahl 0 bis 6 mit Sonntag als 0 wie in der alten App (der Wert
  wäre eine Zahl oder der Text `"automatic"`); die Zahl 1 bis 7 nach ISO (passt nicht zu Mantine,
  dieselbe Mischung).
- **D356 Der Besitzer eines Werts deklariert dessen Einstellungen; `time` deklariert Zeitzone und
  Wochenstart in einem eigenen Einstieg (ersetzt den Teil von D153, der `contracts` nennt, führt
  D116 fort).** `time` bekommt einen Einstieg für die Einstellungen Zeitzone, „dem Gerät folgen“
  und Wochenstart und die Geräteeinstellung „nicht mehr fragen“. Oberfläche und Datenprozess
  dürfen ihn laden. Er hält nur die Deklarationen mit kleinen Schemas, damit er den Start nicht
  vergrößert. Die Regel gilt für jedes Modul: Die Rundung der Zeiterfassung deklariert später
  `time-tracking` in seinem Contract-Einstieg, den schon heute beide Seiten laden. _Gründe:_
  `contracts` importiert den Contract jedes Moduls; ein Modul, das seine Einstellungen von dort
  läse, ergäbe einen Zyklus, den die Grenzprüfung ablehnt. Besitzer des Werts und Besitzer der
  Deklaration bleiben derselbe. _Preis:_ Dieser Einstieg von `time` importiert `settings`; der
  Haupteinstieg von `time` bleibt ohne Paket des Repos (D143). `settings` selbst bleibt deshalb
  ohne Importe aus dem Repo (D116): `db` importiert `time`, also liegt die Tabelle der
  Einstellungen in einem anderen Paket. _Verworfen:_ ein neues Paket nur für die Einstellungen
  des Kerns; `contracts` (Zyklus).

## Später, mit Vorschlag

Diese Fragen gehen mit ihrer vorgeschlagenen Antwort in die Spezifikationen von #109 und #110. Wer
baut, darf anders entscheiden und nennt es im Pull Request.

**Einstellungen in der Datenbank (#109)**

- **Zeilenformat:** wie im Issue: eine Zeile pro Einstellung mit `key` und `value` als JSON-Text
  nach den Konventionen. Ein Modul besitzt eine Einstellung über den Präfix ihres Schlüssels.
- **Space:** Jede Einstellung gehört zum persönlichen Space.
- **Lage im Code:** Tabelle, Migration und Lesefunktion liegen in einem eigenen Paket unter
  `storage`, wie `spaces`; die Migration läuft beim Start des Datenprozesses mit. Laden und
  Speichern der Seite sind ein Modul mit Contract über dem Rahmen, damit Transaktion,
  Tabellenmeldung und Contract-Kit greifen. Es liegt in einem zweiten Paket, weil `storage` die
  Lesefunktion importiert und ein Paket mit beidem einen Zyklus ergäbe.
- **Werte beim Start:** Der Datenprozess bekommt eine Liste von Einstellungen mit Wert, die er
  schreibt, wenn ihre Zeile fehlt. Die App nennt darin die Zeitzone des Geräts (D353), ein Test
  eine feste.
- **Lokale Kopie:** Sie wird nach einem gelungenen Speichern und bei jedem Laden und jeder
  Meldung aus der Datenbank geschrieben. Scheitert ein Speichern, bleibt der Wert bis zum Neustart
  gelten (D117), und die Kopie behält den Stand der Datenbank.
- **Späte Echos:** Bei einer Tabellenmeldung liest der Adapter die aktuellen Zeilen und meldet
  nie einen Wert, der älter ist als das letzte fertige Speichern.
- **Mehrere Fenster:** Jedes Fenster folgt über die Tabellenmeldung.
- **Web-App:** Sie bleibt beim lokalen Adapter, bis sie einen Datenprozess hat.
- **Umzug:** beim ersten Laden aus der Datenbank, Eintrag für Eintrag: Was lokal steht und in der
  Datenbank fehlt, wird geschrieben; wo die Datenbank schon einen Wert hat, gewinnt sie.
- **Zurücksetzen:** schreibt den Standardwert; keine Zeile wird gelöscht.
- **Sicherung:** Eine Wiederherstellung bringt die Einstellungen von damals zurück.
- **Unbekannte Schlüssel:** Zeilen, die keine Deklaration dieser Version kennt, bleiben
  unberührt (D115).

**Zeitzone und Wochenstart (#110)**

- **Schlüssel:** `time.zone`, `time.followDevice`, `time.weekStart` und für das Gerät
  `time.zoneOfferDismissed`.
- **Wert der Zeitzone:** ein Name als Text oder „nicht gesetzt“. „Nicht gesetzt“ und ein
  unbekannter Name ergeben über eine einzige Funktion die Gerätezone. In der Web-App ohne
  Datenprozess gilt damit die Gerätezone, bis der Nutzer eine Zone wählt.
- **Wochenstart je Region:** eine feste Tabelle: `de-DE` Montag, `en-US` Sonntag. Wählbar sind
  „Automatisch“, Montag, Sonntag und Samstag; das Schema nimmt alle sieben Tage an.
- **Zonenliste:** die Liste der Laufzeit plus `UTC`, angezeigt mit Ort und Abstand zu UTC, mit
  Suche. Die Namen der Laufzeit bleiben, wie sie sind (D282).
- **Angebot zum Wechsel:** ein Hinweis mit „Wechseln“ und „Nicht mehr fragen“, beim Start und
  wenn das Fenster wieder sichtbar wird. Mit „dem Gerät folgen“ schreibt die Seite an denselben
  Stellen die neue Zone, ohne zu fragen.
- **Seite:** Hooks über den Store für die aufgelöste Zeitzone und den aufgelösten Wochenstart;
  eine Ansicht folgt einer Änderung über den Store.
- **Tests und Stories:** Der Test-Datenprozess bekommt die Zeitzone als Option (D353); die Seite
  eines Tests oder einer Story reicht Zeitzone und Wochenstart über einen Store mit festen Werten.
- **Einstellungsbereich:** Die Ansicht „Sprache“ heißt „Sprache und Region“ und bekommt die
  Zeilen für Zeitzone, „dem Gerät folgen“ und Wochenstart (D198).
- **Fehlerprotokoll:** Die Lesefunktion von `time` meldet den unbekannten Namen ihrem Aufrufer;
  Datenprozess und Seite schreiben je einen Eintrag, nicht einen pro Aufruf.

## Vorgemerkt

- **Erster Start und Sync:** Ein frisches zweites Gerät schriebe seine Gerätezone, bevor der
  erste Sync die Wahl des Nutzers bringt (D353). Sync-Phase.
- **Meldung pro Schlüssel:** Eine feinere Tabellenmeldung für Einstellungen lässt sich nachrüsten,
  ohne dass ein Modul sich ändert (D352). Erst nach einer Messung.
- **„Diese Woche“ ohne Seite:** Ein Assistent oder ein Import braucht den aufgelösten Wochenstart
  (D354). Mit dem ersten solchen Aufrufer.
- **Geteilte Spaces:** wem eine Einstellung gehört, wenn es mehr als den persönlichen Space gibt.
- **Eigene Regionen-Einstellung:** bleibt wie in D153 für später.
