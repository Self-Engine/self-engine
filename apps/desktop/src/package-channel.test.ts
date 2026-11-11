import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { bundleDirectory } from "./channel.ts";
import {
  assertBundlesBuiltFor,
  assertDeveloperIdRelease,
  builderConfig,
  electronDistPath,
  type PackageOptions,
  packageChannel,
  packagedDmgPath,
  parsePackageRequest,
  parseReleaseChannel,
  type ReleaseChannel,
  resolveSigning,
  withoutSigningInputs,
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
    expect(() => parsePackageRequest(["stable", "--release-version", ""])).toThrow(
      /needs a version/,
    );
  });

  it("still names the channel it needs", () => {
    expect(() => parsePackageRequest([])).toThrow(/Name the channel/);
  });
});

const SIGNING_ENV = {
  CSC_LINK: "link",
  CSC_KEY_PASSWORD: "key",
  APPLE_ID: "id",
  APPLE_APP_SPECIFIC_PASSWORD: "app",
  APPLE_TEAM_ID: "TEAM123456",
};

describe("resolveSigning", () => {
  it("signs a release with the Developer ID when every input is there", () => {
    expect(resolveSigning("1.0.0", SIGNING_ENV)).toBe("developer-id");
  });

  it("leaves a local release ad hoc without any input", () => {
    expect(resolveSigning("1.0.0", {})).toBe("ad-hoc");
  });

  it("leaves a local inspection build ad hoc even with the inputs", () => {
    expect(resolveSigning(undefined, SIGNING_ENV)).toBe("ad-hoc");
  });

  it("never falls back to ad hoc in CI", () => {
    expect(() => resolveSigning("1.0.0", { CI: "true" })).toThrow(/Missing: CSC_LINK,/);
  });

  it.each(Object.keys(SIGNING_ENV))("refuses a release that lacks only %s", (name) => {
    expect(() => resolveSigning("1.0.0", { ...SIGNING_ENV, [name]: undefined })).toThrow(
      new RegExp(`Missing: ${name}\\.`),
    );
  });

  it("treats a secret that expands to nothing as missing", () => {
    expect(() => resolveSigning("1.0.0", { ...SIGNING_ENV, APPLE_ID: "", CI: "true" })).toThrow(
      /Missing: APPLE_ID\./,
    );
  });

  it("names only the inputs, never a value", () => {
    const partial = { ...SIGNING_ENV, CSC_LINK: undefined };
    expect(() => resolveSigning("1.0.0", partial)).toThrow(expect.not.stringContaining("TEAM123"));
  });
});

describe("withoutSigningInputs", () => {
  it("keeps everything but the inputs", () => {
    expect(withoutSigningInputs({ ...SIGNING_ENV, PATH: "/bin" })).toEqual({ PATH: "/bin" });
  });
});

describe("the entitlements", () => {
  it("grant only JIT memory", () => {
    const plist = readFileSync(join(import.meta.dirname, "../entitlements.mac.plist"), "utf8");
    expect(plist.match(/<key>[^<]+<\/key>/g)).toEqual([
      "<key>com.apple.security.cs.allow-jit</key>",
    ]);
  });
});

describe("electronDistPath", () => {
  it("finds the binary folder of the installed electron package", () => {
    expect(electronDistPath(import.meta.dirname)).toMatch(/node_modules\/electron\/dist$/);
  });
});

/** The part of an electron-builder configuration that sets fuses. */
interface FuseConfig {
  readonly appId: string;
  readonly electronFuses?: { readonly enableNodeCliInspectArguments?: boolean };
}

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
    expect(config.mac.target).toBe("dmg");
    expect(config.dmg.writeUpdateInfo).toBe(false);
  });

  it.each([
    ["nightly", "Self-Engine-Nightly-${version}-${arch}.${ext}"],
    ["stable", "Self-Engine-${version}-${arch}.${ext}"],
  ] as const)("names the artifacts of %s without spaces", (channel, artifactName) => {
    expect(builderConfig(channel, ELECTRON_DIST).artifactName).toBe(artifactName);
  });

  it.each(["nightly", "stable"] as const)("signs a %s release for notarization", (channel) => {
    const { mac } = builderConfig(channel, ELECTRON_DIST, "1.0.0", "developer-id");
    expect(mac).toMatchObject({
      hardenedRuntime: true,
      notarize: true,
      entitlements: "entitlements.mac.plist",
      entitlementsInherit: "entitlements.mac.plist",
    });
    expect(mac).not.toHaveProperty("identity");
  });

  it("signs ad hoc, never with whatever identity the machine holds", () => {
    expect(builderConfig("stable", ELECTRON_DIST).mac).toMatchObject({
      identity: "-",
      hardenedRuntime: false,
    });
  });

  // The packaged smoke test starts the signed app through Playwright, which connects over
  // `--inspect`. Flipping that fuse off would leave a release untestable: the smoke test has to
  // change first (see builderConfig).
  it.each(["ad-hoc", "developer-id"] as const)(
    "leaves on the inspector fuse the packaged smoke test needs (%s)",
    (signing) => {
      // Typed as electron-builder reads it, so a fuse config that is added later is seen here.
      const config: FuseConfig = builderConfig("nightly", ELECTRON_DIST, "1.0.0", signing);
      expect(config.electronFuses?.enableNodeCliInspectArguments).not.toBe(false);
    },
  );

  it("never sends an ad-hoc build to Apple for notarization", () => {
    expect(builderConfig("nightly", ELECTRON_DIST, "1.0.0", "ad-hoc").mac).toMatchObject({
      notarize: false,
    });
  });

  it("keeps the channels' output apart", () => {
    expect(builderConfig("nightly", ELECTRON_DIST).directories.output).not.toBe(
      builderConfig("stable", ELECTRON_DIST).directories.output,
    );
  });

  it("ships native modules outside the archive, where the process can load them", () => {
    expect(builderConfig("nightly", ELECTRON_DIST).asarUnpack).toEqual(["**/*.node"]);
  });

  it("leaves the SQLite driver's sources and other platforms' binaries out", () => {
    expect(builderConfig("stable", ELECTRON_DIST).files).toEqual(
      expect.arrayContaining([
        "!**/node_modules/better-sqlite3/{deps,src}/**",
        "!**/node_modules/better-sqlite3/binding.gyp",
        "!**/node_modules/better-sqlite3/prebuilds/!(darwin-*).node",
      ]),
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

describe("packagedDmgPath", () => {
  it("is where electron-builder writes the dmg of a version", () => {
    expect(packagedDmgPath("/repo/apps/desktop", "nightly", "0.0.3-nightly.20261109.7")).toBe(
      "/repo/apps/desktop/release/nightly/Self-Engine-Nightly-0.0.3-nightly.20261109.7-arm64.dmg",
    );
  });
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

describe("assertDeveloperIdRelease", () => {
  const SIGNED = [
    "CodeDirectory v=20500 size=447 flags=0x10000(runtime) hashes=3+7 location=embedded",
    "Authority=Developer ID Application: Some Name (TEAM123456)",
    "TeamIdentifier=TEAM123456",
  ].join("\n");

  function inspectWith(details: string) {
    const calls: string[][] = [];
    const inspect = (command: string, args: string[]) => {
      calls.push([command, ...args]);
      return args[0] === "-dvv" ? details : "";
    };
    return { calls, inspect };
  }

  it("checks the signature, the notarization ticket and Gatekeeper", () => {
    const { calls, inspect } = inspectWith(SIGNED);
    assertDeveloperIdRelease("/a.app", "TEAM123456", inspect);
    expect(calls).toEqual([
      ["codesign", "--verify", "--deep", "--strict", "/a.app"],
      ["codesign", "-dvv", "/a.app"],
      ["xcrun", "stapler", "validate", "/a.app"],
      ["spctl", "--assess", "--type", "execute", "/a.app"],
    ]);
  });

  it("refuses an ad-hoc app", () => {
    const details = "flags=0x10002(adhoc,runtime)\nSignature=adhoc\nTeamIdentifier=not set";
    expect(() =>
      assertDeveloperIdRelease("/a.app", "TEAM123456", inspectWith(details).inspect),
    ).toThrow(/not signed with a Developer ID/);
  });

  it("refuses another team's certificate without naming the team", () => {
    expect(() => assertDeveloperIdRelease("/a.app", "OTHER", inspectWith(SIGNED).inspect)).toThrow(
      /team in APPLE_TEAM_ID/,
    );
  });

  it("refuses an app without the hardened runtime", () => {
    const details = SIGNED.replace("(runtime)", "(none)");
    expect(() =>
      assertDeveloperIdRelease("/a.app", "TEAM123456", inspectWith(details).inspect),
    ).toThrow(/hardened runtime/);
  });

  it("refuses an app without a ticket", () => {
    const inspect = (command: string, args: string[]) => {
      if (command === "xcrun") throw new Error("stapler validate failed");
      return args[0] === "-dvv" ? SIGNED : "";
    };
    expect(() => assertDeveloperIdRelease("/a.app", "TEAM123456", inspect)).toThrow(/stapler/);
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
    readonly env?: NodeJS.ProcessEnv;
    /** The channel the fake workspace build compiles for; `null` builds nothing. */
    readonly compiledFor?: string | null;
    /** Called once the temp checkout exists, before anything runs. */
    readonly seed?: (desktopDir: string) => void;
    /** Receives every call the packaging makes, also when it throws. */
    readonly calls?: Call[];
    /** The smoke test of the packaged app fails. */
    readonly smokeFails?: boolean;
  }

  function isWorkspaceBuild([command]: Call): boolean {
    return command.endsWith("node_modules/.bin/vp");
  }

  function runPackaging(options: PackagingRun = {}) {
    const {
      channel = "nightly",
      releaseVersion,
      seed,
      smokeFails,
      env = { PATH: "/bin" },
    } = options;
    const compiledFor = options.compiledFor === undefined ? channel : options.compiledFor;
    const calls = options.calls ?? [];
    const inspected: string[][] = [];
    dir = realpathSync(mkdtempSync(join(tmpdir(), "package-channel-")));
    const desktopDir = join(dir, "apps/desktop");
    seed?.(desktopDir);
    packageChannel(
      { channel, releaseVersion },
      {
        rootDir: dir,
        desktopDir,
        electronDist: ELECTRON_DIST,
        env,
        inspect: (command, args) => {
          inspected.push([command, ...args]);
          return args[0] === "-dvv"
            ? "flags=0x10000(runtime)\nAuthority=Developer ID Application: A (T)\nTeamIdentifier=link\n"
            : "";
        },
        run: (...call) => {
          calls.push(call);
          if (smokeFails === true && call[1][0]?.endsWith("desktop-smoke.ts")) {
            throw new Error("The smoke test failed.");
          }
          if (isWorkspaceBuild(call) && compiledFor !== null) {
            writeBundles(join(desktopDir, bundleDirectory(channel)), compiledFor);
          }
        },
      },
    );
    return { calls, inspected, desktopDir, root: dir };
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
    expect(calls[2]?.[1]).toEqual([
      "--publish",
      "never",
      "--mac",
      "--arm64",
      "--config",
      configPath,
    ]);
    expect(JSON.parse(readFileSync(configPath, "utf8"))).toMatchObject({
      extraMetadata: { version: "0.0.1-nightly.20261108.7" },
    });
  });

  it("smoke-tests the packaged app before anything can ship it", () => {
    const { calls, desktopDir, root } = runPackaging({
      releaseVersion: "0.0.1-nightly.20261108.7",
    });
    expect(calls).toHaveLength(4);
    expect(calls[3]).toEqual([
      process.execPath,
      [
        join(root, "scripts/desktop-smoke.ts"),
        "--executable",
        join(
          desktopDir,
          "release/nightly/mac-arm64/Self-Engine Nightly.app/Contents/MacOS/Self-Engine Nightly",
        ),
      ],
      { cwd: root, env: { PATH: "/bin" } },
    ]);
  });

  it("fails the packaging when the packaged app fails its smoke test", () => {
    expect(() => runPackaging({ smokeFails: true })).toThrow(/smoke test failed/);
  });

  describe("with the signing inputs", () => {
    const env = { PATH: "/bin", ...SIGNING_ENV, APPLE_TEAM_ID: "link" };
    const releaseVersion = "1.0.0";

    it("hands them only to electron-builder", () => {
      const { calls } = runPackaging({ releaseVersion, env });
      expect(calls[0]?.[2].env).toEqual({ PATH: "/bin" });
      expect(calls[1]?.[2].env).toEqual({ PATH: "/bin", SELF_ENGINE_CHANNEL: "nightly" });
      expect(calls[2]?.[2].env).toBe(env);
      expect(calls[3]?.[2].env).toEqual({ PATH: "/bin" });
    });

    it("checks the signed app of the channel", () => {
      const { inspected, desktopDir } = runPackaging({ releaseVersion, env });
      const app = join(desktopDir, "release/nightly/mac-arm64/Self-Engine Nightly.app");
      expect(inspected[0]).toEqual(["codesign", "--verify", "--deep", "--strict", app]);
    });

    it("writes the signing configuration", () => {
      const { desktopDir } = runPackaging({ releaseVersion, env });
      const config = JSON.parse(
        readFileSync(join(desktopDir, "release/nightly/electron-builder.json"), "utf8"),
      );
      expect(config.mac).toMatchObject({ notarize: true, hardenedRuntime: true });
    });

    it("fails before any build when a secret is missing in CI", () => {
      const calls: Call[] = [];
      expect(() =>
        runPackaging({
          releaseVersion,
          env: { ...env, APPLE_ID: "", CI: "true" },
          calls,
        }),
      ).toThrow(/Missing: APPLE_ID/);
      expect(calls).toHaveLength(0);
    });
  });

  it("does not check a signature on an ad-hoc release", () => {
    const { inspected } = runPackaging({ releaseVersion: "1.0.0" });
    expect(inspected).toEqual([]);
  });

  it("packages stable", () => {
    const { calls, desktopDir } = runPackaging({ channel: "stable" });
    expect(calls).toHaveLength(4);
    expect(calls[3]?.[1].at(-1)).toBe(
      join(desktopDir, "release/stable/mac-arm64/Self-Engine.app/Contents/MacOS/Self-Engine"),
    );
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
