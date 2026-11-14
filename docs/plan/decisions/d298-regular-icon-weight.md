# Nachtrag (2026-11-14): Strichstärke der Icons

- **D298 Alle Icons der App sind standardmäßig regular (ändert D297).** Das gilt für die Icons
  der Oberfläche und die Bilder des Verzeichnisses, also auch für die Marke eines Eintrags.
  _Grund:_ Der Owner: regular ist der Standard; die Stellen, die duotone sein sollen, werden
  später angepasst. _Folgen:_ `catalogIcon` zeichnet jedes Icon in regular, wie vor D297. Die
  Props eines Icons bleiben geschlossen: keine Strichstärke, keine Farbe, keine Füllung, kein
  Strich, nur die fünf benannten Größen. Eine Stelle, die duotone sein soll, bekommt es später;
  dafür braucht der Katalog dann eine Option, die mit dieser ersten Stelle kommt. _Preis:_ keiner
  bei der Größe, jedes Phosphor-Icon bringt alle Strichstärken mit.
