import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  builderConfig,
  electronDistPath,
  type PackageOptions,
  packageChannel,
  parseReleaseChannel,
  type ReleaseChannel,
  STABLE_CUTOVER_APPROVED,
} from "./package-channel.ts";

const ELECTRON_DIST = "/local/electron/dist";

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

describe("electronDistPath", () => {
  it("finds the binary folder of the installed electron package", () => {
    expect(electronDistPath(import.meta.dirname)).toMatch(/node_modules\/electron\/dist$/);
  });
});

describe("builderConfig", () => {
  it.each([
    ["nightly", "Self-Engine Nightly", "app.selfengine.desktop.nightly"],
    ["stable", "Self-Engine", "app.selfengine.desktop"],
  ] as const)("carries the identity of %s", (channel, productName, appId) => {
    const config = builderConfig(channel, ELECTRON_DIST);
    expect(config).toMatchObject({ productName, appId });
    expect(config.mac.icon).toBe(`icons/${channel}.icns`);
  });

  it.each(["nightly", "stable"] as const)("puts the runtime name of %s in", (channel) => {
    const config = builderConfig(channel, ELECTRON_DIST);
    expect(config.extraMetadata.productName).toBe(config.productName);
  });

  it("packages the local Electron binary", () => {
    expect(builderConfig("nightly", ELECTRON_DIST).electronDist).toBe(ELECTRON_DIST);
  });

  it("keeps the channels' output apart", () => {
    expect(builderConfig("nightly", ELECTRON_DIST).directories.output).not.toBe(
      builderConfig("stable", ELECTRON_DIST).directories.output,
    );
  });
});

describe("packageChannel", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function runPackaging(channel: ReleaseChannel = "nightly", stableCutoverApproved = false) {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "package-channel-")));
    const calls: Parameters<PackageOptions["run"]>[] = [];
    const desktopDir = join(dir, "apps/desktop");
    packageChannel(channel, {
      rootDir: dir,
      desktopDir,
      electronDist: ELECTRON_DIST,
      stableCutoverApproved,
      env: { PATH: "/bin" },
      run: (...call) => calls.push(call),
    });
    return { calls, desktopDir, root: dir };
  }

  it("makes sure the Electron binary is there first", () => {
    const { calls, root } = runPackaging();
    expect(calls[0]).toEqual([
      process.execPath,
      [join(root, "scripts/ensure-electron.ts")],
      { cwd: root, env: { PATH: "/bin" } },
    ]);
  });

  it("builds the workspace for the channel before packaging", () => {
    const { calls, root } = runPackaging();
    expect(calls[1]).toEqual([
      join(root, "node_modules/.bin/vp"),
      ["run", "-r", "build"],
      { cwd: root, env: { PATH: "/bin", SELF_ENGINE_CHANNEL: "nightly" } },
    ]);
  });

  it("packages with the channel's configuration", () => {
    const { calls, desktopDir } = runPackaging();
    const configPath = join(desktopDir, "release/nightly/electron-builder.json");
    expect(calls[2]).toEqual([
      join(desktopDir, "node_modules/.bin/electron-builder"),
      ["--dir", "--mac", "--arm64", "--config", configPath],
      { cwd: desktopDir, env: { PATH: "/bin" } },
    ]);
    expect(JSON.parse(readFileSync(configPath, "utf8"))).toEqual(
      builderConfig("nightly", ELECTRON_DIST),
    );
  });

  // Flipping STABLE_CUTOVER_APPROVED is the owner's decision to replace the old app (ADR 0007).
  it("keeps the stable switch off", () => {
    expect(STABLE_CUTOVER_APPROVED).toBe(false);
  });

  it("refuses stable, before building anything, until the switch is approved", () => {
    expect(() => runPackaging("stable")).toThrow(/replace the old app/);
  });

  it("packages stable once the switch is approved", () => {
    const { calls } = runPackaging("stable", true);
    expect(calls).toHaveLength(3);
  });
});
