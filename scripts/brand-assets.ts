// `pnpm brand`: the Northstar's files outside the app, drawn from `@self-engine/icons/brand`.
// It writes the README logo (the one generated file the repository holds, because a README can
// show only files of its repository) and GitHub's pictures into `.temp/brand/`, for a person to
// upload: the organization's avatar and the repository's social preview. The desktop icons are
// drawn by the desktop build itself (apps/desktop/src/app-icon.ts).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import {
  ICON_COLORS,
  README_MARK_COLORS,
  avatarSvg,
  bannerSvg,
  markSvg,
} from "@self-engine/icons/brand";

/** The README logo for GitHub's light and dark page, by path in the repository. */
export function readmeLogos(): Record<string, string> {
  return {
    ".github/brand/logo-light.svg": markSvg(README_MARK_COLORS.light),
    ".github/brand/logo-dark.svg": markSvg(README_MARK_COLORS.dark),
  };
}

function renderPng(svg: string, width: number): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: true, defaultFontFamily: "Helvetica Neue" },
  });
  return resvg.render().asPng();
}

/** The pictures GitHub takes as uploads, by file name, in the sizes it asks for. */
export function githubPictures(): Record<string, Buffer> {
  return {
    "avatar.png": renderPng(avatarSvg(ICON_COLORS.terracotta), 500),
    "social-preview.png": renderPng(
      bannerSvg(ICON_COLORS.terracotta, {
        title: "Self-Engine",
        lines: [
          "Local-first app for organizing life and work",
          "Projects · Time · Finance · Calendar · Habits",
        ],
      }),
      1280,
    ),
  };
}

function write(file: string, content: string | Buffer): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  console.log(`brand: wrote ${file}`);
}

function main(): void {
  const root = resolve(import.meta.dirname, "..");
  for (const [path, svg] of Object.entries(readmeLogos())) write(join(root, path), svg);
  for (const [name, png] of Object.entries(githubPictures())) {
    write(join(root, ".temp/brand", name), png);
  }
  console.log(
    "brand: upload avatar.png in the organization's settings and social-preview.png under Settings → General → Social preview.",
  );
}

if (import.meta.main) main();
