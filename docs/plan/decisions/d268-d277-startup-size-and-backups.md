# Nachtrag (2026-11-14): beim Bau von #136 und #35 entschieden (verfeinert D79, D94, D118, D192, D249, D250, D258, D266)

#136 und #35 wurden ohne eigene Grilling-Runde gebaut. Was dabei offen war, wurde während des
Baus und im Review entschieden und stand bisher nur in den Pull Requests #233 und #234. Für #35
steht die englische Fassung mit allen verworfenen Wegen in ADR 0024, die Messungen stehen in
`docs/development/performance.md`. Was bei den Sicherungen bewusst fehlt, steht in #235.

- **D268 Eine Einstellung deklariert ihr Schema mit `zod/mini`, der Store prüft über Zods Kern
  (verfeinert D118).** Die elf Einstellungen, die die App vor dem ersten Bild liest, zogen über
  `zod` den vollen Build in den Start: ein Chunk von 85.453 Bytes. Jetzt deklariert eine
  Einstellung ihr Schema mit `zod/mini`, und der Einstellungs-Store prüft mit `safeParse` aus
  `zod/v4/core`, das beide Builds teilen. Der Typ bleibt der gemeinsame (`$ZodType`): Eine
  Einstellung, die nur nachgeladener Code deklariert, darf ein Schema des vollen Builds nehmen.
  `zod/mini` hat keine Methoden wie `.min()`; Prüfungen laufen über `.check(z.minLength(1))`.
  Zods Kern bleibt im Start, rund 50 KB: Einstellungen werden vor dem ersten Bild geprüft (D118),
  und die Befehle laden den vollen Build nach, der fast den ganzen Kern braucht. _Gemessen:_
  Start-JavaScript 874.050 → 839.270 Bytes (−34.780). Das erste Bild kommt nicht messbar früher
  (164,7 gegen 164,4 ms im Median, je 60 Starts), darum heißt der Pull Request `chore:` und nicht
  `perf:`. _Preis:_ zwei Schreibweisen für Schemas im Repo. _Nicht hier:_ auch die Befehle auf
  `zod/mini` umstellen (brächte weitere 36.511 Bytes, ändert aber ein entschiedenes Muster).
  _Verworfen:_ Einstellungen erst nach dem ersten Bild prüfen (ein ungeprüfter Wert würde zuerst
  gezeichnet); eine Prüfung von Hand neben Zod (D118).
- **D269 Zods voller Build darf nicht in den Start, und der Build prüft das (verfeinert D192,
  D258).** Die Start-Prüfung nimmt Abhängigkeiten, die nur nachgeladen werden dürfen (`lazyOnly`
  in `apps/web/vite.config.ts`). Liegt ein Modul des vollen Builds (`zod/v4/classic/`) in einem
  statischen Start-Chunk, schlägt der Build fehl und nennt den Start-Code, der es importiert. Die
  Byte-Grenze allein fiele nicht auf: Der volle Build passt unter die 6 %. Die Grenze sinkt nach
  der Regel aus D258 von 905 auf 869 KiB.
- **D270 Eine Sicherung entsteht aus einem von vier Gründen (verfeinert D94).** Täglich, vor
  einer Migration, von Hand, vor einem Wiederherstellen. Die tägliche entsteht, sobald der
  Datenprozess antwortet, und er prüft danach jede Stunde wieder; fällig ist sie, wenn es am
  UTC-Tag noch keine Sicherung irgendeiner Art gibt. Die Sicherung vor einer Migration entsteht
  nur, wenn Migrationen ausstehen und die Datenbank Tabellen hat; scheitert sie, startet der
  Datenprozess nicht, und keine Migration läuft. Der Ordner `backups/` neben der Datenbank ist
  das einzige Verzeichnis: Der Dateiname nennt Zeitpunkt und Grund. Eine neue Sicherung wird
  einmal geöffnet, aber nicht geprüft; geprüft wird sie beim Wiederherstellen, und eine
  beschädigte wird abgelehnt, ohne dass etwas ersetzt wird. _Preis:_ Die Sicherung vor einer
  Migration verzögert diesen einen Start (165 ms bei 100 MB), die tägliche keine Antwort. In
  UTC+7 wechselt der Tag um 07:00 Ortszeit. _Verworfen:_ eine Tabelle der Sicherungen (sie wäre
  Teil jeder Sicherung und widerspräche dem Ordner, sobald jemand eine Datei von Hand löscht).
- **D271 Aufbewahrt wird je Tag die neueste Sicherung jedes Grundes (verfeinert D94).** Von jedem
  der neuesten sieben Tage, an denen es eine Sicherung gibt, bleibt die neueste jedes Grundes,
  also höchstens vier pro Tag; davor die neueste aus jeder von vier Wochen. Tage und Wochen sind
  UTC, die Woche beginnt am Montag. Gezählt werden Tage mit Sicherung, nicht Kalendertage: Ein
  Gerät, das Monate aus war, verliert beim ersten Start nichts. Mit einer Sicherung am Tag sind
  das elf Dateien, nie mehr als 32; die älteste ist 22 bis 28 Tage alt. _Folge:_ Eine zweite
  Sicherung desselben Grundes am selben Tag ersetzt die erste. Zwei Wiederherstellungen
  hintereinander behalten nur die Sicherung vor der zweiten (#235). Im Review am 2026-11-13
  entschieden: Die Zahl der aufbewahrten Sicherungen spielt vorerst keine Rolle, die Regel
  bleibt, wie sie gebaut wurde. _Verworfen:_ nur die neueste Sicherung jedes Tages (die
  Sicherung vor einer Migration fiele der nächsten des Tages zum Opfer); alle Sicherungen der
  letzten sieben Tage (jeder Klick legte eine ganze Kopie dazu, ohne Grenze); die letzten sieben
  Kalendertage (nach einer langen Pause löschte der erste Start alles außer der eigenen).
- **D272 Ein Wiederherstellen wird vorgemerkt, und der nächste Start des Datenprozesses setzt es
  ein.** Eine offene Datenbank lässt sich nicht ersetzen. Der laufende Datenprozess prüft die
  Sicherung, kopiert sie neben die Datenbank, sichert den aktuellen Stand und gibt der Kopie erst
  dann den Namen, nach dem der nächste Start sucht. Nach seiner Antwort bittet er den
  Hauptprozess um den Neustart; der zählt dafür keinen Absturz. Der nächste Datenprozess entfernt
  das alte Write-Ahead-Log und setzt die Datei ein, bevor er die Datenbank öffnet. Ein Absturz
  lässt entweder die alte Datenbank oder eine vorgemerkte Datei zurück, die der nächste Start
  einsetzt. Der Kern bekommt die Sicherungen und den Neustart als eine Option
  (`backups: { service, restart }`): Ein vorgemerktes Wiederherstellen ohne Neustart ließe die
  ersetzte Datenbank weiter antworten. Eine Kopie, die halb geschrieben scheitert, wird sofort
  entfernt. Der Smoke-Test stellt eine Sicherung wieder her, weil nur die echte App den Neustart
  beweist. _Verworfen:_ die Datenbank im laufenden Prozess ersetzen (die Datei ist dort offen,
  und jede Antwort der Seite müsste von Hand verworfen werden); der Datenprozess beendet sich
  selbst (der Hauptprozess zählte einen Absturz, drei in einer Minute stoppten ihn).
- **D273 Ab dem Beginn eines Wiederherstellens nimmt die Datenbank keinen Schreibvorgang an.**
  `PRAGMA query_only` gilt, bis der Prozess endet; scheitert das Wiederherstellen, wird wieder
  geschrieben, außer ein früheres ist noch vorgemerkt. Ein Schreibvorgang nach der Sicherung des
  ersetzten Stands verschwände mit der Datenbank; abgelehnt scheitert seine Operation und sagt
  es. Lesen und Sichern gehen weiter. _Preis:_ Die App kann 0,13 s (1 MB) bis 0,4 s (100 MB)
  lang nicht schreiben. _Verworfen:_ Schreiben offen lassen (ein Schreibvorgang ginge verloren,
  ohne dass es jemand erfährt).
- **D274 Ein Wiederherstellen fragt nicht nach, sein Hinweis bietet „Rückgängig“ (verfeinert
  D79).** Was ersetzt wird, liegt als Sicherung vor; „Rückgängig“ stellt sie wieder her. Ein
  späteres Wiederherstellen zieht das frühere Angebot zurück, weil seine eigene Sicherung den
  Platz der früheren im Ordner nimmt: `notifyUndoable` gibt dafür eine Funktion zurück, die das
  Angebot zurückzieht. Neu ist `notifyDone()` für etwas, das geschehen ist und sich nicht
  zurücknehmen lässt. _Verworfen:_ vorher fragen (D79 behält Fragen dem vor, was sich nicht
  zurücknehmen lässt).
- **D275 Eine gescheiterte automatische Sicherung wird angezeigt, nicht nur gemeldet.** Der
  Datenprozess merkt sich im Speicher, dass der letzte Versuch einer täglichen Sicherung oder
  einer vor einer Migration gescheitert ist, bis irgendeine Sicherung gelingt, auch eine von
  Hand. `backups.list` antwortet mit `{ backups, automaticBackupFailed }`, und die Ansicht
  „Daten“ zeigt solange einen Hinweis in den Warnfarben des Themes. _Preis:_ Der nächste
  Datenprozess beginnt ohne den Merker; der Hinweis kommt erst wieder, wenn sein eigener Versuch
  scheitert.
- **D276 Die Sicherungen gehören keinem Modul (verfeinert D249, D250, D266).** Der Datenprozess
  beantwortet sie als `backups` neben `health` im Datenprotokoll; `backups` ist ein reservierter
  Einhängename. Sein Kern bekommt die Sicherungen von der Plattform und kennt weder Dateien noch
  den SQLite-Treiber; `@self-engine/backup` ist die Seite des Desktops. Eine Plattform ohne
  Sicherungen lässt jeden Aufruf scheitern. Die Seite nutzt denselben Baustein wie für den Port
  eines Moduls. Die Liste liest keine Tabelle, also lädt keine Tabellenmeldung sie neu: Der
  Baustein bekommt `portHooks(…).reload(eintrag)` für eine Abfrage, hinter der keine Tabelle
  steht, und eine Zeile, die eine Antwort von einem früheren Besuch zeigt, liest sie neu, weil
  der Datenprozess sichert, während niemand hinsieht. Für Stories gibt es `answersByMount()`.
  _Verworfen:_ eine Tabellenmeldung mit erfundenem Tabellennamen (die Liste ist keine Tabelle).
- **D277 Wiederherstellen, wenn die App nicht startet, wird vorerst nicht gebaut.** Im Review am
  2026-11-13 entschieden: Für den jetzigen Stand der App ist das zu viel. Wiederherstellen ist
  eine Zeile in den Einstellungen und braucht eine laufende App. Ist eine Migration
  gescheitert, kommt die Datenbank aus einer neueren Version oder steht der Datenprozess nach
  mehreren Abstürzen, antwortet er nur auf `health`, und die Seite zeigt einen Zustand ohne Weg
  zu den Sicherungen. Sie liegen im Ordner, erreichbar nur von Hand. Eine Sicherung schützt
  damit vor einem Fehler oder Versehen in der laufenden App, nicht vor einer App, die nicht mehr
  startet, und nicht vor einem verlorenen Gerät: Sie liegt auf derselben Platte. Die offenen
  Fragen dazu stehen in #235.
