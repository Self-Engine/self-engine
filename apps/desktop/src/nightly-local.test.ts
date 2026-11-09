import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  type CommandResult,
  installLocalNightly,
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
const INSTALLED_VERSION = "0.0.3-nightly.20261108.local.0000aaa";
const NEW_VERSION = "0.0.3-nightly.20261109.local.fedcba9";

describe("installLocalNightly", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  interface Scenario {
    readonly branch?: string;
    readonly status?: string;
    /** The exit code of `pgrep`, per call. */
    readonly pgrep?: readonly number[];
    readonly failOn?: string;
    /** The version the fake build stamps. */
    readonly builtVersion?: string;
    readonly rename?: NightlyLocalOptions["rename"];
    readonly env?: NodeJS.ProcessEnv;
  }

  function writeApp(appPath: string, version: string): void {
    mkdirSync(join(appPath, "Contents"), { recursive: true });
    writeFileSync(join(appPath, "Contents/Info.plist"), version);
  }

  function setUp(scenario: Scenario = {}) {
    const { branch = "main", status = "", failOn, builtVersion = NEW_VERSION } = scenario;
    dir = realpathSync(mkdtempSync(join(tmpdir(), "nightly-local-")));
    const rootDir = join(dir, "repo");
    const desktopDir = join(rootDir, "apps/desktop");
    const applicationsDir = join(dir, "Applications");
    mkdirSync(applicationsDir, { recursive: true });
    const installed = join(applicationsDir, "Self-Engine Nightly.app");
    writeApp(installed, INSTALLED_VERSION);

    const steps: string[] = [];
    const printed: string[] = [];
    const requests: PackageRequest[] = [];
    const envs: NodeJS.ProcessEnv[] = [];
    const pgrep = [...(scenario.pgrep ?? [])];
    const step = (name: string) => {
      steps.push(name);
      if (failOn !== undefined && name.startsWith(failOn)) throw new Error(`${name} failed`);
    };

    const options: NightlyLocalOptions = {
      rootDir,
      desktopDir,
      applicationsDir,
      env: scenario.env ?? { PATH: "/bin" },
      now: () => new Date("2026-11-09T01:30:00.000Z"),
      rename: scenario.rename ?? renameSync,
      print: (line) => printed.push(line),
      query: (command, args) => {
        const line = [command === process.execPath ? "node" : command, ...args].join(" ");
        steps.push(line.startsWith("node") ? "release-plan" : line);
        if (command === "git" && args[0] === "branch") return OK(`${branch}\n`);
        if (command === "git" && args[0] === "status") return OK(status);
        if (command === "git" && args[0] === "rev-parse") return OK(`${FULL_COMMIT}\n`);
        if (command === "pgrep") return { status: pgrep.shift() ?? 1, stdout: "", stderr: "" };
        if (command === "plutil") return OK(`${readFileSync(args.at(-1) ?? "", "utf8")}\n`);
        return OK("channel=nightly\nversion=0.0.3-nightly.20261109.1\ntag=v0.0.3\n");
      },
      run: (command, args, { env }) => {
        envs.push(env);
        if (command === "ditto") {
          const [source = "", target = ""] = args;
          // Leaves a partial copy behind, as a full disk would.
          if (failOn === "ditto") mkdirSync(target, { recursive: true });
          step("ditto");
          cpSync(source, target, { recursive: true });
          return;
        }
        step([command, ...args].join(" "));
      },
      packageApp: (request, env) => {
        envs.push(env);
        step("package");
        requests.push(request);
        writeApp(
          join(desktopDir, "release/nightly/mac-arm64/Self-Engine Nightly.app"),
          builtVersion,
        );
      },
    };
    return { options, steps, printed, requests, envs, installed, applicationsDir };
  }

  function installedVersion(installed: string): string {
    return readFileSync(join(installed, "Contents/Info.plist"), "utf8");
  }

  describe("refuses before changing anything", () => {
    function expectRefusal(scenario: Scenario, message: RegExp) {
      const { options, steps, requests, installed } = setUp(scenario);
      expect(() => installLocalNightly(options)).toThrow(message);
      expect(steps.filter((name) => !/^(git (branch|status)|pgrep)/.test(name))).toEqual([]);
      expect(requests).toEqual([]);
      expect(installedVersion(installed)).toBe(INSTALLED_VERSION);
    }

    it("on another branch", () => {
      expectRefusal({ branch: "feature/x" }, /on "feature\/x".*main/);
    });

    it("on a detached HEAD", () => {
      expectRefusal({ branch: "" }, /detached.*main/);
    });

    it("with uncommitted changes, naming them", () => {
      expectRefusal({ status: " M README.md\n?? notes.txt\n" }, /uncommitted[\s\S]*README\.md/);
    });

    it("while the Nightly runs", () => {
      expectRefusal({ pgrep: [0] }, /Self-Engine Nightly is running/);
    });

    it("when it cannot tell whether the Nightly runs", () => {
      expectRefusal({ pgrep: [3] }, /pgrep/);
    });
  });

  describe("a full run", () => {
    it("updates, then reads the commit, then builds, then installs", () => {
      const { options, steps } = setUp();
      installLocalNightly(options);
      expect(steps).toEqual([
        "git branch --show-current",
        "git status --porcelain",
        "pgrep -x Self-Engine Nightly",
        "git pull --ff-only",
        "pnpm install --frozen-lockfile",
        "git rev-parse HEAD",
        "release-plan",
        "package",
        "ditto",
        expect.stringMatching(/^plutil /),
        "pgrep -x Self-Engine Nightly",
      ]);
    });

    it("asks the release plan for the date of the clock", () => {
      const { options } = setUp();
      const calls: string[][] = [];
      const { query } = options;
      installLocalNightly({
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

    it("packages the Nightly with the local version and no release version", () => {
      const { options, requests } = setUp();
      installLocalNightly(options);
      expect(requests).toEqual([
        { channel: "nightly", releaseVersion: undefined, localVersion: NEW_VERSION },
      ]);
    });

    it("gives no step the signing inputs", () => {
      const { options, envs } = setUp({
        env: { PATH: "/bin", CSC_LINK: "link", APPLE_ID: "id" },
      });
      installLocalNightly(options);
      expect(envs.length).toBeGreaterThan(0);
      for (const env of envs) expect(env).toEqual({ PATH: "/bin" });
    });

    it("replaces the installed app and leaves nothing beside it", () => {
      const { options, installed, applicationsDir } = setUp();
      installLocalNightly(options);
      expect(installedVersion(installed)).toBe(NEW_VERSION);
      expect(readdirSync(applicationsDir)).toEqual(["Self-Engine Nightly.app"]);
    });

    it("installs when no copy is there yet", () => {
      const { options, installed } = setUp();
      rmSync(installed, { recursive: true });
      installLocalNightly(options);
      expect(installedVersion(installed)).toBe(NEW_VERSION);
    });

    it("prints the installed version and path", () => {
      const { options, printed, installed } = setUp();
      installLocalNightly(options);
      expect(printed.at(-1)).toBe(`Installed Self-Engine Nightly ${NEW_VERSION} at ${installed}`);
    });
  });

  describe("leaves the installed app alone", () => {
    function expectUntouched(scenario: Scenario, message: RegExp) {
      const { options, installed, applicationsDir } = setUp(scenario);
      expect(() => installLocalNightly(options)).toThrow(message);
      expect(installedVersion(installed)).toBe(INSTALLED_VERSION);
      expect(readdirSync(applicationsDir)).toEqual(["Self-Engine Nightly.app"]);
    }

    it.each([
      ["the pull", "git pull"],
      ["the install of dependencies", "pnpm install"],
      ["the build", "package"],
      ["the copy", "ditto"],
    ])("when %s fails", (_name, failOn) => {
      expectUntouched({ failOn }, new RegExp(`${failOn} .*failed|${failOn} failed`));
    });

    it("when the built app does not carry the stamped version", () => {
      expectUntouched({ builtVersion: "0.0.1" }, /says 0\.0\.1, not/);
    });

    it("when the Nightly was opened during the build", () => {
      expectUntouched({ pgrep: [1, 0] }, /Self-Engine Nightly is running/);
    });

    it("when the new app cannot be moved into place", () => {
      const rename = (from: string, to: string) => {
        if (from.endsWith(".new")) throw new Error("rename refused");
        renameSync(from, to);
      };
      expectUntouched({ rename }, /rename refused/);
    });
  });

  describe("after an earlier run was cut off", () => {
    it("clears a half-finished copy", () => {
      const { options, installed, applicationsDir } = setUp();
      const stale = join(applicationsDir, ".Self-Engine Nightly.app.new");
      writeApp(stale, "stale");
      writeFileSync(join(stale, "leftover"), "");
      installLocalNightly(options);
      expect(installedVersion(installed)).toBe(NEW_VERSION);
      expect(readdirSync(applicationsDir)).toEqual(["Self-Engine Nightly.app"]);
    });

    it("keeps the set-aside app until the new one is in place", () => {
      const { options, installed, applicationsDir } = setUp();
      const old = join(applicationsDir, ".Self-Engine Nightly.app.old");
      renameSync(installed, old);
      const rename = (from: string, to: string) => {
        if (from.endsWith(".new")) throw new Error("rename refused");
        renameSync(from, to);
      };
      expect(() => installLocalNightly({ ...options, rename })).toThrow(/rename refused/);
      expect(installedVersion(installed)).toBe(INSTALLED_VERSION);
    });
  });
});
