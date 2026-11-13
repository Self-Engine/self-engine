# Entscheidungslog

Jede Runde ist eine Datei in [`decisions/`](decisions/), benannt nach ihren D-Nummern. Lies diese
Übersicht und dann nur die Runden zu deinem Arbeitspaket.

> **So sind die Einträge zu lesen (D278):** Jeder Eintrag ist eine Arbeitsannahme, die beste
> Antwort zum Zeitpunkt des Eintrags, oft vor dem Code geschrieben. Wer einen besseren Weg sieht,
> nennt ihn dem Owner (`AGENTS.md`, Abschnitt „Decisions“). Was der Code heute tut, steht als ADR
> in `docs/adr/`. Ist das Issue einer Runde geschlossen, gelten Code und ADR, und die Runde
> erklärt nur noch, warum.

## Eine Runde festhalten

Eine neue Runde bekommt eine neue Datei `decisions/d<erste>-d<letzte>-<thema>.md` (Nummern
dreistellig, Thema englisch) und eine Zeile am Ende der Tabelle. Die nächste freie Nummer folgt auf
die letzte Zeile. Lies sie von `main`: Ein anderer Zweig kann sie schon belegt haben.

Eine bestehende Runde bekommt keine neuen Einträge. Wird einer ihrer Einträge überholt, bekommt er
den Vermerk `_Überholt durch D<n>._`

## Runden

| Nummern | Datum | Thema | Issues |
| --- | --- | --- | --- |
| [D1–D27](decisions/d001-d027-product-and-principles.md) | 2026-11-07 | Zielgruppe, Lizenz, Plattform, Produktkern, Datenmodell, Agenten-Setup | – |
| [D28–D49](decisions/d028-d049-layer-0-foundation.md) | 2026-11-07 | Schicht 0: Werkzeuge, Electron-Aufbau, Tests, Releases | #1–#10 |
| [D50–D53](decisions/d050-d053-name-and-transition.md) | 2026-11-08 | Name, App-IDs und Repo während des Übergangs | – |
| [D54–D82](decisions/d054-d082-layer-1-shell.md) | 2026-11-08 | Schicht 1: Design-System und App-Hülle | #14–#25 |
| [D83–D85](decisions/d083-d085-business-model-and-assistant.md) | 2026-11-08 | Geschäftsmodell, alte App, KI-Assistent | – |
| [D86–D98](decisions/d086-d098-layer-2-data.md) | 2026-11-08 | Schicht 2: Datenschicht | #29–#35 |
| [D99–D101](decisions/d099-d101-error-capture.md) | 2026-11-08 | Fehlererfassung | #37 |
| [D102–D107](decisions/d102-d107-github-settings.md) | 2026-11-08 | GitHub-Repo-Einstellungen | – |
| [D108–D110](decisions/d108-d110-release-location.md) | 2026-11-08 | Wohin die Releases gehören, Signierung, Nightly-Rhythmus | #9, #10 |
| [D109–D112](decisions/d109-d112-theme-engine.md) | 2026-11-09 | Theme-Engine | #14 |
| [D113–D132](decisions/d113-d132-settings-store.md) | 2026-11-09 | Einstellungs-Store | #15 |
| [D133–D142](decisions/d133-d142-sqlite-and-migrations.md) | 2026-11-09 | SQLite, Konventionen und Migrationen | #30 |
| [D143–D154](decisions/d143-d154-layer-3-core.md) | 2026-11-09 | Schicht 3: gemeinsamer Kern (Zeit, Geld, Spaces, Tags) | #103–#111 |
| [D155–D160](decisions/d155-d160-workflow.md) | 2026-11-10 | Arbeitsablauf und Übersichtsseite | – |
| [D161–D163](decisions/d161-d163-move-to-organisation.md) | 2026-11-10 | Umzug in die Organisation, öffentliches Repo | – |
| [D164–D173](decisions/d164-d173-edit-drawer-and-feedback.md) | 2026-11-10 | Bearbeiten-Drawer und Rückmeldung | #21 |
| [D174–D186](decisions/d174-d186-commands-and-palette.md) | 2026-11-10 | Befehle, Kürzel und Palette | #22 |
| [D187–D196](decisions/d187-d196-data-process-and-port-pattern.md) | 2026-11-10 | Datenprozess, Port-Muster und Hooks | #29, #31, #32, #33 |
| [D197–D204](decisions/d197-d204-settings-area.md) | 2026-11-11 | Einstellungsbereich | #23 |
| [D205–D209](decisions/d205-d209-window-state.md) | 2026-11-12 | Fensterzustand | #24 |
| [D210–D218](decisions/d210-d218-app-check.md) | 2026-11-12 | App-Check `verify-desktop` | #25 |
| [D219–D230](decisions/d219-d230-typed-queries.md) | 2026-11-12 | Typisierte Abfragen mit Kysely und Zod | #31 |
| [D231–D241](decisions/d231-d241-port-pattern-and-contract-tests.md) | 2026-11-12 | Port-Muster und Contract-Test-Kit | #32 |
| [D242–D246](decisions/d242-d246-port-pattern-build-addendum.md) | 2026-11-12 | Beim Bau von #32 entschieden | #32 |
| [D247–D262](decisions/d247-d262-table-events-and-hooks.md) | 2026-11-13 | Tabellenmeldung und Hooks | #33 |
| [D263–D266](decisions/d263-d266-code-review-findings.md) | 2026-11-13 | Befunde der Code-Prüfung zu #33 | #33 |
| [D267](decisions/d267-notice-position.md) | 2026-11-13 | Wo Hinweise stehen | #230 |
| [D268–D277](decisions/d268-d277-startup-size-and-backups.md) | 2026-11-14 | Beim Bau entschieden: Startgröße und Sicherungen | #136, #35 |
| [D278](decisions/d278-weight-of-decisions.md) | 2026-11-14 | Gewicht der Entscheidungen | – |
| [D279–D285](decisions/d279-d285-time-package.md) | 2026-11-14 | Paket `time`: Zuschnitt, Temporal, Zeitwerte, Zeitzone, Uhr, Prüfungen | #104 |
| [D286–D290](decisions/d286-d290-spaces-package.md) | 2026-11-14 | Paket `spaces`: Fremdschlüssel, Lage, ein persönlicher Space, Tabelle, Begriffe | #108 |

D109 und D110 sind doppelt vergeben, in den Runden 18 und 19. Wer eine der beiden nennt, nennt die
Runde dazu.

Befunde aus Recherche und Audits, die keine Entscheidungen sind, stehen in [`facts.md`](facts.md).
