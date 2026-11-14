# Runde 39 (2026-11-14): Ein Feld für Icon und Emoji, mit Mantines Emoji-Auswahl (#264, ändert die Auswahl aus D291)

Diese Runde ändert, was #106 für die Auswahl gebaut hat: die drei Bausteine aus
Punkt 9 von ADR 0029. Was ein Eintrag speichert und was als Emoji gilt, bleibt (D294).

## Ausgangslage

- **Zwei Felder für einen Wert:** #106 hat `EntryIconPicker` und `EntryEmojiInput` gebaut. Beide
  schreiben in dasselbe Feld `icon`. Wählt jemand ein Emoji, wird das Icon-Feld leer; „Kein Icon“
  darf ein Emoji nicht löschen. Die Form der Bausteine war eine Wahl beim Bau ohne Eintrag im Log.
- **Das Emoji-Feld ist ein Textfeld:** Es verweist auf die Emoji-Tastatur des Betriebssystems und
  nimmt auch Text an, der kein Emoji ist. Dann zeigt es einen Fehler, von dem das Formular nichts
  erfährt.
- **Mantine 9.8.0** (2026-11-09) bringt das Paket `@mantine/emoji` mit `EmojiPicker`,
  `EmojiPickerPopover` und `EmojiPickerInput`. Die App steht auf 9.7.5.
- **Gemessen am 2026-11-14:** Das Paket bringt keine Emoji-Daten mit. `emojibase-data` 18.0.0 hat
  je Sprache etwa 790 KB (100 KB gzip), mit deutschen und englischen Namen und Suchwörtern. Der
  Code des Pickers hat unverkleinert etwa 45 KB (11 KB gzip). Alle 1.932 Emojis der Daten und ihre
  Hautton-Varianten, 3.972 Zeichen, bestehen `isSingleEmoji`.
- **Der Picker im Code:** Sein Suchfeld führt mit Pfeiltasten und Enter ins Raster; den Suchbegriff
  kann man von außen setzen und mitlesen. Er sucht in Namen und Suchwörtern, ein Emoji-Zeichen als
  Suchbegriff findet nichts. Der Wert von `EmojiPickerInput` ist eine Emoji-ID, nicht das Zeichen.
- **Noch kein Formular** benutzt die Bausteine, und kein Modul speichert ein Icon.

## Entscheidungen

- **D299 Ein Feld für Icon und Emoji (ändert die drei Bausteine aus D291).** Ein Knopf zeigt die
  aktuelle Marke, ob Icon oder Emoji, und öffnet ein Fenster mit den Reitern „Icons“ und „Emoji“
  und einem „Kein Icon“, das beides entfernt. _Gründe:_ Gespeichert wird ein Wert; zwei Felder
  dafür leeren sich gegenseitig, und zum Entfernen muss man wissen, in welchem der Wert wohnt.
  _Folgen:_ Der Baustein nimmt den gespeicherten Text und liefert Icon-Name, Emoji oder leer. Ein
  Formular bindet zwei Bausteine ein statt drei. Die Sonderregel aus ADR 0029, dass der
  Icon-Picker ein Emoji nicht löscht, entfällt. _Preis:_ `EntryIconPicker` wird umgebaut, samt
  Stories und Tests. _Verworfen:_ zwei getrennte Felder wie bisher.
- **D300 Die Emoji-Auswahl ist Mantines `EmojiPicker`.** Der Reiter „Emoji“ zeigt den nackten
  `EmojiPicker` aus `@mantine/emoji` in unserem eigenen Fenster; Mantine geht dafür auf 9.8.0.
  _Gründe:_ Mantine zuerst. Ein Raster ist ohne Tastenkürzel auffindbar, auf jedem Betriebssystem
  gleich, und lässt keine ungültige Eingabe zu. _Preis:_ zwei neue Abhängigkeiten (`@mantine/emoji`,
  `emojibase-data`) und die Emoji-Daten, die erst beim Öffnen des Reiters laden. Das Paket ist neu.
  _Verworfen:_ das Textfeld mit Verweis auf die Emoji-Tastatur; `EmojiPickerInput`, weil sein Wert
  eine ID ist; die Daten von emoji-mart, weil sie nur englische Namen haben und bei Emoji 15 enden.
- **D301 Ein Suchbegriff über beide Reiter.** Jeder Reiter behält sein eigenes Suchfeld an
  derselben Stelle, beide teilen den Begriff, und er überlebt den Reiterwechsel. _Gründe:_ Wer
  „Haus“ bei den Icons sucht und dann die Emojis sehen will, tippt nicht zweimal. Mantines eigenes
  Suchfeld bleibt, weil seine Tastaturführung ins Raster daran hängt. _Folgen:_ Die beiden Suchen
  vergleichen verschieden: unsere ignoriert Akzente, die von Mantine nicht. Die Reiter zeigen keine
  Trefferzahlen. _Verworfen:_ getrennte Begriffe; eine gemischte Trefferliste (wir müssten das
  Emoji-Raster selbst zeichnen, und die Emoji-Daten müssten beim ersten Tastendruck laden).
- **D302 Ein einzelnes gültiges Emoji im Suchfeld wird übernommen.** Ist der Suchbegriff, ohne
  Leerraum am Rand, genau ein Emoji nach der Regel aus `icons`, liefert das Feld es, leert den
  Begriff und schließt das Fenster. Das gilt in beiden Reitern und braucht die Emoji-Daten nicht.
  Jeder andere Text ist ein Suchbegriff. _Gründe:_ Einfügen aus der Zwischenablage und die
  Emoji-Tastatur des Betriebssystems bleiben nutzbar, ohne ein Textfeld mit Fehlerzustand; ein
  einzelnes Emoji als Suchbegriff fände ohnehin nichts. _Verworfen:_ nur das Raster; nur das
  Einfügen aus der Zwischenablage (die Emoji-Tastatur bliebe wirkungslos); das Textfeld daneben.

## Später, mit Vorschlag

Diese Fragen gehen mit ihrer vorgeschlagenen Antwort in die Spezifikation von #264. Wer baut, darf
anders entscheiden und nennt es im Pull Request des Arbeitspakets.

- **Datenquelle:** `emojibase-data` in der Sprache der App, Deutsch oder Englisch, so wie das Paket
  sie liefert. Gekürzt wird nur, wenn die Messung es verlangt.
- **Laden:** Picker und Daten laden beim ersten Öffnen des Reiters „Emoji“, die Daten je Sprache
  als eigenes Stück. Eine Regel der Start-Prüfung hält beides aus dem Start. Die Öffnungszeit wird
  gemessen und steht danach in `docs/development/performance.md`.
- **Erster Reiter:** der des gespeicherten Werts, sonst „Icons“.
- **Nicht darstellbare Emojis:** ausgeblendet. Ein Emoji von einem neueren Gerät kann anderswo als
  Kästchen erscheinen; das ist heute schon so.
- **Hautton:** wählbar, nicht gemerkt.
- **Vorschau und Kategorien:** beide an, wie Mantine sie liefert.
- **Texte:** Oberflächentexte und Kategorienamen aus unseren Katalogen. Das Feld heißt „Icon“, die
  Reiter „Icons“ und „Emoji“, das Entfernen „Kein Icon“.
- **Schnittstelle:** Der Baustein heißt weiter `EntryIconPicker`; `EntryEmojiInput` wird gelöscht.
- **Fremdes Emoji:** Ein gespeichertes Emoji, das die Liste nicht kennt, zeigt der Knopf, und es
  bleibt gespeichert, bis der Nutzer wählt oder entfernt.
- **Zuschnitt:** Mantine 9.8.0 kommt als eigener Pull Request vor dem Einbau.
- **Dokumente:** Punkt 9 von ADR 0029 wird an Ort und Stelle angepasst.
