import { expect, test } from "vite-plus/test";
import { validateContributions } from "@self-engine/shell";
import { contributions } from "./modules.ts";

test("every installed module and Settings has valid, unambiguous addresses", () => {
  expect(() => validateContributions(contributions)).not.toThrow();
});
