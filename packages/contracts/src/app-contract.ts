import { protocolContract } from "@self-engine/data-protocol";

/**
 * Every procedure the data process serves: the protocol's `health` and `tablesChanged`, and each
 * module's contract mounted under its name (D187), so the import direction is `contracts →
 * module`. Only the desktop app's module list imports it; the data client and the Data Process
 * take the protocol from `@self-engine/data-protocol`, which knows no module.
 */
export const appContract = {
  ...protocolContract,
};

/** The app contract's type, which the module list is checked against. */
export type AppContract = typeof appContract;
