// The Northstar as standalone SVG documents, for the files generated from it. Pure strings: the
// desktop build and the repo scripts call these in Node, without React or a DOM.

import {
  CROP,
  FACETS_PATH,
  type IconColors,
  type NorthstarColors,
  RING,
  STAR_PATH,
} from "./northstar.ts";

const CENTER_X = CROP.x + CROP.size / 2;
const CENTER_Y = CROP.y + CROP.size / 2;

/** Ring, star and facets, centred on (x, y), at `scale` units per source unit. */
function artwork(colors: NorthstarColors, x: number, y: number, scale: number): string {
  return `<defs>
    <linearGradient id="star" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${colors.starTop}"/>
      <stop offset="1" stop-color="${colors.starBottom}"/>
    </linearGradient>
    <clipPath id="star-clip">
      <path d="${STAR_PATH}"/>
    </clipPath>
  </defs>
  <g transform="translate(${x} ${y}) scale(${scale}) translate(${-CENTER_X} ${-CENTER_Y})">
    <circle cx="${RING.cx}" cy="${RING.cy}" r="${RING.r}" fill="none" stroke="${colors.ring}" stroke-opacity="${colors.ringOpacity}" stroke-width="${RING.strokeWidth}"/>
    <path d="${STAR_PATH}" fill="url(#star)"/>
    <path d="${FACETS_PATH}" fill="${colors.facet}" fill-opacity="${colors.facetOpacity}" clip-path="url(#star-clip)"/>
  </g>`;
}

function background(colors: IconColors): string {
  return `<defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colors.backgroundStart}"/>
      <stop offset="1" stop-color="${colors.backgroundEnd}"/>
    </linearGradient>
  </defs>`;
}

function escapeText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * A macOS app icon, 1024 units square: the rounded tile covers 824 units with a margin of 100,
 * as Apple's icon grid lays it out. macOS draws a Dock icon as it is, without a mask of its own.
 */
export function appIconSvg(colors: IconColors): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  ${background(colors)}
  <rect x="100" y="100" width="824" height="824" rx="184" fill="url(#background)"/>
  ${artwork(colors, 512, 512, 6.4)}
</svg>
`;
}

/** A square picture filled to the edge, for an avatar a host crops to its own shape. */
export function avatarSvg(colors: IconColors): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${background(colors)}
  <rect width="512" height="512" fill="url(#background)"/>
  ${artwork(colors, 256, 256, 4)}
</svg>
`;
}

export interface BannerText {
  readonly title: string;
  readonly lines: readonly [string, string];
}

/** A 1280 × 640 banner: the mark on the left, a title and two lines beside it. */
export function bannerSvg(colors: IconColors, text: BannerText): string {
  const font = "Helvetica Neue, Helvetica, Arial, sans-serif";
  const [first, second] = text.lines;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640">
  ${background(colors)}
  <rect width="1280" height="640" fill="url(#background)"/>
  ${artwork(colors, 330, 320, 3.6)}
  <text x="560" y="300" font-family="${font}" font-size="92" font-weight="700" fill="${colors.starTop}">${escapeText(text.title)}</text>
  <text x="562" y="370" font-family="${font}" font-size="34" fill="${colors.ring}" fill-opacity="0.85">${escapeText(first)}</text>
  <text x="562" y="420" font-family="${font}" font-size="26" fill="${colors.ring}" fill-opacity="0.6">${escapeText(second)}</text>
</svg>
`;
}

/** The transparent mark, framed to its crop square. */
export function markSvg(colors: NorthstarColors): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CROP.size} ${CROP.size}">
  ${artwork(colors, CROP.size / 2, CROP.size / 2, 1)}
</svg>
`;
}
