import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createTestRepo, type TestRepo } from "./testing/git-repo.ts";
import {
  clearVerifyStamp,
  headTreeHash,
  readVerifyStamp,
  VERIFY_STAMP_FILE,
  workingTreeHash,
  writeVerifyStamp,
} from "./verify-stamp.ts";

// Each test gets a throwaway git repository in the system temp directory.
let repo: TestRepo;

beforeEach(() => {
  repo = createTestRepo("verify-stamp-test-");
});

afterEach(() => {
  repo.remove();
});

describe("workingTreeHash", () => {
  it("equals the HEAD tree in a clean checkout", () => {
    expect(workingTreeHash(repo.dir)).toBe(headTreeHash(repo.dir));
  });

  it("covers edits and untracked files, but not ignored ones", () => {
    const clean = workingTreeHash(repo.dir);
    mkdirSync(join(repo.dir, ".cache"));
    writeFileSync(join(repo.dir, ".cache/log"), "ignored\n");
    expect(workingTreeHash(repo.dir)).toBe(clean);

    writeFileSync(join(repo.dir, "b.txt"), "untracked\n");
    expect(workingTreeHash(repo.dir)).not.toBe(clean);
  });

  it("matches HEAD again once the changes are committed", () => {
    writeFileSync(join(repo.dir, "a.txt"), "changed\n");
    const edited = workingTreeHash(repo.dir);
    repo.git("commit", "-q", "-am", "edit");
    expect(headTreeHash(repo.dir)).toBe(edited);
  });

  it("leaves the real index untouched", () => {
    writeFileSync(join(repo.dir, "b.txt"), "untracked\n");
    workingTreeHash(repo.dir);
    expect(repo.git("status", "--porcelain")).toBe("?? b.txt");
  });
});

describe("the stamp file", () => {
  const stamp = { tree: "abc", verifiedAt: "2026-11-08T08:00:00.000Z" };

  it("round-trips, and is gone after clearing", () => {
    expect(readVerifyStamp(repo.dir)).toBeUndefined();
    writeVerifyStamp(repo.dir, stamp);
    expect(readVerifyStamp(repo.dir)).toEqual(stamp);
    clearVerifyStamp(repo.dir);
    expect(readVerifyStamp(repo.dir)).toBeUndefined();
  });

  it("reads a corrupt or foreign stamp as no stamp", () => {
    writeVerifyStamp(repo.dir, stamp);
    const file = join(repo.dir, VERIFY_STAMP_FILE);
    writeFileSync(file, readFileSync(file, "utf8").slice(0, 10));
    expect(readVerifyStamp(repo.dir)).toBeUndefined();
    writeFileSync(file, '{"tree": 1}');
    expect(readVerifyStamp(repo.dir)).toBeUndefined();
  });
});
