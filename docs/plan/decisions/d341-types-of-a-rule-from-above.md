# Runde 44 (2026-11-18): Woher eine Regel von oben ihre Typen bekommt (#274, beim Bau gefunden, ergänzt D331)

Grundlage: der Stand des Zweigs `feat/274-protection-rules` nach allen acht Unter-Tickets.

- **Was gebaut ist:** Eine Regel von oben wird beim Start des Datenprozesses angemeldet
  (`startDataProcess({ rules })`) und an allen Schreibwegen gefragt, auch in einer fremden
  Transaktion. Das Modul darunter und sein Vertrag erfahren nichts von ihr.
- **Was fehlt:** Eine Schutzregel bekommt den Tabellennamen, die Zeilen-ID und die geschriebenen
  Felder aus der Row Map, die man `protectionRule` übergibt. Die Row Map eines fremden Moduls ist
  privat (ADR 0020, Lint-Regel `no-foreign-row-map`, auch als reiner Typ). Ein gewöhnliches Paket
  kann eine Regel von oben deshalb heute nicht schreiben; nur ein Test und `data-process` können
  es, weil die Lint-Regel sie ausnimmt.
- **Wer es braucht:** noch niemand. `time-tracking` (#275) kommt mit der Verweis-Prüfung aus. Der
  erste echte Fall ist die Abrechnung: „Ein abgerechneter Zeiteintrag darf nicht mehr geändert
  werden, die Notiz ja, Dauer und Projekt nein.“ Die Regel muss sehen, welche Felder geschrieben
  werden.

- **D341 Das Modul darunter gibt frei, was von oben bewacht werden darf; gebaut wird es mit dem
  ersten echten Fall.** So wie ein Modul heute Lesebausteine freigibt, gibt es je Tabelle frei,
  was eine Regel von oben sehen darf: den Tabellennamen, die Zeilen-ID und ausgewählte Felder. Das
  Modul darüber schreibt seine Regel gegen diese Freigabe und liest Fremdes weiter nur über
  freigegebene Lesebausteine. #274 baut davon nichts; ADR 0023, ADR 0033 und der Leitfaden sagen,
  dass der typisierte Weg noch fehlt. Das Arbeitspaket, das die erste Regel von oben braucht, baut
  die Freigabe im Rahmen zuerst und legt dann erst ihre genaue Form fest. _Gründe:_ Das Modul
  darunter bestimmt, wovon andere abhängen, und sieht im eigenen Paket, wenn es ein freigegebenes
  Feld umbaut. Ohne echten Abnehmer wäre die Form geraten: Welche Felder man freigibt und ob eine
  Regel auf das Anlegen alle Werte braucht, zeigt erst die Abrechnung. _Beispiel:_ `time-tracking`
  gibt für `time_entries` Beginn, Ende und Projekt frei. Benennt es das Ende um, bricht zuerst die
  eigene Freigabe, dann die Regel der Abrechnung; die Notiz kann eine Regel von oben gar nicht
  ansprechen. _Preis:_ Jedes von oben bewachte Modul pflegt eine weitere öffentliche Oberfläche
  neben Vertrag, Lesebausteinen und unteren Funktionen. Bis zum ersten Fall ist das Fundament von
  oben nicht benutzbar, und das Arbeitspaket der Abrechnung fasst zuerst den Rahmen an. Geschätzt
  100 bis 150 neue Zeilen im Rahmen samt Tests, dazu ein bis drei Zeilen je freigegebener Tabelle;
  nicht gemessen. _Was der Compiler nicht fängt:_ Die Felder werden nur im Typ ausgeblendet; zur
  Laufzeit liegt das ganze Objekt vor, und wer castet, sieht alles. _Laufzeit:_ keine, es geht nur
  um Typen. _Verworfen:_ eine Ausnahme in der Lint-Regel, nach der Dateien mit Regeln die fremde
  Row Map als Typ importieren dürfen (rund 20 Zeilen): Das Modul darüber sähe alle Spalten, könnte
  an den Lesebausteinen vorbei direkt aus der fremden Tabelle lesen, und das Modul darunter bekäme
  beim Umbau kein Signal im eigenen Paket. Ebenfalls verworfen: die Freigabe jetzt in #274 bauen,
  mit einem Testmodul als einzigem Abnehmer.
