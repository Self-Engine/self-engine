import { describe, expect, it } from "vite-plus/test";
import { lintFixture, lintFixtures } from "../testing/lint-fixture.ts";

describe("self-engine/no-query-or-throw", () => {
  it("reports executeTakeFirstOrThrow and explains explicit not found handling", () => {
    const hits = lintFixture("no-query-or-throw", "query.executeTakeFirstOrThrow();");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain("executeTakeFirst()");
    expect(hits[0]).toContain('undefined into the port\'s "not found" result');
  });

  it("reports takeFirstOrThrow too", () => {
    const hits = lintFixture("no-query-or-throw", "query.takeFirstOrThrow();");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain("executeTakeFirst()");
  });

  it("allows nonthrowing queries and unrelated names", () => {
    const results = lintFixtures("no-query-or-throw", [
      "query.executeTakeFirst();",
      "query.takeFirst();",
      "query.execute();",
      'const name = "executeTakeFirstOrThrow";',
      "const executeTakeFirstOrThrow = () => {};",
    ]);
    expect(results).toEqual([[], [], [], [], []]);
  });

  it("also reports optional access, literal brackets and saved method references", () => {
    const results = lintFixtures("no-query-or-throw", [
      "query?.executeTakeFirstOrThrow();",
      'query["executeTakeFirstOrThrow"]();',
      'query["takeFirstOrThrow"]();',
      "const run = query.executeTakeFirstOrThrow;",
    ]);
    expect(results.map((hits) => hits.length)).toEqual([1, 1, 1, 1]);
  });
  it("reports destructured throwing methods, including aliases and literal keys", () => {
    const results = lintFixtures("no-query-or-throw", [
      "const { executeTakeFirstOrThrow } = query;",
      "const { takeFirstOrThrow: run } = query;",
      'const { ["executeTakeFirstOrThrow"]: run } = query;',
      'const { "takeFirstOrThrow": run } = query;',
      "function run({ executeTakeFirstOrThrow }) {}",
      "const { executeTakeFirst } = query;",
      "const query = { executeTakeFirstOrThrow() {} };",
    ]);
    expect(results.map((hits) => hits.length)).toEqual([1, 1, 1, 1, 1, 0, 0]);
  });
});
