// For tests only: the test Data Process with `projects`, `time-tracking` and `settings` mounted,
// a fixed Clock, and a client of its Port, as a View, a Command or an assistant calls it.
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";
import type { ProtocolContract } from "@self-engine/data-protocol";
import { startTestDataProcess, type TestDataProcess } from "@self-engine/data-process/testing";
import { projects } from "@self-engine/projects/data";
import { settings } from "@self-engine/settings-data/data";
import { resolveTimeZone, type TimeZone } from "@self-engine/time";
import { TIME_ZONE_SETTING } from "@self-engine/time/settings";
import { timeTracking } from "./data/index.ts";

export type TimeTrackingClient = ContractRouterClient<
  ProtocolContract & {
    projects: typeof projects.contract;
    timeTracking: typeof timeTracking.contract;
    settings: typeof settings.contract;
  }
>;

/**
 * Starts the test Data Process; the device runs in Berlin unless a test says else. The caller
 * closes it through `started`, after each test.
 */
export async function startTimeTracking(
  started: TestDataProcess[],
  { deviceZone = resolveTimeZone("Europe/Berlin").timeZone }: { deviceZone?: TimeZone } = {},
) {
  const process = await startTestDataProcess({
    modules: { projects, timeTracking, settings },
    deviceZone,
  });
  started.push(process);
  const client: TimeTrackingClient = createORPCClient(new RPCLink({ port: process.openPort() }));
  /** Saves the Time Zone as the settings area does. */
  const saveTimeZone = (name: string) =>
    client.settings.save({ entries: [{ key: TIME_ZONE_SETTING.key, value: name }] });
  return { process, client, saveTimeZone };
}

/** The error a call answers with, or `undefined` when it answers. */
export async function errorOf(call: Promise<unknown>) {
  const error: unknown = await call.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  return error as { code: string; data?: { issues?: unknown[]; reasons?: unknown[] } } | undefined;
}
