// What a release run builds (ADR 0007), derived from the `v*` tags of the repository: a tag
// marks a release that was published, so the tags hold the last nightly and the last stable.
// No commit carries a version: `apps/desktop/package.json` only seeds the first stable, and
// every later one is a patch bump of the last stable tag unless the owner names a version.
// The workflow calls this script; a run writes its plan to `GITHUB_OUTPUT`.

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

export interface ReleaseTag {
  readonly name: string;
  readonly commit: string;
}

export interface ReleasePlan {
  readonly channel: "nightly" | "stable";
  readonly version: string;
  readonly tag: string;
  readonly commit: string;
  /** The tag the changelog starts after, empty before the first stable. */
  readonly previousTag: string;
  /** Nightly only: whether `commit` differs from the last published nightly. */
  readonly changed: boolean;
}

const STABLE_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const STABLE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;
const NIGHTLY_TAG = /^v(\d+)\.(\d+)\.(\d+)-nightly\.(\d{8})\.(\d+)$/;
const COMMIT = /^[0-9a-f]{40}$/;

function compare(left: readonly number[], right: readonly number[]): number {
  for (const [index, part] of left.entries()) {
    const difference = part - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function parts(name: string, pattern: RegExp): number[] | undefined {
  return pattern.exec(name)?.slice(1).map(Number);
}

function latest(tags: readonly ReleaseTag[], pattern: RegExp): ReleaseTag | undefined {
  let best: { tag: ReleaseTag; version: number[] } | undefined;
  for (const tag of tags) {
    const version = parts(tag.name, pattern);
    if (version !== undefined && (best === undefined || compare(version, best.version) > 0)) {
      best = { tag, version };
    }
  }
  return best?.tag;
}

/**
 * The version the next stable proposes, and the base of every nightly until then. Before the
 * first stable it is the version in `apps/desktop/package.json`, afterwards always a patch
 * bump: the middle number only moves when the owner names a version (ADR 0007).
 */
export function nextStableVersion(tags: readonly ReleaseTag[], packageVersion: string): string {
  const stable = latest(tags, STABLE_TAG);
  if (stable === undefined) {
    if (!STABLE_VERSION.test(packageVersion)) {
      throw new Error(`The package version "${packageVersion}" is not x.y.z.`);
    }
    return packageVersion;
  }
  const [major, minor, patch] = parts(stable.name, STABLE_TAG) ?? [];
  return `${major}.${minor}.${(patch ?? 0) + 1}`;
}

/** `YYYYMMDD` in UTC, the date part of a nightly version. */
export function nightlyDate(startedAt: string): string {
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`"${startedAt}" is not a timestamp.`);
  }
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

export interface NightlyInput {
  readonly tags: readonly ReleaseTag[];
  readonly packageVersion: string;
  readonly commit: string;
  readonly startedAt: string;
  readonly runNumber: number;
}

/** The nightly of `commit`: `<base>-nightly.<YYYYMMDD>.<run>`. */
export function planNightly(input: NightlyInput): ReleasePlan {
  const { tags, packageVersion, commit, startedAt, runNumber } = input;
  if (!COMMIT.test(commit)) throw new Error(`"${commit}" is not a full commit id.`);
  if (!Number.isInteger(runNumber) || runNumber < 1) {
    throw new Error(`"${runNumber}" is not a run number.`);
  }
  const version = `${nextStableVersion(tags, packageVersion)}-nightly.${nightlyDate(startedAt)}.${runNumber}`;
  const last = latest(tags, NIGHTLY_TAG);
  return {
    channel: "nightly",
    version,
    tag: `v${version}`,
    commit,
    previousTag: last?.name ?? "",
    changed: last?.commit !== commit,
  };
}

export interface StableInput {
  readonly tags: readonly ReleaseTag[];
  readonly packageVersion: string;
  /** Empty means the proposed patch bump. */
  readonly requestedVersion: string;
}

/** The stable release: always the commit of the latest published nightly (ADR 0007). */
export function planStable(input: StableInput): ReleasePlan {
  const { tags, packageVersion, requestedVersion } = input;
  const nightly = latest(tags, NIGHTLY_TAG);
  if (nightly === undefined) {
    throw new Error("No nightly was published yet: stable only builds a published nightly commit.");
  }
  const previous = latest(tags, STABLE_TAG);
  const version = requestedVersion.replace(/^v/, "") || nextStableVersion(tags, packageVersion);
  const wanted = parts(version, STABLE_VERSION);
  if (wanted === undefined) throw new Error(`"${version}" is not a stable version (x.y.z).`);
  if (previous !== undefined && compare(wanted, parts(previous.name, STABLE_TAG) ?? []) <= 0) {
    throw new Error(`"${version}" is not higher than the last stable, ${previous.name}.`);
  }
  return {
    channel: "stable",
    version,
    tag: `v${version}`,
    commit: nightly.commit,
    previousTag: previous?.name ?? "",
    changed: true,
  };
}

/** The release tags of the repository at `cwd`, annotated tags resolved to their commit. */
export function readTags(cwd: string): ReleaseTag[] {
  const output = execFileSync(
    "git",
    ["for-each-ref", "--format=%(refname:strip=2)%09%(objectname)%09%(*objectname)", "refs/tags/v*"],
    { cwd, encoding: "utf8" },
  );
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name = "", object = "", dereferenced = ""] = line.split("\t");
      return { name, commit: dereferenced || object };
    });
}

function readPackageVersion(cwd: string): string {
  const manifest = JSON.parse(readFileSync(join(cwd, "apps/desktop/package.json"), "utf8")) as {
    version: string;
  };
  return manifest.version;
}

/** The plan as `key=value` lines. All values come out of the checks above, not from a run. */
export function formatPlan(plan: ReleasePlan): string {
  return [
    `channel=${plan.channel}`,
    `version=${plan.version}`,
    `tag=${plan.tag}`,
    `commit=${plan.commit}`,
    `previous_tag=${plan.previousTag}`,
    `changed=${plan.changed}`,
  ]
    .map((line) => `${line}\n`)
    .join("");
}

export interface PlanRun {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly print: (line: string) => void;
}

export function runReleasePlan(argv: string[], { cwd, env, print }: PlanRun): void {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      commit: { type: "string", default: "" },
      "started-at": { type: "string", default: "" },
      "run-number": { type: "string", default: "" },
      version: { type: "string", default: "" },
    },
  });
  const tags = readTags(cwd);
  const packageVersion = readPackageVersion(cwd);
  const [channel] = positionals;
  let plan: ReleasePlan;
  if (channel === "nightly") {
    plan = planNightly({
      tags,
      packageVersion,
      commit: values.commit,
      startedAt: values["started-at"],
      runNumber: Number(values["run-number"]),
    });
  } else if (channel === "stable") {
    plan = planStable({ tags, packageVersion, requestedVersion: values.version });
  } else {
    throw new Error('Name the channel: "nightly" or "stable".');
  }
  const text = formatPlan(plan);
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, text);
  print(text.trimEnd());
}

if (import.meta.main) {
  try {
    runReleasePlan(process.argv.slice(2), {
      cwd: process.cwd(),
      env: process.env,
      print: console.log,
    });
  } catch (error) {
    console.error(`release-plan: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
