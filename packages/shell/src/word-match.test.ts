import { expect, test } from "vite-plus/test";
import { INSIDE_A_WORD, WORD_START, wordMatch } from "./word-match.ts";

test("a query at the start of the text or of a later word is a word start", () => {
  expect(wordMatch("font scale", "fo")).toBe(WORD_START);
  expect(wordMatch("font scale", "sc")).toBe(WORD_START);
  expect(wordMatch("row-height", "he")).toBe(WORD_START);
});

test("a query that only stands inside words is a match inside a word", () => {
  expect(wordMatch("font scale", "al")).toBe(INSIDE_A_WORD);
});

test("a word start anywhere beats an earlier match inside a word", () => {
  expect(wordMatch("unopened open", "open")).toBe(WORD_START);
});

test("a letter with an accent or an umlaut belongs to its word", () => {
  expect(wordMatch("schriftgröße", "ße")).toBe(INSIDE_A_WORD);
});

test("a text without the query is no match, and a typo finds nothing", () => {
  expect(wordMatch("font scale", "fnt")).toBeUndefined();
});

test("a word start ranks before a match inside a word", () => {
  expect(WORD_START).toBeLessThan(INSIDE_A_WORD);
});
