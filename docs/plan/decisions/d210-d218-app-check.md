# Runde 30 (2026-11-12): App-Check `verify-desktop` (#25, verfeinert D76)

- **D210 Ein festes Skript fährt den Ablauf, der Skill erklärt nur drumherum.** Das Skript liegt
  in `scripts/` mit Test und baut auf dem Start der Stufe `smoke` auf; die `SKILL.md` sagt, wann
  man es startet, wie man die Ausgabe liest und was in den Bericht gehört. Jeder Lauf ist gleich,
  und ein Agent kann danach von Hand weitermachen. _Verworfen:_ ein Rezept, nach dem jeder Agent
  sein eigenes Playwright schreibt (ungetestet, jeder Lauf anders, Electron-Fallen wie
  `ELECTRON_RUN_AS_NODE` und das Wegwerf-Profil jedes Mal neu).
- **D211 Geprüft wird die gebaute App im eigenen Checkout des Agenten.** Erst der Build, dann
  Electron mit Wegwerf-Profil und eigenem Port, wie `smoke`; `--executable` prüft eine paketierte
  App. Läuft im selben Checkout `pnpm dev`, bricht das Skript mit einem Hinweis ab, statt mit dem
  Build die laufende Dev-App neu zu starten. _Verworfen:_ ein Dev-Server-Modus oder das Andocken an
  eine laufende `pnpm dev`-Sitzung (eigene Daten, fester Port 5733, das eigene Fenster würde auf
  576 px gezogen).
- **D212 Das Fenster bleibt unsichtbar, auch in `smoke`.** Eine Umgebungsvariable, die nur der
  Kanal `dev` beachtet, lässt das Fenster ungezeigt, blendet das Dock-Symbol aus und schaltet die
  Hintergrund-Drosselung ab, damit die Seite trotzdem voll zeichnet. Playwright holt Screenshots
  aus Chromium, nicht vom Bildschirm. `--visible` zeigt das Fenster doch. So springt weder beim
  App-Check noch bei `pnpm verify` ein Fenster nach vorne und nimmt den Fokus. Eine paketierte
  Nightly oder Stable lässt sich so nicht verstecken. _Verworfen:_ `showInactive()` (das Fenster
  springt trotzdem achtmal sichtbar um); ein Fenster außerhalb des Bildschirms (macOS und D207
  holen es zurück).
- **D213 Screenshots zeigen nur die Seite, die Fensterknöpfe prüft die Geometrie.** macOS zeichnet
  die Knöpfe über die Seite, sie fehlen also auf den Bildern; der Skill sagt das dem Agenten. Das
  Skript prüft stattdessen in jeder Layoutstufe, dass der Streifen für die Knöpfe frei bleibt, mit
  dem Maß, das die Hülle selbst dafür verwendet. Unter Windows und Linux gibt es bis #167 den
  nativen Rahmen (D205) und daher nichts zu prüfen; #167 erweitert die Prüfung. _Verworfen:_ eine
  Aufnahme auf Systemebene (braucht die macOS-Freigabe für Bildschirmaufnahme, nur Mac).
- **D214 Hell und Dunkel kommen über das System-Theme.** Der Hauptprozess stellt das System-Theme
  um; der Farbmodus bleibt auf seinem Standard „System“. Das prüft nebenbei, dass die App dem System
  folgt. _Verworfen:_ die Einstellung im Einstellungsbereich anklicken (bindet den Ablauf an dessen
  Oberfläche); Medien-Emulation des Browsers (umgeht Electron).
- **D215 Vier Breiten, jede gegen ihre Layoutstufe geprüft.** 1280 (wide), 1100 (medium), 800
  (narrow) und 576 (Mindestbreite, noch narrow), je hell und dunkel. Die Hülle zeigt ihre
  Layoutstufe als Attribut an ihrer Wurzel; das ist Produkt-Markup, kein Test-Haken, und kostet
  nichts, weil die Stufe ohnehin berechnet ist. Die Breiten exportiert die Hülle an einer Stelle,
  Stories und Skript lesen sie von dort. Ändert jemand einen Breakpoint, scheitert der Lauf, statt
  plausibel aussehende Bilder der falschen Stufe zu liefern.
- **D216 Objektive Fehler lassen den Lauf scheitern, alles andere beurteilt der Agent.** Hart
  scheitert er an der Fehlerseite statt der Hülle, an einem ungefangenen Fehler in Seite oder
  Hauptprozess, an `console.error`, an einer falschen Layoutstufe, einer falschen Route oder einem
  belegten Streifen für die Fensterknöpfe. Aussehen, Überlappung und Kontrast beurteilt der Agent an
  den Bildern. Auch ein gescheiterter Lauf behält die Bilder bis zum Fehler.
- **D217 Der Ablauf folgt der Oberfläche, nicht den Platzhaltern.** Das Skript liest die Module aus
  der Navbar und ihre Ansichten aus der Modul-Sidebar, über Rollen und Namen, und klickt sie an wie
  ein Mensch; so übersteht es den Ersatz der Platzhalter und prüft, dass jede Ansicht erreichbar
  ist. Es besucht jede Ansicht (wide, hell), deckt auf der ersten alle Layoutstufen in beiden
  Farbmodi ab, öffnet den Einstellungsbereich und lädt neu (dieselbe Route muss bleiben). Deep Link
  heißt: eine volle Adresse in den Hash schreiben und neu laden. Für `?edit=` (D77) startet es die
  Hauptaktion des ersten Moduls, das eine hat, und öffnet die Adresse mit offenem
  Bearbeiten-Drawer später neu. Ein OS-Protokoll (`self-engine://`) gehört nicht dazu.
  _Verworfen:_ das Register über einen Test-Haken der App auslesen (Testschnittstelle in der
  ausgelieferten App, Klickweg ungeprüft).
- **D218 Ausgabe in `.temp/`, Bericht mit Bildern, Verweis in AGENTS.md.** Jeder Lauf schreibt in
  einen eigenen Ordner mit Zeitstempel: nummerierte Bilder mit Schritt, Layoutstufe und Farbmodus im
  Namen und eine Zusammenfassung mit Schritten, Routen, Layoutstufen und Fehlern. Der Agent zeigt
  die wichtigen Bilder im Bericht, nennt, was ihm auffiel, und was ungeprüft blieb. Die Regel in
  AGENTS.md, eine nicht geprüfte visuelle Änderung zu melden und den Check anzubieten, nennt den
  Skill. Läuft nur auf Wunsch, nie in CI (D76).
