import type { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { type ComponentProps, createElement } from "react";

// Phosphor's `Icon` type lives in `dist/lib/types`, which exists only as a declaration file and
// so does not resolve for the boundary check, and the barrel is off limits. Every icon has it.
type PhosphorIcon = typeof PlusIcon;

// Multiplied by Mantine's scale, so an icon follows the font scale like text does. Density does
// not change it.
const SIZES = { xs: "0.875rem", sm: "1rem", md: "1.125rem", lg: "1.25rem", xl: "1.5rem" };

// Phosphor passes unknown props on to the <svg>, so `fill` and `stroke` have to be ruled out here
// as well. `alt` and `mirrored` are Phosphor's own API, which callers must not come to rely on.
export type IconProps = Omit<
  ComponentProps<PhosphorIcon>,
  "alt" | "color" | "fill" | "mirrored" | "size" | "stroke" | "weight"
> & {
  size?: keyof typeof SIZES;
};

/** A catalog icon, made from one Phosphor icon. */
export function catalogIcon(SourceIcon: PhosphorIcon) {
  return function CatalogIcon({ size = "md", style, ...props }: IconProps) {
    const length = `calc(${SIZES[size]} * var(--mantine-scale))`;
    return createElement(SourceIcon, {
      ...props,
      // In CSS, because the svg's width and height attributes cannot hold a variable.
      style: { width: length, height: length, ...style },
      weight: "regular",
      color: "currentColor",
    });
  };
}
