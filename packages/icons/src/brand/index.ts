// The Northstar as data and as SVG documents (`@self-engine/icons/brand`). This entry loads
// neither React nor the icon library, so the desktop build and the repo scripts run it in Node.

export {
  CROP,
  FACETS_PATH,
  ICON_COLORS,
  type IconColors,
  type NorthstarColors,
  README_MARK_COLORS,
  RING,
  STAR_PATH,
} from "./northstar.ts";
export { appIconSvg, avatarSvg, type BannerText, bannerSvg, markSvg } from "./northstar-svg.ts";
