// What the main process, the data process and the preload say to each other about the data
// process. Free of `electron`, so every bundle and its tests can import it.
//
// The handoff has an order (spike on #29): the data process tells the main process that it is
// serving only once its handler is installed; the main process creates a channel only after
// that, per request of a page, and gives one end to the data process and the other to the page.

import type { DataProcess } from "@self-engine/data-process";

/** The outcome of the data process's start: `ready`, or a failure state it stays alive in. */
export type HealthState = DataProcess["health"]["state"];

const SERVING = "data-process:serving";
const PORT_HANDOFF = "data-process:port";

/**
 * Data process → main process: the database is open, the migrations have run, and ports are
 * answered. It carries the outcome, as the main process does not restart a data process in a
 * failure state (spec #29).
 */
export function servingMessage(health: HealthState): unknown {
  return { type: SERVING, health };
}

/** The outcome a serving message carries; `undefined` for any other message. */
export function servingHealth(message: unknown): HealthState | undefined {
  if (!isMessage(message, SERVING) || !("health" in message)) return undefined;
  const { health } = message;
  return health === "ready" || health === "migrationFailed" || health === "databaseNewer"
    ? health
    : undefined;
}

/**
 * Main process → data process: the port in this message's `ports` is a new connection for the
 * page numbered `page`. It replaces that page's earlier port, which a reload left behind.
 */
export function portHandoff(page: number): unknown {
  return { type: PORT_HANDOFF, page };
}

/** The page a port handoff is for; `undefined` for any other message. */
export function handoffPage(message: unknown): number | undefined {
  if (!isMessage(message, PORT_HANDOFF) || !("page" in message)) return undefined;
  return typeof message.page === "number" ? message.page : undefined;
}

function isMessage(message: unknown, type: string): message is { readonly type: string } {
  return (
    typeof message === "object" && message !== null && "type" in message && message.type === type
  );
}

/** Page (through the preload) → main process: asks for a port to the data process. */
export const PORT_REQUEST_CHANNEL = "data-process:request-port";

/** Main process → preload: the port in this message's `ports` reaches the data process. */
export const PORT_CHANNEL = "data-process:port";

/** Main process → preload: the data process exited unexpectedly; a fresh port follows. */
export const GONE_CHANNEL = "data-process:gone";

/** Main process → preload: the data process kept crashing and stays down until a retry. */
export const STOPPED_CHANNEL = "data-process:stopped";

/** Page (through the preload) → main process: start the stopped data process again. */
export const RETRY_CHANNEL = "data-process:retry";

/**
 * Preload → page, by `window.postMessage`: the `data` of the message that carries the port.
 * apps/web/src/desktop-data.ts repeats the three page messages, as the web app cannot import
 * the desktop app. All three travel the same way, so the page sees them in the order sent.
 */
export const PAGE_PORT_MESSAGE = "self-engine:data-port";

/** Preload → page: the `data` of the window message that says the data process is gone. */
export const PAGE_GONE_MESSAGE = "self-engine:data-gone";

/** Preload → page: the `data` of the window message that says the data process stopped. */
export const PAGE_STOPPED_MESSAGE = "self-engine:data-stopped";

const DATABASE_FLAG = "--database=";

/** The arguments that pass the database file to the data process. */
export function dataProcessArgs(databasePath: string): string[] {
  return [`${DATABASE_FLAG}${databasePath}`];
}

/** The database file the main process passed, read from the data process's `process.argv`. */
export function databasePathFromArgs(argv: readonly string[]): string {
  const argument = argv.find((value) => value.startsWith(DATABASE_FLAG));
  const databasePath = argument?.slice(DATABASE_FLAG.length);
  if (!databasePath) {
    throw new Error(`The data process was started without ${DATABASE_FLAG}<path>.`);
  }
  return databasePath;
}
