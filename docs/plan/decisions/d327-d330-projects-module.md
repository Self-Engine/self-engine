# Runde 42 (2026-11-15): Modul `projects` (#273, führt D306 und D323 aus, schärft D241, ändert den Titel-Vorschlag aus Runde 40)

Grundlage: der Stand auf `main` nach #293 und die alte App (nur gelesen, Pfad in
`research-layer-3-core.md`).

- **Speicher-Rahmen heute:** Er kennt einen Zustand neben „lebt“, nämlich „gelöscht“.
  `sharedEntry.live()` filtert, `sharedWrites.softDelete()` und `.restore()` schreiben, und das
  Contract-Kit prüft, dass kein Eintrag eines Moduls den Filter vergisst. `update` schreibt, was es
  bekommt, und setzt immer `updated_at`, auch bei einer leeren Feldliste.
- **Formular-Helfer heute:** Beim Bearbeiten schickt er die Id und die geänderten Felder. Ein
  geleertes Textfeld wird `null`, ein unberührtes Feld fehlt im Aufruf (D323, ADR 0030).
- **Zod:** Ein gewöhnliches Objekt-Schema wirft unbekannte Felder stillschweigend weg.
- **Lese-Baustein heute:** Das Beispiel `noteTitles` gibt Id, Titel und eine Lösch-Marke frei, mit
  eingebautem Space-Filter. Das lesende Modul verbindet ihn in seiner eigenen Abfrage (D241).
- **Alte App:** Sie erzwingt keine eindeutigen Projekttitel; der einzige eindeutige Index an
  Projekten betrifft das verknüpfte Gehalt. Sie archiviert Projekte und Daueraufträge.
- **Eindeutige Indizes:** D221 erlaubt sie auf synchronisierten Tabellen und regelt ihre Form. Was
  ein Abgleich mit zwei gleichen Werten macht, steht in keiner Runde; D310 verzichtet deshalb beim
  Timer auf einen Index.

- **D327 „Archiviert“ ist ein Baustein des Speicher-Rahmens mit einer Bedeutung für alle Module
  (führt D306 aus).** `archived_at` wird eine freiwillige Konventionsspalte einer synchronisierten
  Tabelle, ein Zeitpunkt oder leer. Der Rahmen bekommt einen Filter für „lebt und ist nicht
  archiviert“ und zwei Schreibwege, Archivieren und Zurückholen. Die Konventionsprüfung prüft Name
  und Typ der Spalte; das Contract-Kit prüft, dass eine Abfrage, die sich als „aktiv“ erklärt,
  nichts Archiviertes liefert. Drei Regeln gelten für jedes Modul:
  1. **Archiviert und gelöscht sind unabhängig.** Wer ein archiviertes Projekt löscht und das
     Löschen rückgängig macht, bekommt es archiviert zurück, nicht aktiv.
  2. **Archivieren sperrt nichts** (D306) und ist eine gewöhnliche Änderung: Sie setzt `updated_at`,
     und die Listen laden neu.
  3. **Zweimal archivieren ändert nichts.** Der erste Zeitpunkt bleibt stehen, es gibt keinen
     Fehler. Dasselbe gilt für das Zurückholen eines aktiven Eintrags.

  Im Vertrag heißt das Zurückholen `unarchive`, im Glossar „Unarchive“ (de: _Reaktivieren_).
  `restore` und „Wiederherstellen“ bleiben das Rückgängig eines Löschens. _Gründe:_ Mindestens vier
  Module archivieren absehbar: Projekte, Daueraufträge, Konten mit Buchungen und Aufgaben mit
  Zeiteinträgen (D306). Die Regel „aus den Auswahlen verschwunden“ wird von Hand vergessen, und
  ohne Prüfung fällt ein archiviertes Konto im Buchungsformular niemandem auf. Regel 3 zählt,
  sobald zwei Geräte denselben Eintrag archivieren. _Preis:_ Das Paket `projects` wächst um ein
  Stück Rahmen mit Tests, grob 200 bis 300 Zeilen, und der Rahmen kennt einen zweiten Zustand neben
  „gelöscht“. _Laufzeit:_ eine weitere Bedingung in Abfragen über Tabellen mit einigen hundert
  Zeilen, nichts Messbares. _Verworfen:_ Jedes Modul setzt die Spalte über ein gewöhnliches
  `update` und filtert von Hand (derselbe Filter in jedem Modul, und kein Test bemerkt einen
  vergessenen).
- **D328 Zwei Projekte dürfen denselben Titel tragen (ändert den Vorschlag aus Runde 40).** Ein
  Projekt ist seine Id. `projects` hat keinen eindeutigen Index auf dem Titel und damit keinen
  Konflikt, auch nicht beim Wiederherstellen. _Gründe:_ Eine Eindeutigkeit bräche an vier Stellen:
  - **Archiv:** Wer „Steuer“ von 2024 archiviert hat und „Steuer“ neu anlegt, würde wegen eines
    Projekts abgelehnt, das die Liste nicht zeigt. Gälte die Regel nur unter aktiven, ließe sich
    das alte nicht mehr reaktivieren, ohne eines umzubenennen.
  - **Rückgängig:** Löschen, neu anlegen und das erste Löschen rückgängig machen scheiterte.
  - **Sync:** Zwei Geräte legen offline je ein „Website“ an; beim Abgleich träfen zwei gültige
    Zeilen auf einen Index, der nur eine zulässt (derselbe Grund wie in D310).
  - **Import:** Die alte App erlaubt doppelte Titel; der Import müsste umbenennen oder abbrechen.

  Ein Index, der Daten ablehnt, lässt sich später leicht entfernen; einen nachträglich einzuführen,
  wenn Dubletten existieren, braucht eine Bereinigung. _Preis:_ In der Projekt-Auswahl können zwei
  Einträge gleich heißen; Icon und Farbe unterscheiden sie meist, aber nicht sicher. Ein Assistent,
  der „Timer auf Website“ hört, muss nachfragen. Die Vorlage `projects` zeigt das Muster
  „eindeutiger Index wird Konflikt am Feld“ nicht; es bleibt in `placeholder-alpha` und im
  Beispiel `notes` getestet. _Vorgemerkt für nach Schicht 4:_ ein Hinweis im Formular („Ein
  anderes Projekt heißt schon so“), der nicht sperrt. Der Formular-Helfer kennt heute keine
  Hinweise, die den Datenprozess fragen (D326). _Verworfen:_ eindeutig unter allen ungelöschten
  Projekten, archivierte eingeschlossen; eindeutig nur unter den aktiven.
- **D329 Das Bearbeiten folgt in jedem Modul einem Muster aus vier Regeln (führt D323 aus).**
  1. **Fehlt, leer, Wert.** Ein Feld, das im Aufruf fehlt, bleibt unberührt. `null` leert es. Ein
     Wert setzt es. Ein Pflichtfeld wie der Titel darf fehlen, aber nie `null` sein.
  2. **Unbekannte Felder sind ein Eingabefehler.** Das Schema ist streng und wirft nichts
     stillschweigend weg.
  3. **Eine Änderung ohne Felder tut nichts.** Sie antwortet mit dem Eintrag, schreibt nicht und
     lässt `updated_at` stehen. Eine unbekannte Id bleibt „nicht gefunden“.
  4. **Beim Erstellen darf ein freiwilliges Feld fehlen** und zählt dann als leer. Pflicht ist nur,
     was der Eintrag braucht, bei einem Projekt der Titel. Das Formular schickt weiter alle Felder.

  Ein Modul legt seine Felder einmal fest; Erstellen und Bearbeiten werden daraus abgeleitet, mit
  einem kleinen Baustein neben den Schemas. Das Contract-Kit prüft die Regeln 1 bis 3 für jede
  Operation zum Bearbeiten. _Gründe:_ Zu 1: Ein Icon, das diese Version nicht kennt, reist beim
  Umbenennen nicht mit und bleibt stehen (D294). Zu 2: Ein Assistent, der `titel` statt `title`
  schickt, bekäme sonst „gespeichert“, und nichts hätte sich geändert; ein Tippfehler in einem
  Befehl fiele nie auf. Zu 3: Lässt ein späterer Abgleich die jüngere Änderung gewinnen, darf ein
  Aufruf, der nichts ändert, nicht gegen eine echte Umbenennung gewinnen; und doppeltes Archivieren
  ist nach D327 ebenfalls kein Fehler. Zu 4: Kommt später ein Feld dazu, bricht kein Aufrufer, der
  es nicht kennt. _Grenze:_ Die Operation vergleicht nicht mit dem gespeicherten Stand. Wer den
  Titel schickt, der schon dasteht, schreibt, und `updated_at` rückt vor; das zu verhindern kostete
  ein Lesen vor jedem Schreiben. Das Formular schickt so etwas nie, weil es gegen den gespeicherten
  Stand vergleicht (D321). _Preis:_ Die Verträge werden empfindlicher: Wer ein Feld umbenennt,
  ändert alle Aufrufer im selben Schritt; TypeScript zeigt sie. Regel 3 braucht in der Operation
  einen Zweig, der liest statt schreibt. _Verworfen:_ eine leere Änderung ablehnen (sie ist kein
  Fehler des Nutzers); sie schreiben (siehe Regel 3); das Muster in jedem Modul von Hand.
- **D330 Die Schnittstelle zwischen `projects` und den Modulen darüber ist ein Wert, der
  Projekt-Verweis (schärft D241 und D306, klärt den Einstieg aus D313).** Er trägt Id, Titel, Icon,
  Farbe, eine Archiv-Marke und eine Lösch-Marke. `projects` gibt ihn zweimal heraus: als
  Lese-Baustein für Abfragen und als Schema, das ein Modul darüber in seine eigenen Antworten
  einbaut. Drei Regeln:
  1. **Der Lese-Baustein liefert die Archiv-Marke mit.** Die Zeit-Ansicht kennzeichnet ein
     archiviertes Projekt und filtert danach, ohne `projects` zu fragen.
  2. **Die Projekt-Auswahl lädt die aktiven Projekte selbst und bekommt die aktuelle Wahl als
     Projekt-Verweis vom Formular gereicht.** Sie fragt nie nach einer einzelnen Id. Ein
     archiviertes oder gelöschtes Projekt, das gewählt ist, zeigt das Feld mit dem Zusatz
     „archiviert“ oder „gelöscht“. Wer ein anderes wählt, findet es danach nicht mehr in der Liste.
  3. **„Aus den Auswahlen verschwunden“ ist Anzeige, keine Regel.** Eine Operation nimmt die Id
     eines archivierten Projekts an. Abgelehnt wird nur ein gelöschtes oder unbekanntes.

  _Gründe:_ Zu 2: Wer einen Zeiteintrag von 2024 öffnet, um die Notiz zu ändern, muss sein
  archiviertes Projekt sehen; das Formular hat den Verweis schon aus seiner Abfrage, und weil das
  Projekt nicht angefasst wurde, reist es beim Speichern nicht mit (D329). Zu 3: Als Regel säße sie
  nach D307 im Datenprozess. Dann scheiterten der Import alter Einträge auf archivierten Projekten,
  der Abgleich eines Eintrags, den ein Gerät offline schrieb, während ein anderes archivierte, und
  jede Zeit-Änderung, die das Projekt mitschickt. _Laufzeit:_ Die Auswahl nutzt dieselbe Abfrage
  wie die Ansicht „Aktiv“, die Liste liegt also meist schon vor. Ihr Code lädt mit dem Drawer, nie
  im Start. _Preis:_ Sechs freigegebene Spalten, die `projects` nicht mehr umbenennt, ohne jedes
  Modul darüber anzufassen. Jedes Formular mit Projekt-Feld reicht den Verweis durch; vergisst es
  das, zeigt das Feld bei einem archivierten Projekt nichts, und ein Test im Paket der Auswahl
  deckt den Fall ab. Ein Assistent, der die Id kennt, kann Zeit auf ein archiviertes Projekt
  buchen. _Grenze:_ Sobald das Schutz-Paket (#274) steht, entsteht ein gelöschtes Projekt mit
  lebenden Einträgen nur noch über den Sync. _Verworfen:_ eine eigene Abfrage „aktive Projekte
  plus diese eine Id“ (eine Runde zum Datenprozess je geöffnetem Formular, und sie müsste gelöschte
  Projekte am Port herausgeben, was D221 sonst überall ausschließt); der Lese-Baustein ohne
  Archiv-Marke (eine zweite Abfrage an `projects` je Ansicht).

## Später, mit Vorschlag

Diese Fragen gehen mit ihrer vorgeschlagenen Antwort in die Spezifikation von #273. Wer baut, darf
anders entscheiden und nennt es im Pull Request.

- **Grenzen:** Der Titel hat 1 bis 200 Zeichen und wird am Rand abgeschnitten; die Beschreibung hat
  höchstens 10.000 Zeichen, und eine leere wird „kein Wert“.
- **Strenge Eingaben:** Auch das Erstellen und jede andere Operation lehnen unbekannte Felder ab
  (D329, Regel 2).
- **Feldliste:** Wie der Baustein heißt, der Erstellen und Bearbeiten aus einer Feldliste ableitet,
  und in welchem Paket er liegt.
- **Listen:** „Aktiv“ und „Archiv“ sind kleine Mengen (`smallSetList`). Sortiert wird nach Titel in
  der Oberfläche, damit Umlaute richtig einsortiert werden.
- **Bearbeiten im Archiv:** Ein archiviertes Projekt lässt sich bearbeiten und löschen wie ein
  aktives (D327, Regel 2).
- **Standard-Icon:** das Projekte-Icon der Navbar.
- **Namen:** Modul-Id und Vertrags-Namensraum `projects`, Adressen `/projects/active` und
  `/projects/archive`, in der Navbar „Projekte“ und "Projects".
- **Einstieg der Auswahl:** `@self-engine/projects/picker`; die Start-Prüfung kennt ihn als
  Eintrag, der nie im Start liegt.
- **Befehle:** „Neues Projekt“ mit Mod+N und ein Eingabe-Befehl zum Anlegen für einen späteren
  Assistenten (D85).
- **Alte Entwicklungs-Datenbank:** Sie wird neu angelegt (D315); der Pull Request nennt den
  Schritt.
- **Scheiben:** vier. Vertrag und Speicher mit dem Archiv im Rahmen; Ansichten und Formular;
  Lese-Baustein und Auswahl; Abbau der Platzhalter mit dem Leitfaden.
- **Glossar und ADR:** Begriffe für das Projekt, das Archiv, das Reaktivieren und den
  Projekt-Verweis entstehen beim Bau, ebenso die ADRs zum Archiv im Rahmen und zum Muster des
  Bearbeitens.

## Vorgemerkt

- **Gleicher Titel:** ein Hinweis im Formular, der nicht sperrt (D328), nach Schicht 4.
- **Neues Projekt aus der Auswahl:** ob die Projekt-Auswahl ein Projekt anlegen kann, ohne das
  Formular zu verlassen, nach Schicht 4.
- **Eindeutige Indizes unter Sync:** Was ein Abgleich mit zwei Zeilen macht, die ein eindeutiger
  Index nicht beide zulässt, ist für die Module offen, die einen solchen Index behalten. Die Frage
  gehört zur Sync-Phase.
