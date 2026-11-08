import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  builderConfig,
  type PackageOptions,
  packageChannel,
  parseReleaseChannel,
} from "./package-channel.ts";

describe("parseReleaseChannel", () => {
  it.each(["nightly", "stable"] as const)("accepts %s", (channel) => {
    expect(parseReleaseChannel(channel)).toBe(channel);
  });

  it.each([undefined, "dev"])("refuses to package %j", (value) => {
    expect(() => parseReleaseChannel(value)).toThrow(/Name the channel/);
  });

  it("refuses an unknown channel", () => {
    expect(() => parseReleaseChannel("beta")).toThrow(/Unknown channel/);
  });
});

describe("builderConfig", () => {
  it.each([
    ["nightly", "Self-Engine Nightly", "app.selfengine.desktop.nightly"],
    ["stable", "Self-Engine", "app.selfengine.desktop"],
  ] as const)("carries the identity of %s", (channel, productName, appId) => {
    const config = builderConfig(channel);
    expect(config).toMatchObject({ productName, appId });
    expect(config.mac.icon).toBe(`icons/${channel}.icns`);
  });

  it.each(["nightly", "stable"] as const)("puts the runtime name of %s in", (channel) => {
    const config = builderConfig(channel);
    expect(config.extraMetadata.productName).toBe(config.productName);
  });

  it("keeps the channels' output apart", () => {
    expect(builderConfig("nightly").directories.output).not.toBe(
      builderConfig("stable").directories.output,
    );
  });
});

describe("packageChannel", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function runPackaging() {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "package-channel-")));
    const calls: Parameters<PackageOptions["run"]>[] = [];
    const desktopDir = join(dir, "apps/desktop");
    packageChannel("nightly", {
      rootDir: dir,
      desktopDir,
      env: { PATH: "/bin" },
      run: (...call) => calls.push(call),
    });
    return { calls, desktopDir, root: dir };
  }

  it("builds the workspace for the channel before packaging", () => {
    const { calls, root } = runPackaging();
    expect(calls[0]).toEqual([
      join(root, "node_modules/.bin/vp"),
      ["run", "-r", "build"],
      { cwd: root, env: { PATH: "/bin", SELF_ENGINE_CHANNEL: "nightly" } },
    ]);
  });

  it("packages with the channel's configuration", () => {
    const { calls, desktopDir } = runPackaging();
    const configPath = join(desktopDir, "release/nightly/electron-builder.json");
    expect(calls[1]).toEqual([
      join(desktopDir, "node_modules/.bin/electron-builder"),
      ["--dir", "--mac", "--arm64", "--config", configPath],
      { cwd: desktopDir, env: { PATH: "/bin" } },
    ]);
    expect(JSON.parse(readFileSync(configPath, "utf8"))).toEqual(builderConfig("nightly"));
  });
});
