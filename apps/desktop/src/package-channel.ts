// `pnpm package:desktop <nightly|stable>`: builds the workspace for one release channel and
// packages it into `apps/desktop/release/<channel>`. It installs nothing. It lives in the app
// because repo scripts may not import apps (ADR 0006) and the identity is the app's own.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { type Channel, channelIdentity, parseChannel } from "./channel.ts";

const DESKTOP_DIR = resolve(import.meta.dirname, "..");
const ROOT_DIR = resolve(DESKTOP_DIR, "../..");

export type ReleaseChannel = Exclude<Channel, "dev">;

/** The channel to package. Dev is never packaged: it has no renderer of its own. */
export function parseReleaseChannel(value: string | undefined): ReleaseChannel {
  const channel = value === undefined ? "dev" : parseChannel(value);
  if (channel === "dev") {
    throw new Error("Name the channel to package: `pnpm package:desktop <nightly|stable>`.");
  }
  return channel;
}

/** The electron-builder configuration of `channel`. */
export function builderConfig(channel: ReleaseChannel) {
  const { appId, productName, icon } = channelIdentity(channel);
  return {
    appId,
    productName,
    // Electron reads `app.name` from the packaged package.json, not from `build.productName`.
    extraMetadata: { productName },
    directories: { output: `release/${channel}` },
    files: ["dist-electron/**", "package.json", { from: "../web/dist", to: "dist-renderer" }],
    mac: { target: "dir", identity: null, icon },
    npmRebuild: false,
  };
}

export type Run = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) => void;

export interface PackageOptions {
  readonly rootDir: string;
  readonly desktopDir: string;
  readonly env: NodeJS.ProcessEnv;
  readonly run: Run;
}

/** Builds with the channel compiled in, then packages that build. */
export function packageChannel(channel: ReleaseChannel, options: PackageOptions): void {
  const { rootDir, desktopDir, env, run } = options;
  run(join(rootDir, "node_modules/.bin/vp"), ["run", "-r", "build"], {
    cwd: rootDir,
    env: { ...env, SELF_ENGINE_CHANNEL: channel },
  });
  const outputDir = join(desktopDir, "release", channel);
  mkdirSync(outputDir, { recursive: true });
  const configPath = join(outputDir, "electron-builder.json");
  writeFileSync(configPath, JSON.stringify(builderConfig(channel), null, 2));
  run(
    join(desktopDir, "node_modules/.bin/electron-builder"),
    ["--dir", "--mac", "--arm64", "--config", configPath],
    { cwd: desktopDir, env },
  );
}

if (import.meta.main) {
  packageChannel(parseReleaseChannel(process.argv[2]), {
    rootDir: ROOT_DIR,
    desktopDir: DESKTOP_DIR,
    env: process.env,
    run: (command, args, options) => {
      execFileSync(command, args, { ...options, stdio: "inherit" });
    },
  });
}
