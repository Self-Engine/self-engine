import { describe, expect, it } from "vite-plus/test";
import { cruiseFixture, packageName, ruleNames, withFiles } from "./cruise-fixture.ts";

const lower = { dir: "packages/lower", files: { "src/index.ts": "export const a = 1;\n" } };

describe("packageName", () => {
  it("scopes the folder name", () => {
    expect(packageName("apps/desktop")).toBe("@self-engine/desktop");
  });
});

describe("withFiles", () => {
  it("adds files and replaces those of the same path", () => {
    const changed = withFiles(lower, { "src/index.ts": "x", "src/b.ts": "y" });
    expect(changed.files).toEqual({ "src/index.ts": "x", "src/b.ts": "y" });
  });
});

describe("cruiseFixture", () => {
  const upper = {
    dir: "packages/upper",
    dependencies: ["@self-engine/lower"],
    files: { "src/index.ts": 'import { a } from "@self-engine/lower";\nexport const b = a;\n' },
  };

  it("links declared workspace packages, so an import by name resolves", async () => {
    // Resolved (no not-to-unresolvable); `upper` is not in allowedImports, so it may not.
    expect(ruleNames(await cruiseFixture([lower, upper]))).toEqual(["package-direction:unlisted"]);
  });

  it("applies the allowed imports it is given", async () => {
    expect(await cruiseFixture([lower, upper], { allowedImports: { upper: ["lower"] } })).toEqual(
      [],
    );
  });

  it("links root dependencies into the root node_modules", async () => {
    const undeclared = { ...upper, dependencies: [] };
    expect(
      ruleNames(
        await cruiseFixture([lower, undeclared], {
          allowedImports: { upper: ["lower"] },
          rootDependencies: ["@self-engine/lower"],
        }),
      ),
    ).toEqual(["declared-workspace-dependency:packages/upper"]);
  });

  it("refuses a root dependency that is no fixture package", async () => {
    await expect(cruiseFixture([lower], { rootDependencies: ["@self-engine/x"] })).rejects.toThrow(
      /not a fixture package/,
    );
  });

  it("reports each violation with its rule and both ends", async () => {
    const fixture = withFiles(lower, { "src/broken.ts": 'import "./missing.ts";\n' });
    expect(await cruiseFixture([fixture])).toEqual([
      { rule: "not-to-unresolvable", from: "packages/lower/src/broken.ts", to: "./missing.ts" },
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
