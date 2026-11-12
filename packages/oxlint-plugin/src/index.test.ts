import noForeignRowMap from "./rules/no-foreign-row-map.ts";
import { describe, expect, it } from "vite-plus/test";
import plugin from "./index.ts";
import noGlobalTMacro from "./rules/no-global-t-macro.ts";
import noImportTypeQuery from "./rules/no-import-type-query.ts";
import noQueryOrThrow from "./rules/no-query-or-throw.ts";
import noSilentCatch from "./rules/no-silent-catch.ts";

describe("@self-engine/oxlint-plugin", () => {
  it("reports its rules as self-engine/<rule>", () => {
    expect(plugin.meta?.name).toBe("self-engine");
  });

  it("exports every rule under its name", () => {
    expect(plugin.rules).toEqual({
      "no-global-t-macro": noGlobalTMacro,
      "no-foreign-row-map": noForeignRowMap,
      "no-import-type-query": noImportTypeQuery,
      "no-query-or-throw": noQueryOrThrow,
      "no-silent-catch": noSilentCatch,
    });
  });
});
