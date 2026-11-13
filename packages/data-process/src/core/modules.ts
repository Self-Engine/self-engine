import type { ErasedStorageModule } from "@self-engine/storage";

/**
 * The data entries the Data Process mounts, by mount name. The app passes its list
 * (`apps/desktop/src/data-modules.ts`); the core knows no module, so a module's tests may start it
 * without a cycle between packages (ADR 0006).
 */
export type DataModules = Readonly<Record<string, ErasedStorageModule>>;
