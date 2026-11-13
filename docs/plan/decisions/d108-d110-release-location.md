# Runde 18 (2026-11-08): Wohin die Releases gehören (#9)

- **D108 Releases liegen im privaten Projekt-Repo `GwydionBr/self-engine-next`.** Der
  Release-Workflow legt Tag und GitHub-Release nur mit dem eingebauten `GITHUB_TOKEN` an. Kein
  eigenes Releases-Repo, kein Token in der App. **Updates werden von Hand geladen.** Zum
  Herunterladen braucht man Zugriff auf das Repo; dem zweiten Nutzer kann der Owner einen
  Build direkt geben. Der Updater in der App kommt mit dem Wechsel auf öffentlich (D107) und
  der Signierung (#10). _Grund:_ Eine App darf kein Token mitbringen, und Squirrel.Mac lehnt
  Updates ad-hoc-signierter Builds ab (die Anforderung ist der Hash genau dieses Builds).
  Der Nightly-Zeitplan ist zunächst aus (Repo-Variable `NIGHTLY_SCHEDULE_ENABLED`), weil
  macOS-Minuten im privaten Repo begrenzt sind und die Build-Dauer noch unbekannt ist.
- **D109 macOS-Releases sind mit der Developer ID signiert, gehärtet und notarisiert (#10).**
  Das Packen prüft das Ergebnis, weil electron-builder ohne Identität nur warnt. In CI lässt
  ein fehlendes Secret den Lauf scheitern; lokal ohne die Eingaben bleibt der Build ad hoc und
  braucht kein Apple-Konto. Einziges Entitlement ist `allow-jit`. Der Updater in der App wartet
  weiter auf den Wechsel auf öffentlich (D107). Windows-Signierung ist offen.
- **D110 Der Nightly-Zeitplan läuft vorerst nur jede zweite Nacht** (ungerade Monatstage) und
  ersetzt damit den Rhythmus aus D41. Gebaut wird weiter nur, wenn sich `main` seit dem letzten
  Nightly geändert hat; manuell geht es jederzeit.
