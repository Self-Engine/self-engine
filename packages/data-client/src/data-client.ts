import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { SupportedMessagePort } from "@orpc/client/message-port";
import type { AnyContractRouter, ContractRouterClient } from "@orpc/contract";
// A type only: the renderer never loads the contract's schemas (D187). The boundary rules fail
// a value import.
import type { AppContract } from "@self-engine/contracts";

/**
 * The renderer's end of a channel to the data process. A DOM `MessagePort` queues its messages
 * until `start` runs, which this client calls once it listens.
 */
export type DataClientPort = SupportedMessagePort & { start?: () => void };

/** Typed calls to the data process, one method per procedure of the contract. */
export type DataClient<Contract extends AnyContractRouter = AppContract> =
  ContractRouterClient<Contract>;

/**
 * A typed client for the data process on `port`. It checks nothing it receives: the data
 * process checks every input, and outputs are checked in tests (D188). The type parameter
 * exists for tests that serve a contract of their own.
 */
export function createDataClient<Contract extends AnyContractRouter = AppContract>(
  port: DataClientPort,
): DataClient<Contract> {
  const link = new RPCLink({ port });
  port.start?.();
  return createORPCClient<DataClient<Contract>>(link);
}
