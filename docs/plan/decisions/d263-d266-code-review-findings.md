# Runde 34 (2026-11-13): Befunde der Code-Prüfung zu #33 (verfeinert D187, D196, D251, D257, D261)

- **D263 Die Web-App ohne Datenprozess zeigt den Zustand „Daten nicht erreichbar“ (verfeinert
  D196, D257).** Ohne Desktop-Brücke wird die Verbindung beim Start gestoppt; die Seite zeigt
  denselben Zustand wie die Desktop-App, wenn der Datenprozess nach mehreren Abstürzen steht,
  aber ohne „Erneut versuchen“ (im Browser kann nichts einen Datenprozess starten) und mit einem
  eigenen Satz, dass der Browser noch keinen Zugang zu den Daten hat. Der Port-Zugang der
  Web-App ist `NO_DATA_PROCESS`: Jeder Aufruf scheitert sofort, nichts wartet still dahinter.
  „Wie bisher“ in der Spezifikation war ein Irrtum: Auf `main` zeigte die Web-App nur die
  Einträge im Speicher, die #33 entfernt. _Preis:_ ein übersetzter Satz mehr; zur Laufzeit
  nichts. _Verworfen:_ ewig laden (Liste im Spinner, Speichern-Knopf und Befehl ohne Antwort);
  die App ohne Daten zeigen (jede Ansicht zeigte ihren Fehlerzustand, ohne zu sagen, warum).
- **D264 Ein Konfliktgrund ohne Feld sagt das ausdrücklich (verfeinert D251).** Die Typen
  verlangen weiter für jeden Grund Text und Feld; ein Modul darf `field: null` schreiben, wenn
  kein Feld den Konflikt zeigen kann (Rückgängig, ein Befehl ohne Formular). Dann zeigt der
  Baustein den Text selbst als Benachrichtigung, genau einmal, über denselben Weg wie seine
  anderen Benachrichtigungen; das Ergebnis trägt `field: null`. Ein weggelassenes Feld
  kompiliert nicht. _Verworfen:_ ein erfundenes Feld wie `id` und eine Kopie des
  Benachrichtigungs-Helfers im Modul (der Baustein ließe eine Lücke, die jedes Modul selbst
  stopft).
- **D265 Alle Benachrichtigungen des Bausteins gehen über eine Naht (verfeinert D261).** Der
  Befehls-Kontext trägt in `data` den Port-Zugang zusammen mit dem `notify` des `DataProvider`
  (`useDataAccess()` → `{ access, notify }`), und die Funktionsform einer Operation nimmt beides.
  So landen die Benachrichtigungen von Hook, Funktionsform, Neuladen und Konflikt ohne Feld an
  derselben Stelle, und eine Story oder ein Test, der den Zugang ersetzt, sammelt sie mit.
  _Verworfen:_ die Funktionsform ruft das Rückmelde-System direkt (Tests müssten `ui` ersetzen,
  eine Story sähe die Benachrichtigungen nicht).
- **D266 Zwischen Paketen gibt es keinen Kreis, auch nicht über devDependencies (verfeinert
  D187, ADR 0006).** `health` und der Strom der Tabellenmeldungen liegen im Paket
  `data-protocol`, das kein Modul kennt; `data-client`, Datenprozess und Desktop-Brücke nehmen
  sie von dort. Der Kern des Datenprozesses kennt keine Module mehr: Die Desktop-App gibt ihm
  ihre Modulliste (`apps/desktop/src/data-modules.ts`), geprüft gegen den App-Vertrag, den
  `contracts` weiter zusammensetzt. Ein Test über alle `package.json` schlägt bei jedem Kreis
  zwischen Paketen fehl; dependency-cruiser sieht nur Kreise zwischen Dateien. Ein Import nur
  für Tests steht immer in `TEST_ONLY_IMPORTS`. _Preis:_ ein Paket mehr. _Verworfen:_ die Tests
  über den echten Datenprozess aus `data-client` und dem Modul in ein höheres Paket verschieben
  (die Tests lägen weit weg von ihrem Code, und der Kreis über `contracts` bliebe).
