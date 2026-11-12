import type { AppContract } from "@self-engine/contracts";
import { placeholderAlpha } from "@self-engine/placeholder-alpha/data";
import type { ErasedStorageModule } from "@self-engine/storage";

export type DataModules = Readonly<Record<string, ErasedStorageModule>>;

type ModuleContracts = Omit<AppContract, "health" | "tablesChanged">;
type AppModules = keyof ModuleContracts extends never
  ? Readonly<Record<string, never>>
  : {
      readonly [Key in keyof ModuleContracts]: ErasedStorageModule & {
        readonly name: Key;
        readonly contract: ModuleContracts[Key];
      };
    };

/** Add a module's data entry here; both migrations and calls come from this list. */
export const modules = { placeholderAlpha } satisfies AppModules;
