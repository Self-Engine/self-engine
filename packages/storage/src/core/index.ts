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

export {
  windowList,
  smallSetList,
  pageList,
  pageSchema,
  pageInputSchema,
  type Page,
} from "./lists.ts";
