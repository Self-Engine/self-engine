# Runde 19 (2026-11-09): Theme-Engine (#14, verfeinert D57, D58, D61, D68–D71, D81)

- **D109 Die Theme-Engine ist die einzige Farbquelle** (ADR 0009). Neues Paket
  `@self-engine/theme` mit zwei Einstiegen: reiner Kern (Themes, Farbsätze, Berechnung,
  Kontrastfunktion; kein React, kein Mantine, kein DOM) und Mantine-Anbindung (`ThemeProvider`,
  Abbildung auf Mantine, Hook mit den Endwerten). Der Kern rechnet aus Einstellungen und Katalog
  alle Endwerte als sRGB-Hex; Wide-Gamut wird bewusst aufgegeben. Dieselben Werte speisen die
  `--se-*`-Variablen, Mantine und den Kontrasttest. _Grund:_ Was nur im Browser entsteht, kann
  kein Test sehen.
- **D110 Themes sind vollständige Rollentabellen** für mindestens einen Farbmodus, mit
  `version: 1`, ID und Name; die IDs `neutral`, `warm`, `cool` bleiben dauerhaft. 22 Rollen je
  Farbmodus (fünf Flächen, Text, Linien, `hover` als einzige durchscheinende Rolle, je vier
  Statusrollen), dazu vier Akzentrollen. `navSurface` wird berechnet: `surface` zu 70 % über dem
  endgültigen `chrome`, immer deckend. Der Katalog ist offen, fremde Formate werden einmal beim
  Import umgewandelt. Fehlt ein Theme oder ein Farbmodus, gilt das Standard-Theme, der
  gespeicherte Wert bleibt.
- **D111 Die Engine besitzt den Farbmodus:** Sie löst „System“ selbst auf und gibt Mantine nur
  hell oder dunkel. Mantines eigener Farbspeicher wird nicht benutzt (`forceColorScheme` allein
  reicht in 9.7.5 nicht, beim Start wird der Speicher sonst trotzdem gelesen). Der Provider ist
  nur lesend; die Einstellungen besitzt der Store (#15).
- **D112 Kontrast ist ein Test, keine Absicht:** Der Kontrasttest läuft in `pnpm verify` über die
  öffentliche Funktion des Kerns auf den Endwerten und nennt im Fehlerfall Theme, Farbmodus,
  Akzent, Hintergrundtönung, Paar und Verhältnis. Texte 4,5:1, Eingabe-Umrisse und Fokusring
  3:1, `hover` gegen die Fläche 1,1:1 (eigene Regel). Die erleichterten 3:1 für große Schrift
  gelten nicht, weil Rollen die Schriftgröße nicht kennen.
