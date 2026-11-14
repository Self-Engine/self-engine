import { describe, expect, it } from "vite-plus/test";
import { isIconName, OLD_ICON_NAMES } from "./index.ts";

const pairs = Object.entries(OLD_ICON_NAMES).flatMap(([kind, names]) =>
  Object.entries(names).map(([oldName, name]) => ({ kind, oldName, name })),
);

describe("OLD_ICON_NAMES", () => {
  it("holds the five lists of the old app with all their names", () => {
    const sizes = Object.fromEntries(
      Object.entries(OLD_ICON_NAMES).map(([kind, names]) => [kind, Object.keys(names).length]),
    );
    expect(sizes).toEqual({
      project: 36,
      habit: 43,
      bankAccount: 15,
      recurringCashflow: 20,
      taskStatus: 28,
    });
  });

  it("leads every old pair of kind and name to a name of the list", () => {
    expect(pairs.filter(({ name }) => !isIconName(name))).toEqual([]);
  });

  it("keeps the three pictures of `savings` apart", () => {
    expect(OLD_ICON_NAMES.habit.savings).toBe("coins");
    expect(OLD_ICON_NAMES.bankAccount.savings).toBe("shield-check");
    expect(OLD_ICON_NAMES.recurringCashflow.savings).toBe("piggy-bank");
  });

  it("leads several old names of one picture to one name", () => {
    expect(OLD_ICON_NAMES.project.fitness).toBe("barbell");
    expect(OLD_ICON_NAMES.recurringCashflow.gym).toBe("barbell");
    expect(OLD_ICON_NAMES.habit.barbell).toBe("barbell");
    expect(OLD_ICON_NAMES.bankAccount.piggy).toBe("piggy-bank");
  });

  it("translates names that meant something in one kind of entry", () => {
    expect(OLD_ICON_NAMES.recurringCashflow.rent).toBe("house");
    expect(OLD_ICON_NAMES.recurringCashflow.salary).toBe("briefcase");
    expect(OLD_ICON_NAMES.project.growth).toBe("chart-line-up");
    expect(OLD_ICON_NAMES.bankAccount.handCoins).toBe("hand-coins");
    expect(OLD_ICON_NAMES.taskStatus["x-circle"]).toBe("x-circle");
  });

  it("uses every picture of the list", () => {
    expect(new Set(pairs.map(({ name }) => name)).size).toBe(107);
  });
});
