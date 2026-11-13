// What the desktop app's preload and the page say to each other: the bridge the preload installs
// on the page's window, and the window messages that carry the data process's port and news.
// Both apps import it (ADR 0006: apps share code through packages), the preload in its sandbox
// and the web app at startup, so it holds no code beyond these few checks.

import type { HealthFailure } from "@self-engine/data-protocol";

/** The release channels; `Channel` in apps/desktop/src/channel.ts must stay assignable to it. */
export type DesktopChannel = "dev" | "nightly" | "stable";

/** What the Electron preload installs on the page's window as `desktopBridge`. */
export interface DesktopBridge {
  readonly platform: string;
  readonly channel: DesktopChannel;
  /**
   * The version of the main process: a release only gets its version at packaging. Absent
   * when the preload was handed none, which leaves the rest of the bridge as it is.
   */
  readonly version: string | undefined;
  /** Asks for a port to the data process; it arrives as a window message (`PageMessage`). */
  requestDataPort(): void;
  /** Starts the data process again after repeated crashes stopped it. */
  retryDataProcess(): void;
}

/**
 * Preload → page, by `window.postMessage` to the page's own origin. A port cannot cross the
 * context bridge, so it travels this way, and the news travels the same way, so the page reads
 * all of it in the order sent.
 */
export type PageMessage =
  /** The message's `ports` holds a new port to the data process. */
  | { readonly kind: "port" }
  /** The data process exited unexpectedly; a fresh port follows once it is back. */
  | { readonly kind: "gone" }
  /** The data process kept crashing and stays down until a retry. */
  | { readonly kind: "stopped" }
  /** The data process exited in this failure state; it is not restarted (spec #29). */
  | { readonly kind: "failed"; readonly failure: HealthFailure };

const PAGE_MESSAGE = "self-engine:data-process";

/** The `data` of the window message that carries `message`. */
export function pageMessageData(message: PageMessage): unknown {
  return { type: PAGE_MESSAGE, ...message };
}

/** The page message a window message's `data` carries; `undefined` for any other data. */
export function readPageMessage(data: unknown): PageMessage | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  if (!("type" in data) || data.type !== PAGE_MESSAGE || !("kind" in data)) return undefined;
  switch (data.kind) {
    case "port":
    case "gone":
    case "stopped":
      return { kind: data.kind };
    case "failed":
      return "failure" in data && isFailure(data.failure)
        ? { kind: "failed", failure: data.failure }
        : undefined;
    default:
      return undefined;
  }
}

// Typed against the contract, so a new failure state fails to compile here until it is listed.
const FAILURE_STATES: Readonly<Record<HealthFailure["state"], true>> = {
  migrationFailed: true,
  databaseNewer: true,
};

function isFailure(value: unknown): value is HealthFailure {
  return (
    typeof value === "object" &&
    value !== null &&
    "state" in value &&
    typeof value.state === "string" &&
    Object.hasOwn(FAILURE_STATES, value.state) &&
    "migration" in value &&
    typeof value.migration === "string"
  );
}

/**
 * The name of the performance mark the page sets for each state of its data connection, with the
 * status as its `detail`. The desktop smoke test (scripts/desktop-smoke.ts) reads these marks.
 */
export const CONNECTION_MARK = "self-engine:data-connection";
