# Runde 28 (2026-11-11): Einstellungsbereich (#23, verfeinert D77, D115, ändert D80 und D116)

- **D197 Einstellungszeilen sind Daten, Seiten und Suche entstehen aus derselben Liste.** Jede
  sichtbare Zeile des Einstellungsbereichs steht einmal in einer Liste: ID, View, Titel, optionale
  Beschreibung, Suchwörter und ein Bedienelement oder ein Wert. Die Seite einer View zeichnet ihre
  Zeilen der Reihe nach, die Suche filtert dieselbe Liste. Eine Zeile ist keine Einstellung: Sie
  bedient eine, mehrere oder keine („Theme“ schreibt zwei Einstellungen, „Version“ keine, die Breite
  der Modul-Sidebar hat keine Zeile). Besonderes wie die Theme-Auswahl zeichnet den rechten Teil
  frei, bleibt aber eine Zeile mit Titel und Suchwörtern. Die Liste liegt hinter `load` und kommt
  nicht ins Startpaket. Der Erweiterungspunkt für Module wird noch nicht gebaut; die Form der Zeile
  liegt so, dass Module sie später importieren können. Beim Bauen entsteht dazu ein ADR. _Preis:_
  Jede Zeile muss in die Form „Titel, Beschreibung, Bedienelement“ passen. _Verworfen:_ frei gebaute
  Seiten mit getrennt gepflegtem Suchindex (läuft auseinander, sobald jemand eine Einstellung
  ergänzt); Suche nur über die Titel der Views (kann die Befehlspalette schon, erfüllt D80 nicht).
- **D198 Eine View entsteht erst mit echtem Inhalt (ändert D80).** #23 baut vier Views: Darstellung,
  Sprache, Tastenkürzel, Über. „Module“ und „Daten“ kommen mit ihrer ersten echten Zeile, „Daten“
  also mit der Sicherung (#35). „Sprache“ heißt „Sprache und Region“, sobald die Region kommt
  (D153). Wer die Einstellungen öffnet, landet auf „Darstellung“. _Verworfen:_ alle sechs sofort mit
  Platzhaltern (ein Klick in eine leere Seite, die Suche findet dort nichts).
- **D199 Das Suchfeld sitzt oben im Inhalt, Treffer sind bedienbare Zeilen.** Die gemeinsame
  Seiten-Komponente aller vier Views setzt das Feld über die Zeilen, es ist damit in jeder
  Layoutstufe sichtbar. Mit Suchtext zeigt der Inhalt statt der View die passenden Zeilen aller
  Views, nach View gruppiert und mit ihren Bedienelementen; ein leeres Feld zeigt wieder die View.
  Der Suchtext steht als Suchparameter in der Adresse und bleibt beim Wechsel der View erhalten.
  Durchsucht werden Titel, Beschreibung, Suchwörter und Werte in der angezeigten Sprache, nach den
  Regeln der Befehlspalette (D184: Wortanfang vor Wortmitte, keine Tippfehler-Suche); ohne Treffer
  erscheint `EmptyState`. Der Einstellungsbereich lädt dafür als ein Paket nach, nicht je View. Die
  Hülle bleibt unverändert: Während der Suche bleiben die Markierung in der Modul-Sidebar und der
  Seitentitel bei der View aus der Adresse. _Verworfen:_ das Feld im Groups-Bereich, wie #23 es
  vorschlug (läge unter der View-Liste und ab der Layoutstufe „schmal“ in der Schublade);
  Sprungliste mit Hervorhebung (ein Klick mehr, zweiter Suchparameter, Scrollen und Hervorheben).
- **D200 Die App-Sprache folgt allein dem Store.** Sie ist die Synced Setting `i18n.language` mit
  offenem Schema und dem Standardwert `system`. Der Picker bietet „System“, „Deutsch“ und „English“
  und schreibt nur die Einstellung; die Sprachen stehen in ihrer eigenen Sprache. Ein Beobachter
  über dem Router reagiert auf jede Änderung des Werts, vom Picker, aus einem anderen Tab oder
  später vom Sync (D119), lädt den Katalog und schaltet dann um. Scheitert das Laden, bleibt die
  alte Sprache sichtbar, ein Hinweis meldet es, und der gespeicherte Wert bleibt (D117). Beim Start
  löst die App den gespeicherten Wert auf, der Store ist dann schon geladen (D113). Ein unbekannter
  Wert verhält sich wie `system` und bleibt gespeichert (D118). Bei `system` folgt die App einem
  Wechsel der Systemsprache sofort (`languagechange`). _Verworfen:_ erst laden, dann speichern
  (für Änderungen von außen bräuchte es den Beobachter trotzdem, also zwei Abläufe).
- **D201 Darstellung: Theme-Karten, ein oder zwei Picker, alles wirkt sofort.** Bei festem
  Farbmodus gibt es einen Picker „Theme“, der das Theme dieses Farbmodus schreibt, bei „System“
  zwei („Theme für Hell“, „Theme für Dunkel“). Ein Picker bietet nur Themes, die den Farbmodus
  mitbringen. Ein Theme ist eine Karte mit seinen echten Farben aus der Theme-Engine, auf Mantines
  `Radio.Card`. Farbmodus und Dichte sind Umschalter, der Akzent sind Farbkreise mit „Vom Theme“
  davor (nicht wählbar, wenn das aktive Theme keinen Akzent mitbringt), die Hintergrundtönung ist
  ein Schalter, die Schriftgröße ein Schieberegler mit fünf Rasten in Prozent. Es gibt keinen
  Speichern- und keinen Zurücksetzen-Knopf. _Verworfen:_ immer zwei Picker (einer ohne sichtbare
  Wirkung); `Select` (ein Theme sieht man erst nach der Wahl).
- **D202 Der Einstellungsbereich ist ein eigenes Paket (ändert D116).** Es enthält die Form der
  Einstellungszeile, die Seiten-Komponente mit Suche und die vier Views; der Arbeitsname ist
  `@self-engine/settings-area`, klar getrennt vom Store-Paket `@self-engine/settings`. Die App
  reicht Store, Befehlsliste und Versionsangaben an eine Funktion des Pakets, die den fertigen
  Hüllen-Beitrag zurückgibt. Die Deklarationen der Darstellung und der Sprache ziehen aus der App
  in einen Einstieg des Pakets ohne Oberfläche, weil die App sie schon vor dem ersten Bild braucht.
  D116 gilt weiter für alles andere: Jeder Besitzer deklariert seine Einstellungen selbst.
  _Verworfen:_ alles in `apps/web` (Module könnten die Form der Zeile nie importieren, die App
  bekäme eigene Oberflächen).
- **D203 „Tastenkürzel“ und „Über“ zeigen nur an.** „Tastenkürzel“ listet die Befehle mit
  Standardkürzel aus dem Register (D174) und dazu ⌘K, nach Modul gruppiert, die Kürzel der Hülle als
  „Allgemein“ zuerst. Die Zeilen entstehen aus dem Register und sind durchsuchbar; Befehle ohne
  Kürzel erscheinen erst mit dem eigenen Belegen (D75). „Über“ zeigt Version, Kanal (nur im
  Desktop), Betriebssystem, einen Knopf, der diese Angaben als eine Zeile kopiert, und die Lizenz.
  Im Desktop reicht die Brücke die Version aus `app.getVersion()` durch, weil ein Release sie erst
  beim Verpacken bekommt; im Web setzt der Build sie ein. Kein Update-Knopf und kein Kanalwechsel
  (#46), keine Links nach außen. _Verworfen:_ alle Befehle mit Strich (lange Liste ohne Nutzen,
  solange niemand Kürzel belegen kann).
- **D204 Begriffe: Ein Abschnitt ist eine View, die Zeile heißt Einstellungszeile.** Was #23
  „section“ nennt, ist eine View des Einstellungsbereichs; das Glossar meidet „section“ bereits bei
  _Group_. Neu ist _Settings Row_ (de: _Einstellungszeile_): eine Zeile des Einstellungsbereichs mit
  Titel, optionaler Beschreibung und Bedienelement oder Wert, und das, was die Suche findet. Der
  Glossareintrag entsteht beim Bauen.
