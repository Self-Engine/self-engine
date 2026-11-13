import { fixedClock, requireInstant } from "@self-engine/time/testing";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  buildLocalNightly,
  type CommandResult,
  localNightlyVersion,
  type NightlyLocalOptions,
} from "./nightly-local.ts";
import type { PackageRequest } from "./package-channel.ts";

// The grammar from semver.org, as an independent check of the stamped form.
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
// The form of a published nightly, as `scripts/release-plan.ts` matches its tags.
const PUBLISHED_NIGHTLY = /^(\d+)\.(\d+)\.(\d+)-nightly\.(\d{8})\.(\d+)$/;

const COMMIT = "abc1234def5678901234567890123456789012ab";

describe("localNightlyVersion", () => {
  it("keeps the base and date of the plan and names the commit", () => {
    expect(localNightlyVersion("0.0.3-nightly.20261109.1", COMMIT)).toBe(
      "0.0.3-nightly.20261109.local.abc1234",
    );
  });

  it("is valid semver and cannot pass for a published nightly", () => {
    const version = localNightlyVersion("0.0.3-nightly.20261109.1", COMMIT);
    expect(version).toMatch(SEMVER);
    expect(version).not.toMatch(PUBLISHED_NIGHTLY);
  });

  it("stays valid semver when the short commit is digits with a leading zero", () => {
    const version = localNightlyVersion(
      "0.0.3-nightly.20261109.1",
      "0123456a00000000000000000000000000000000",
    );
    expect(version).toBe("0.0.3-nightly.20261109.local.0123456a");
    expect(version).toMatch(SEMVER);
  });

  it("refuses a plan that is not a nightly", () => {
    expect(() => localNightlyVersion("0.0.3", COMMIT)).toThrow(/not a nightly/);
  });
});

const OK = (stdout = ""): CommandResult => ({ status: 0, stdout, stderr: "" });
const FULL_COMMIT = "fedcba9876543210fedcba9876543210fedcba98";
const VERSION = "0.0.3-nightly.20261109.local.fedcba9";
const DMG_NAME = `Self-Engine-Nightly-${VERSION}-arm64.dmg`;

describe("buildLocalNightly", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  interface Scenario {
    readonly branch?: string;
    readonly status?: string;
    readonly failOn?: string;
    /** Whether the fake build writes a dmg. */
    readonly buildsDmg?: boolean;
    readonly env?: NodeJS.ProcessEnv;
  }

  function setUp(scenario: Scenario = {}) {
    const { branch = "main", status = "", failOn, buildsDmg = true } = scenario;
    dir = realpathSync(mkdtempSync(join(tmpdir(), "nightly-local-")));
    const rootDir = join(dir, "repo");
    const desktopDir = join(rootDir, "apps/desktop");
    const homeDir = join(dir, "home");
    const downloads = join(homeDir, "Downloads");
    mkdirSync(downloads, { recursive: true });

    const steps: string[] = [];
    const printed: string[] = [];
    const requests: PackageRequest[] = [];
    const envs: NodeJS.ProcessEnv[] = [];
    const step = (name: string) => {
      steps.push(name);
      if (failOn !== undefined && name.startsWith(failOn)) throw new Error(`${name} failed`);
    };

    const options: NightlyLocalOptions = {
      rootDir,
      desktopDir,
      homeDir,
      env: scenario.env ?? { PATH: "/bin" },
      clock: fixedClock(requireInstant("2026-11-09T01:30:00.000Z")),
      print: (line) => printed.push(line),
      query: (command, args) => {
        const line = [command === process.execPath ? "node" : command, ...args].join(" ");
        steps.push(line.startsWith("node") ? "release-plan" : line);
        if (command === "git" && args[0] === "branch") return OK(`${branch}\n`);
        if (command === "git" && args[0] === "status") return OK(status);
        if (command === "git" && args[0] === "rev-parse") return OK(`${FULL_COMMIT}\n`);
        return OK("channel=nightly\nversion=0.0.3-nightly.20261109.1\ntag=v0.0.3\n");
      },
      run: (command, args, { env }) => {
        envs.push(env);
        step([command, ...args].join(" "));
      },
      packageApp: (request, env) => {
        envs.push(env);
        step("package");
        requests.push(request);
        if (!buildsDmg) return;
        const output = join(desktopDir, "release/nightly");
        mkdirSync(output, { recursive: true });
        writeFileSync(join(output, DMG_NAME), "the built dmg");
      },
      copyFile: (from, to) => {
        // Leaves a partial file behind, as a full disk would.
        if (failOn === "copy") writeFileSync(to, "half");
        step("copy");
        copyFileSync(from, to);
      },
    };
    return { options, steps, printed, requests, envs, downloads };
  }

  describe("refuses before changing anything", () => {
    function expectRefusal(scenario: Scenario, message: RegExp) {
      const { options, steps, requests, downloads } = setUp(scenario);
      expect(() => buildLocalNightly(options)).toThrow(message);
      expect(
        steps.filter((name) => !name.startsWith("git branch") && !name.startsWith("git status")),
      ).toEqual([]);
      expect(requests).toEqual([]);
      expect(readdirSync(downloads)).toEqual([]);
    }

    it("on another branch", () => {
      expectRefusal({ branch: "feature/x" }, /on "feature\/x".*main/);
    });

    it("on a detached HEAD", () => {
      expectRefusal({ branch: "" }, /detached.*main/);
    });

    it("with a changed file, naming it", () => {
      expectRefusal({ status: " M README.md\n" }, /uncommitted[\s\S]*README\.md/);
    });

    it("with an untracked file, naming it", () => {
      expectRefusal({ status: "?? notes.txt\n" }, /uncommitted[\s\S]*notes\.txt/);
    });
  });

  describe("a full run", () => {
    it("updates, then reads the commit, then builds, then copies", () => {
      const { options, steps } = setUp();
      buildLocalNightly(options);
      expect(steps).toEqual([
        "git branch --show-current",
        "git status --porcelain --untracked-files=normal",
        "git pull --ff-only",
        "pnpm install --frozen-lockfile",
        "git rev-parse HEAD",
        "release-plan",
        "package",
        "copy",
      ]);
    });

    it("asks the release plan for the date of the clock", () => {
      const { options } = setUp();
      const calls: string[][] = [];
      const { query } = options;
      buildLocalNightly({
        ...options,
        query: (command, args, cwd) => {
          calls.push([command, ...args]);
          return query(command, args, cwd);
        },
      });
      expect(calls).toContainEqual([
        process.execPath,
        join(options.rootDir, "scripts/release-plan.ts"),
        "nightly",
        "--commit",
        FULL_COMMIT,
        "--started-at",
        "2026-11-09T01:30:00.000Z",
        "--run-number",
        "1",
      ]);
    });

    it("packages the Nightly's dmg under the local version", () => {
      const { options, requests } = setUp();
      buildLocalNightly(options);
      expect(requests).toEqual([{ channel: "nightly", releaseVersion: VERSION }]);
    });

    it("gives no step the signing inputs, so the build stays ad hoc", () => {
      const { options, envs } = setUp({
        env: {
          PATH: "/bin",
          CSC_LINK: "link",
          CSC_KEY_PASSWORD: "password",
          APPLE_ID: "id",
          APPLE_APP_SPECIFIC_PASSWORD: "password",
          APPLE_TEAM_ID: "team",
        },
      });
      buildLocalNightly(options);
      expect(envs.length).toBeGreaterThan(0);
      for (const env of envs) expect(env).toEqual({ PATH: "/bin" });
    });

    it("does not count as CI, which would refuse an ad-hoc dmg", () => {
      const { options, envs } = setUp({ env: { PATH: "/bin", CI: "1" } });
      buildLocalNightly(options);
      for (const env of envs) expect(env).toEqual({ PATH: "/bin" });
    });

    it("leaves only the dmg in Downloads", () => {
      const { options, downloads } = setUp();
      buildLocalNightly(options);
      expect(readdirSync(downloads)).toEqual([DMG_NAME]);
      expect(readFileSync(join(downloads, DMG_NAME), "utf8")).toBe("the built dmg");
    });

    it("overwrites a dmg of the same name", () => {
      const { options, downloads } = setUp();
      writeFileSync(join(downloads, DMG_NAME), "from this morning");
      buildLocalNightly(options);
      expect(readFileSync(join(downloads, DMG_NAME), "utf8")).toBe("the built dmg");
    });

    it("creates a missing Downloads folder", () => {
      const { options, downloads } = setUp();
      rmSync(downloads, { recursive: true });
      buildLocalNightly(options);
      expect(readdirSync(downloads)).toEqual([DMG_NAME]);
    });

    it("prints the path of the dmg", () => {
      const { options, printed, downloads } = setUp();
      buildLocalNightly(options);
      expect(printed.at(-1)).toContain(join(downloads, DMG_NAME));
    });
  });

  describe("leaves no file in Downloads", () => {
    function expectNothingDelivered(scenario: Scenario, message: RegExp) {
      const { options, downloads } = setUp(scenario);
      expect(() => buildLocalNightly(options)).toThrow(message);
      expect(readdirSync(downloads)).toEqual([]);
    }

    it.each([
      ["the pull", "git pull"],
      ["the install of dependencies", "pnpm install"],
      ["the build", "package"],
      ["the copy, half done", "copy"],
    ])("when %s fails", (_name, failOn) => {
      expectNothingDelivered({ failOn }, /failed/);
    });

    it("when the build wrote no dmg", () => {
      expectNothingDelivered({ buildsDmg: false }, /ENOENT/);
    });

    it("beside the target when the copy cannot take its name", () => {
      const { options, downloads } = setUp();
      // A rename cannot replace a directory with a file.
      mkdirSync(join(downloads, DMG_NAME, "in-the-way"), { recursive: true });
      expect(() => buildLocalNightly(options)).toThrow();
      expect(readdirSync(downloads)).toEqual([DMG_NAME]);
    });
  });
});
