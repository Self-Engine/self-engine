// `pnpm package:desktop <nightly|stable> [--release-version <version>]`: builds the workspace
// for one release channel, into that channel's own bundle folder, and packages it into
// `apps/desktop/release/<channel>`. Without a version it makes an unpacked app for inspection;
// with one, the dmg a release ships, signed with the Developer ID when the signing inputs are
// in the environment and ad hoc when none are. Either way it then runs the gate's smoke test
// against the packaged app and fails when that does. It installs and uploads nothing. It lives in the
// app because repo scripts may not import apps (ADR 0006) and the identity is the app's own.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { type Channel, bundleDirectory, channelIdentity, parseChannel } from "./channel.ts";

export const DESKTOP_DIR = resolve(import.meta.dirname, "..");
export const ROOT_DIR = resolve(DESKTOP_DIR, "../..");
const BUNDLES = ["main.cjs", "preload.cjs"];

// electron-builder reads these from the environment: the certificate, and the Apple account
// that notarizes.
const SIGNING_INPUTS = [
  "CSC_LINK",
  "CSC_KEY_PASSWORD",
  "APPLE_ID",
  "APPLE_APP_SPECIFIC_PASSWORD",
  "APPLE_TEAM_ID",
] as const;
const ENTITLEMENTS = "entitlements.mac.plist";

export type ReleaseChannel = Exclude<Channel, "dev">;
export type Signing = "ad-hoc" | "developer-id";

/**
 * How this package is signed. Only a release is signed with the Developer ID. Without any
 * input a local release stays ad hoc and needs no Apple account; in CI, or with only some of
 * the inputs, that fallback would publish a release nobody can open, so it throws.
 */
export function resolveSigning(
  releaseVersion: string | undefined,
  env: NodeJS.ProcessEnv,
): Signing {
  if (releaseVersion === undefined) return "ad-hoc";
  const missing = SIGNING_INPUTS.filter((name) => !env[name]);
  if (missing.length === 0) return "developer-id";
  if (missing.length === SIGNING_INPUTS.length && !env.CI) return "ad-hoc";
  throw new Error(`A signed release needs every signing input. Missing: ${missing.join(", ")}.`);
}

/** `env` for the steps that have no use for the signing inputs. */
export function withoutSigningInputs(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const rest = { ...env };
  for (const name of SIGNING_INPUTS) delete rest[name];
  return rest;
}

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

// GitHub turns a space in an asset name into a dot; this name stays what the build wrote.
function artifactName(productName: string, version: string, arch: string, ext: string): string {
  return `${productName.replaceAll(" ", "-")}-${version}-${arch}.${ext}`;
}

/** Where electron-builder leaves the dmg of `version`. */
export function packagedDmgPath(
  desktopDir: string,
  channel: ReleaseChannel,
  version: string,
): string {
  const { productName } = channelIdentity(channel);
  return join(desktopDir, "release", channel, artifactName(productName, version, "arm64", "dmg"));
}

/** The executable inside the app electron-builder leaves in `release/<channel>/mac-arm64`. */
function packagedExecutablePath(desktopDir: string, channel: ReleaseChannel): string {
  const { productName } = channelIdentity(channel);
  return join(packagedAppPath(desktopDir, channel), "Contents/MacOS", productName);
}

function packagedAppPath(desktopDir: string, channel: ReleaseChannel): string {
  const { productName } = channelIdentity(channel);
  return join(desktopDir, "release", channel, "mac-arm64", `${productName}.app`);
}

/** The electron-builder configuration of `channel`. */
export function builderConfig(
  channel: ReleaseChannel,
  electronDist: string,
  releaseVersion?: string,
  signing: Signing = "ad-hoc",
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
    artifactName: artifactName(productName, "${version}", "${arch}", "${ext}"),
    // Always `dist-electron` inside the package, because that is where `main` points.
    files: [
      "package.json",
      { from: bundleDirectory(channel), to: "dist-electron" },
      { from: "../web/dist", to: "dist-renderer" },
      // The SQLite driver needs only its JavaScript and the binary for this Mac; its C sources
      // and the binaries of other platforms would only grow the app.
      "!**/node_modules/better-sqlite3/{deps,src}/**",
      "!**/node_modules/better-sqlite3/binding.gyp",
      "!**/node_modules/better-sqlite3/prebuilds/!(darwin-*).node",
    ],
    // A process loads a native module from a real file, never from inside app.asar.
    asarUnpack: ["**/*.node"],
    mac: {
      target: releaseVersion === undefined ? "dir" : "dmg",
      // Ad hoc is trusted by nobody, but a valid signature for the whole bundle, unlike a
      // skipped one. Hardened runtime cannot load Electron's own frameworks under it. With the
      // Developer ID, electron-builder takes the identity from CSC_LINK. Without
      // `notarize: false`, an Apple API key in the shell would send an ad-hoc build to Apple.
      ...(signing === "developer-id"
        ? {
            hardenedRuntime: true,
            notarize: true,
            entitlements: ENTITLEMENTS,
            entitlementsInherit: ENTITLEMENTS,
          }
        : { identity: "-", hardenedRuntime: false, notarize: false }),
      icon,
    },
    // No `electronFuses`: the fuses stay at Electron's defaults. The packaged smoke test (run at
    // the end of packageChannel) starts the signed app through Playwright, which needs the
    // `EnableNodeCliInspectArguments` fuse on for `--inspect` and Chromium's
    // `--remote-debugging-port`. A fuse config that turns that off must replace the smoke
    // test's launch first; package-channel.test.ts fails until it does.
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

/** Runs a command and returns its output, throwing when it fails. */
export type Inspect = (command: string, args: string[]) => string;

/**
 * Throws unless `appPath` is signed by the team in APPLE_TEAM_ID, hardened and notarized.
 * electron-builder only warns and carries on when it finds no identity or cannot notarize.
 */
export function assertDeveloperIdRelease(appPath: string, teamId: string, inspect: Inspect): void {
  inspect("codesign", ["--verify", "--deep", "--strict", appPath]);
  const details = inspect("codesign", ["-dvv", appPath]);
  if (!/^Authority=Developer ID Application:/m.test(details)) {
    throw new Error(`${appPath} is not signed with a Developer ID, so it is not released.`);
  }
  if (!details.split("\n").includes(`TeamIdentifier=${teamId}`)) {
    throw new Error(`${appPath} is not signed by the team in APPLE_TEAM_ID.`);
  }
  if (!/flags=\S*runtime/.test(details)) {
    throw new Error(`${appPath} has no hardened runtime, so it is not released.`);
  }
  inspect("xcrun", ["stapler", "validate", appPath]);
  inspect("spctl", ["--assess", "--type", "execute", appPath]);
}

export type Run = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) => void;

/** Runs a command in the open, throwing when it fails. */
export const runInherited: Run = (command, args, options) => {
  execFileSync(command, args, { ...options, stdio: "inherit" });
};

// codesign reports on stderr, so both streams are the answer.
const inspectCommand: Inspect = (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf8" });
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== 0) throw new Error(`${command} ${args[0]} failed:\n${output}`);
  return output;
};

export interface PackageOptions {
  readonly rootDir: string;
  readonly desktopDir: string;
  readonly electronDist: string;
  readonly env: NodeJS.ProcessEnv;
  readonly run: Run;
  readonly inspect: Inspect;
}

/** This checkout and the real commands. Finds Electron when called, so call it after an install. */
export function checkoutPackageOptions(env: NodeJS.ProcessEnv): PackageOptions {
  return {
    rootDir: ROOT_DIR,
    desktopDir: DESKTOP_DIR,
    electronDist: electronDistPath(DESKTOP_DIR),
    env,
    run: runInherited,
    inspect: inspectCommand,
  };
}

/** Builds with the channel compiled in, then packages that build. */
export function packageChannel(request: PackageRequest, options: PackageOptions): void {
  const { channel, releaseVersion } = request;
  const { rootDir, desktopDir, electronDist, env, run, inspect } = options;
  // Before any build: a missing secret must fail the run at once.
  const signing = resolveSigning(releaseVersion, env);
  const buildEnv = withoutSigningInputs(env);
  run(process.execPath, [join(rootDir, "scripts/ensure-electron.ts")], {
    cwd: rootDir,
    env: buildEnv,
  });
  // So a bundle from an earlier run cannot pass for this build.
  const bundleDir = join(desktopDir, bundleDirectory(channel));
  rmSync(bundleDir, { recursive: true, force: true });
  // `--no-cache`: Vite Task hides SELF_ENGINE_CHANNEL from a cached task, which then builds dev.
  run(join(rootDir, "node_modules/.bin/vp"), ["run", "--no-cache", "-r", "build"], {
    cwd: rootDir,
    env: { ...buildEnv, SELF_ENGINE_CHANNEL: channel },
  });
  assertBundlesBuiltFor(channel, bundleDir);
  const outputDir = join(desktopDir, "release", channel);
  mkdirSync(outputDir, { recursive: true });
  const configPath = join(outputDir, "electron-builder.json");
  writeFileSync(
    configPath,
    JSON.stringify(builderConfig(channel, electronDist, releaseVersion, signing), null, 2),
  );
  // `--publish never`: electron-builder would otherwise publish on its own when it sees a CI tag.
  const targetArgs = releaseVersion === undefined ? ["--dir"] : ["--publish", "never"];
  run(
    join(desktopDir, "node_modules/.bin/electron-builder"),
    [...targetArgs, "--mac", "--arm64", "--config", configPath],
    { cwd: desktopDir, env },
  );
  if (signing === "developer-id") {
    assertDeveloperIdRelease(
      packagedAppPath(desktopDir, channel),
      env.APPLE_TEAM_ID ?? "",
      inspect,
    );
  }
  // The gate's smoke test (scripts/desktop-smoke.ts) against what was packaged, run as a command
  // because the app may not import a repo script (ADR 0006). A file the package lacks, such as
  // the SQLite binary or the data process bundle, fails here, before a release can ship it.
  run(
    process.execPath,
    [
      join(rootDir, "scripts/desktop-smoke.ts"),
      "--executable",
      packagedExecutablePath(desktopDir, channel),
    ],
    { cwd: rootDir, env: buildEnv },
  );
}

if (import.meta.main) {
  packageChannel(parsePackageRequest(process.argv.slice(2)), checkoutPackageOptions(process.env));
}
