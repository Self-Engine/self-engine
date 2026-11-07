# Design-Baum

Legende: ✅ entschieden · ❓ offen (Frontier) · ⏳ wartet auf Vorgänger
Pro Runde werden nur 2–3 Fragen gestellt; die Nummern sind stabil.

- ✅ Zielgruppe: Freelancer (D1)
  - ✅ Erster Meilenstein Projekte + Zeit; Ablösung erst bei Funktionsgleichheit (D9)
  - ✅ Übergang: wiederholbarer Import, Wechsel am Stichtag (D12)
  - ✅ Mobile + Sync sind Pflicht vor dem Stichtag (D14)
  - ✅ Schichtenfolge als Rahmen, jede Schicht mit eigener Vertiefung (D25)
    - ✅ Schicht 0 Repo-Fundament entschieden (D28–D49) → 03-layer-0-foundation.md
    - ⏳ Schicht 1 Design-System + App-Hülle
    - ⏳ Schicht 2 Datenschicht
    - ⏳ Schicht 3 Gemeinsamer Kern
    - ⏳ Schicht 4 Projekte + Zeit
    - ⏳ Schicht 5 Import
  - ⏳ Reihenfolge nach Schicht 5 bis zum Stichtag (weitere Module, Sync, Mobile)
  - ⏳ Zeitpunkt Organisations-Spaces & Policies
  - ⏳ Onboarding / Blueprints
- ✅ Motivation OSS (D2)
  - ✅ Lizenz: AGPL App/Server, MIT SDK (D18)
  - ❓ Q12 Geschäftsmodell (Empfehlung: Sync & Org-Spaces bezahlt, Selbsthosten frei)
  - ⏳ Community / Governance
- ✅ Self-Engine (D3)
  - ❓ Q13 Was in Self-Engine noch passieren darf
  - ⏳ Import aus Self-Engine: Format, Umfang, ab welchem Meilenstein
- ✅ Repo: neues Repo (D4)
  - ✅ Name bleibt Self-Engine (D50)
    - ❓ Q33 Identität während des Übergangs (App-ID, Repo-Umbenennung)
  - ✅ Agenten-Setup: ausgewählt übernehmen nach Audit (D27) → Teil von Schicht 0
- ✅ Plattform: Desktop zuerst als Hauptprodukt, dann Web und Mobile (D6, D26)
  - ✅ Desktop-Shell: Electron (D17)
  - ✅ UI: React + Mantine, App-Hülle zuerst, von unten nach oben (D23)
- ✅ Produktkern: fokussierte App, Modularität Stufe 1–3 (D20)
  - ✅ Fachmodule mit festen Grenzen ab Tag 1, Manifest ab Modul 3 (D8, D10)
  - ✅ Plugins von anderen: irgendwann, kein Architekturziel jetzt (D21)
  - ✅ Datenmodell: Tabellen pro Modul + `custom`-Spalte + Brückentabellen (D22)
    - ✅ Recherche Datenmodelle → research-data-models.md (D16)
    - ✅ Prototyp-Vergleich, nur Desktop → prototypes/data-model/RESULTS.md (D19); V3 gewann unter der alten Annahme „Plugins ohne Migration“
  - ⏳ Module an-/abschalten, Sidebar/Dashboard anordnen
  - ⏳ Eigene Felder (Umfang, Feldtypen)
  - ⏳ Brücken zwischen Modulen (z. B. Abrechnung Zeit → Finanzen)
- ✅ Sync später, eigene Speicher-Schnittstelle, Engine in der Sync-Phase (D11)
  - ⏳ Spaces, Autorität, Konflikte
  - ⏳ Policies (Ebenen, Sperren)
  - ❓ Q21 Ende-zu-Ende-Verschlüsselung (Empfehlung: später, nur persönliche Spaces)
- ❓ Q16 KI-Assistent (Empfehlung: nach MVP, eigener Key + lokaler MCP-Server)
- ✅ Sprachen: DE + EN ab Tag 1, Code/Doku Englisch (D24)
- ✅ Plan liegt im Repo self-engine-next unter docs/plan (D13)
