// `pnpm nightly:local`: builds the Nightly on this Mac and installs it into /Applications, so the
// owner sees the app's progress without spending GitHub minutes. It updates this checkout, stamps
// a version that says which commit it is, packages through `packageChannel` (ad hoc, nothing is
// uploaded) and swaps the new app in only once it is complete. The app's identity and data
// folder are the channel's and stay as they are. A version comes from `scripts/release-plan.ts`,
// run as a command because the app may not import a repo script (ADR 0006).
//
// This file and `packageChannel` are already loaded when `git pull` runs, so a change to them
// takes effect on the next run.

import { spawnSync } from "node:child_process";
import { existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { channelIdentity } from "./channel.ts";
import {
  checkoutPackageOptions,
  DESKTOP_DIR,
  packageChannel,
  type PackageRequest,
  packagedAppPath,
  ROOT_DIR,
  type Run,
  runInherited,
  withoutSigningInputs,
} from "./package-channel.ts";

const NIGHTLY = channelIdentity("nightly");

const APPLICATIONS_DIR = "/Applications";

const PLANNED_NIGHTLY = /^(\d+\.\d+\.\d+-nightly\.\d{8})\.\d+$/;
const SHORT_COMMIT_LENGTH = 7;

// A semver identifier of digits only may not start with a zero, and a commit can start that way.
function shortCommit(commit: string): string {
  let length = SHORT_COMMIT_LENGTH;
  while (length < commit.length && /^0\d*$/.test(commit.slice(0, length))) length += 1;
  return commit.slice(0, length);
}

/** `<base>-nightly.<YYYYMMDD>.local.<short-sha>`, from the version the release plan resolved. */
export function localNightlyVersion(plannedVersion: string, commit: string): string {
  const stem = PLANNED_NIGHTLY.exec(plannedVersion)?.[1];
  if (stem === undefined) throw new Error(`"${plannedVersion}" is not a nightly version.`);
  return `${stem}.local.${shortCommit(commit)}`;
}

export interface CommandResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs a command for its answer; never throws, so a caller can read an exit code. */
export type Query = (command: string, args: string[], cwd: string) => CommandResult;

export interface NightlyLocalOptions {
  readonly rootDir: string;
  readonly desktopDir: string;
  readonly applicationsDir: string;
  readonly env: NodeJS.ProcessEnv;
  readonly now: () => Date;
  readonly query: Query;
  readonly run: Run;
  readonly packageApp: (request: PackageRequest, env: NodeJS.ProcessEnv) => void;
  readonly rename: (from: string, to: string) => void;
  readonly print: (line: string) => void;
}

function answer(options: NightlyLocalOptions, command: string, args: string[]): string {
  const result = options.query(command, args, options.rootDir);
  if (result.status !== 0) {
    throw new Error(`${command} ${args[0]} failed:\n${result.stdout}${result.stderr}`);
  }
  return result.stdout.trim();
}

function assertNightlyNotRunning(options: NightlyLocalOptions): void {
  const { productName } = NIGHTLY;
  const { status, stderr } = options.query("pgrep", ["-x", productName], options.rootDir);
  if (status === 0) throw new Error(`${productName} is running. Quit it and run this again.`);
  if (status !== 1) throw new Error(`pgrep could not tell whether ${productName} runs: ${stderr}`);
}

function assertReadyToUpdate(options: NightlyLocalOptions): void {
  const branch = answer(options, "git", ["branch", "--show-current"]);
  if (branch === "") throw new Error("This checkout has a detached HEAD. Switch to main first.");
  if (branch !== "main") throw new Error(`This checkout is on "${branch}". Switch to main first.`);
  const changes = answer(options, "git", ["status", "--porcelain"]);
  if (changes !== "") {
    throw new Error(`This checkout has uncommitted changes. Commit them first:\n${changes}`);
  }
  assertNightlyNotRunning(options);
}

/** The version for HEAD, read after the update so that it names what is built. */
function resolveLocalVersion(options: NightlyLocalOptions): string {
  const commit = answer(options, "git", ["rev-parse", "HEAD"]);
  const plan = answer(options, process.execPath, [
    join(options.rootDir, "scripts/release-plan.ts"),
    "nightly",
    "--commit",
    commit,
    "--started-at",
    options.now().toISOString(),
    "--run-number",
    "1",
  ]);
  const planned = /^version=(.+)$/m.exec(plan)?.[1];
  if (planned === undefined) throw new Error(`The release plan named no version:\n${plan}`);
  return localNightlyVersion(planned, commit);
}

function bundleVersion(options: NightlyLocalOptions, appPath: string): string {
  return answer(options, "plutil", [
    "-extract",
    "CFBundleShortVersionString",
    "raw",
    "-o",
    "-",
    join(appPath, "Contents/Info.plist"),
  ]);
}

/**
 * Moves `staged` to `target`, which only a rename can do without a moment of half an app. The
 * two renames are not one step, so a failure of the second puts the old app back.
 */
function swapIn(options: NightlyLocalOptions, staged: string, target: string, old: string): void {
  if (existsSync(target)) {
    rmSync(old, { recursive: true, force: true });
    options.rename(target, old);
  }
  try {
    options.rename(staged, target);
  } catch (error) {
    if (existsSync(old)) options.rename(old, target);
    throw error;
  }
  rmSync(old, { recursive: true, force: true });
}

/**
 * Copies the built app beside the installed one, checks the copy, then swaps. Neither name ends
 * in `.app`, so macOS never lists the copy as a second Nightly, and both are on the volume of
 * the target, so the swap is a rename. `ditto` keeps the symlinks and the signature of a bundle.
 */
function install(options: NightlyLocalOptions, version: string, env: NodeJS.ProcessEnv): string {
  const { applicationsDir, desktopDir, rootDir } = options;
  const name = `${NIGHTLY.productName}.app`;
  const target = join(applicationsDir, name);
  const staged = join(applicationsDir, `.${name}.new`);
  rmSync(staged, { recursive: true, force: true });
  try {
    options.run("ditto", [packagedAppPath(desktopDir, "nightly"), staged], { cwd: rootDir, env });
    const copied = bundleVersion(options, staged);
    if (copied !== version) {
      throw new Error(`The built app says ${copied}, not ${version}, so it is not installed.`);
    }
    // The build takes minutes, and the owner may have opened the app meanwhile.
    assertNightlyNotRunning(options);
    swapIn(options, staged, target, join(applicationsDir, `.${name}.old`));
  } finally {
    rmSync(staged, { recursive: true, force: true });
  }
  return target;
}

/** Builds this checkout's `main` as the Nightly and installs it into `applicationsDir`. */
export function installLocalNightly(options: NightlyLocalOptions): void {
  assertReadyToUpdate(options);
  const { rootDir, run } = options;
  // A local build is ad hoc and is never notarized, whatever this shell has loaded.
  const env = withoutSigningInputs(options.env);
  run("git", ["pull", "--ff-only"], { cwd: rootDir, env });
  run("pnpm", ["install", "--frozen-lockfile"], { cwd: rootDir, env });
  const localVersion = resolveLocalVersion(options);
  options.packageApp({ channel: "nightly", releaseVersion: undefined, localVersion }, env);
  const installed = install(options, localVersion, env);
  options.print(`Installed ${NIGHTLY.productName} ${localVersion} at ${installed}`);
}

if (import.meta.main) {
  try {
    installLocalNightly({
      rootDir: ROOT_DIR,
      desktopDir: DESKTOP_DIR,
      applicationsDir: APPLICATIONS_DIR,
      env: process.env,
      now: () => new Date(),
      query: (command, args, cwd) => {
        const { status, stdout, stderr } = spawnSync(command, args, { cwd, encoding: "utf8" });
        return { status, stdout, stderr };
      },
      run: runInherited,
      // Late, because `pnpm install` above may have replaced Electron.
      packageApp: (request, env) => packageChannel(request, checkoutPackageOptions(env)),
      rename: renameSync,
      print: console.log,
    });
  } catch (error) {
    console.error(`nightly:local: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
