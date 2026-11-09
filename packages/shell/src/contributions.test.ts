import { describe, expect, test } from "vite-plus/test";
import { validateContributions } from "./contributions.ts";

const moduleWith = (id: string, views = [{ id: "overview" }]) => ({ id, views });

describe("contribution addresses", () => {
  test("accepts modules with independent view namespaces", () => {
    expect(() => validateContributions([moduleWith("beta"), moduleWith("settings")])).not.toThrow();
  });
  test("rejects duplicate modules, duplicate views, unsafe ids and empty modules", () => {
    for (const contributions of [
      [moduleWith("beta"), moduleWith("beta")],
      [moduleWith("beta", [{ id: "overview" }, { id: "overview" }])],
      [moduleWith("bad/id")],
      [moduleWith("beta", [{ id: "Bad View" }])],
      [moduleWith("beta", [])],
    ])
      expect(() => validateContributions(contributions)).toThrow();
  });
});
