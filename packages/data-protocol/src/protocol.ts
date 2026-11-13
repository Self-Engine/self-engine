import { backupsContract } from "./backups.ts";
import { healthContract } from "./health.ts";
import { tablesChangedContract } from "./tables-changed.ts";

/**
 * What the Data Process answers on every port, whatever modules it mounts: `health`, the Table
 * Change stream and the Backups of the database. It knows no module, so the data client, the
 * Data Process and the desktop app can import it without reaching a module (ADR 0006, no cycles
 * between packages).
 */
export const protocolContract = {
  health: healthContract,
  tablesChanged: tablesChangedContract,
  backups: backupsContract,
};

/** The renderer imports only this type, so no schema loads at startup (D187). */
export type ProtocolContract = typeof protocolContract;

/** The procedure names a module may not take as its mount name. */
export const PROTOCOL_PROCEDURES = Object.keys(
  protocolContract,
) as readonly (keyof ProtocolContract)[];
