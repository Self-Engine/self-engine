import { basename } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  CHANNEL_ICON_COLORS,
  ICNS_TYPES,
  appIcon,
  appIconFile,
  encodeIcns,
  renderPng,
} from "./app-icon.ts";
import { CHANNELS, bundleDirectory, channelIdentity } from "./channel.ts";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** The width and height in a PNG's IHDR chunk. */
function pngSize(png: Buffer): [number, number] {
  expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

/** The images of an `.icns`, read back by type and length. */
function readIcns(file: Buffer): { type: string; png: Buffer }[] {
  expect(file.toString("ascii", 0, 4)).toBe("icns");
  expect(file.readUInt32BE(4)).toBe(file.length);
  const images = [];
  for (let offset = 8; offset < file.length;) {
    const length = file.readUInt32BE(offset + 4);
    images.push({
      type: file.toString("ascii", offset, offset + 4),
      png: file.subarray(offset + 8, offset + length),
    });
    offset += length;
  }
  return images;
}

describe("CHANNEL_ICON_COLORS", () => {
  it.each(["backgroundStart", "starTop"] as const)("gives every channel its own %s", (field) => {
    const values = CHANNELS.map((channel) => CHANNEL_ICON_COLORS[channel][field]);
    expect(new Set(values).size).toBe(CHANNELS.length);
  });
});

describe("renderPng", () => {
  it("renders at the width asked for", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>';
    expect(pngSize(renderPng(svg, 48))).toEqual([48, 48]);
  });
});

describe("encodeIcns", () => {
  it("frames each image with its type and length", () => {
    const file = encodeIcns([
      { type: "ic07", png: Buffer.from("abc") },
      { type: "ic08", png: Buffer.from("de") },
    ]);
    expect(file.length).toBe(8 + 11 + 10);
    expect(readIcns(file)).toEqual([
      { type: "ic07", png: Buffer.from("abc") },
      { type: "ic08", png: Buffer.from("de") },
    ]);
  });
});

describe("appIconFile", () => {
  it("draws dev's icon as a 1024-pixel PNG for the Dock", () => {
    expect(channelIdentity("dev").icon.endsWith(".png")).toBe(true);
    expect(pngSize(appIconFile("dev"))).toEqual([1024, 1024]);
  });

  it.each(["nightly", "stable"] as const)("draws every size macOS asks for into %s", (channel) => {
    expect(channelIdentity(channel).icon.endsWith(".icns")).toBe(true);
    const images = readIcns(appIconFile(channel));
    expect(images.map(({ type }) => type)).toEqual(ICNS_TYPES.map(([type]) => type));
    for (const [index, { png }] of images.entries()) {
      const size = ICNS_TYPES[index]![1];
      expect(pngSize(png)).toEqual([size, size]);
    }
  });
});

describe("appIcon", () => {
  it.each(CHANNELS)("writes the icon of %s into its bundle folder", (channel) => {
    const { icon } = channelIdentity(channel);
    expect(icon).toBe(`${bundleDirectory(channel)}/${basename(icon)}`);
    const emitted: unknown[] = [];
    const plugin = appIcon(channel);
    const generateBundle = plugin.generateBundle as (this: unknown) => void;
    generateBundle.call({ emitFile: (file: unknown) => emitted.push(file) });
    expect(emitted).toEqual([
      { type: "asset", fileName: basename(icon), source: appIconFile(channel) },
    ]);
  });
});
