import type { ErasedStorageModule } from "@self-engine/storage";

export type DataModules = Readonly<Record<string, ErasedStorageModule>>;

/** Add a module's data entry here; both migrations and calls come from this list. */
export const modules: DataModules = {};
