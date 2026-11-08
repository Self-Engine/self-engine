import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { bundleDirectory } from "./channel.ts";
import {
  assertBundlesBuiltFor,
  builderConfig,
  electronDistPath,
  type PackageOptions,
  packageChannel,
  parsePackageRequest,
  parseReleaseChannel,
  type ReleaseChannel,
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

describe("parsePackageRequest", () => {
  it("packages an unpacked app without a version", () => {
    expect(parsePackageRequest(["nightly"])).toEqual({
      channel: "nightly",
      releaseVersion: undefined,
    });
  });

  it("takes a release version", () => {
    expect(
      parsePackageRequest(["nightly", "--release-version", "0.0.1-nightly.20261108.7"]),
    ).toEqual({ channel: "nightly", releaseVersion: "0.0.1-nightly.20261108.7" });
  });

  it("refuses an empty release version", () => {
    expect(() => parsePackageRequest(["stable", "--release-version", ""])).toThrow(/needs a version/);
  });

  it("still names the channel it needs", () => {
    expect(() => parsePackageRequest([])).toThrow(/Name the channel/);
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

  it("leaves the version alone for a local package", () => {
    const config = builderConfig("nightly", ELECTRON_DIST);
    expect(config.extraMetadata).not.toHaveProperty("version");
    expect(config.mac.target).toBe("dir");
  });

  it("stamps a release version and builds what a release ships", () => {
    const config = builderConfig("nightly", ELECTRON_DIST, "0.0.1-nightly.20261108.7");
    expect(config.extraMetadata).toMatchObject({ version: "0.0.1-nightly.20261108.7" });
    expect(config.mac.target).toEqual(["dmg", "zip"]);
  });

  it.each([
    ["nightly", "Self-Engine-Nightly-${version}-${arch}.${ext}"],
    ["stable", "Self-Engine-${version}-${arch}.${ext}"],
  ] as const)("names the artifacts of %s without spaces", (channel, artifactName) => {
    expect(builderConfig(channel, ELECTRON_DIST).artifactName).toBe(artifactName);
  });

  it("signs ad hoc, never with whatever identity the machine holds", () => {
    expect(builderConfig("stable", ELECTRON_DIST).mac).toMatchObject({
      identity: "-",
      hardenedRuntime: false,
    });
  });

  it("keeps the channels' output apart", () => {
    expect(builderConfig("nightly", ELECTRON_DIST).directories.output).not.toBe(
      builderConfig("stable", ELECTRON_DIST).directories.output,
    );
  });

  it.each(["nightly", "stable"] as const)(
    "packages the bundle of %s where main expects it",
    (channel) => {
      expect(builderConfig(channel, ELECTRON_DIST).files).toContainEqual({
        from: bundleDirectory(channel),
        to: "dist-electron",
      });
    },
  );
});

function writeBundles(bundleDir: string, compiledFor: string): void {
  mkdirSync(bundleDir, { recursive: true });
  for (const name of ["main.cjs", "preload.cjs"]) {
    writeFileSync(join(bundleDir, name), `channelIdentity(parseChannel("${compiledFor}"));`);
  }
}

describe("assertBundlesBuiltFor", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function bundleDir(): string {
    dir = realpathSync(mkdtempSync(join(tmpdir(), "bundle-channel-")));
    return dir;
  }

  it("accepts bundles compiled for the channel", () => {
    const bundles = bundleDir();
    writeBundles(bundles, "nightly");
    expect(() => assertBundlesBuiltFor("nightly", bundles)).not.toThrow();
  });

  it("refuses bundles compiled for another channel", () => {
    const bundles = bundleDir();
    writeBundles(bundles, "dev");
    expect(() => assertBundlesBuiltFor("nightly", bundles)).toThrow(/not compiled for the nightly/);
  });

  it("refuses a preload compiled for another channel", () => {
    const bundles = bundleDir();
    writeBundles(bundles, "nightly");
    writeFileSync(join(bundles, "preload.cjs"), 'channelIdentity(parseChannel("dev"));');
    expect(() => assertBundlesBuiltFor("nightly", bundles)).toThrow(/preload\.cjs/);
  });

  it("refuses a missing bundle", () => {
    const bundles = bundleDir();
    expect(() => assertBundlesBuiltFor("nightly", bundles)).toThrow(/not compiled/);
  });
});

describe("packageChannel", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  type Call = Parameters<PackageOptions["run"]>;

  interface PackagingRun {
    readonly channel?: ReleaseChannel;
    readonly releaseVersion?: string;
    /** The channel the fake workspace build compiles for; `null` builds nothing. */
    readonly compiledFor?: string | null;
    /** Called once the temp checkout exists, before anything runs. */
    readonly seed?: (desktopDir: string) => void;
    /** Receives every call the packaging makes, also when it throws. */
    readonly calls?: Call[];
  }

  function isWorkspaceBuild([command]: Call): boolean {
    return command.endsWith("node_modules/.bin/vp");
  }

  function runPackaging(options: PackagingRun = {}) {
    const { channel = "nightly", releaseVersion, seed } = options;
    const compiledFor = options.compiledFor === undefined ? channel : options.compiledFor;
    const calls = options.calls ?? [];
    dir = realpathSync(mkdtempSync(join(tmpdir(), "package-channel-")));
    const desktopDir = join(dir, "apps/desktop");
    seed?.(desktopDir);
    packageChannel(
      { channel, releaseVersion },
      {
        rootDir: dir,
        desktopDir,
        electronDist: ELECTRON_DIST,
        env: { PATH: "/bin" },
        run: (...call) => {
          calls.push(call);
          if (isWorkspaceBuild(call) && compiledFor !== null) {
            writeBundles(join(desktopDir, bundleDirectory(channel)), compiledFor);
          }
        },
      },
    );
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
      ["run", "--no-cache", "-r", "build"],
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

  it("builds and never publishes the artifacts of a release", () => {
    const { calls, desktopDir } = runPackaging({ releaseVersion: "0.0.1-nightly.20261108.7" });
    const configPath = join(desktopDir, "release/nightly/electron-builder.json");
    expect(calls[2]?.[1]).toEqual(["--publish", "never", "--mac", "--arm64", "--config", configPath]);
    expect(JSON.parse(readFileSync(configPath, "utf8"))).toMatchObject({
      extraMetadata: { version: "0.0.1-nightly.20261108.7" },
    });
  });

  it("packages stable", () => {
    const { calls } = runPackaging({ channel: "stable" });
    expect(calls).toHaveLength(3);
  });

  it("does not package a bundle compiled for another channel", () => {
    const calls: Call[] = [];
    expect(() => runPackaging({ compiledFor: "dev", calls })).toThrow(
      /not compiled for the nightly/,
    );
    expect(calls).toHaveLength(2);
  });

  it("does not let an earlier run's bundle pass for this build", () => {
    const calls: Call[] = [];
    const seed = (desktopDir: string) =>
      writeBundles(join(desktopDir, bundleDirectory("nightly")), "nightly");
    expect(() => runPackaging({ compiledFor: null, seed, calls })).toThrow(/not compiled/);
    expect(calls).toHaveLength(2);
  });
});
