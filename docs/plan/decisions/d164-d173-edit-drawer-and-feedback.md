# Runde 25 (2026-11-10): Bearbeiten-Drawer und Rückmeldung (#21, verfeinert D60, D63, D67, D79, D120)

- **D164 Ein Bearbeiten-Drawer hat zwei Ausgänge (ändert den Vertrag aus #20).** `onClose` wird zu
  `onCancel` (darf nachfragen) und `onDone` (schließt ohne Nachfrage, nach erfolgreichem Speichern
  oder Löschen). Ein fehlgeschlagenes Speichern ruft keinen von beiden, der Entwurf bleibt.
  _Verworfen:_ ein einziges `onClose` (ein Speichern endet sonst in einer falschen Warnung).
- **D165 Ungespeichertes wird erfragt, nicht gemeldet.** `useUnsavedChanges(check)` hinterlegt eine
  Funktion, die die Hülle nur beim Verlassen aufruft. Tippen kostet dadurch nichts, und sie passt zu
  Mantines `form.isDirty()`. Mehrere Prüfungen sind erlaubt, eine einzige mit `true` löst die
  Nachfrage aus. _Preis:_ Die Hülle kann im Rahmen keine Markierung „geändert“ zeigen, das zeichnet
  ein Modul bei Bedarf selbst. _Verworfen:_ ein gemeldeter Zustand `isDirty` (Update bei jedem
  Tastendruck, kann veralten).
- **D166 Der Drawer-Titel ist der gespeicherte Name.** `useEditDrawerTitle(title)` setzt ihn. Bis
  dahin steht dort der Name des Moduls, also beim Laden und bei einem nicht gefundenen Eintrag. Der
  Titel liegt im Zustand des Rahmens und zeichnet die View nicht neu.
- **D167 Eine Wache an der Adresse fängt jeden Ausgang ab.** Jeder Weg hinaus ist eine Änderung der
  Adresse: Schließen-Knopf, Esc, Klick daneben, `onCancel`, Zurück, Vor und Befehle. `ShellRouting`
  bekommt dafür eine neue Fähigkeit, die App setzt sie mit TanStack Routers `useBlocker` um, die
  Hülle bleibt frei vom Router. Gefragt wird, wenn die nächste Adresse den offenen Eintrag entfernt
  oder tauscht. Ein Filterwechsel läuft durch. „Verwerfen“ setzt die ursprüngliche Navigation fort,
  „Weiter bearbeiten“ lässt Adresse und Entwurf unverändert, Esc und Klick daneben bedeuten
  „Weiter bearbeiten“. Es ist immer nur eine Frage offen, und währenddessen schließt Esc den Drawer
  nicht. _Bekannte Lücke:_ Neuladen und Beenden fragen nicht (`enableBeforeUnload` bleibt aus),
  ein späteres automatisches Speichern ist die bessere Antwort. _Verworfen:_ jeden Ausgang einzeln
  absichern (Zurück und Befehle würden durchrutschen).
- **D168 Das Paket `@self-engine/ui` entsteht mit #21** (D120: beim ersten geteilten Baustein). Es
  hängt nur von Mantine, Lingui, `theme` und `icons` ab, Module brauchen für einen Baustein also
  nicht den Rahmen der Hülle.
- **D169 Nachfragen und Hinweise laufen über schmale Eingänge auf Mantine.** `confirm()` antwortet
  mit ja oder nein, ist der einzige Eingang zu `@mantine/modals` und funktioniert auch außerhalb von
  Komponenten. `notifyUndoable()` und `notifyError()` sind die einzigen Eingänge zu
  `@mantine/notifications`. Ein Hinweis mit Rückgängig bleibt 8 Sekunden und pausiert beim
  Darüberfahren. Hinweise stehen unten rechts, am Telefon über der Leiste. `FeedbackHost`
  bindet beides einmal in App und Komponentenkatalog ein. _Verworfen:_ ein eigener Dialog (Mantine
  bringt ihn mit, er wäre außerhalb von Komponenten nicht aufrufbar).
- **D170 Leer, Laden und Fehler sind geteilte Bausteine.** `EmptyState`, `ErrorState` und
  `LoadingState` sitzen dünn auf Mantine. `ErrorState` ersetzt `ContributionFailure`.
  `LoadingState` bleibt die ersten 200 ms unsichtbar, weil lokale Lesezugriffe meist Millisekunden
  dauern. Es ist der Fallback beim Laden des Drawer-Codes, Views behalten das Verhalten aus
  ADR 0013. _Verworfen:_ Skeletons (erst, wenn ein echtes Modul sie braucht).
- **D171 Der Drawer-Rahmen ist für alle Module gleich.** 460 px breit, schwebend mit 8 px Abstand
  und 16 px Ecken bei den Layout-Stufen wide, medium und narrow, volle Breite am Telefon. Der Inhalt
  bekommt die volle Höhe. _Verworfen:_ Breite pro Modul (erst bei echtem Bedarf).
- **D172 Löschen ist sofort und weich, Rückgängig stellt wieder her (verfeinert D79, D88).** Löschen
  aus dem Drawer schließt ihn, Rückgängig öffnet ihn nicht wieder. Bis ein eigenes späteres Paket
  Papierkorb, Fristen pro Datenart und endgültiges Löschen regelt, löscht die App nie von selbst.
  _Verworfen:_ erst beim Ablauf des Hinweises löschen (beim Beenden ginge das Löschen verloren, und
  jede andere View und später der Sync müssten einen Zustand „gleich gelöscht“ kennen).
- **D173 Einen fehlenden Eintrag erkennt das Modul.** Es zeigt `ErrorState` mit „Eintrag nicht
  gefunden“ und nur einem Schließen, das `onDone` ruft. Ein fehlgeschlagenes Laden zeigt `ErrorState`
  mit Wiederholen.
