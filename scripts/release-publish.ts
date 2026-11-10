// Publishes one planned release (scripts/release-plan.ts) as a GitHub release of this repository
// (ADR 0007), through `gh` with the workflow's built-in token. The release starts as a draft,
// which has no git tag yet, and is published once its assets are on it: a `v*` tag marks a
// complete release, and it is what the next plan reads.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

export type ReleaseChannel = "nightly" | "stable";

export interface PublishRequest {
  readonly channel: ReleaseChannel;
  readonly tag: string;
  readonly commit: string;
  readonly assets: readonly string[];
  readonly notes: string;
}

/** Runs `gh` with these arguments and returns its output. */
export type Gh = (args: string[]) => string;

const MANUAL_UPDATES = "There is no in-app update yet: download new versions by hand.";

const DEVELOPMENT_BUILD =
  "**This is a development build.** It changes often, can break and comes without support, " +
  "so do not rely on it for data you need.";

const OLD_APP =
  "**If you have the old Self-Engine app, rename it first** (for example to " +
  "`Self-Engine Legacy.app`). This release installs as `Self-Engine.app` and would replace it. " +
  "Renaming changes neither its data nor its signature.";

/** The body of the release. Only stable has a changelog and shares its name with the old app. */
export function releaseNotes(channel: ReleaseChannel, commit: string, changelog: string): string {
  if (channel === "nightly") {
    return `${DEVELOPMENT_BUILD}\n\nNightly build of ${commit}. It installs as "Self-Engine Nightly", next to the other channels.\n\n${MANUAL_UPDATES}\n`;
  }
  return `${OLD_APP}\n\n${MANUAL_UPDATES}\n\n${changelog}`;
}

function title(channel: ReleaseChannel, tag: string): string {
  const version = tag.replace(/^v/, "");
  return channel === "nightly" ? `Self-Engine Nightly ${version}` : `Self-Engine ${version}`;
}

export function publishRelease(request: PublishRequest, gh: Gh): void {
  const { channel, tag, commit, assets, notes } = request;
  if (assets.length === 0) throw new Error(`${tag} has no assets to publish.`);
  const releases = JSON.parse(
    gh(["release", "list", "--limit", "200", "--json", "tagName,isDraft"]),
  ) as {
    tagName: string;
    isDraft: boolean;
  }[];
  const existing = releases.find((release) => release.tagName === tag);
  if (existing !== undefined && !existing.isDraft) {
    throw new Error(`${tag} is already published.`);
  }
  // What an earlier attempt of this run left behind. A draft has no tag, so none is removed.
  if (existing !== undefined) gh(["release", "delete", tag, "--yes"]);
  gh([
    "release",
    "create",
    tag,
    ...assets,
    "--draft",
    "--target",
    commit,
    "--title",
    title(channel, tag),
    "--notes",
    notes,
    ...(channel === "nightly" ? ["--prerelease"] : []),
  ]);
  gh(["release", "edit", tag, "--draft=false", ...(channel === "stable" ? ["--latest"] : [])]);
}

function parseChannel(value: string | undefined): ReleaseChannel {
  if (value === "nightly" || value === "stable") return value;
  throw new Error('Name the channel: "nightly" or "stable".');
}

/** `dir`'s dmg files. A release ships nothing else from the build. */
export function findAssets(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".dmg"))
    .map((name) => join(dir, name));
}

export function runPublish(argv: string[], gh: Gh): void {
  const { values } = parseArgs({
    args: argv,
    options: {
      channel: { type: "string" },
      tag: { type: "string" },
      commit: { type: "string" },
      assets: { type: "string" },
      changelog: { type: "string" },
    },
  });
  const channel = parseChannel(values.channel);
  const { tag, commit, assets, changelog } = values;
  if (tag === undefined || commit === undefined || assets === undefined) {
    throw new Error("Usage: release-publish --channel <c> --tag <t> --commit <c> --assets <dir>");
  }
  if (channel === "stable" && changelog === undefined) {
    throw new Error("A stable release needs --changelog.");
  }
  // Only stable has a changelog file; a nightly run passes the same path, which does not exist.
  const text = channel === "stable" ? readFileSync(changelog ?? "", "utf8") : "";
  publishRelease(
    {
      channel,
      tag,
      commit,
      assets: findAssets(assets),
      notes: releaseNotes(channel, commit, text),
    },
    gh,
  );
}

if (import.meta.main) {
  try {
    runPublish(process.argv.slice(2), (args) =>
      execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }),
    );
  } catch (error) {
    console.error(`release-publish: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
