import { expect, test } from "vite-plus/test";
import { describeDuration } from "./index.ts";

test("describes a duration through the shared package", () => {
  expect(describeDuration(130)).toBe("Tracked 2:10");
});
