import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { findMigrationProblems } from "./check-migrations.ts";
import { createTestRepo, type TestRepo } from "./testing/git-repo.ts";

const MIGRATION = "packages/time/src/migrations/0001.sql";

// Each test gets a throwaway repository with one merged migration, on a branch off `origin/main`.
let repo: TestRepo;

function write(path: string, content: string): void {
  const file = join(repo.dir, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function commitAll(message: string): void {
  repo.git("add", "-A");
  repo.git("commit", "-q", "-m", message);
}

beforeEach(() => {
  repo = createTestRepo("check-migrations-test-");
  repo.git("branch", "-M", "main");
  write(MIGRATION, "CREATE TABLE a (id TEXT) STRICT;\n");
  commitAll("add a migration");
  repo.git("update-ref", "refs/remotes/origin/main", "HEAD");
  repo.git("switch", "-q", "-c", "feature");
});

afterEach(() => {
  repo.remove();
});

describe("findMigrationProblems", () => {
  it("rejects a changed migration, naming the file and the fix", () => {
    write(MIGRATION, "CREATE TABLE a (id TEXT, b TEXT) STRICT;\n");
    commitAll("edit it");

    const problems = findMigrationProblems(repo.dir);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(MIGRATION);
    expect(problems[0]).toContain("Write a new migration");
  });

  it("passes when a new migration is added", () => {
    write("packages/time/src/migrations/0002.sql", "CREATE TABLE b (id TEXT) STRICT;\n");
    commitAll("add another");

    expect(findMigrationProblems(repo.dir)).toEqual([]);
  });

  it("passes on a branch that changes no migration", () => {
    write("a.txt", "changed\n");
    commitAll("edit something else");

    expect(findMigrationProblems(repo.dir)).toEqual([]);
  });

  it("rejects a deleted migration", () => {
    repo.git("rm", "-q", MIGRATION);
    commitAll("delete it");

    expect(findMigrationProblems(repo.dir)).toEqual([expect.stringContaining(MIGRATION)]);
  });

  it("rejects a renamed migration, and passes neither name off as an addition", () => {
    repo.git("mv", MIGRATION, "packages/time/src/migrations/0009.sql");
    commitAll("rename it");

    expect(findMigrationProblems(repo.dir)).toEqual([expect.stringContaining(MIGRATION)]);
  });

  it("rejects an edit that is not committed yet", () => {
    write(MIGRATION, "CREATE TABLE a (id TEXT, b TEXT) STRICT;\n");

    expect(findMigrationProblems(repo.dir)).toEqual([expect.stringContaining(MIGRATION)]);
  });

  it("does not mistake a migration that main gained later for a deletion", () => {
    repo.git("switch", "-q", "main");
    write("packages/time/src/migrations/0002.sql", "CREATE TABLE b (id TEXT) STRICT;\n");
    commitAll("main moves on");
    repo.git("update-ref", "refs/remotes/origin/main", "HEAD");
    repo.git("switch", "-q", "feature");

    expect(findMigrationProblems(repo.dir)).toEqual([]);
  });

  it("passes on main itself, where the merge base is HEAD and nothing differs", () => {
    repo.git("switch", "-q", "main");

    expect(findMigrationProblems(repo.dir)).toEqual([]);
  });

  it("checks the merge commit a pull request runs on in CI", () => {
    write(MIGRATION, "CREATE TABLE a (id TEXT, b TEXT) STRICT;\n");
    commitAll("edit it");
    repo.git("switch", "-q", "--detach", "main");
    repo.git("merge", "-q", "--no-ff", "-m", "merge the pull request", "feature");

    expect(findMigrationProblems(repo.dir)).toEqual([expect.stringContaining(MIGRATION)]);
  });

  it("watches a migration wherever its module keeps the folder", () => {
    const elsewhere = "packages/habits/migrations/0001.sql";
    write(elsewhere, "CREATE TABLE h (id TEXT) STRICT;\n");
    commitAll("add one");
    repo.git("update-ref", "refs/remotes/origin/main", "HEAD");
    write(elsewhere, "CREATE TABLE h (id TEXT, b TEXT) STRICT;\n");

    expect(findMigrationProblems(repo.dir)).toEqual([expect.stringContaining(elsewhere)]);
  });

  it("leaves the fixtures in a package's test folder alone, since they never ship", () => {
    const fixture = "packages/db/test/sql-module/migrations/0001.sql";
    write(fixture, "CREATE TABLE f (id TEXT) STRICT;\n");
    commitAll("add a fixture");
    repo.git("update-ref", "refs/remotes/origin/main", "HEAD");
    write(fixture, "CREATE TABLE f (id TEXT, b TEXT) STRICT;\n");
    commitAll("edit the fixture");

    expect(findMigrationProblems(repo.dir)).toEqual([]);
  });

  it("names a migration deleted by renaming it to something that is no migration", () => {
    repo.git("mv", MIGRATION, "packages/time/src/migrations/0001-entries.sql");
    commitAll("rename it");

    expect(findMigrationProblems(repo.dir)).toEqual([expect.stringContaining(MIGRATION)]);
  });
});

describe("without the history of main", () => {
  const needsHistory = [expect.stringContaining("needs the history of main")];

  it("fails when origin/main is missing", () => {
    repo.git("update-ref", "-d", "refs/remotes/origin/main");

    expect(findMigrationProblems(repo.dir)).toEqual(needsHistory);
  });

  it("fails in a shallow clone, whose merge base cannot be trusted", () => {
    const clone = join(repo.dir, ".cache/shallow");
    repo.git("switch", "-q", "main");
    repo.git("clone", "-q", "--depth=1", `file://${repo.dir}`, clone);

    expect(findMigrationProblems(clone)).toEqual(needsHistory);
  });

  it("fails when HEAD shares no history with origin/main", () => {
    repo.git("switch", "-q", "--orphan", "unrelated");
    write("a.txt", "a\n");
    commitAll("start over");

    expect(findMigrationProblems(repo.dir)).toEqual(needsHistory);
  });

  it("fails outside a git repository", () => {
    rmSync(join(repo.dir, ".git"), { recursive: true });

    expect(findMigrationProblems(repo.dir)).toEqual(needsHistory);
  });
});
