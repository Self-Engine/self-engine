import { beforeAll, describe, expect, it } from "vite-plus/test";
import { lintFixtures } from "../testing/lint-fixture.ts";

const RULE = "no-global-t-macro";

// [name, source, diagnostics]. Every fixture goes through one real Oxlint run (beforeAll).
const FIXTURES: [string, string, number][] = [
  ["the global t", 'import { t } from "@lingui/core/macro";', 1],
  ["the global t under another name", 'import { t as translate } from "@lingui/core/macro";', 1],
  ["the global t beside msg", 'import { msg, t } from "@lingui/core/macro";', 1],
  ["msg", 'import { msg } from "@lingui/core/macro";', 0],
  ["msg under the name t", 'import { msg as t } from "@lingui/core/macro";', 0],
  ["the other core macros", 'import { plural, select } from "@lingui/core/macro";', 0],
  ["useLingui from the React macros", 'import { useLingui } from "@lingui/react/macro";', 0],
  ["useLingui from the React runtime", 'import { useLingui } from "@lingui/react";', 0],
  ["a t from another module", 'import { t } from "./t.ts";', 0],
];

describe("self-engine/no-global-t-macro", () => {
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
    expect(results[0]?.[0]).toContain("Use `msg` outside components");
  });

  it("reports the imported t, not the whole import", () => {
    const [imported] = lintFixtures(RULE, ['import {\n  msg,\n  t,\n} from "@lingui/core/macro";']);
    expect(imported?.[0]).toMatch(/:3:3: /);
  });
});
