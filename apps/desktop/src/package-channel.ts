// `pnpm package:desktop <nightly|stable> [--release-version <version>]`: builds the workspace
// for one release channel, into that channel's own bundle folder, and packages it into
// `apps/desktop/release/<channel>`. Without a version it makes an unpacked app for inspection;
// with one, the dmg a release ships. It installs and uploads nothing. It lives in the
// app because repo scripts may not import apps (ADR 0006) and the identity is the app's own.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { type Channel, bundleDirectory, channelIdentity, parseChannel } from "./channel.ts";

const DESKTOP_DIR = resolve(import.meta.dirname, "..");
const ROOT_DIR = resolve(DESKTOP_DIR, "../..");
const BUNDLES = ["main.cjs", "preload.cjs"];

export type ReleaseChannel = Exclude<Channel, "dev">;

/** The channel to package. Dev is never packaged: it has no renderer of its own. */
export function parseReleaseChannel(value: string | undefined): ReleaseChannel {
  const channel = value === undefined ? "dev" : parseChannel(value);
  if (channel === "dev") {
    throw new Error("Name the channel to package: `pnpm package:desktop <nightly|stable>`.");
  }
  return channel;
}

export interface PackageRequest {
  readonly channel: ReleaseChannel;
  /** Set for a release: stamped into the package, and the dmg is built. */
  readonly releaseVersion: string | undefined;
}

export function parsePackageRequest(argv: readonly string[]): PackageRequest {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: { "release-version": { type: "string" } },
  });
  const releaseVersion = values["release-version"];
  if (releaseVersion === "") throw new Error("--release-version needs a version.");
  return { channel: parseReleaseChannel(positionals[0]), releaseVersion };
}

/** The binary of the `electron` package that `desktopDir` depends on. */
export function electronDistPath(desktopDir: string): string {
  const require = createRequire(join(desktopDir, "package.json"));
  return join(dirname(require.resolve("electron/package.json")), "dist");
}

/** The electron-builder configuration of `channel`. */
export function builderConfig(
  channel: ReleaseChannel,
  electronDist: string,
  releaseVersion?: string,
) {
  const { appId, productName, icon } = channelIdentity(channel);
  return {
    appId,
    productName,
    // The binary `pnpm dev` already runs, so packaging downloads no second copy from GitHub.
    electronDist,
    // Electron reads `app.name` and `app.getVersion()` from the packaged package.json, not from
    // `build.productName`. A release carries the version the plan resolved; no commit does.
    extraMetadata: {
      productName,
      ...(releaseVersion === undefined ? {} : { version: releaseVersion }),
    },
    directories: { output: `release/${channel}` },
    // GitHub turns a space in an asset name into a dot; this name stays what the build wrote.
    artifactName: `${productName.replaceAll(" ", "-")}-\${version}-\${arch}.\${ext}`,
    // Always `dist-electron` inside the package, because that is where `main` points.
    files: [
      "package.json",
      { from: bundleDirectory(channel), to: "dist-electron" },
      { from: "../web/dist", to: "dist-renderer" },
    ],
    mac: {
      target: releaseVersion === undefined ? "dir" : "dmg",
      // Ad hoc until the Developer ID of issue #10: not trusted by anyone, but a valid signature
      // for the whole bundle, unlike the skipped one. Hardened runtime cannot load Electron's
      // own frameworks under an ad-hoc signature.
      identity: "-",
      hardenedRuntime: false,
      icon,
    },
    // Updates are downloaded by hand (ADR 0007), so the dmg needs no block map.
    dmg: { writeUpdateInfo: false },
    npmRebuild: false,
  };
}

/**
 * Throws unless both bundles in `bundleDir` were compiled for `channel`. Every bundle carries
 * the identity table of all channels, so only the compiled `define` tells them apart.
 */
export function assertBundlesBuiltFor(channel: ReleaseChannel, bundleDir: string): void {
  const expected = `parseChannel(${JSON.stringify(channel)})`;
  for (const name of BUNDLES) {
    const file = join(bundleDir, name);
    if (!existsSync(file) || !readFileSync(file, "utf8").includes(expected)) {
      throw new Error(
        `${file} was not compiled for the ${channel} channel (no ${expected} in it), so it is not packaged.`,
      );
    }
  }
}

export type Run = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) => void;

export interface PackageOptions {
  readonly rootDir: string;
  readonly desktopDir: string;
  readonly electronDist: string;
  readonly env: NodeJS.ProcessEnv;
  readonly run: Run;
}

/** Builds with the channel compiled in, then packages that build. */
export function packageChannel(request: PackageRequest, options: PackageOptions): void {
  const { channel, releaseVersion } = request;
  const { rootDir, desktopDir, electronDist, env, run } = options;
  run(process.execPath, [join(rootDir, "scripts/ensure-electron.ts")], { cwd: rootDir, env });
  // So a bundle from an earlier run cannot pass for this build.
  const bundleDir = join(desktopDir, bundleDirectory(channel));
  rmSync(bundleDir, { recursive: true, force: true });
  // `--no-cache`: Vite Task hides SELF_ENGINE_CHANNEL from a cached task, which then builds dev.
  run(join(rootDir, "node_modules/.bin/vp"), ["run", "--no-cache", "-r", "build"], {
    cwd: rootDir,
    env: { ...env, SELF_ENGINE_CHANNEL: channel },
  });
  assertBundlesBuiltFor(channel, bundleDir);
  const outputDir = join(desktopDir, "release", channel);
  mkdirSync(outputDir, { recursive: true });
  const configPath = join(outputDir, "electron-builder.json");
  writeFileSync(
    configPath,
    JSON.stringify(builderConfig(channel, electronDist, releaseVersion), null, 2),
  );
  // `--publish never`: electron-builder would otherwise publish on its own when it sees a CI tag.
  const targetArgs = releaseVersion === undefined ? ["--dir"] : ["--publish", "never"];
  run(
    join(desktopDir, "node_modules/.bin/electron-builder"),
    [...targetArgs, "--mac", "--arm64", "--config", configPath],
    { cwd: desktopDir, env },
  );
}

if (import.meta.main) {
  packageChannel(parsePackageRequest(process.argv.slice(2)), {
    rootDir: ROOT_DIR,
    desktopDir: DESKTOP_DIR,
    electronDist: electronDistPath(DESKTOP_DIR),
    env: process.env,
    run: (command, args, options) => {
      execFileSync(command, args, { ...options, stdio: "inherit" });
    },
  });
}
