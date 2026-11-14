import { RocketLaunchIcon } from "@phosphor-icons/react/dist/csr/RocketLaunch";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { ICON_NAMES } from "../names/index.ts";
import { ICON_DIRECTORY } from "./index.ts";

const draw = (name: (typeof ICON_NAMES)[number], size?: "xs" | "sm" | "md" | "lg" | "xl") =>
  renderToStaticMarkup(createElement(ICON_DIRECTORY[name], size ? { size } : {}));

describe("the directory of pictures", () => {
  it("holds exactly the 107 names of the list", () => {
    expect(ICON_NAMES).toHaveLength(107);
    expect(Object.keys(ICON_DIRECTORY).toSorted()).toEqual([...ICON_NAMES].toSorted());
  });

  it("shows a different picture for every name", () => {
    const pictures = ICON_NAMES.map((name) => draw(name).replace(/^<svg [^>]*>/, ""));
    expect(new Set(pictures).size).toBe(107);
  });

  it("draws the picture of Phosphor's regular weight", () => {
    const picture = (markup: string) => markup.replace(/^<svg [^>]*>/, "");
    const regular = renderToStaticMarkup(createElement(RocketLaunchIcon, { weight: "regular" }));
    expect(picture(draw("rocket-launch"))).toBe(picture(regular));
  });

  it.each(ICON_NAMES)("draws %s like a catalog icon: regular, in the color around it", (name) => {
    const markup = draw(name);
    expect(markup).toMatch(/^<svg [^>]*fill="currentColor"/);
    // Only the duotone weight has a layer at a fifth of the opacity.
    expect(markup).not.toMatch(/opacity=/);
    expect(markup).not.toMatch(/<path [^>]*(fill|stroke)=/);
    expect(markup).toMatch(/width:calc\(1\.125rem \* var\(--mantine-scale\)\)/);
  });

  it.each([
    ["xs", "0.875rem"],
    ["sm", "1rem"],
    ["md", "1.125rem"],
    ["lg", "1.25rem"],
    ["xl", "1.5rem"],
  ] as const)("takes the named size %s = %s", (size, rem) => {
    const scaled = `calc(${rem} * var(--mantine-scale))`;
    expect(draw("rocket-launch", size)).toContain(`width:${scaled};height:${scaled}`);
  });
});
