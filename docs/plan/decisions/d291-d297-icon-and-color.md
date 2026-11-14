# Runde 38 (2026-11-14): Icon und Farbe an Entitäten (#106, ändert und schärft D151)

Grundlage: der Stand von `theme` (acht Farbsätze, Kontrastprüfung, Mantine-Anbindung) und `icons`
(14 Icons der Oberfläche, einzeln importiert), die alte App (nur gelesen, Pfad in
`research-layer-3-core.md`) und Messungen dieser Runde:

- **Icon-Namen der alten App:** fünf Listen, eine je Entität (Projekt 36, Gewohnheit 43, Konto 14,
  Dauerbuchung 20, Aufgabenstatus 28). Zusammen 129 Namen für 106 Bilder. 21 Bilder haben zwei oder
  drei Namen (`fitness`, `gym` und `barbell` sind dieselbe Hantel). Ein Name ist mehrdeutig:
  `savings` ist bei Gewohnheiten Münzen, bei Konten ein Schild, bei Dauerbuchungen ein Sparschwein.
  Von den 131 Paaren aus Name und Bild beschreiben 69 das Bild, 62 eine Bedeutung in einer Entität
  (`growth`, `rent`, `salary`).
- **Farben der alten App:** zwölf Namen (`red`, `pink`, `grape`, `violet`, `indigo`, `blue`,
  `cyan`, `teal`, `green`, `lime`, `yellow`, `orange`), dazu `gray` am Aufgabenstatus „Inbox“ und
  vereinzelt alte Hex-Werte.
- **Kontrast:** Weiß auf dem alten Gelb `#fab005` hat 1,86:1, auf Limette `#82c91e` 2,03:1, auf
  Cyan `#15aabf` 2,79:1. Eine helle gelbe Füllung hat auf Weiß 1,72:1. Entwürfe für alle vier neuen
  Farbsätze bestehen jedes Paar der heutigen Prüfung, mit heller wie mit abgedunkelter Füllung
  (Wegwerf-Skript, WCAG-Formel).
- **Größe:** Ein Phosphor-Icon bringt alle sechs Strichstärken mit: 1.568, 5.640 und 5.750 Bytes in
  drei Stichproben. 106 Icons sind hochgerechnet grob 400 KB. Der Start liegt bei 839.270 Bytes und
  darf 869 KiB nicht überschreiten (D258, D269).
- **Emoji-Regel:** Die offizielle Unicode-Liste (`\p{RGI_Emoji}`) braucht das Regex-Flag `v`. Node
  26.13 kann es; für Hermes ließ es sich nicht belegen. Die Regel der alten App läuft auf Hermes,
  nimmt aber auch Zeichen wie © an.
- **Die Marke der alten App:** zwei Formen. Das nackte, getönte Icon steht an 9 Stellen
  (Navigationslisten, Tabs, Zeilen), die weiche Kachel an 15 Stellen (Karten, Detailköpfe,
  Auswahl, Formulare). Füllungen bekamen ihre Schriftfarbe über Mantines `autoContrast`.

- **D291 #106 liefert Werte, Anzeige und Auswahl (weitet den Zuschnitt aus D151).** Vier Slices:
  die vier Farbsätze; Namen, Schemas und Auflösung ohne React; das Verzeichnis und die Marke; die
  Auswahl für Icon, Emoji und Farbe. _Gründe:_ Das erste Formular für Projekte braucht alle Teile,
  fünf Entitätsarten teilen sie, also gehören sie nicht ins Projekte-Paket. Ohne die Marke weiß die
  Kontrastprüfung nicht, welche Farbpaare ein Eintrag wirklich benutzt. _Preis:_ Die Auswahl
  entsteht vor ihrem ersten echten Formular; ihre Schnittstelle richtet sich an der alten App und am
  Bearbeiten-Drawer aus. _Verworfen:_ nur Werte (mischt geteilte Bausteine in das erste Fachmodul);
  Werte und Anzeige, die Auswahl mit Projekten.
- **D292 Ein Icon-Name je Bild, benannt nach dem Bild; der Import übersetzt (ändert „mit den alten
  Namen“ in D151).** Das Verzeichnis hat 106 Namen. Ein Name beschreibt, was zu sehen ist (`house`,
  `briefcase`, `barbell`, `piggy-bank`), nicht, was es in einer Entität bedeutet. Die Namen gehören
  der App und folgen nur in der Schreibweise Phosphor: Wechselt die Icon-Bibliothek, bleibt der
  Name und zeigt auf das neue Bild. Der Import übersetzt über eine Tabelle aus Entitätsart und
  altem Namen (131 Zeilen); das Bild jedes Eintrags bleibt dasselbe. Die Tabelle entsteht jetzt in
  `icons` als Daten mit einem Test: Jedes alte Paar führt auf einen Namen des Verzeichnisses. Wer
  später ein Bild entfernt, bricht diesen Test. _Gründe:_ `savings` erzwingt das Übersetzen
  ohnehin, weil ein Name in einem gemeinsamen Verzeichnis nur ein Bild haben kann. Mit 129 Namen
  trügen gleiche Bilder verschiedene gespeicherte Werte; die Auswahl, jeder Vergleich von Icons und
  ein späterer Assistent müssten Zweitnamen auflösen, und Zweitnamen ließen sich nie mehr
  entfernen, weil Daten sie tragen. Das in D151 verworfene „beim Import umbiegen“ galt den Farben,
  wo ein Umbiegen das Aussehen ändert; die zwölf Farbnamen bleiben unangetastet. _Preis:_ Der
  Import schreibt 62 der 131 Paare um, und die Tabelle entsteht, bevor ihr Nutzer gebaut ist.
  _Verworfen:_ die 129 Namen übernehmen; Zweitnamen im Verzeichnis führen, die das Lesen annimmt
  und das Schreiben ersetzt.
- **D293 Ein Vorrat für die ganze App, und die Werte laufen ohne React und ohne Browser (schärft
  D151).** Alle Bilder liegen in `icons`; jede Entitätsart darf jedes wählen, und kein Modul führt
  eine eigene Liste. Zwei Wege führen zum selben Vorrat: Die Oberfläche importiert ihre Icons
  einzeln im Code, nur diese liegen im Start; das Verzeichnis „Name → Bild“ ist ein eigener
  Einstieg, der mit der ersten Ansicht lädt, die ihn braucht. Namensliste, Schema und Erkennung
  liegen in einem Einstieg ohne React und ohne Browser und benutzen nichts, was Hermes fehlt, damit
  die spätere Mobile-App sie nutzt wie in der alten App. Das Web-Verzeichnis ist gegen die
  Namensliste typisiert; ein späteres Verzeichnis für React Native wird es auch, und ein fehlendes
  Bild ist dann ein Typfehler. Gebaut wird jetzt nur das Web-Verzeichnis: Das Repo hat keine
  Mobile-App, die ein zweites prüfen könnte. _Preis:_ Die Marke und die Auswahl in `ui` sind
  Mantine; Mobile bekommt eigene. _Verworfen:_ das Verzeichnis im Start (grob 400 KB bei 30 KB
  Luft bis zur Grenze).
- **D294 Im Vertrag eines Moduls wird streng geschrieben und der gespeicherte Text unverändert
  gelesen (führt „streng schreiben, nachsichtig lesen“ aus D151 aus).** Vier Regeln, die jedes
  Modul mit Icon oder Farbe kopiert:
  1. Die Eingabe einer Operation nimmt für `icon` nur einen bekannten Namen oder genau ein Emoji,
     für `color` nur den Namen eines Farbsatzes, jeweils oder leer. Alles andere ist ein
     Eingabefehler. Geprüft werden nur die Felder, die der Aufruf mitbringt.
  2. Die Antwort eines Ports trägt `icon` und `color` als Text oder leer, ohne Prüfung gegen die
     Listen.
  3. Aufgelöst wird an einer Stelle: Zwei Funktionen in den Einstiegen ohne React machen aus dem
     Text „bekanntes Icon“, „Emoji“ oder „nichts“ und „bekannter Farbsatz“ oder „nichts“. Die Marke
     ruft sie auf; kein Modul prüft selbst.
  4. Leer heißt Standard: kein Icon zeigt das Standard-Icon der Entitätsart, keine Farbe die
     neutrale Farbe. Es gibt keinen gespeicherten Namen für „Standard“ und keinen leeren Text.

  _Gründe:_ Ein Port prüft seine Antwort gegen den Vertrag. Stünde dort die strenge Liste, ließe
  ein einziger unbekannter Wert die ganze Abfrage scheitern: Ein Gerät mit älterer Version zeigte
  nach einem Sync statt der Projektliste einen Fehler. Mit Text in der Antwort zeigt es alle
  Projekte, eines mit dem Standard-Icon, und beim Umbenennen bleibt das unbekannte Icon stehen.
  _Preis:_ Der Typ eines gelesenen Icons ist nur Text. Dass er durch die Auflösung geht, erzwingt
  nicht der Compiler, sondern die Marke als einziger Baustein, der Icons von Einträgen zeichnet.
  _Verworfen:_ Der Datenprozess macht Unbekanntes beim Lesen zu „leer“ (saubere Typen, aber
  speichert das ältere Gerät den Eintrag, ist das Icon des neueren weg).
- **D295 Ein Farbsatz darf dunkle Schrift auf heller Füllung tragen; die Schriftfarbe kommt aus dem
  Farbsatz (schärft D151, bestätigt D109).** Gelb, Limette und Cyan bekommen eine helle Füllung
  mit dunkler Schrift, Rot bleibt bei weißer Schrift. _Gründe:_ Die Füllung ist die Farbe in
  Balken, Kalenderblöcken und Diagrammen; dort müssen zwölf Farben auseinanderzuhalten sein. Mit
  abgedunkelter Füllung wird Gelb Bronze, Limette rückt an Grün, und Cyan ist von Petrol kaum zu
  trennen. _Preis:_ Die stille Regel „auf jeder Füllung steht Weiß“ endet; ein Baustein nimmt die
  Schriftfarbe immer aus dem Farbsatz. Kontrastprüfung und Mantine-Anbindung rechnen schon in beide
  Richtungen, es kommen drei Werte im Katalog dazu und keine Zeile in einem Baustein. Ein Modul
  mit Gelb als Modulfarbe bekommt ebenfalls dunkle Schrift auf gefüllten Flächen. _Verworfen:_
  abgedunkelte Füllungen für alle zwölf; Mantines `autoContrast` als Quelle der Schriftfarbe (es
  entscheidet erst im Browser, nur für Mantine-Bausteine und nur zwischen Schwarz und Weiß; die
  Kontrastprüfung sieht nur, was die Theme-Engine berechnet, ADR 0009).
- **D296 Die Marke eines Eintrags hat zwei Formen, und das getönte Icon ist lesbar (schärft „wie
  die Modulfarben“ in D151).** Ein Baustein zeichnet Icon oder Emoji eines Eintrags in dessen
  Farbe. Ohne Angabe ist es das nackte, getönte Icon, wie die Navigation Module zeichnet; die
  weiche Kachel (farbiges Icon auf der weichen Füllung) wählt, wer eine Karte oder einen Detailkopf
  baut. Eine gefüllte Kachel gibt es nicht. Das getönte Icon trägt in beiden Formen die Textfarbe
  des Farbsatzes mit 4,5:1; die Kontrastprüfung bekommt keine Ausnahme. _Folgen:_ In der nackten
  Form ist bei einem Emoji die Farbe des Eintrags nicht zu sehen, wie in der alten App. Im hellen
  Farbmodus ist das Icon eines gelben Eintrags ockerfarben, das eines limettenfarbenen oliv; das
  satte Gelb steht dort, wo es Fläche ist. Für die weiche Kachel kennt die Prüfung das Paar
  „farbiger Text auf weicher Füllung“ schon. _Verworfen:_ die weiche Kachel als Standard; das Icon
  in der satten Füllung wie in der alten App (Gelb 1,7:1 auf Weiß, die erste Ausnahme von D112).
- **D297 Alle Icons der App sind standardmäßig duotone.** Das gilt für die Icons der Oberfläche
  und die der Einträge. „regular“ war eine Wahl beim Bau des Katalogs (#73) ohne Eintrag im Log.
  _Gründe:_ Der Owner will den Strich der alten App; Icons von Einträgen und Modulen bleiben eine
  Familie. _Preis:_ keiner bei der Größe, jedes Phosphor-Icon bringt alle Strichstärken mit. Jeder
  Bildschirm ändert sich; Icons ohne umschlossene Fläche wie Plus und X sehen gleich aus. Die
  Änderung kommt als eigene kleine Änderung vor den Slices, damit man sie in der App für sich
  ansieht.

## Abnahmekriterien von #106

„Die alten Icon-Namen werden alle akzeptiert“ wird zu: Jedes alte Icon hat ein Bild im
Verzeichnis, und die Übersetzungstabelle ist geprüft (D292). „Die alten Farbnamen werden alle
akzeptiert“ gilt für die zwölf Namen; `gray` schreibt der Import als leer. Neu: Das Verzeichnis
liegt nicht im Start, und der Build prüft das (D293). Ein unbekannter gespeicherter Wert lässt
keine Abfrage scheitern (D294).

## Später, mit Vorschlag

Diese Fragen gehen mit ihrer vorgeschlagenen Antwort in die Spezifikation von #106. Wer baut, darf
anders entscheiden und nennt es im Pull Request des Arbeitspakets.

- **Emoji-Regel:** die Regel der alten App als Grundlage, weil sie auf Hermes läuft; ihre Lücke
  bei Zeichen wie © wird geschlossen. Eine Regel für alle Geräte, sonst hält ein Gerät für gültig,
  was das andere ablehnt.
- **Neutrale Farbe:** kein Wert. Der Import schreibt `gray` als leer und alte Hex-Werte als Namen.
- **Standard-Icon:** gibt der Aufrufer je Entitätsart vor.
- **Namensform:** Kleinbuchstaben, Ziffern und Bindestrich; ein Name wird nie umbenannt.
- **Einstiege ohne React:** je einer in `theme` und `icons`; die Namensliste ist die Quelle, das
  Verzeichnis ist gegen sie typisiert. Die Schemas ziehen Zods vollen Build nicht in den Start
  (D269).
- **Laden:** Das Verzeichnis ist ein eigener Einstieg, der nie im Start liegt; die Start-Prüfung
  nimmt ihn in ihre Liste auf.
- **CSS-Bereich:** ein neutraler Name statt `data-module-color`, von Modulen und Einträgen
  gemeinsam genutzt.
- **Rot:** bekommt den Wert der Fehlerfarbe des Themes Neutral, wie in der alten App.
- **Auswahl:** Beschriftungen der 106 Icons in zwei Sprachen, Suche über die Beschriftung, Farben
  in der Reihenfolge des Farbkreises.
- **Dokumentation beim Bau:** ein ADR zum Vertragsmuster und zu den Namen; im Glossar nennt der
  Eintrag „Color Set“ zusätzlich die Farbe eines Eintrags.
