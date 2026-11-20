import { expect, test } from "vite-plus/test";
import { lintFixtures } from "../testing/lint-fixture.ts";

const RULE = "no-dom-in-time-core";

test("rejects the page's globals in the core of time, also through globalThis", () => {
  const results = lintFixtures(
    RULE,
    [
      "window.addEventListener('focus', listener);",
      "document.visibilityState;",
      "navigator.language;",
      "localStorage.getItem(key);",
      "const zone = globalThis.window;",
      'globalThis["document"];',
      "requestAnimationFrame(draw);",
    ],
    "packages/time/src",
  );
  expect(results.map((hits) => hits.length)).toEqual(Array(7).fill(1));
  expect(results.flat().every((hit) => hit.includes("src/react/"))).toBe(true);
});

test("rejects the page's globals taken out of globalThis by destructuring", () => {
  const results = lintFixtures(
    RULE,
    [
      "const { document: doc } = globalThis; doc.visibilityState;",
      "const { navigator } = globalThis;",
      "let storage; ({ localStorage: storage } = globalThis);",
    ],
    "packages/time/src",
  );
  expect(results.map((hits) => hits.length)).toEqual([1, 1, 1]);
});

test("allows destructuring of other objects and of other globals", () => {
  const results = lintFixtures(
    RULE,
    [
      "const { document, window } = page;",
      "const { setTimeout: later } = globalThis;",
      "function read(globalThis: { document: string }) { const { document } = globalThis; return document; }",
    ],
    "packages/time/src",
  );
  expect(results).toEqual([[], [], []]);
});

test("allows timers, shadowed names and property keys of the same spelling", () => {
  const results = lintFixtures(
    RULE,
    [
      "setTimeout(tick, 1000);",
      "const document = parse(text); document.title;",
      "function read(window: number) { return window + 1; }",
      "const options = { window: 1, document: 2 }; options.window;",
    ],
    "packages/time/src",
  );
  expect(results).toEqual([[], [], [], []]);
});

test("allows the page's globals in the React entry of time and outside time", () => {
  const source = "document.visibilityState; window.addEventListener('focus', listener);";
  expect(
    lintFixtures(RULE, [
      { path: "packages/time/src/react/visibility.ts", source },
      { path: "packages/ui/src/visible.ts", source },
      { path: "apps/web/src/page.ts", source },
    ]),
  ).toEqual([[], [], []]);
});
