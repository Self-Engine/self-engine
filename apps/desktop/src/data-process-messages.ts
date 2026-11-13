// What the main process and the data process say to each other. Free of `electron`, so both
// bundles and their tests can import it. The preload's channels are in data-process-channels.ts,
// apart, so that the preload bundles no schema.
//
// The handoff has an order (spike on #29): the data process tells the main process that it is
// serving only once its handler is installed; the main process creates a channel only after
// that, per request of a page, and gives one end to the data process and the other to the page.

import { type Health, healthSchema } from "@self-engine/data-protocol";

const SERVING = "data-process:serving";
const PORT_HANDOFF = "data-process:port";

/**
 * Data process → main process: the database is open, the migrations have run, and ports are
 * answered. It carries the outcome, its `health`: the main process does not restart a data
 * process in a failure state, and keeps telling pages about it after it exits (spec #29).
 */
export function servingMessage(health: Health): unknown {
  return { type: SERVING, health };
}

/** The outcome a serving message carries; `undefined` for any other message. */
export function servingHealth(message: unknown): Health | undefined {
  if (!isMessage(message, SERVING) || !("health" in message)) return undefined;
  const parsed = healthSchema.safeParse(message.health);
  return parsed.success ? parsed.data : undefined;
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
