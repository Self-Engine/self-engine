import { describe, expect, it } from "vite-plus/test";
import { cruiseFixture, packageName, repoPackage, ruleNames, withFiles } from "./cruise-fixture.ts";

describe("repoPackage", () => {
  it("reads a repo package's exports, dependencies and sources, without its tests", () => {
    const fixture = repoPackage("packages/placeholder-module");
    expect(fixture.exports).toEqual({ ".": "./src/index.ts" });
    expect(fixture.dependencies).toEqual(["@self-engine/placeholder-shared"]);
    expect(Object.keys(fixture.files)).toEqual(["src/index.ts"]);
  });
});

describe("packageName", () => {
  it("scopes the folder name", () => {
    expect(packageName("apps/desktop")).toBe("@self-engine/desktop");
  });
});

describe("cruiseFixture", () => {
  it("links declared workspace packages, so an import by name resolves", async () => {
    const lower = { dir: "packages/lower", files: { "src/index.ts": "export const a = 1;\n" } };
    const upper = {
      dir: "packages/upper",
      dependencies: ["@self-engine/lower"],
      files: { "src/index.ts": 'import { a } from "@self-engine/lower";\nexport const b = a;\n' },
    };
    // Resolved (no not-to-unresolvable); `upper` is not in ALLOWED_IMPORTS, so it may not.
    expect(ruleNames(await cruiseFixture([lower, upper]))).toEqual(["package-direction:unlisted"]);
  });

  it("reports each violation with its rule and both ends", async () => {
    const fixture = withFiles(repoPackage("packages/placeholder-shared"), {
      "src/broken.ts": 'import "./missing.ts";\n',
    });
    expect(await cruiseFixture([fixture])).toEqual([
      {
        rule: "not-to-unresolvable",
        from: "packages/placeholder-shared/src/broken.ts",
        to: "./missing.ts",
      },
    ]);
  });
});

describe("ruleNames", () => {
  it("sorts the rule names and lists each once", () => {
    const at = { from: "a", to: "b" };
    expect(
      ruleNames([
        { rule: "z", ...at },
        { rule: "a", ...at },
        { rule: "z", ...at },
      ]),
    ).toEqual(["a", "z"]);
  });
});
