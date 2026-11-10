import { describe, expect, test } from "vite-plus/test";
import { parseAddressSearch, stringifyAddressSearch } from "./address-search.ts";

describe("the edit id in an address", () => {
  test.each([
    ["?edit=42", "42"],
    ["?edit=1e5", "1e5"],
    ["?edit=true", "true"],
    ["?edit=null", "null"],
    ["?edit=%2242%22", '"42"'],
    ["?edit=new", "new"],
  ])("%s keeps its exact text", (address, id) => {
    expect(parseAddressSearch(address)).toEqual({ edit: id });
  });

  test.each(["42", "1e5", "true", "new", "a b/c"])("%s survives writing and reading", (id) => {
    expect(parseAddressSearch(stringifyAddressSearch({ edit: id }))).toEqual({ edit: id });
  });

  test("a number is written without quotes", () => {
    expect(stringifyAddressSearch({ edit: "42" })).toBe("?edit=42");
  });

  test("keeps the order of the parameters, so an address stays canonical", () => {
    expect(stringifyAddressSearch(parseAddressSearch("?edit=1&client=studio"))).toBe(
      "?edit=1&client=studio",
    );
  });
});

test("other parameters keep the router's parsing and quoting", () => {
  expect(parseAddressSearch("?page=2&client=studio")).toEqual({ page: 2, client: "studio" });
  expect(stringifyAddressSearch({ code: "42" })).toBe("?code=%2242%22");
  expect(stringifyAddressSearch({})).toBe("");
});
