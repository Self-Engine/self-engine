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
| [D291–D297](decisions/d291-d297-icon-and-color.md) | 2026-11-14 | Icon und Farbe an Entitäten: Zuschnitt, Icon-Namen, Vertragsmuster, helle Füllungen, Marke, Strichstärke (D297 überholt durch D298) | #106 |
| [D298](decisions/d298-regular-icon-weight.md) | 2026-11-14 | Icons standardmäßig regular statt duotone | #106 |
| [D299–D302](decisions/d299-d302-icon-field-with-emoji-picker.md) | 2026-11-14 | Ein Feld für Icon und Emoji: zwei Reiter, Mantines Emoji-Auswahl, ein Suchbegriff, Einfügen | #264 |
| [D303–D316](decisions/d303-d316-layer-4-projects-and-time.md) | 2026-11-14 | Schicht 4: Projekte und Zeit (Umfang, Module, Löschschutz, Zeiteintrag, Timer, Überschneidungen, Reihenfolge) | #271–#277, #109, #110, #201, #213, #214 |
| [D317–D326](decisions/d317-d326-form-helper.md) | 2026-11-14 | Formular-Helfer: Prüfung mit dem Vertrag, `@mantine/form`, Entwurf, Meldungen, Ablauf, geänderte Felder, Paket `forms` | #213 |
| [D327–D330](decisions/d327-d330-projects-module.md) | 2026-11-15 | Modul `projects`: Archiv im Speicher-Rahmen, Titel nicht eindeutig, Muster des Bearbeitens, Projekt-Verweis und Auswahl | #273 |
| [D331–D340](decisions/d331-d340-protection-rules.md) | 2026-11-17 | Schutzregeln: ein System, Verhindern an den Schreibwegen, Ablehnung mit typisierten Gründen, Auskunft, Verweis-Prüfung, Arten von Verweisen, zwei Pakete | #274, #313 |
| [D341](decisions/d341-types-of-a-rule-from-above.md) | 2026-11-18 | Beim Bau von #274 entschieden: Das Modul darunter gibt frei, was eine Regel von oben sehen darf; gebaut mit dem ersten echten Fall | #274 |
| [D342–D350](decisions/d342-d350-time-tracking.md) | 2026-11-19 | `time-tracking`: Zeitzone am Eintrag, Tagesanteile über Mitternacht, ganze Sekunden, Anzeige rundet auf, keine Dauer von Hand, Zeitumstellung im Formular, Uhr der Oberfläche, Stoppen über zwei Tabellen, Uhr und Felder als eigenes Arbeitspaket | #275, #277, #332, #110, #276 |
| [D351–D356](decisions/d351-d356-settings-in-the-database.md) | 2026-11-20 | Einstellungen in der Datenbank, Zeitzone und Wochenstart: lokale Kopie für den ersten Render, Lesen im Datenprozess über den Kontext, Gerätezone beim Start, Abfrage über eine Spanne von Tagen, Wochenstart als Name des Tages, der Besitzer deklariert | #109, #110, #275 |
| [D357–D360](decisions/d357-d360-module-indicator.md) | 2026-11-20 | Modulanzeige, der ständige Platz in der Hülle: rechts in der Kopfzeile des Inhalts in voller Form oder Kurzform, eine Fläche der Hülle, zwei später ladende Bausteine im Hüllen-Beitrag, die Namen „Module Indicator“ und „Indicator Panel“ | #276, #277 |
| [D361–D364](decisions/d361-d364-time-fields-and-settings-copy.md) | 2026-11-21 | Nachträge aus dem Bau von #332 und #109: die doppelte Stunde beim Bearbeiten, ein Beginn hinter dem Ende, der Wecker für „heute“, der Name „Settings Copy“ | #332, #109 |
| [D365](decisions/d365-branded-draft.md) | 2026-11-21 | Der Entwurf eines Formulars behält die Marke eines Werts, den das Eingabe-Schema markiert; der Vertrag bleibt unmarkiert | #275 |
| [D366](decisions/d366-previous-value-is-the-stored-value.md) | 2026-11-21 | Beim Bearbeiten in der doppelten Stunde ist der bisherige Wert der gespeicherte, nicht ein Zwischenstand beim Tippen | #332, #275 |
| [D367–D368](decisions/d367-d368-week-address-and-refusal-at-the-project.md) | 2026-11-21 | Nachträge aus dem Bau von #275: Die Adresse nennt keine Woche, solange die gezeigte die von heute ist; die Ablehnung am Projektfeld nennt die Art des Ziels, nicht seinen Namen | #275 |
| [D369–D370](decisions/d369-d370-input-error-from-the-data-process.md) | 2026-11-21 | Nachträge aus dem Bau von #277: Eine Operation meldet eine Grenze, die nur der Datenprozess kennt, als Eingabefehler, und das Formular zeigt ihn am Feld; die Datums- und Zeitfelder behalten vorerst Mantines Verhalten | #277, #377 |
| [D371](decisions/d371-restore-writes-fields.md) | 2026-11-21 | Nachtrag aus dem Bau von #277: Das Zurückholen einer Zeile im Speicher-Rahmen kann zugleich Felder schreiben | #277 |

D109 und D110 sind doppelt vergeben, in den Runden 18 und 19. Wer eine der beiden nennt, nennt die
Runde dazu.

Befunde aus Recherche und Audits, die keine Entscheidungen sind, stehen in [`facts.md`](facts.md).
