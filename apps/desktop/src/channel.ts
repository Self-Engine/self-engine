// What separates the channels from each other (ADR 0007). The channel is fixed when the bundle
// is built (build-channel.ts): `app.isPackaged` cannot tell nightly from stable, and a run-time
// variable would let an unpackaged `electron .` pose as the production app.

import path from "node:path";

export const CHANNELS = ["dev", "nightly", "stable"] as const;
export type Channel = (typeof CHANNELS)[number];

export interface ChannelIdentity {
  readonly channel: Channel;
  /** The app's name, also `app.name`, which names its Keychain item (`<name> Safe Storage`). */
  readonly productName: string;
  /** Never the old app's `com.self-engine.desktop`. */
  readonly appId: string;
  /** The custom protocol the renderer is served from. */
  readonly scheme: string;
  /**
   * The folder under the OS app-data directory. Always set explicitly: Electron's default in
   * any build is the package name, `@self-engine/desktop`, which is the live data folder of
   * the installed old Self-Engine app.
   */
  readonly dataFolder: string;
  /**
   * Relative to `apps/desktop`. Dev's is a PNG for the Dock. The release icons are `.icns`
   * already, because electron-builder downloads a converter from GitHub for a PNG.
   */
  readonly icon: string;
}

const IDENTITIES: Readonly<Record<Channel, ChannelIdentity>> = {
  dev: {
    channel: "dev",
    productName: "Self-Engine Dev",
    appId: "app.selfengine.desktop.dev",
    scheme: "self-engine-dev",
    dataFolder: "Self-Engine Dev",
    icon: "icons/dev.png",
  },
  nightly: {
    channel: "nightly",
    productName: "Self-Engine Nightly",
    appId: "app.selfengine.desktop.nightly",
    scheme: "self-engine-nightly",
    dataFolder: "Self-Engine Nightly",
    icon: "icons/nightly.icns",
  },
  stable: {
    channel: "stable",
    productName: "Self-Engine",
    appId: "app.selfengine.desktop",
    scheme: "self-engine",
    dataFolder: "Self-Engine",
    icon: "icons/stable.icns",
  },
};

export function channelIdentity(channel: Channel): ChannelIdentity {
  return IDENTITIES[channel];
}

function isChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value);
}

/**
 * The channel a build is for. Unset means dev, so that `vp pack` and `pnpm dev` need no setup
 * and only a deliberate packaging run makes a release bundle; a wrong value never builds.
 */
export function parseChannel(value: string | undefined): Channel {
  if (value === undefined) return "dev";
  if (isChannel(value)) return value;
  throw new Error(`Unknown channel "${value}". Expected one of: ${CHANNELS.join(", ")}.`);
}

/** Where the channel keeps its data; `--user-data-dir` moves it, as it does in Chromium. */
export function userDataPath(appData: string, dataFolder: string, override: string): string {
  return override === "" ? path.join(appData, dataFolder) : path.resolve(override);
}

/**
 * The Vite dev server a build loads its renderer from. Only dev has one; a release build ignores
 * the variable. A dev build has no renderer of its own, so without the URL it cannot start.
 */
export function resolveDevServer(channel: Channel, url: string | undefined): URL | undefined {
  if (channel !== "dev") return undefined;
  const trimmed = url?.trim();
  if (!trimmed) {
    throw new Error(
      "This is a dev build, and VITE_DEV_SERVER_URL is not set, so it has no renderer to show. Start it with `pnpm dev`.",
    );
  }
  return new URL(trimmed);
}
