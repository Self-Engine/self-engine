# Runde 35 (2026-11-13): Wo Hinweise stehen (#230, ändert D79 und D169)

- **D267 Hinweise stehen oben in der Mitte, gestapelt, eine Lücke unter dem Kopf des Inhalts
  (ändert D79, D169).** Unten rechts lagen sie über Speichern und Abbrechen des Drawers und
  nahmen deren Klicks. Mantine stellt sie mit `position="top-center"` und `layout="stacked"`: Nur
  der neueste ist ganz zu sehen und läuft ab, die älteren warten dahinter und fächern sich unter
  dem Zeiger auf; eine Linie füllt sich, bis er schließt (`withAutoCloseProgress`). Sie beginnen
  auf jeder Stufe, mit oder ohne Drawer, 64 px unter dem Fensterrand, eine Lücke unter dem Kopf
  des Inhalts, so springt nichts. Jedes Bedienelement von Kopf und Drawer bleibt klickbar; unter
  1376 px Fensterbreite liegt ein Hinweis über dem ersten Feld des Drawers. Stories prüfen das bei
  1440 px (Feld frei), breit (Feld klickbar) und Telefon, ohne Drawer breit und Telefon.
  _Preis:_ eine CSS-Variable; Mantine misst jeden Hinweis einmal. _Verworfen:_ oben rechts (lag
  über dem ersten Feld), unten links, ein Versatz nur bei offenem Drawer (der Hinweis spränge).
