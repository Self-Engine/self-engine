// What the main process, the data process and the preload say to each other about the data
// process. Free of `electron`, so every bundle and its tests can import it.
//
// The handoff has an order (spike on #29): the data process tells the main process that it is
// serving only once its handler is installed; the main process creates a channel only after
// that, per request of a page, and gives one end to the data process and the other to the page.

/** Data process → main process: the database is open, migrated, and ports are answered. */
export const SERVING = "data-process:serving";

/** Main process → data process: the port in this message's `ports` is a new connection. */
export const PORT_HANDOFF = "data-process:port";

/** Page (through the preload) → main process: asks for a port to the data process. */
export const PORT_REQUEST_CHANNEL = "data-process:request-port";

/** Main process → preload: the port in this message's `ports` reaches the data process. */
export const PORT_CHANNEL = "data-process:port";

/**
 * Preload → page, by `window.postMessage`: the `data` of the message that carries the port.
 * apps/web/src/desktop-data.ts repeats it, as the web app cannot import the desktop app.
 */
export const PAGE_PORT_MESSAGE = "self-engine:data-port";

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
