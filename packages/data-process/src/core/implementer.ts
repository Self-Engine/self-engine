import { implement } from "@orpc/server";
import { protocolContract } from "@self-engine/data-protocol";

/**
 * The protocol to implement, shared by every procedure file; module entries are implemented by
 * the storage frame. oRPC checks each input against the contract before a handler runs, so the
 * data process refuses a call that breaks its schema (D188).
 */
export const implementer = implement(protocolContract);
