import { expect, it } from "vite-plus/test";
import { options } from "./measure-renders.ts";

it("takes an output and a prior code-state report without making comparison a gate", () => {
  expect(options(["--output", ".temp/after.json", "--compare", ".temp/before.json"])).toEqual({
    output: ".temp/after.json",
    compare: ".temp/before.json",
  });
  expect(options([]).output).toBe(".temp/renders/current.json");
  expect(() => options(["--unknown"])).toThrow();
});
