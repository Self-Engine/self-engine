import { expect, test } from "vite-plus/test";
import { retainedViewSearch } from "./view-search.ts";

test("cross-View links retain only declared shared filters and never edit", () => {
  expect(
    retainedViewSearch({ client: "a", page: 2, edit: "entry" }, "alpha", "alpha", [
      "client",
      "edit",
    ]),
  ).toEqual({ client: "a" });
});

test("module changes clear every filter, including identically named filters", () => {
  expect(retainedViewSearch({ client: "a" }, "alpha", "beta", ["client"])).toEqual({});
});
test("modules without sharedSearch retain nothing", () => {
  expect(retainedViewSearch({ client: "a" }, "alpha", "alpha")).toEqual({});
});
