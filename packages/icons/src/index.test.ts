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
  "ErrorIcon",
  "ThemeColorsIcon",
] as const;

describe.each(ICON_NAMES)("%s", (name) => {
  const markup = renderToStaticMarkup(createElement(catalog[name]));

  it("takes the color of the element around it", () => {
    expect(markup).toMatch(/^<svg [^>]*fill="currentColor"/);
  });

  it("is drawn in the duotone weight, its fill layer in the same color", () => {
    // Phosphor's duotone weight lays a shape at a fifth of the opacity under the line drawing;
    // no other weight has it.
    expect(markup).toMatch(/<path [^>]*opacity="0\.2"/);
    expect(markup).not.toMatch(/<path [^>]*(fill|stroke)=/);
  });

  it("is 1.125rem by default, grown by the font scale", () => {
    expect(markup).toMatch(
      /^<svg [^>]*style="[^"]*width:calc\(1\.125rem \* var\(--mantine-scale\)\)/,
    );
  });

  it.each([
    ["xs", "0.875rem"],
    ["sm", "1rem"],
    ["md", "1.125rem"],
    ["lg", "1.25rem"],
    ["xl", "1.5rem"],
  ] as const)("is %s = %s, grown by the font scale", (size, rem) => {
    const sized = renderToStaticMarkup(createElement(catalog[name], { size }));
    const scaled = `calc(${rem} * var(--mantine-scale))`;
    expect(sized).toContain(`width:${scaled};height:${scaled}`);
  });
});

describe("the catalog", () => {
  it("exports exactly the starter icons, beside the length of a named size", () => {
    expect(Object.keys(catalog).toSorted()).toEqual([...ICON_NAMES, "iconLength"].toSorted());
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

  it("leaves color, fill, stroke and weight to the catalog", () => {
    expectTypeOf<Props>().not.toHaveProperty("color");
    expectTypeOf<Props>().not.toHaveProperty("fill");
    expectTypeOf<Props>().not.toHaveProperty("stroke");
    expectTypeOf<Props>().not.toHaveProperty("weight");

    // @ts-expect-error The surrounding element decides the color.
    const color: Props = { color: "red" };
    // @ts-expect-error The surrounding element decides the color.
    const fill: Props = { fill: "red" };
    // @ts-expect-error The surrounding element decides the color.
    const stroke: Props = { stroke: "red" };
    // @ts-expect-error Every icon has the duotone weight.
    const weight: Props = { weight: "bold" };
    expect([color, fill, stroke, weight]).toHaveLength(4);
  });

  it("does not expose the props only Phosphor has", () => {
    expectTypeOf<Props>().not.toHaveProperty("alt");
    expectTypeOf<Props>().not.toHaveProperty("mirrored");

    // @ts-expect-error Accessibility of icons is still undecided.
    const alt: Props = { alt: "Add" };
    // @ts-expect-error A change of icon library must stay a change of one mapping.
    const mirrored: Props = { mirrored: true };
    expect([alt, mirrored]).toHaveLength(2);
  });

  it("takes only the five named sizes", () => {
    expectTypeOf<NonNullable<Props["size"]>>().toEqualTypeOf<"xs" | "sm" | "md" | "lg" | "xl">();

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

  it("keeps a style of the caller beside its own size", () => {
    const markup = renderToStaticMarkup(
      createElement(catalog.AddIcon, { style: { opacity: 0.5 } }),
    );
    expect(markup).toMatch(/^<svg [^>]*style="[^"]*opacity:0\.5/);
    expect(markup).toMatch(/^<svg [^>]*style="[^"]*width:calc\(/);
  });
});
