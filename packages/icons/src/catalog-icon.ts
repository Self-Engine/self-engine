import type { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { type ComponentProps, createElement, type ReactElement } from "react";

// Phosphor's `Icon` type lives in `dist/lib/types`, which exists only as a declaration file and
// so does not resolve for the boundary check, and the barrel is off limits. Every icon has it.
type PhosphorIcon = typeof PlusIcon;

// Multiplied by Mantine's scale, so an icon follows the font scale like text does. Density does
// not change it.
const SIZES = { xs: "0.875rem", sm: "1rem", md: "1.125rem", lg: "1.25rem", xl: "1.5rem" };

/** The five named sizes of an icon. */
export type IconSize = keyof typeof SIZES;

/** The side of an icon of `size` as CSS, grown by the font scale: for what sits beside an icon. */
export function iconLength(size: IconSize): string {
  return `calc(${SIZES[size]} * var(--mantine-scale))`;
}

// Phosphor passes unknown props on to the <svg>, so `fill` and `stroke` have to be ruled out here
// as well. `alt` and `mirrored` are Phosphor's own API, which callers must not come to rely on.
export type IconProps = Omit<
  ComponentProps<PhosphorIcon>,
  "alt" | "color" | "fill" | "mirrored" | "size" | "stroke" | "weight"
> & {
  size?: IconSize;
};

/** An icon of the catalog: a picture that takes only the closed props. */
export type CatalogIcon = (props: IconProps) => ReactElement;

/** A catalog icon, made from one Phosphor icon. */
export function catalogIcon(SourceIcon: PhosphorIcon): CatalogIcon {
  return function CatalogIcon({ size = "md", style, ...props }: IconProps) {
    const length = iconLength(size);
    return createElement(SourceIcon, {
      ...props,
      // In CSS, because the svg's width and height attributes cannot hold a variable.
      style: { width: length, height: length, ...style },
      weight: "regular",
      color: "currentColor",
    });
  };
}
