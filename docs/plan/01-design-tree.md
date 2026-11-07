# Design-Baum

Legende: ✅ entschieden · ❓ offen (Frontier) · ⏳ wartet auf Vorgänger
Pro Runde werden nur 2–3 Fragen gestellt; die Nummern sind stabil.

- ✅ Zielgruppe: Freelancer (D1)
  - ✅ Erster Meilenstein Projekte + Zeit; Ablösung erst bei Funktionsgleichheit (D9)
  - ✅ Übergang: wiederholbarer Import, Wechsel am Stichtag (D12)
  - ✅ Mobile + Sync sind Pflicht vor dem Stichtag (D14)
  - ⏳ Reihenfolge bis zum Stichtag (Module, Sync, Mobile)
  - ⏳ Zeitpunkt Organisations-Spaces & Policies
  - ⏳ Onboarding / Blueprints
- ✅ Motivation OSS (D2)
  - ❓ Q11 Lizenz (Empfehlung: AGPL App/Server, MIT SDK)
  - ❓ Q12 Geschäftsmodell (Empfehlung: Sync & Org-Spaces bezahlt, Selbsthosten frei)
  - ⏳ Community / Governance
- ✅ Self-Engine (D3)
  - ❓ Q13 Was in Self-Engine noch passieren darf
  - ⏳ Import aus Self-Engine: Format, Umfang, ab welchem Meilenstein
- ✅ Repo: neues Repo (D4)
  - ❓ Q14 Endgültiger Name (Arbeitstitel: self-engine-next)
  - ❓ Q18 Agenten-Setup im neuen Repo (Glossar, ADRs, ein Verify-Befehl)
- ✅ Plattform: Desktop + Web (D6)
  - ❓ Q20 Desktop-Shell (Empfehlung: Electron)
  - ❓ Q15 UI-Stack (Empfehlung: Mantine + eigene UI-Schicht für Plugins)
- ✅ Fachmodule + generische Schicht (D8)
  - ✅ Feste Modulgrenzen ab Tag 1, Manifest ab Modul 3 (D10)
  - ❓ Q22 Datenmodell → Vertiefung in 02-storage-options.md
    - ✅ Ziel eigene Typen, zuerst eigene Felder (D15)
    - 🔎 Recherche Datenmodelle → research-data-models.md (D16)
    - ⏳ Prototyp-Vergleich (D16)
  - ⏳ Generische Schicht: wann und wie viel
  - ⏳ Brücken zwischen Modulen (z. B. Abrechnung Zeit → Finanzen)
  - ⏳ Öffentliche Plugin-API, Sandbox, Berechtigungen
- ✅ Sync später, eigene Speicher-Schnittstelle, Engine in der Sync-Phase (D11)
  - ⏳ Spaces, Autorität, Konflikte
  - ⏳ Policies (Ebenen, Sperren)
  - ❓ Q21 Ende-zu-Ende-Verschlüsselung (Empfehlung: später, nur persönliche Spaces)
- ❓ Q16 KI-Assistent (Empfehlung: nach MVP, eigener Key + lokaler MCP-Server)
- ❓ Q17 Sprachen (Empfehlung: DE + EN ab Tag 1, Code/Doku Englisch)
- ✅ Plan liegt im Repo self-engine-next unter docs/plan (D13)
