# Runde 29 (2026-11-12): Fensterzustand (#24, verfeinert D78, D114)

- **D205 #24 merkt nur noch den Fensterzustand, die Windows/Linux-Titelleiste wartet (#167).**
  Gebaut wird nur eine macOS-dmg, und niemand kann ein Windows- oder Linux-Fenster ansehen;
  blind gebaut gingen Farben, Hover, Knopfbreite und Ziehbereich ungeprüft an Nutzer, die es
  noch nicht gibt. Bis zu einem Windows- oder Linux-Build behalten beide den nativen Rahmen.
  Startpunkte für #167, nicht entschieden: `titleBarOverlay` ohne eigenen Hintergrund,
  Symbolfarbe per IPC aus `useFinalColors`, Platz über `env(titlebar-area-*)`, Höhe wie die
  Kopfzeile. _Verworfen:_ blind bauen; Prüfung per Bildschirmfoto auf einem Windows-Runner.
- **D206 Gemerkt werden normale Bounds, maximiert und Vollbild, kurz nach jeder Änderung.** Die
  normalen Bounds (Fenster weder maximiert noch im Vollbild) bleiben im maximierten Zustand und im
  Vollbild erhalten, damit Wiederherstellen und Vollbild-Verlassen zu ihnen zurückführen. Die
  Datei trägt eine Formatversion. Geschrieben wird etwa 0,5 s nach der letzten Änderung und
  sofort beim Schließen, immer über eine Hilfsdatei, die umbenannt wird. Kosten: höchstens ein
  kleiner Schreibvorgang pro halbe Sekunde im Hauptprozess, der Renderer merkt nichts.
  _Verworfen:_ nur beim Schließen schreiben (Absturz, Zwangsbeenden und Neustart für Updates
  verlieren die Sitzung).
- **D207 Ist der gemerkte Platz auf keinem Bildschirm sichtbar, öffnet das Fenster in der
  gemerkten Größe zentriert auf dem Hauptbildschirm.** Immer passend auf die Arbeitsfläche
  verkleinert, nie schmaler als 576 px (D131). Fehlt die Datei, ist sie kaputt oder hat sie eine
  unbekannte Version, gilt das Standardfenster 1280 × 800. _Verworfen:_ ganz auf das
  Standardfenster zurückfallen (die eingestellte Größe ginge verloren); an den nächsten
  sichtbaren Rand schieben (schwer vorherzusagen).
- **D208 Maximiert und Vollbild kommen beim Start wieder** (bestätigt D78). Auf dem Mac heißt das:
  eigener Space beim Start. _Verworfen:_ Vollbild nicht wiederherstellen, nur maximiert.
- **D209 Begriff _Window State_ (de: _Fensterzustand_), die Vollbild-Lücke ist #168.** Neu im
  Glossar: wo das Desktop-Fenster war, wie groß, und ob maximiert oder im Vollbild, pro Kanal
  gemerkt; keine Einstellung. Der Glossareintrag entsteht beim Bauen. Im Vollbild blendet macOS
  die Fensterknöpfe aus, die Hülle hält ihren Streifen aber frei; das zu beheben braucht den ersten
  Kanal vom Hauptprozess zum Renderer und gehört daher nicht in #24.
