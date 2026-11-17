export { createFrame, type FrameReport, type FrameOptions } from "./frame.ts";
export {
  defineStorageModule,
  type StorageModule,
  type ErasedStorageModule,
  type ModuleEntries,
  type ReadTransaction,
  type StorageContract,
  type RowMap,
} from "./module.ts";
export { createContext, type StorageContext, type ContextSources } from "./context.ts";
// The id of a Space is `spaces`' own; modules take it from here for their row maps (D287).
export { spaceIdSchema, type SpaceId } from "@self-engine/spaces";
export { sharedEntry, sharedWrites } from "./shared-entry.ts";
export { protectionRule, type ProtectionRule, type RuleRow, type WrittenValues } from "./rules.ts";
export { referenceCheck } from "./reference-check.ts";
export { clearance, type Clearance, type ClearanceWrite, type RowClearance } from "./clearance.ts";
export {
  protectionRules,
  noProtectionRules,
  type ProtectionRules,
  type RegisteredRule,
  type RuleAnswer,
  type WriteKind,
} from "./registry.ts";

export {
  windowList,
  smallSetList,
  pageList,
  pageSchema,
  pageInputSchema,
  type Page,
} from "./lists.ts";
