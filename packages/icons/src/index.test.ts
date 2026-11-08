import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import * as catalog from "./index.ts";

const ICON_NAMES = [
  "ProjectsIcon",
  "TimeIcon",
  "FinanceIcon",
  "CalendarIcon",
  "HabitsIcon",
  "SettingsIcon",
  "AddIcon",
  "SearchIcon",
  "CloseIcon",
  "SendIcon",
  "AssistantIcon",
  "SidePanelIcon",
] as const;

describe.each(ICON_NAMES)("%s", (name) => {
  const markup = renderToStaticMarkup(createElement(catalog[name]));

  it("takes the color of the element around it", () => {
    expect(markup).toMatch(/^<svg [^>]*fill="currentColor"/);
  });

  it("is 1.125rem by default", () => {
    expect(markup).toMatch(/^<svg [^>]*width="1\.125rem" height="1\.125rem"/);
  });

  it.each([
    ["xs", "0.875rem"],
    ["sm", "1rem"],
    ["md", "1.125rem"],
    ["lg", "1.25rem"],
  ] as const)("is %s = %s", (size, rem) => {
    const sized = renderToStaticMarkup(createElement(catalog[name], { size }));
    expect(sized).toContain(`width="${rem}" height="${rem}"`);
  });
});

describe("the catalog", () => {
  it("exports exactly the starter icons", () => {
    expect(Object.keys(catalog).toSorted()).toEqual(ICON_NAMES.toSorted());
  });

  it("shows a different picture for every meaning", () => {
    const pictures = ICON_NAMES.map((name) =>
      renderToStaticMarkup(createElement(catalog[name])).replace(/^<svg [^>]*>/, ""),
    );
    expect(new Set(pictures).size).toBe(ICON_NAMES.length);
  });
});

describe("the props of an icon", () => {
  type Props = ComponentProps<typeof catalog.AddIcon>;

  it("leaves color, fill and weight to the catalog", () => {
    expectTypeOf<Props>().not.toHaveProperty("color");
    expectTypeOf<Props>().not.toHaveProperty("fill");
    expectTypeOf<Props>().not.toHaveProperty("weight");

    // @ts-expect-error The surrounding element decides the color.
    const color: Props = { color: "red" };
    // @ts-expect-error The surrounding element decides the color.
    const fill: Props = { fill: "red" };
    // @ts-expect-error Every icon has the regular weight.
    const weight: Props = { weight: "bold" };
    expect([color, fill, weight]).toHaveLength(3);
  });

  it("takes only the four named sizes", () => {
    expectTypeOf<NonNullable<Props["size"]>>().toEqualTypeOf<"xs" | "sm" | "md" | "lg">();

    // @ts-expect-error There are no free numbers.
    const number: Props = { size: 18 };
    // @ts-expect-error There are no free strings.
    const text: Props = { size: "1rem" };
    expect([number, text]).toHaveLength(2);
  });

  it("still passes everything else on to the svg", () => {
    expectTypeOf<Props>().toHaveProperty("className");
    const markup = renderToStaticMarkup(
      createElement(catalog.AddIcon, { className: "nav-icon", "aria-hidden": true }),
    );
    expect(markup).toMatch(/^<svg [^>]*class="nav-icon"/);
    expect(markup).toMatch(/^<svg [^>]*aria-hidden="true"/);
  });
});
