# Runde 16 (2026-11-08): Fehlererfassung

- **D99 Fehler werden zuerst nur lokal erfasst.** Ein Fehlerprotokoll im Nutzerdaten-Ordner
  (begrenzt, rotiert) sammelt Fehler aus Haupt-, Renderer- und Datenprozess: Zeit, Prozess,
  Meldung, Stacktrace, Version, Kanal, Betriebssystem, nie Inhalte. Unter Einstellungen →
  Daten zeigt „Diagnose“ die Einträge und kopiert einen per Klick (für ein Issue oder einen
  Agenten). Ein neuer Fehler zeigt einen unaufdringlichen Hinweis; Source Maps liegen bei,
  damit Stacktraces auf den TypeScript-Code zeigen. Issue #37. _Grund:_ Solange der
  Maintainer der Hauptnutzer ist, bringt ein externer Dienst wenig und kostet eine
  Datenschutz-Frage.
- **D100 Fehlererfassung über eine eigene Schnittstelle mit austauschbaren Empfängern.** Das
  lokale Protokoll ist der erste; Sentry (EU-Region) kommt als zweiter Empfänger vor der
  ersten öffentlichen Version oder sobald andere die App nutzen: nur nach Zustimmung beim
  ersten Start, nur technische Daten, ein Test beweist das Herausfiltern von Inhalten.
  Selbsthoster schalten es ab oder zeigen auf einen eigenen Server (z. B. GlitchTip).
  Die Lint-Regel `no-silent-catch` („melden“) meldet über diese Schnittstelle.
- **D101 Keine Produktanalyse (PostHog) vorerst.** Später nur nach Zustimmung, anonym und mit
  wenigen festgelegten Ereignissen. _Grund:_ Datenschutz ist der Hauptgrund für OSS (D2).
