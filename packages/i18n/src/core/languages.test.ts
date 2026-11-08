import { describe, expect, test } from "vite-plus/test";
import { requiredLanguages } from "./index.ts";

describe("requiredLanguages", () => {
  test("requires English and German", () => {
    expect(requiredLanguages()).toEqual(["en", "de"]);
  });
});
