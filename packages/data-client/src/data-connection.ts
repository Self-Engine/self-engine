import { createORPCClient, DynamicLink } from "@orpc/client";
import { RPCLink, type SupportedMessagePort } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { AppContract } from "@self-engine/contracts";

/** The typed client of the app contract. The contract arrives as a type only (D187). */
export type DataClient = ContractRouterClient<AppContract>;

/** A port of the platform: a DOM or Node `MessagePort`, or Electron's `MessagePortMain`. */
export type DataPort = SupportedMessagePort;

export interface DataConnection {
  /**
   * One client for the whole session. It sends every call over the port connected last, so a
   * caller keeps it across a new port. A call before the first port waits for it.
   */
  readonly client: DataClient;
  /** Sends the calls that follow over this port, for example after a reload or a restart. */
  connect(port: DataPort): void;
}

/** The renderer's connection to the data process, platform-neutral: it only needs a port. */
export function createDataConnection(): DataConnection {
  let resolveFirstLink: (link: RPCLink<object>) => void = () => {};
  let currentLink = new Promise<RPCLink<object>>((resolve) => {
    resolveFirstLink = resolve;
  });
  return {
    client: createORPCClient(new DynamicLink(() => currentLink)),
    connect(port) {
      const link = new RPCLink({ port });
      if ("start" in port && typeof port.start === "function") port.start();
      resolveFirstLink(link);
      currentLink = Promise.resolve(link);
    },
  };
}
