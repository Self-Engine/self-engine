import type { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { type ComponentProps, createElement } from "react";

// Phosphor's `Icon` type lives in `dist/lib/types`, which exists only as a declaration file and
// so does not resolve for the boundary check, and the barrel is off limits. Every icon has it.
type PhosphorIcon = typeof PlusIcon;

// In rem, so an icon follows the font scale like text does. Density does not change it.
const SIZES = { xs: "0.875rem", sm: "1rem", md: "1.125rem", lg: "1.25rem" };

// Phosphor passes unknown props on to the <svg>, so `fill` has to be ruled out here as well.
type IconProps = Omit<ComponentProps<PhosphorIcon>, "color" | "fill" | "size" | "weight"> & {
  size?: keyof typeof SIZES;
};

/** A catalog icon, made from one Phosphor icon. */
export function catalogIcon(Phosphor: PhosphorIcon) {
  return function CatalogIcon({ size = "md", ...props }: IconProps) {
    return createElement(Phosphor, {
      ...props,
      size: SIZES[size],
      weight: "regular",
      color: "currentColor",
    });
  };
}
