import { beforeAll, describe, expect, it } from "vite-plus/test";
import { lintFixtures } from "../testing/lint-fixture.ts";

const RULE = "no-import-type-query";

// [name, source, diagnostics]. Every fixture goes through one real Oxlint run (beforeAll).
const FIXTURES: [string, string, number][] = [
  [
    "a typeof query of a relative module",
    'export type D = ReturnType<typeof import("../../module/src/index.ts").describe>;',
    1,
  ],
  ["a type from a workspace package", 'export type T = import("@self-engine/time").Entry;', 1],
  ["a type from an npm package", 'export type T = import("left-pad").Options;', 1],
  ["a whole module's type", 'export type M = typeof import("./a.ts");', 1],
  ["a query with type arguments", 'export type B = import("./a.ts").Box<string>;', 1],
  [
    "two queries in one type",
    'export type P = [import("./a.ts").A, typeof import("./b.ts")];',
    2,
  ],
  ["an import type declaration", 'import type { Entry } from "@self-engine/time";', 0],
  ["a dynamic import expression", 'export const load = () => import("./a.ts");', 0],
  ["a typeof of a local value", "const a = 1;\nexport type A = typeof a;", 0],
];

describe("self-engine/no-import-type-query", () => {
  let results: string[][] = [];
  beforeAll(() => {
    results = lintFixtures(
      RULE,
      FIXTURES.map(([, source]) => source),
    );
  });

  it.each(FIXTURES.map((fixture, index) => [...fixture, index] as const))(
    "%s",
    (_name, _source, expected, index) => {
      expect(results[index]).toHaveLength(expected);
    },
  );

  it("names the way out in its message", () => {
    expect(results[0]?.[0]).toContain("Use `import type { … } from` instead.");
  });

  it("reports the query where it starts", () => {
    const [query] = lintFixtures(RULE, ['export type T =\n  import("./a.ts").A;']);
    expect(query?.[0]).toMatch(/:2:3: /);
  });
});
