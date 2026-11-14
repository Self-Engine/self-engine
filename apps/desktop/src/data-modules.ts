import type { AppContract } from "@self-engine/contracts";
import type { DataModules } from "@self-engine/data-process";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { placeholderAlpha } from "@self-engine/placeholder-alpha/data";
import { projects } from "@self-engine/projects/data";

type ModuleContracts = Omit<AppContract, keyof ProtocolContract>;
type AppModules = keyof ModuleContracts extends never
  ? Readonly<Record<string, never>>
  : {
      readonly [Key in keyof ModuleContracts]: DataModules[string] & {
        readonly name: Key;
        readonly contract: ModuleContracts[Key];
      };
    };

/**
 * The data entries the app's Data Process mounts. Add a module's data entry here, under the name
 * its contract has in the app contract; both migrations and calls come from this list.
 */
export const dataModules = { placeholderAlpha, projects } satisfies AppModules;
