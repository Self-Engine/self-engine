import { expect, test } from "vite-plus/test";
import { greet } from "./index.ts";

test("greets by name", () => {
  expect(greet("Self-Engine")).toBe("Hello, Self-Engine!");
});
