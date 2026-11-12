import { implement } from "@orpc/server";
import { appContract } from "@self-engine/contracts";

/**
 * The app contract to implement, shared by every procedure file. oRPC checks each input
 * against the contract before a handler runs, so the data process refuses a call that breaks
 * its schema (D188).
 */
export const implementer = implement(appContract);
