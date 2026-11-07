import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  clearVerifyStamp,
  headTreeHash,
  readVerifyStamp,
  VERIFY_STAMP_FILE,
  workingTreeHash,
  writeVerifyStamp,
} from "./verify-stamp.ts";

// Each test gets a throwaway git repository in the system temp directory.
let repo: string;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "verify-stamp-test-"));
  git("init", "-q");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Test");
  git("config", "commit.gpgsign", "false");
  writeFileSync(join(repo, ".gitignore"), ".cache/\n");
  writeFileSync(join(repo, "a.txt"), "a\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("workingTreeHash", () => {
  it("equals the HEAD tree in a clean checkout", () => {
    expect(workingTreeHash(repo)).toBe(headTreeHash(repo));
  });

  it("covers edits and untracked files, but not ignored ones", () => {
    const clean = workingTreeHash(repo);
    mkdirSync(join(repo, ".cache"));
    writeFileSync(join(repo, ".cache/log"), "ignored\n");
    expect(workingTreeHash(repo)).toBe(clean);

    writeFileSync(join(repo, "b.txt"), "untracked\n");
    expect(workingTreeHash(repo)).not.toBe(clean);
  });

  it("matches HEAD again once the changes are committed", () => {
    writeFileSync(join(repo, "a.txt"), "changed\n");
    const edited = workingTreeHash(repo);
    git("commit", "-q", "-am", "edit");
    expect(headTreeHash(repo)).toBe(edited);
  });

  it("leaves the real index untouched", () => {
    writeFileSync(join(repo, "b.txt"), "untracked\n");
    workingTreeHash(repo);
    expect(git("status", "--porcelain")).toBe("?? b.txt");
  });
});

describe("the stamp file", () => {
  const stamp = { tree: "abc", verifiedAt: "2026-11-08T08:00:00.000Z" };

  it("round-trips, and is gone after clearing", () => {
    expect(readVerifyStamp(repo)).toBeUndefined();
    writeVerifyStamp(repo, stamp);
    expect(readVerifyStamp(repo)).toEqual(stamp);
    clearVerifyStamp(repo);
    expect(readVerifyStamp(repo)).toBeUndefined();
  });

  it("reads a corrupt or foreign stamp as no stamp", () => {
    writeVerifyStamp(repo, stamp);
    const file = join(repo, VERIFY_STAMP_FILE);
    writeFileSync(file, readFileSync(file, "utf8").slice(0, 10));
    expect(readVerifyStamp(repo)).toBeUndefined();
    writeFileSync(file, '{"tree": 1}');
    expect(readVerifyStamp(repo)).toBeUndefined();
  });
});
