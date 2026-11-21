# Runde 55 (2026-11-22): Nachtrag aus dem Bau von #277: Die Modul-Indikatoren laden nach dem gemeldeten ersten Bild

Grundlage: die Messung zu #380 auf dem Integrations-Branch von #277, 12 Kaltstarts der gebauten
App je Zelle, Fenster versteckt (`docs/development/performance.md`, „The indicators' load and an
observed paint (#380)“).

- **Laut D314:** Die Hülle lädt den Code eines Modul-Indikators nach dem ersten Bild, in einem
  freien Moment, damit er den Start nichts kostet.
- **Gebaut in #276:** Die Hülle wartet zwei Frame-Callbacks ab und fragt dann nach dem freien
  Moment. Kein Bild wird beobachtet.
- **Gemessen:** In 24 von 24 Starts begann das Laden etwa 10 ms vor dem ersten Bild, das Chromium
  meldet. Das erste Bild selbst lag in beiden Varianten bei 200 ms.

- **D373 Die Hülle wartet auf das erste Bild, das der Browser meldet, bevor sie die
  Modul-Indikatoren lädt.** Sie liest den Eintrag `first-contentful-paint` über einen
  `PerformanceObserver` mit Puffer und fragt erst danach nach dem freien Moment. Eine Seite ohne
  Paint-Timing wartet wie bisher zwei Frames. _Gründe:_ Die Absicht von D314 gilt damit
  verlässlich, auch wenn später weitere Module Indikatoren bekommen oder ein Indikator schwerer
  wird. _Beispiel:_ Mit der Variante begann das Laden in 24 von 24 Starts etwa 5 ms nach dem
  ersten Bild. _Preis:_ rund 40 Zeilen mit Test; 331 Bytes mehr JavaScript beim Start (869.907
  statt 869.576, Grenze 889.856). _Laufzeit:_ Das Fenster erscheint gleich schnell (200 ms); der
  Indikator erscheint 16 bis 17 ms später (522 statt 505 ms im Median). Eine Seite, die nie
  gezeichnet wird, etwa ein Browser-Tab im Hintergrund, lädt ihre Indikatoren erst, wenn sie
  gezeigt wird; die App mit verstecktem Fenster meldet ihr erstes Bild und lädt wie zuvor.
  _Verworfen:_ die zwei Frames lassen (heute kein sichtbarer Unterschied, aber keine Zusage für
  schwerere Indikatoren).

- **Nebenfunde, nichts entschieden:** Der Indikator erscheint rund 300 ms, nachdem sein Code
  angekommen ist, in beiden Varianten; vermutet wird Reacts Wartezeit für aufgelöste
  Suspense-Grenzen. Dazu gibt es #392. Das Vorladen des Panels bleibt: Es lädt rund 211 KB
  JavaScript (nicht 588 KB; den Rest hat die Projekte-Ansicht schon geladen) und kostet 6 bis
  13 ms auf dem Haupt-Thread, die längste Aufgabe unter 8 ms.
