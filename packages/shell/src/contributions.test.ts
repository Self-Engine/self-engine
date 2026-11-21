import { type DataTexts, NO_DATA_TEXTS } from "@self-engine/data-client/react";
import { describe, expect, test } from "vite-plus/test";
import { z } from "zod";
import type {
  IndicatorPanelProps,
  ModuleIndicator,
  ModuleIndicatorWithPanelProps,
  OpenIndicatorPanel,
} from "./module-indicator.ts";
import {
  defineContribution,
  type ShellContribution,
  validateContributions,
} from "./contributions.ts";
import { definePageCommand, type ShellCommand } from "./commands.ts";

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
  test("accepts the same command id in two modules", () => {
    const commands = [{ id: "create-entry" }];
    expect(() =>
      validateContributions([
        { ...moduleWith("alpha"), commands },
        { ...moduleWith("beta"), commands },
      ]),
    ).not.toThrow();
  });
  test("rejects duplicate and unsafe command ids", () => {
    for (const commands of [[{ id: "create" }, { id: "create" }], [{ id: "not/safe" }]])
      expect(() => validateContributions([{ ...moduleWith("beta"), commands }])).toThrow();
  });
});

const create = {
  id: "create",
  kind: "page",
  label: { id: "Create" },
  load: async () => ({
    default: definePageCommand({
      description: "Creates a thing.",
      schema: z.object({}),
      run: () => undefined,
    }),
  }),
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
  expect(() => validateContributions([contribution])).not.toThrow();
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

test("a contribution promises data texts only when it was given them", () => {
  const texts = NO_DATA_TEXTS;
  const withTexts = defineContribution({ ...base, dataTexts: texts });
  expect(withTexts.dataTexts).toBe(texts);
  const promised: DataTexts = withTexts.dataTexts;
  void promised;
  const without = defineContribution(base);
  // @ts-expect-error A contribution made without data texts does not claim to have them.
  const missing: DataTexts = without.dataTexts;
  // @ts-expect-error Naming the type of the data texts does not make them optional.
  const named = defineContribution<readonly [], DataTexts>(base);
  void [missing, named];
});

test("a contribution keeps data texts its input reads through a getter", () => {
  class WithTexts {
    readonly id = base.id;
    readonly name = base.name;
    readonly icon = base.icon;
    readonly color = base.color;
    readonly views = base.views;
    get dataTexts() {
      return NO_DATA_TEXTS;
    }
  }
  expect(defineContribution(new WithTexts()).dataTexts).toBe(NO_DATA_TEXTS);
});

test("a Module Indicator is one entry of its contribution, which a panel can only join", () => {
  const indicator = { load: async () => ({ default: () => null }) };
  expect(defineContribution({ ...base, indicator }).indicator).toBe(indicator);
  const panel = async () => ({ default: ({ onDone }: IndicatorPanelProps) => void onDone });
  const withPanel = {
    load: async () => ({
      default: ({ togglePanel }: ModuleIndicatorWithPanelProps) => void togglePanel,
    }),
    panel,
  };
  expect(defineContribution({ ...base, indicator: withPanel }).indicator).toBe(withPanel);
  // An indicator that does not use the function may still declare a panel.
  defineContribution({ ...base, indicator: { ...indicator, panel } });
  defineContribution({
    ...base,
    // @ts-expect-error A panel has no entry of its own beside the indicator.
    panel,
  });
  defineContribution({
    ...base,
    // @ts-expect-error An indicator declared without a panel receives no function to open one.
    indicator: { load: withPanel.load },
  });
});

// Compiled, not run: the Shell's function opens only a panel that its indicator declared.
function onlyAPanelThatExistsOpens(open: OpenIndicatorPanel, declared: ModuleIndicator) {
  const withPanel = {
    load: async () => ({ default: () => null }),
    panel: async () => ({ default: () => null }),
  };
  open(withPanel);
  // @ts-expect-error An indicator without a panel has nothing to open.
  open({ load: async () => ({ default: () => null }) });
  // @ts-expect-error The union of both forms may be one without a panel.
  open(declared);
}
void onlyAPanelThatExistsOpens;
