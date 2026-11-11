import { expect, test } from "vite-plus/test";
import { afterArrival, searchText } from "./typed-view-search.ts";

test("a text in the address that nobody typed here is taken by the field", () => {
  expect(afterArrival([], "license")).toEqual({ written: [], adopt: true });
});

test("the newest typed text arriving means the address has caught up", () => {
  expect(afterArrival(["l", "li"], "li")).toEqual({ written: [], adopt: false });
});

test("an earlier key press arriving leaves the field alone while later ones follow", () => {
  expect(afterArrival(["l", "li", "lic"], "l")).toEqual({
    written: ["l", "li", "lic"],
    adopt: false,
  });
});

test("a text typed and taken back is forgotten once the address shows the field's text", () => {
  // "dark" was typed over "compact" and taken back before the address followed.
  const { written } = afterArrival(["dark", "compact"], "compact");
  // Back then brings "dark" from an earlier entry, which is not an echo of the typing.
  expect(afterArrival(written, "dark")).toEqual({ written: [], adopt: true });
});

test("a text from elsewhere wins over typing that never arrived", () => {
  expect(afterArrival(["a", "ab"], "license")).toEqual({ written: [], adopt: true });
});

test("the text of a search parameter is the text as typed, also when it reads as a number", () => {
  expect(searchText({ q: "dark" }, "q")).toBe("dark");
  expect(searchText({ q: 404 }, "q")).toBe("404");
  expect(searchText({ q: true }, "q")).toBe("true");
});

test("a search parameter that is absent or no text is the empty text", () => {
  expect(searchText({}, "q")).toBe("");
  expect(searchText({ q: ["a"] }, "q")).toBe("");
});
