import { describe, expect, test } from "vite-plus/test";
import { defineContribution, validateContributions } from "./contributions.ts";

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

// Module authors use this seam to constrain a direct action reference to their commands.
function commandMembershipContract() {
  const create = {
    id: "create",
    label: { id: "Create" },
    load: async () => ({ default: () => {} }),
  } as const;
  const foreign = { ...create, id: "foreign" } as const;
  const base = {
    id: "example",
    name: { id: "Example" },
    icon: () => null,
    color: "blue",
    views: [
      { id: "overview", title: { id: "Overview" }, load: async () => ({ default: () => null }) },
    ],
  } as const;
  defineContribution({ ...base, commands: [create], primaryAction: create });
  // @ts-expect-error A main action must belong to the declared commands.
  defineContribution({ ...base, commands: [create], primaryAction: foreign });
  // @ts-expect-error A main action requires commands.
  defineContribution({ ...base, primaryAction: create });
}
void commandMembershipContract;
