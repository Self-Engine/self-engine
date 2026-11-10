import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  findAssets,
  type Gh,
  publishRelease,
  type PublishRequest,
  releaseNotes,
  runPublish,
} from "./release-publish.ts";

const COMMIT = "a".repeat(40);
const TAG = "v0.0.1-nightly.20261108.7";

function fakeGh(releases: { tagName: string; isDraft: boolean }[] = []) {
  const calls: string[][] = [];
  const gh: Gh = (args) => {
    calls.push(args);
    return args[1] === "list" ? JSON.stringify(releases) : "";
  };
  return { calls, gh };
}

const nightly: PublishRequest = {
  channel: "nightly",
  tag: TAG,
  commit: COMMIT,
  assets: ["assets/app.dmg"],
  notes: "notes",
};

describe("publishRelease", () => {
  it("publishes a nightly as a prerelease of the planned commit", () => {
    const { calls, gh } = fakeGh();
    publishRelease(nightly, gh);
    expect(calls.slice(1)).toEqual([
      [
        "release",
        "create",
        TAG,
        "assets/app.dmg",
        "--draft",
        "--target",
        COMMIT,
        "--title",
        `Self-Engine Nightly 0.0.1-nightly.20261108.7`,
        "--notes",
        "notes",
        "--prerelease",
      ],
      ["release", "edit", TAG, "--draft=false"],
    ]);
  });

  it("publishes a stable as the latest release", () => {
    const { calls, gh } = fakeGh();
    publishRelease({ ...nightly, channel: "stable", tag: "v0.0.1" }, gh);
    expect(calls[1]).toContain("Self-Engine 0.0.1");
    expect(calls[1]).not.toContain("--prerelease");
    expect(calls[2]).toEqual(["release", "edit", "v0.0.1", "--draft=false", "--latest"]);
  });

  it("creates the draft with its assets before it publishes", () => {
    const { calls, gh } = fakeGh();
    publishRelease(nightly, gh);
    expect(calls.map((call) => call[1])).toEqual(["list", "create", "edit"]);
    expect(calls[1]).toContain("assets/app.dmg");
  });

  it("replaces the draft an earlier attempt left behind", () => {
    const { calls, gh } = fakeGh([{ tagName: TAG, isDraft: true }]);
    publishRelease(nightly, gh);
    expect(calls[1]).toEqual(["release", "delete", TAG, "--yes"]);
    expect(calls[2]?.[1]).toBe("create");
  });

  it("never touches a published release", () => {
    const { calls, gh } = fakeGh([{ tagName: TAG, isDraft: false }]);
    expect(() => publishRelease(nightly, gh)).toThrow(/already published/);
    expect(calls).toHaveLength(1);
  });

  it("refuses a release without assets", () => {
    const { calls, gh } = fakeGh();
    expect(() => publishRelease({ ...nightly, assets: [] }, gh)).toThrow(/no assets/);
    expect(calls).toHaveLength(0);
  });
});

describe("releaseNotes", () => {
  it("tells anyone with the old app to rename it before installing stable", () => {
    const notes = releaseNotes("stable", COMMIT, "## Features\n\n- a\n");
    expect(notes).toContain("rename it first");
    expect(notes).toContain("Self-Engine Legacy.app");
    expect(notes).toContain("## Features");
  });

  it("names the nightly's commit and not the old app", () => {
    const notes = releaseNotes("nightly", COMMIT, "");
    expect(notes).toContain(COMMIT);
    expect(notes).not.toContain("rename");
  });

  it("marks only the nightly as a development build", () => {
    expect(releaseNotes("nightly", COMMIT, "")).toContain("development build");
    expect(releaseNotes("stable", COMMIT, "")).not.toContain("development build");
  });

  it.each(["nightly", "stable"] as const)("says %s updates by hand", (channel) => {
    expect(releaseNotes(channel, COMMIT, "")).toContain("download new versions by hand");
  });
});

describe("the publish run", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function assetsDir(): string {
    dir = mkdtempSync(join(tmpdir(), "release-publish-"));
    writeFileSync(join(dir, "Self-Engine-1.dmg"), "");
    writeFileSync(join(dir, "Self-Engine-1.dmg.blockmap"), "");
    return dir;
  }

  it("finds only the dmg", () => {
    const assets = assetsDir();
    expect(findAssets(assets)).toEqual([join(assets, "Self-Engine-1.dmg")]);
  });

  it("publishes a nightly from the assets folder, with no changelog file", () => {
    const assets = assetsDir();
    const { calls, gh } = fakeGh();
    runPublish(
      [
        "--channel",
        "nightly",
        "--tag",
        TAG,
        "--commit",
        COMMIT,
        "--assets",
        assets,
        "--changelog",
        join(assets, "missing.md"),
      ],
      gh,
    );
    expect(calls[1]).toContain(join(assets, "Self-Engine-1.dmg"));
  });

  it("puts the changelog into a stable release", () => {
    const assets = assetsDir();
    const changelog = join(assets, "notes.md");
    writeFileSync(changelog, "## Bug Fixes\n\n- b\n");
    const { calls, gh } = fakeGh();
    runPublish(
      [
        "--channel",
        "stable",
        "--tag",
        "v0.0.1",
        "--commit",
        COMMIT,
        "--assets",
        assets,
        "--changelog",
        changelog,
      ],
      gh,
    );
    const notes = calls[1]?.[(calls[1]?.indexOf("--notes") ?? 0) + 1];
    expect(notes).toContain("## Bug Fixes");
  });

  it("needs a changelog for stable", () => {
    const assets = assetsDir();
    const { gh } = fakeGh();
    expect(() =>
      runPublish(
        ["--channel", "stable", "--tag", "v0.0.1", "--commit", COMMIT, "--assets", assets],
        gh,
      ),
    ).toThrow(/needs --changelog/);
  });

  it("names the channel it needs", () => {
    expect(() => runPublish([], fakeGh().gh)).toThrow(/Name the channel/);
  });
});
