// The app icon of each channel, drawn from the Northstar when the bundle is built: nothing
// generated is committed. Dev gets a PNG, which `main.ts` hands to the Dock; a release gets an
// `.icns`, which electron-builder puts into the app as it is (it would download a converter
// from GitHub for a PNG).

import { basename } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { ICON_COLORS, type IconColors, appIconSvg } from "@self-engine/icons/brand";
import type { Rolldown } from "vite-plus/pack";
import { type Channel, channelIdentity } from "./channel.ts";

/** Each channel its own pair of background and star, so the three apps differ in the Dock. */
export const CHANNEL_ICON_COLORS: Readonly<Record<Channel, IconColors>> = {
  dev: ICON_COLORS.petrol,
  nightly: ICON_COLORS.nightBlue,
  stable: ICON_COLORS.terracotta,
};

/** `svg` as a PNG `size` pixels wide. The icons hold no text, so no font is loaded. */
export function renderPng(svg: string, size: number): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

/**
 * The image types of an `.icns` and the pixel size of each: every size macOS asks for, at 1x
 * and 2x. Each holds a PNG, which macOS reads since 10.7.
 */
export const ICNS_TYPES = [
  ["icp4", 16],
  ["icp5", 32],
  ["ic11", 32],
  ["ic12", 64],
  ["ic07", 128],
  ["ic13", 256],
  ["ic08", 256],
  ["ic14", 512],
  ["ic09", 512],
  ["ic10", 1024],
] as const;

export interface IcnsImage {
  /** Four ASCII characters. */
  readonly type: string;
  readonly png: Buffer;
}

/** An `.icns`: the magic `icns` and the file's length, then each image with its type and length. */
export function encodeIcns(images: readonly IcnsImage[]): Buffer {
  const header = (type: string, length: number) => {
    const bytes = Buffer.alloc(8);
    bytes.write(type, 0, 4, "ascii");
    bytes.writeUInt32BE(length, 4);
    return bytes;
  };
  const entries = images.map(({ type, png }) => Buffer.concat([header(type, png.length + 8), png]));
  const length = entries.reduce((sum, entry) => sum + entry.length, 8);
  return Buffer.concat([header("icns", length), ...entries]);
}

/** The icon file of `channel`, as `channelIdentity(channel).icon` names it. */
export function appIconFile(channel: Channel): Buffer {
  const svg = appIconSvg(CHANNEL_ICON_COLORS[channel]);
  if (channelIdentity(channel).icon.endsWith(".png")) return renderPng(svg, 1024);
  const pngs = new Map<number, Buffer>();
  const pngOf = (size: number) => {
    const png = pngs.get(size) ?? renderPng(svg, size);
    pngs.set(size, png);
    return png;
  };
  return encodeIcns(ICNS_TYPES.map(([type, size]) => ({ type, png: pngOf(size) })));
}

/** Writes the channel's icon beside the main bundle, where `channelIdentity` points. */
export function appIcon(channel: Channel): Rolldown.Plugin {
  return {
    name: "self-engine:app-icon",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: basename(channelIdentity(channel).icon),
        source: appIconFile(channel),
      });
    },
  };
}
