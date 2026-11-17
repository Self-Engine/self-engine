# Runde 43 (2026-11-17): Schutzregeln (#274 und #313, ändert D306, D307 und D330, beantwortet den offenen Punkt aus ADR 0023)

Grundlage: der Stand auf `main` nach #307 und das Guard-System der alten App (nur gelesen, Pfad in
`research-layer-3-core.md`).

- **Ziel des Owners:** #274 wird die Basis eines Systems, das die Regeln der App kennt, mitteilt
  und verhindert, was nicht geht. Es muss nicht dem der alten App gleichen. Es soll jede Art von
  „das darf nicht passieren“ tragen und mitwachsen. Der erste Fall ist das Projekt, auf das
  Zeiteinträge verweisen.
- **Speicher-Rahmen heute:** Ein Modul schreibt über sechs Standardwege, je eine Zeile: Anlegen,
  Ändern, Löschen, Wiederherstellen, Archivieren, Reaktivieren. Alle Schreibstellen der Module
  laufen darüber; die einzige direkte ist das Anlegen des persönlichen Space in `spaces`. Der
  Aufrufrahmen gehört einem Modul. Eine Brücke ruft die unteren Funktionen in ihrer eigenen
  Transaktion und läuft damit am Aufrufrahmen vorbei (ADR 0020, ADR 0023).
- **Erwartete Fehler heute:** „nicht gefunden“ und der Konflikt. Ein Konflikt trägt einen Grund,
  den der Vertrag der Operation aufzählt (D238); das Contract-Kit prüft mit Beispielen, dass jeder
  aufgezählte Grund auftritt.
- **`projects` heute:** „Löschen“ gibt es nur in der Bearbeiten-Schublade. Es löscht sofort und
  zeigt einen Hinweis mit „Rückgängig“.
- **Fremdschlüssel:** SQLite gibt sie über `pragma_foreign_key_list` heraus; gelesen werden sie
  heute nur in den Testhilfen von `db`. Jede Tabelle trägt außerdem `space_id` als Fremdschlüssel.
- **Alte App:** Guards sind Funktionen je Entität, denen der Aufrufer Fakten reicht. Die untere
  Entität kennt dadurch jedes obere Gebiet („hat Zeiteinträge“, „hat Auszahlungen“), Seite und
  Schreibweg können sich widersprechen, und der Assistent hielt eine gespiegelte Kopie.
  Übernommen wird der Gedanke: eine Definition, die Auskunft gibt und verhindert, Gründe mit Code,
  blockierend oder warnend, das Archivieren als Ausweg.
- **Was nicht passieren soll, und wo es hingehört:**

  | Was | Beispiel | Wo |
  | --- | --- | --- |
  | Ungültige Eingabe | Titel leer | Vertrag, Meldung am Feld (steht) |
  | Doppelter Wert | zwei Tags mit gleichem Titel | Datenbank, der Rahmen übersetzt (steht) |
  | Ungelöschtes zeigt auf Gelöschtes | Projekt mit Zeiteinträgen löschen | Regel des Rahmens (diese Runde) |
  | Ein Zustand sperrt den Eintrag | abgerechneten Zeiteintrag ändern | Regel einer Brücke |
  | Ein Zustand sperrt ein Feld | Währung eines Kontos mit Buchungen | Regel des Moduls |
  | Regel über mehrere eigene Zeilen | Überschneidung, wenn die Einstellung sie verbietet | Regel des Moduls |
  | Erlaubt, aber mit Folge | Löschen mit Warnung | Regel mit warnendem Grund |
  | Nicht dieser Aufrufer | Assistent ohne Erlaubnis, später Mitglieder eines Space | Regel, die den Aufrufer sieht |
  | Kommt per Sync oder Import herein | zwei Geräte ändern offline dasselbe | nicht verhinderbar, nur auffindbar |

- **D331 Jede Regel über gespeicherten Zustand ist eine Schutzregel in einem System (ändert
  D307).** Eine Schutzregel gehört zu einer Tabelle und einer Art von Schreiben. Sie liest nur und
  antwortet mit Gründen. Ob sie der Rahmen mitbringt, ein Modul für seine eigene Tabelle anmeldet
  oder eine Brücke von oben: Sie wird auf dieselbe Art angemeldet. Eine Definition dient drei
  Nutzungen:
  1. **Verhindern** vor dem Schreiben.
  2. **Auskunft** vor dem Klick, für Seite, Befehl und Assistent.
  3. **Datenprüfung** über vorhandene Zeilen, nach Sync und Import.

  Keine Schutzregeln sind Abläufe („ein zweiter Timer stoppt den ersten“) und Rückfragen mit
  Auswahl; sie bleiben in der Operation. _Gründe:_ Steht eine Regel als Code in einer Operation,
  braucht das Formular, das ein Feld sperren will, eine Kopie, und die Datenprüfung aus D307 eine
  zweite. Nur ein System kennt alle Regeln. _Beispiel:_ „Die Währung eines Kontos mit Buchungen
  ist gesperrt“ meldet `finance` einmal an; das Formular sperrt das Feld mit Begründung, die
  Operation lehnt ab, und nach einem Sync findet die Datenprüfung das Konto, bei dem es doch
  passiert ist. _Preis:_ Eine einfache Prüfung wird eine angemeldete Regel statt drei Zeilen Code.
  _Laufzeit:_ je Schreiben ein Nachschlagen im Speicher; eine Abfrage nur, wenn für die Tabelle
  eine Regel gilt. Nicht gemessen. _Verworfen:_ Das System trägt nur die Verweis-Prüfung und die
  Regeln der Brücken, und ein Modul schreibt eigene Regeln frei in seine Operation (D307 in der
  alten Fassung).
- **D332 Das Verhindern sitzt an den Schreibwegen des Rahmens (schärft D307, ändert die Fassung in
  ADR 0023).** Jeder der sechs Wege fragt vor dem Schreiben die Regeln für seine Tabelle und seine
  Art von Schreiben, in derselben Transaktion. Eine Regel schützt damit eine Tabelle und eine Art
  von Schreiben, nicht eine Operation. Eine Lint-Regel verbietet, in eine synchronisierte Tabelle
  an den Schreibwegen vorbei zu schreiben; Ausnahmen stehen namentlich in einer Liste. _Gründe:_
  Drei Fälle:
  - **Neue Operation:** „Projekte zusammenführen“ löscht das zweite Projekt und ist geschützt, weil
    sie den Löschweg benutzt. An der Operation wäre sie es nur, wenn jemand an eine Erklärung
    denkt.
  - **Brücke:** Sie ruft die unteren Funktionen, und die gehen über die Schreibwege. An der
    Operation liefe sie am Schutz vorbei.
  - **Mehrere Schritte:** Eine spätere Operation „Projekt samt Zeiteinträgen löschen“ geht von
    selbst: erst die Einträge, dann das Projekt; beim Löschen des Projekts verweist nichts mehr.

  _Preis:_ Die Wege schreiben je eine Zeile; ein Weg für viele Zeilen entsteht mit dem ersten
  Fall, der ihn braucht, und bekommt die Prüfung gleich mit. Eine Operation mit mehreren Schritten
  muss sie so ordnen, dass jeder einzelne erlaubt ist. _Laufzeit:_ Beim Löschen eines Projekts je
  verweisender Tabelle eine Abfrage über einen Index, die beim ersten Treffer endet; erwartet
  deutlich unter einer Millisekunde, auch bei 50.000 Zeiteinträgen. Nicht gemessen; die Messung ist
  ein Abnahmekriterium von #274. _Verworfen:_ die Prüfung an der Operation (siehe die drei Fälle);
  Trigger in der Datenbank (sie träfen auch den Sync und können keine Regel einer Brücke
  ausführen).
- **D333 Eine Schutzregel antwortet für eine Menge von Zeilen.** Sie bekommt die Tabelle, die Art
  des Schreibens und eine Liste von Zeilen und antwortet je Zeile. Der Schreibweg für eine Zeile
  übergibt eine Liste mit einem Eintrag. _Gründe:_ Der Einwand des Owners: Zeile für Zeile ist auf
  Dauer zu langsam. Geschätzt: 200 Zeiteinträge einzeln zu löschen kostet einige zehn
  Millisekunden, 5.000 eine halbe bis ganze Sekunde, und eine Datenprüfung über 50.000 Zeilen wäre
  mit einzelnen Abfragen unbrauchbar. In der Mengen-Form prüft ein späterer Schreibweg für viele
  Zeilen mit einer Abfrage je Regel, und die Datenprüfung ruft dieselbe Regel für eine ganze
  Tabelle auf. Wird die Form jetzt festgelegt, muss später keine Regel umgeschrieben werden.
  _Preis:_ Eine Regel ordnet ihre Gründe den Zeilen zu, statt für eine Zeile ja oder nein zu
  sagen. _Laufzeit:_ Für den einzelnen Klick ändert sich nichts. Die Zahlen sind Schätzungen.
- **D334 Die Ablehnung ist ein dritter erwarteter Fehler, und jeder Grund ist typisiert definiert
  (ändert ADR 0020, beantwortet den offenen Punkt aus ADR 0023).** Neben „nicht gefunden“ und dem
  Konflikt kennt jede Operation die Ablehnung, in derselben Form: eine Liste von Gründen. Ein
  Grund trägt einen Code, eine Schwere, die Zeile, wahlweise ein Feld und Einzelheiten. Der Vertrag
  eines Moduls zählt die Codes nicht auf. Ein Grund wird einmal definiert, von dem, dem er gehört:
  ein fester Code und ein Schema für seine Einzelheiten, bei den Verträgen des Pakets. Daraus folgt
  die Typsicherheit an vier Stellen:
  1. **Die Regel** kann nur mit Gründen antworten, die sie angibt.
  2. **Der Text** bekommt die Einzelheiten typisiert.
  3. **Die App** kompiliert nur, wenn jeder Grund einen Text hat. Erst dort sind alle Regeln
     bekannt.
  4. **Eine Seite, die gezielt reagieren will**, fragt nach einem bestimmten Grund und bekommt
     seine Einzelheiten typisiert.

  Der Konflikt bleibt, was er ist: ein doppelter Wert, dessen Grund das Modul selbst aufzählt.
  _Gründe:_ Zählte der Vertrag die Gründe auf, müsste `time-tracking` den Grund „abgerechnet“ der
  Abrechnungs-Brücke nennen. Das untere Modul kennte ein Wort des oberen, jede neue Brücke änderte
  die Verträge darunter, und der Test des Moduls könnte den Grund allein nicht auslösen. Das war
  die Schwäche der alten App. Der Einwand des Owners gegen die erste Fassung, einen freien Code:
  Die Typsicherheit darf nicht verloren gehen. _Preis:_ Der Compiler zwingt die Seite von
  `time-tracking` nicht, den Grund einer Brücke einzeln zu behandeln; das ist gewollt, die Seite
  zeigt jede Ablehnung über ein gemeinsames Bauteil. Die Liste der Gründe muss beim Zusammenstellen
  der App typisiert bleiben; für Module gibt es so eine Liste schon, ausprobiert ist es für Gründe
  nicht. Je Grund eine Definition mehr. _Laufzeit:_ keine. _Verworfen:_ jede Operation zählt die
  Gründe in ihrem Vertrag auf; ein freier Text als Code mit einem Test statt des Compilers.
- **D335 Jedes Modul benennt seine Tabellen.** Es liefert für jede synchronisierte Tabelle einmal
  den Namen in Einzahl und Mehrzahl, auf Deutsch und Englisch. Der Text der Verweis-Prüfung setzt
  daraus den Satz zusammen: „‚Website Relaunch‘ lässt sich nicht löschen: 12 Zeiteinträge, 3
  Aufgaben und 2 Termine verweisen darauf.“ Fehlt ein Name, kompiliert das Modul nicht. _Gründe:_
  Die Verweis-Prüfung gehört dem Rahmen und kennt nur Tabelle und Anzahl; `projects` kennt das Wort
  „Zeiteinträge“ nicht. Der Name dient danach auch dem Papierkorb, dem Bericht der Datenprüfung,
  der Zusammenfassung eines Imports und dem Assistenten. _Preis:_ Auch eine Verknüpfungstabelle
  braucht ein Wort, das der Nutzer versteht. Der Satz ist formelhaft; ein einzelner Verweis kann
  später einen eigenen Satz bekommen, gebaut wird das nicht. _Laufzeit:_ keine. _Verworfen:_ jeder
  Verweis bringt seinen eigenen Satz mit (ein Satz je Verweis in zwei Sprachen, und der Ton läuft
  auseinander); kein Name, immer „wird noch verwendet“ (sagt nicht, was aufzuräumen wäre).
- **D336 Außerhalb eines Formulars erfährt der Nutzer die Ablehnung nach dem Klick; das
  Bearbeitungsformular weiß es vorher.** Im Zeilenmenü, im Befehl und beim Assistenten kommt die
  Ablehnung nach dem Versuch, mit Begründung und Ausweg. Das Bearbeitungsformular fragt beim
  Öffnen einmal die Auskunft für seinen Eintrag und zeigt Gesperrtes vorab als gesperrt, mit
  Begründung; das gilt für Felder und für die Aktionen im Formular. Die Projektseite hängt an die
  Ablehnung eines Löschens den Knopf „Archivieren“. _Gründe:_ Der Owner: Normal reicht es, erst
  dann informiert zu werden; ein Bearbeitungsformular soll aber vorher wissen, was gar keine
  Möglichkeit ist. Nach dem Klick kostet nichts und kann nicht veralten. _Folge für den ersten
  Fall:_ „Löschen“ gibt es bei Projekten nur in der Schublade. Sie zeigt es gesperrt mit „12
  Zeiteinträge verweisen darauf“, „Archivieren“ steht daneben; die Auskunft wird also bis zur Seite
  gebaut. _Preis:_ Außerhalb eines Formulars sieht „Löschen“ verfügbar aus, auch wenn es nicht
  geht. _Laufzeit:_ eine Anfrage je geöffnetem Formular, geschätzt wenige Millisekunden, nicht
  gemessen. Entsteht ein Verweis, während das Formular offen ist, lehnt der Klick ab. _Verworfen:_
  die Auskunft mit jeder Zeile der Liste (jeder gestartete Timer machte die Projektliste ungültig,
  und `projects` hinge an den Tabellen der Module über ihm); die Auskunft beim Öffnen jedes Menüs
  als Regel für alle Aktionen.
- **D337 Die Verweis-Prüfung schützt drei Wege von selbst (führt D306 aus, ändert D330).** Der
  Satz, der immer gilt: Keine ungelöschte Zeile zeigt auf eine gelöschte. Der Rahmen liest die
  Fremdschlüssel aus der Datenbank und schützt für jede Tabelle:
  1. **Ziel löschen:** abgelehnt, solange eine ungelöschte Zeile darauf verweist.
  2. **Verweisende Zeile wiederherstellen:** abgelehnt, wenn ihr Ziel gelöscht ist. Der Grund nennt
     das Ziel, das zuerst zurückkommen muss.
  3. **Anlegen oder Ändern mit Verweis:** abgelehnt, wenn das Ziel gelöscht oder unbekannt ist. Der
     Grund trägt das Feld.

  Ein archiviertes Ziel bleibt gültig, und eine archivierte Zeile schützt weiter (D327, D330).
  _Gründe:_ Prüfte jede Operation ihr Ziel selbst, wie D330 es für `time-tracking` beschrieb,
  entstünde still ein Zeiteintrag auf ein gelöschtes Projekt, sobald ein Modul es vergisst.
  _Beispiel:_ Das Formular eines Zeiteintrags ist offen, das Projekt „Altlast“ gewählt; in einem
  zweiten Fenster wird „Altlast“ gelöscht, was geht, weil nichts darauf verweist. Beim Speichern
  lehnt der Rahmen ab, und am Feld steht „Dieses Projekt wurde gelöscht“. _Preis:_ „Rückgängig“ für
  einen gelöschten Eintrag kann scheitern. _Laufzeit:_ Beim Anlegen und Ändern je gesetztem
  Verweisfeld ein Nachschlagen über den Primärschlüssel. Timer stoppen ändert kein Verweisfeld und
  kostet nichts. Erwartet weit unter einer Millisekunde, nicht gemessen. _Verworfen:_ nur die
  ersten beiden Wege, und beim Anlegen und Ändern prüft die Operation selbst.
- **D338 Ein Verweis schützt, geht mit oder bleibt; ein Grund ist blockierend oder warnend (ändert
  D306).** Ein Verweis erklärt, was beim Löschen seines Ziels geschieht:

  | Art | Beim Löschen des Ziels | Beispiel |
  | --- | --- | --- |
  | **schützt** (Standard) | wird abgelehnt | heute jeder Verweis |
  | **geht mit** | die verweisenden Zeilen werden mitgelöscht, mit Warnung | später Zeiteinträge eines Projekts |
  | **bleibt** | das Ziel wird gelöscht, die Zeilen bleiben stehen | Tags (D150) |

  Jetzt schützt jeder Verweis. „Bleibt“ heißt: Der Verweis schützt sein Ziel nicht vor dem Löschen,
  sonst nichts; die anderen beiden Wege aus D337 bleiben geschützt, die Datenprüfung meldet ihn
  nicht, und wer liest, blendet gelöschte Ziele aus oder markiert sie. Erklärt wird die Art vom
  Modul, dem die verweisende Tabelle gehört. „Bleibt“ wird mit den Tags (#111) gebaut. Über „geht
  mit“ entscheidet der Owner endgültig im Papierkorb-Paket. Die Schwere „warnend“ gehört zum Format
  der Gründe; gebaut wird jetzt nur „blockierend“. _Gründe:_ Das Bild des Owners für später: Wer
  ein Projekt löscht, wird gewarnt, dass seine Zeiteinträge mitgelöscht werden; ist einer davon
  ausgezahlt, geht es nicht, weil ein ausgezahlter Zeiteintrag nicht gelöscht werden kann. Der
  zweite Teil ergibt sich von selbst: Das Mitlöschen läuft über dieselben Schreibwege (D332), also
  greift dort die Regel des ausgezahlten Eintrags und lehnt die ganze Aktion ab. _Beispiel für
  „bleibt“:_ Der Tag „Kunde A“ hängt an 40 Projekten. Er wird gelöscht, die 40 Zuordnungen bleiben
  stehen, und wer ihn wiederherstellt, hat alle 40 sofort zurück. _Was „geht mit“ später kostet:_
  Das Wiederherstellen muss genau die Zeilen zurückholen, die mit dem Ziel gelöscht wurden, also
  muss gespeichert werden, was zusammen gelöscht wurde; ein Projekt mit 5.000 Einträgen braucht den
  Schreibweg für viele Zeilen; die Operation antwortet mit der Warnung, und der Aufrufer ruft mit
  der Bestätigung erneut auf. _Verworfen:_ die Schwere erst mit der ersten Warnung ins Format
  aufnehmen (mein Vorschlag; der Owner: Warnungen gehören zum System).
- **D339 Die Auskunft fragt nach Tabelle und Art des Schreibens und liest nur.** Eine gemeinsame
  Abfrage für alle Module: Was ist für diese Zeilen dieser Tabelle gesperrt, und warum? Sie ruft
  dieselben Regeln auf wie das Verhindern. Die Seite ordnet ihre Knöpfe selbst zu, etwa „Löschen“
  zu „Löschen dieser Zeile in `projects`“. _Gründe:_ Die Auskunft liest nur, kann Feldsperren als
  Gründe mit Feld zurückgeben und geht dank der Mengen-Form (D333) mit vielen Zeilen um. _Preis:_
  Fragt die Seite nach dem falschen Schreibvorgang, zeigt sie etwas Falsches an; das Verhindern
  greift trotzdem. Eine Operation mit mehreren Schritten bekommt vorab keine vollständige Auskunft
  und kann später eine eigene mitbringen. _Laufzeit:_ eine Anfrage je Öffnen; bei einem Projekt mit
  5.000 Zeiteinträgen eine Zählung über 5.000 Indexeinträge, erwartet unter einer Millisekunde,
  nicht gemessen. _Verworfen:_ ein Probelauf der Operation, der danach alles rückgängig macht (er
  schreibt bei jedem Öffnen eines Formulars, nimmt die Schreibsperre der Datenbank, kann keine
  Feldsperren beantworten und löschte später zur Probe 5.000 Zeilen).
- **D340 Zwei Arbeitspakete, Schnitt am Port (ändert die Reihenfolge aus D316).** #274 baut den
  Datenprozess: Schutzregeln anmelden, die Schreibwege, die Ablehnung im Vertrag, die
  Verweis-Prüfung, die Auskunft als Abfrage, die Lint-Regel und eine Messung mit 50.000 Zeilen.
  #313 baut die Oberfläche: Ablehnung und Auskunft im Aufruf-Haken und in den festen Antworten,
  Texte je Grund, Namen je Tabelle, den gemeinsamen Hinweis, die gesperrte Aktion im Formular und
  die Projekt-Schublade. Reihenfolge: #274, #313, dann weiter bis #275. _Gründe:_ Die Grenze liegt
  bei rund 4.500 neuen Zeilen; die letzten beiden Pakete lagen bei 4.990 und 6.152. Nach #274 ist
  in der App nichts zu sehen, was nicht schadet: Bis `time-tracking` existiert, verweist nichts auf
  ein Projekt. _Preis:_ #313 trägt eine höhere Nummer als #275 und blockiert es doch; die Regel
  „Blocker haben kleinere Nummern“ bricht einmal. _Nicht gebaut, kommt mit dem ersten echten
  Fall:_ die Datenprüfung, Feldsperren und eigene Regeln eines Moduls, Regeln einer Brücke, Regeln,
  die den Aufrufer sehen, Schreibwege für viele Zeilen, Warnungen mit Bestätigung, „geht mit“ und
  „bleibt“.

## Später, mit Vorschlag

Diese Fragen gehen mit ihrer vorgeschlagenen Antwort in die Spezifikationen von #274 und #313. Wer
baut, darf anders entscheiden und nennt es im Pull Request.

- **Fremdschlüssel lesen:** einmal beim Start des Datenprozesses nach den Migrationen, danach im
  Speicher.
- **Index-Pflicht:** Die Konventionsprüfung verlangt einen Index auf jeder verweisenden Spalte.
- **Weg der Regeln:** Sie erreichen die Schreibwege über den Kontext, den der Rahmen je Aufruf
  baut.
- **Zählung:** eine je verweisender Tabelle, nur in Ablehnung und Auskunft.
- **`space_id`:** Die Konventionsspalte ist kein Verweis im Sinn der Prüfung.
- **Spaces:** Ein Verweis aus jedem Space schützt das Ziel. Ein neuer Verweis muss auf eine
  ungelöschte Zeile im selben Space zeigen.
- **Lokale Tabellen:** Ein Verweis aus einer lokalen Tabelle schützt nie.
- **Verweis auf die eigene Tabelle:** dieselbe Regel, also erst die Kinder löschen.
- **Archivieren:** Die Verweis-Prüfung schützt es nicht.
- **Unbekanntes Ziel:** wird wie ein gelöschtes abgelehnt.
- **Auskunft im Formular:** einmal beim Öffnen und nur für die Aktionen, die es zeigt. Sie
  aktualisiert sich nicht, solange das Formular offen ist; den Rest fängt die Ablehnung.
- **Ausnahmen der Lint-Regel:** das Anlegen des persönlichen Space in `spaces`.
- **Messung:** 50.000 Zeilen, mit Eintrag in `docs/development/performance.md`.
- **Tests:** Die Testmodule `notes` und `note-links` belegen den geschützten Verweis, das
  Testmodul `project-entries` den Verweis auf ein Projekt.
- **Begriffe im Glossar:** Protection Rule (Schutzregel), Refusal (Ablehnung), Reason (Grund),
  Clearance (Auskunft). Sie entstehen beim Bau von #274.
- **Dokumente:** ein neuer ADR für die Schutzregeln, die Anpassung von ADR 0020 und ADR 0023 und
  des Leitfadens zum Port-Muster. Sie entstehen beim Bau.

## Vorgemerkt

- **„Geht mit“:** ob die Zeiteinträge eines Projekts beim Löschen mitgehen, und was dafür
  gespeichert wird, damit das Wiederherstellen sie zurückholt. Papierkorb-Paket.
- **Warnungen:** wie ein Aufrufer eine Warnung bestätigt. Mit der ersten Regel, die warnt.
- **Datenprüfung:** nach Sync und Import, mit denselben Regeln (D331, D333). Sync-Phase und
  Schicht 5.
- **Regeln mit Aufrufer:** die Erlaubnisse eines Assistenten und später die Mitglieder eines
  Space.
- **Auskunft für Operationen mit mehreren Schritten:** eine eigene Auskunft der Operation, falls
  die nach Tabelle und Art des Schreibens nicht reicht (D339).
