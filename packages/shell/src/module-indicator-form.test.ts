import { expect, test } from "vite-plus/test";
import { indicatorForm } from "./module-indicator-form.ts";

test("a Module Indicator shows its full form on the wide and medium step, its short form on the narrow step and the phone", () => {
  expect(indicatorForm("wide")).toBe("full");
  expect(indicatorForm("medium")).toBe("full");
  expect(indicatorForm("narrow")).toBe("short");
  expect(indicatorForm("phone")).toBe("short");
});
