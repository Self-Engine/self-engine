// `pnpm nightly:local`: builds the Nightly on this Mac and leaves its dmg in ~/Downloads, as if it
// had been downloaded, so the owner sees the app's progress without spending GitHub minutes and
// drags it into Applications themselves. It updates this checkout, stamps a version that says
// which commit it is and packages through `packageChannel` (ad hoc, nothing is uploaded). It
// installs and replaces nothing. A version comes from `scripts/release-plan.ts`, run as a command
// because the app may not import a repo script (ADR 0006).
//
// This file and `packageChannel` are already loaded when `git pull` runs, so a change to them
// takes effect on the next run.

import type { Clock } from "@self-engine/time";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { channelIdentity } from "./channel.ts";
import {
  checkoutPackageOptions,
  DESKTOP_DIR,
  packageChannel,
  type PackageRequest,
  packagedDmgPath,
  ROOT_DIR,
  type Run,
  runInherited,
  withoutSigningInputs,
} from "./package-channel.ts";
import { systemSources } from "./system-sources.ts";

const NIGHTLY = channelIdentity("nightly");

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
  readonly homeDir: string;
  readonly env: NodeJS.ProcessEnv;
  readonly clock: Clock;
  readonly query: Query;
  readonly run: Run;
  readonly packageApp: (request: PackageRequest, env: NodeJS.ProcessEnv) => void;
  readonly copyFile: (from: string, to: string) => void;
  readonly print: (line: string) => void;
}

function answer(options: NightlyLocalOptions, command: string, args: string[]): string {
  const result = options.query(command, args, options.rootDir);
  if (result.status !== 0) {
    throw new Error(`${command} ${args[0]} failed:\n${result.stdout}${result.stderr}`);
  }
  return result.stdout.trim();
}

function assertReadyToUpdate(options: NightlyLocalOptions): void {
  const branch = answer(options, "git", ["branch", "--show-current"]);
  if (branch === "") throw new Error("This checkout has a detached HEAD. Switch to main first.");
  if (branch !== "main") throw new Error(`This checkout is on "${branch}". Switch to main first.`);
  // Named, because `status.showUntrackedFiles` could otherwise hide untracked files.
  const changes = answer(options, "git", ["status", "--porcelain", "--untracked-files=normal"]);
  if (changes !== "") {
    throw new Error(`This checkout has uncommitted changes. Commit them first:\n${changes}`);
  }
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
    options.clock(),
    "--run-number",
    "1",
  ]);
  const planned = /^version=(.+)$/m.exec(plan)?.[1];
  if (planned === undefined) throw new Error(`The release plan named no version:\n${plan}`);
  return localNightlyVersion(planned, commit);
}

/** Copies under a temporary name first, so that a failed copy leaves no half dmg to open. */
function copyToDownloads(options: NightlyLocalOptions, version: string): string {
  const built = packagedDmgPath(options.desktopDir, "nightly", version);
  const downloads = join(options.homeDir, "Downloads");
  const name = basename(built);
  const target = join(downloads, name);
  const partial = join(downloads, `.${name}.partial`);
  mkdirSync(downloads, { recursive: true });
  try {
    // Never add a quarantine attribute: Gatekeeper would block this ad hoc signed app.
    options.copyFile(built, partial);
    renameSync(partial, target);
  } finally {
    rmSync(partial, { force: true });
  }
  return target;
}

/** Builds this checkout's `main` as a Nightly dmg and leaves it in the owner's Downloads. */
export function buildLocalNightly(options: NightlyLocalOptions): void {
  assertReadyToUpdate(options);
  const { rootDir, run } = options;
  // A local build is ad hoc and is never notarized, whatever this shell has loaded. In CI a
  // release without the inputs is refused, and this is no CI.
  const env = withoutSigningInputs(options.env);
  delete env.CI;
  run("git", ["pull", "--ff-only"], { cwd: rootDir, env });
  run("pnpm", ["install", "--frozen-lockfile"], { cwd: rootDir, env });
  const version = resolveLocalVersion(options);
  options.packageApp({ channel: "nightly", releaseVersion: version }, env);
  const dmg = copyToDownloads(options, version);
  options.print(`Built ${NIGHTLY.productName} ${version}. Open it and drag it to Applications:`);
  options.print(dmg);
}

if (import.meta.main) {
  try {
    buildLocalNightly({
      rootDir: ROOT_DIR,
      desktopDir: DESKTOP_DIR,
      homeDir: homedir(),
      env: process.env,
      clock: systemSources().clock,
      query: (command, args, cwd) => {
        const { status, stdout, stderr } = spawnSync(command, args, { cwd, encoding: "utf8" });
        return { status, stdout, stderr };
      },
      run: runInherited,
      // Late, because `pnpm install` above may have replaced Electron.
      packageApp: (request, env) => packageChannel(request, checkoutPackageOptions(env)),
      copyFile: copyFileSync,
      print: console.log,
    });
  } catch (error) {
    console.error(`nightly:local: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
