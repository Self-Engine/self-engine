// Throwaway git repositories for the tests of the verify scripts, in the system temp
// directory. Git runs there without the developer's global and system config, so a
// `core.hooksPath`, signing or exclude setup on the machine cannot reach into the
// repositories, and the tests behave the same everywhere.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };

export interface TestRepo {
  readonly dir: string;
  git(...args: string[]): string;
  remove(): void;
}

/** A repository with one commit (`a.txt`) and `.cache/` ignored, like the real checkout. */
export function createTestRepo(prefix: string): TestRepo {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const git = (...args: string[]): string =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      env: GIT_ENV,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "-q");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Test");
  writeFileSync(join(dir, ".gitignore"), ".cache/\n");
  writeFileSync(join(dir, "a.txt"), "a\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  return { dir, git, remove: () => rmSync(dir, { recursive: true, force: true }) };
}
