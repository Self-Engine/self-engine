import { describe, expect, test } from "vite-plus/test";
import {
  defineContribution,
  type ShellCommand,
  type ShellContribution,
  validateContributions,
} from "./contributions.ts";

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

test("keeps the declared command reference and rejects a lookalike action", () => {
  const contribution = defineContribution({ ...base, commands: [create], primaryAction: create });
  expect(contribution.primaryAction).toBe(create);
  expect(contribution.commands).toEqual([create]);
  // Structural typing cannot distinguish two objects with identical fields.
  expect(() =>
    defineContribution({ ...base, commands: [create], primaryAction: { ...create } }),
  ).toThrow("The primary action must reference one of the contribution's commands");
});

// Module authors use this seam to constrain a direct action reference to their commands.
function commandMembershipContract() {
  defineContribution({ ...base, commands: [create], primaryAction: create });
  const unrelated = {
    ...base,
    commands: [create],
    primaryAction: foreign,
    // @ts-expect-error Raw objects cannot bypass main-action membership validation.
  } satisfies ShellContribution;
  // @ts-expect-error Raw objects cannot supply an action without commands.
  const missingCommands = { ...base, primaryAction: create } satisfies ShellContribution;
  // @ts-expect-error An annotation must not bypass membership validation either.
  const annotated: ShellContribution = { ...base, commands: [create], primaryAction: foreign };
  const checked = defineContribution({ ...base, commands: [create], primaryAction: create });
  const replaced = {
    // oxlint-disable-next-line typescript/no-misused-spread -- Intentionally test a forged copy.
    ...checked,
    commands: [create],
    primaryAction: foreign,
    // @ts-expect-error Spreading a checked contribution must not permit replacing its action.
  } satisfies ShellContribution;
  const widened: readonly ShellCommand[] = [create];
  // @ts-expect-error Widened ids cannot prove command membership.
  defineContribution({ ...base, commands: widened, primaryAction: foreign });
  void [unrelated, missingCommands, annotated, replaced];
  // @ts-expect-error A main action must belong to the declared commands.
  defineContribution({ ...base, commands: [create], primaryAction: foreign });
  // @ts-expect-error A main action requires commands.
  defineContribution({ ...base, primaryAction: create });
}
void commandMembershipContract;
