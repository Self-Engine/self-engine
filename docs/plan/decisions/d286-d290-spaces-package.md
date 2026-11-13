# Runde 37 (2026-11-14): Paket `spaces` (#108, ändert D143 und D144, schärft D140, klärt D227)

Grundlage: der Stand aus #30 bis #33 (Spalte `space_id`, Indizes ab `space_id`, Space im Kontext,
gemeinsamer Einstieg, Contract-Kit mit Zeilen in mehreren Spaces) und Messungen dieser Runde mit
einem Wegwerf-Skript gegen better-sqlite3 13.0.3 (SQLite 3.53.4) in Node 26.13, auf einer Datei im
WAL-Modus mit den Pragmas aus D134:

- Ein Fremdschlüssel auf `spaces` kostet beim Einfügen 0,05 µs pro Zeile: 100.000 Zeilen in einer
  Transaktion brauchen 1,60 µs pro Zeile ohne und 1,65 µs mit Fremdschlüssel (je zwei Läufe).
- Ein `INSERT` in eine Tabelle mit diesem Fremdschlüssel scheitert mit „no such table“, solange
  die Tabelle `spaces` fehlt. Das `CREATE TABLE` selbst nimmt SQLite vorher an (D136).
- Zwei Verbindungen, die in je einer Transaktion erst „kein persönlicher Space“ lesen und dann
  einen anlegen, erzeugen genau eine Zeile: Die zweite scheitert beim Schreiben mit
  `SQLITE_BUSY_SNAPSHOT`.
- Die Desktop-App hat keine Sperre gegen eine zweite Instanz; zwei Datenprozesse auf derselben
  Datenbank sind möglich.

Heute ist der Space eine feste Konstante im Code (`00000000-0000-7000-8000-000000000001`, D195),
es gibt keine Tabelle `spaces`, und keine Tabelle verweist auf einen Space.

- **D286 Die Konventionsprüfung verlangt an jeder synchronisierten Tabelle den Fremdschlüssel auf
  `spaces` (schärft D140, setzt D144 durch).** Die Form ist genau
  `space_id TEXT NOT NULL REFERENCES spaces(id) DEFERRABLE INITIALLY DEFERRED`, ohne
  `ON UPDATE CASCADE` und ohne Ausnahmeliste; lokale Tabellen sind wie bisher befreit. `spaces`
  erfüllt die Regel selbst, weil die Zeile auf sich verweist (D289). _Gründe:_ Schreibt ein zweites
  Gerät später seine `space_id` um (D144) und vergisst der Code eine Tabelle, bleiben deren Zeilen
  ohne Fremdschlüssel unter der alten Id liegen, unsichtbar und ohne Fehler; mit Fremdschlüssel
  scheitert die Transaktion, und nichts ist geschrieben. Dasselbe gilt für den Import. SQLite kann
  einen Fremdschlüssel nicht nachträglich anfügen: Später hieße das für jede Tabelle „neu anlegen,
  kopieren, löschen, umbenennen“, auf echten Nutzerdaten. _Preis:_ 0,05 µs pro `INSERT`
  (gemessen). Jede Testdatenbank braucht die Tabelle `spaces` und ihre Zeilen (löst D287).
  `placeholder-alpha` und die Testmodule bekommen den Fremdschlüssel; die Tabelle von
  `placeholder-alpha` wird dafür neu angelegt. _Verworfen:_ nur der Kontext ohne Fremdschlüssel
  (schützt im Alltag, nicht beim Umschreiben und beim Import); der Fremdschlüssel als Konvention
  ohne Prüfung (das erste Modul vergisst ihn); `ON UPDATE CASCADE` (ein Update schriebe still in
  jede Tabelle; das Umschreiben kann die Tabellen selbst aufzählen, verzögerte Fremdschlüssel
  erlauben es in einer Transaktion, und die Form bleibt neutral gegenüber der Sync-Engine, D89).
- **D287 `spaces` liegt zwischen `db` und `storage` und hat keinen Vertrag (ändert D143 und
  D144).** Das Paket importiert nur `db` und `time`. Es bietet seine Migration, seine Zeilen-Map,
  das Id-Schema des Space, die Funktion „persönlichen Space sicherstellen“ und unter `./testing`
  einen Helfer, der Space-Zeilen anlegt. `storage` und `data-process` importieren es. Der
  Datenprozess lässt die Migration von `spaces` immer mitlaufen und stellt den Space beim Start
  sicher; `spaces` steht nicht in der Modulliste einer App, keine App kann es also vergessen. Das
  Contract-Kit und der Test-Helfer in `storage` legen die Space-Zeilen selbst an, kein Modul
  schreibt dafür Testcode. Von der Seite aus ist `spaces` nicht erreichbar, und nichts davon
  gelangt in den Renderer. `tags` bleibt ein normales Modul über `storage`. _Gründe:_ Aus D286
  folgt, dass das Kit in `storage` Space-Zeilen schreiben muss; läge `spaces` über `storage`,
  wäre das ein Zyklus (ADR 0006). Und der Rahmen braucht für jeden Aufruf einen Space: Das Anlegen
  beim ersten Start kann kein Aufruf durch den Rahmen sein. _Folge für später:_
  Organisations-Spaces mit Oberfläche und Operationen kommen als eigenes Modul über `storage`, das
  `spaces` importiert, so wie eine Brücke die untere Lage eines Moduls ruft (D189). _Verworfen:_
  `spaces` als normales Modul über `storage` wie in D143 (jeder Modul-Test müsste `spaces` und eine
  Funktion zum Anlegen von Space-Zeilen übergeben, oder das Kit schriebe mit rohem SQL in eine
  Tabelle, deren Spalten es nur als Text kennt; die einzige Funktion des Moduls liefe trotzdem am
  Rahmen vorbei); Tabelle und Sicherstellen in `storage` (`storage` besäße eine echte Tabelle,
  gegen den Zuschnitt aus D143).
- **D288 „Höchstens ein persönlicher Space“ gilt im Code, in einer Transaktion (ändert D144,
  klärt den offenen Punkt aus D227).** Beim Start sieht `spaces` nach, ob ein persönlicher Space
  existiert, und legt nur dann einen an, beides in einer Transaktion. Scheitert sie mit
  `SQLITE_BUSY_SNAPSHOT`, weil ein zweiter Datenprozess schneller war, versucht sie es einmal neu
  und findet dessen Space. Findet der Start zwei persönliche Spaces, scheitert er, statt einen zu
  wählen. Den eindeutigen Index aus D144 gibt es nicht. _Gründe:_ Ein Index über `kind` beginnt
  nicht mit `space_id` (D227); mit `space_id` vorn nützt er nichts, weil jede Space-Zeile ihre
  eigene Id als `space_id` trägt. Das Startrennen ist gemessen: zwei Verbindungen, eine Zeile.
  „Ein persönlicher Space pro Nutzer“ ist am Ende eine Regel des Servers pro Konto; lokal ist es
  eine Regel des Starts. In die Tabelle schreibt nur `spaces` (D241). _Preis:_ Gegen einen Fehler
  in späterem Code (Import, Sync), der eine zweite Zeile schreibt, schützt erst der nächste
  Start. _Verworfen:_ ein Trigger (der erste im Repo, die Konventionsprüfung kennt keine; er
  feuerte auch, wenn eine Sync-Engine Zeilen einspielt, gegen D89; das Kit braucht mehrere Spaces
  in einer Datenbank und müsste eine zweite Art erfinden); eine Ausnahme in der Prüfung für genau
  diesen Index (bricht „ohne Ausnahmeliste“ aus D140 und D227, dasselbe Problem im Kit).
- **D289 Die Tabelle `spaces` hat die Pflichtspalten, `CHECK (space_id = id)` und `kind` (schärft
  D144).** Spalten: `id`, `created_at`, `updated_at`, `deleted_at`, `space_id` mit dem
  Fremdschlüssel aus D286 auf die eigene Tabelle und `CHECK (space_id = id)`, dazu
  `kind TEXT NOT NULL`, vorerst nur `personal`. `kind` prüft der Code über die Zeilen-Map, ohne
  SQL-`CHECK`: Eine neue Art wie `organization` braucht so keine Migration, während ein
  `CHECK (kind IN (…))` sich nur durch Neuaufbau einer Tabelle ändern ließe, auf die jede andere
  verweist. Die Id ist eine UUIDv7 aus dem Id-Erzeuger des Kontexts, `created_at` und `updated_at`
  tragen den Zeitpunkt des ersten Starts. `deleted_at` gibt es der Konvention wegen; keine
  Operation setzt es. Name und Besitzer fehlen: Der persönliche Space wird nirgends angezeigt,
  Konten gibt es noch nicht, und beides kommt später als `ALTER TABLE … ADD COLUMN`. _Preis:_ Der
  `CHECK (space_id = id)` ließe sich nur durch Neuaufbau von `spaces` entfernen; er gilt als
  sicher, weil „die Zeile ist ihr eigener Space“ die Definition aus D144 ist und auch für
  Organisations-Spaces gilt. Das Umschreiben auf einem zweiten Gerät setzt beide Spalten in einer
  Anweisung und besteht ihn. _Verworfen:_ die Regel `space_id = id` nur im Code; `kind` erst mit
  den Organisations-Spaces (der Start suchte „die einzige Zeile“ statt „den persönlichen Space“,
  eine Annahme, die still bricht, sobald eine zweite Art dazukommt).
- **D290 „Space“ und „Personal Space“ kommen mit diesem Wortlaut ins Glossar.** Die Einträge
  entstehen beim Bau von #108, weil sie sagen, was der Code tut:

  > **Space** (de: _Space_):
  > The owner of data. Every synced row belongs to exactly one Space, and a row refers only to rows
  > of its own Space. A Space is not something the user picks to sort entries, such as a folder or a
  > filter.
  > _Avoid_: workspace, tenant, account, organization
  >
  > **Personal Space** (de: _persönlicher Space_):
  > The Space that holds one person's own data. A database has exactly one, created at the first
  > start and never shown.
  > _Avoid_: default space, user space, private space

  Ein Space beantwortet später, wem eine Zeile gehört, wer sie sieht und wohin sie synchronisiert;
  er ist kein Ordner. „Workspace“ ist ausgeschlossen, weil die alte App so ihre UI-Tabs nannte und
  das Repo ein pnpm-Workspace ist. Deutsch bleibt es „Space“: Die Planung nutzt das Wort
  durchgehend, die App zeigt es nirgends, und der Code heißt genauso. _Folge für später:_ Wer Zeit
  auf ein Projekt im Space eines Auftraggebers erfasst, dessen Zeiteintrag liegt in diesem Space,
  nicht im persönlichen (D144, D246); ob das so bleibt, entscheidet die Phase der
  Organisations-Spaces. _Verworfen:_ „Bereich“ (verschwimmt im Deutschen mit Ansichten und
  Gruppen).

## Abnahmekriterien von #108

„Ein eindeutiger Index erlaubt höchstens einen persönlichen Space“ entfällt (D288). Neu sind drei
prüfbare Sätze: Zwei gleichzeitige Starts auf einer Datenbank erzeugen einen Space. Eine Datenbank
mit zwei persönlichen Spaces startet nicht. Die Konventionsprüfung meldet eine synchronisierte
Tabelle ohne Fremdschlüssel auf `spaces` (D286).

## Später, mit Vorschlag

Diese Fragen gehen mit ihrer vorgeschlagenen Antwort in die Spezifikation von #108. Wer baut, darf
anders entscheiden und nennt es im Pull Request des Arbeitspakets.

- **Start:** Das Sicherstellen läuft nach den Migrationen in einer eigenen Transaktion, bevor der
  erste Aufruf beantwortet wird.
- **Kaputter Zustand:** Neben zwei persönlichen Spaces lässt auch ein gelöschter persönlicher
  Space den Start scheitern; geraten wird nichts.
- **Kontext:** Der Rahmen bekommt den Space vom Datenprozess. Die feste Konstante verschwindet aus
  dem Code der App; Tests behalten feste Ids über den Test-Helfer von `spaces`.
- **Kit:** Es legt seine Space-Zeilen selbst an; die Tests der Module ändern sich nicht.
- **`placeholder-alpha`:** Eine neue Migration legt die Tabelle mit Fremdschlüssel neu an. Die
  Zeilen in Dev-Datenbanken gehen verloren; eine stabile Version gibt es vorher nicht (D252).
- **Testmodule** (`notes`, `note-links`): Sie liegen in `test/`-Ordnern, gelten nicht als
  gemergte Migrationen (D142) und werden direkt geändert.
- **Kein Zugang von außen:** keine Oberfläche, kein Vertragseintrag, kein Feld in `health`, keine
  Operation zum Löschen eines Space.
- **Dokumentation beim Bau:** ein ADR („jede Zeile gehört einem Space, den der Kontext liefert“)
  und die Glossar-Einträge aus D290.
