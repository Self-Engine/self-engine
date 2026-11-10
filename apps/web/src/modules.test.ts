import { expect, test } from "vite-plus/test";
import { auditCommands, validateContributions } from "@self-engine/shell";
import { contributions } from "./modules.ts";

test("every installed module and Settings has valid, unambiguous addresses", () => {
  expect(() => validateContributions(contributions)).not.toThrow();
});

test("every Command has a unique full id and a schema that matches its kind", async () => {
  await expect(auditCommands(contributions)).resolves.toEqual([]);
});
