import { type ComponentProps, useId } from "react";

const STAR_PATH = "M64 18Q69.5 64.5 92 70Q69.5 75.5 64 98Q58.5 75.5 36 70Q58.5 64.5 64 18Z";
const FACETS_PATH =
  "M64 70L64 10L124 10ZM64 70L124 70L124 130ZM64 70L64 130L4 130ZM64 70L4 70L4 10Z";

// The brand's own colors, from the theme engine. Variables, so a switch of the Color Mode repaints
// without a render.
const STAR_TOP = "var(--se-brand-star-top)";
const STAR_BOTTOM = "var(--se-brand-star-bottom)";
const RING = "var(--se-brand-ring)";
const FACETS = "var(--se-brand-facets)";

/** Multiplied by Mantine's scale, so the mark follows the font scale like the icons do. */
const LENGTH = "calc(1.75rem * var(--mantine-scale))";

/** The Northstar, Self-Engine's logo: the faceted star breaking out of its ring. */
export function BrandMark({ style, ...props }: ComponentProps<"svg">) {
  const id = useId();
  const starId = `${id}-star`;
  const clipId = `${id}-star-clip`;
  return (
    <svg
      aria-hidden
      viewBox="18 16 92 92"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      style={{ height: LENGTH, width: LENGTH, ...style }}
    >
      <defs>
        <linearGradient id={starId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: STAR_TOP }} />
          <stop offset="1" style={{ stopColor: STAR_BOTTOM }} />
        </linearGradient>
        <clipPath id={clipId}>
          <path d={STAR_PATH} />
        </clipPath>
      </defs>
      <circle cx="64" cy="70" fill="none" r="34" strokeWidth="5" style={{ stroke: RING }} />
      <path d={STAR_PATH} fill={`url(#${starId})`} />
      <path clipPath={`url(#${clipId})`} d={FACETS_PATH} style={{ fill: FACETS }} />
    </svg>
  );
}
