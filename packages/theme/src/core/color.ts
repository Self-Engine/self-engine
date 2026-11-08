import { formatHex, interpolate } from "culori";
import type { Hex } from "./roles.ts";

interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

function parseHex(hex: Hex): Rgba {
  const channel = (start: number) => Number.parseInt(hex.slice(start, start + 2), 16);
  const a = hex.length === 9 ? channel(7) / 255 : 1;
  return { r: channel(1), g: channel(3), b: channel(5), a };
}

function toHex({ r, g, b }: Omit<Rgba, "a">): Hex {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** `top` with its own alpha times `opacity` over the opaque `bottom`, as the browser composes it. */
export function composite(top: Hex, bottom: Hex, opacity = 1): Hex {
  const front = parseHex(top);
  const back = parseHex(bottom);
  const alpha = front.a * opacity;
  const mix = (over: number, under: number) => over * alpha + under * (1 - alpha);
  return toHex({ r: mix(front.r, back.r), g: mix(front.g, back.g), b: mix(front.b, back.b) });
}

/** `amount` (0 to 1) of the opaque `color` mixed into the opaque `base` in Oklab, as sRGB. */
export function mixOklab(base: Hex, color: Hex, amount: number): Hex {
  return formatHex(interpolate([base, color], "oklab")(amount)) as Hex;
}

/** WCAG relative luminance of an opaque color, from 0 (black) to 1 (white). */
export function luminance(hex: Hex): number {
  const { r, g, b } = parseHex(hex);
  const linear = (value: number) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** The WCAG 2 contrast ratio of two opaque colors, from 1 to 21. */
export function contrastRatio(first: Hex, second: Hex): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (lighter + 0.05) / (darker + 0.05);
}
