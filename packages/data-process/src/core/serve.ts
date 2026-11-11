import type { AnyRouter } from "@orpc/server";
import { RPCHandler } from "@orpc/server/message-port";

/** A port of the platform: a DOM or Node `MessagePort`, or Electron's `MessagePortMain`. */
export type DataPort = Parameters<RPCHandler<object>["upgrade"]>[0];

/** Answers calls on any number of ports with one router: one port per window and reload. */
export function createPortServer(router: AnyRouter): (port: DataPort) => void {
  const handler = new RPCHandler(router);
  return (port) => {
    handler.upgrade(port);
    // A DOM or Node port queues its messages until started; Electron's starts on its own too.
    if ("start" in port && typeof port.start === "function") port.start();
  };
}
