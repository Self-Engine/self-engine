import { expect, test } from "vite-plus/test";
import { formatMinutes } from "./index.ts";

test("formats minutes as hours and padded minutes", () => {
  expect(formatMinutes(65)).toBe("1:05");
});
