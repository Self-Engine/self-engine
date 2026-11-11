import { healthContract } from "./health.ts";
import { tablesChangedContract } from "./tables-changed.ts";

/**
 * Every procedure the data process serves. The cross-module procedures live here; each module's
 * contract is mounted under its name once it has one (D187), so the import direction is
 * `contracts → module`.
 */
export const appContract = {
  health: healthContract,
  tablesChanged: tablesChangedContract,
};

/** The renderer imports only this type, so no schema loads at startup (D187). */
export type AppContract = typeof appContract;
