---
name: grill
description: Grill the owner on a design question of this repo. Use for every grilling of a layer, a work package or a map's ticket, and when the owner asks to be grilled.
---

# Grill

1. **Load the pair.** Call the Skill tool twice, for `grilling` and `domain-modeling` (what `/grill-with-docs` loads). Load them again when a context compaction has dropped their text. Done when both texts are in your context.
2. **Read what is decided:** the issue and its parent, the ADRs that touch the question, and the terms in [`GLOSSARY.md`](../../../GLOSSARY.md).
3. **Orient the owner** before the first question: why the question matters, how the app works today, what is decided, and which questions will come. A layer or a work package gets [the sort](../../../docs/agents/workflow.md#sorting-the-questions) here; a map's ticket needs none.
4. **Grill** by the rules below. Done when no question on the owner's list is open.
5. **Record** every answer on the issue, in English: a comment on a work package, the resolution comment on a map's ticket.

## Rules of a round

- **German** with the owner; issues, ADRs and the glossary stay English. Say "Arbeitspaket": a bare "Paket" reads as a code package.
- **Few questions:** one to three per round. Each comes with a scenario that shows what the answer changes later, the options, and your recommendation.
- **Costs by name:** for each option, what it costs while the app runs and what the compiler still checks. Look for a typed variant before you recommend an option that loses a compile-time check.
- **The old app is one option** among several. Start from what is scalable and stable, and say where the old app did it differently.
- **Generated data** tests a stored form. The owner's own data arrives with the import at the cutover.
- **A question inside an answer** ("yes, but I wonder…") gets its answer before the next question.
