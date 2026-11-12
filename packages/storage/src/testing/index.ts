export { createTestContext, createTestDatabase } from "./helpers.ts";
export { checkContract, type ContractViolation, type Seed } from "./contract.ts";
export type { ConflictExamples } from "./conflicts.ts";

// Test-only modules for consumers that exercise module composition.
export { notes } from "../../test/notes-module/data/index.ts";
export { links } from "../../test/note-links-module/data/index.ts";
