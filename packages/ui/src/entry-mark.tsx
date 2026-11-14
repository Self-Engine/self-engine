// The mark of an entry: its icon or emoji in its color (D296). It is the one building block that
// draws an entry's icon, and it resolves the stored text itself (D294), so a value from a newer
// version shows the usual icon or the neutral look instead of an error.
//
// Its own entry of `ui`, because it imports the directory of 107 pictures, which never loads at
// startup (D293): a View that loads on demand imports it, and the startup check of the web app
// fails when startup code does.

import { Box, ThemeIcon } from "@mantine/core";
import { type CatalogIcon, type IconSize, iconLength } from "@self-engine/icons";
import { ICON_DIRECTORY } from "@self-engine/icons/directory";
import { resolveEntryIcon } from "@self-engine/icons/names";
import { colorSetColor, roleColor } from "@self-engine/theme";
import { type ColorSetName, resolveColorSetName } from "@self-engine/theme/names";
import type { CSSProperties } from "react";

/** The bare tinted icon, as the navigation draws a Module Color, or the soft tile for cards. */
export type EntryMarkForm = "bare" | "tile";

export interface EntryMarkProps {
  /** The stored `icon`: an icon name, one emoji, or anything else, which shows `defaultIcon`. */
  readonly icon: string | null | undefined;
  /** The stored `color`: a Color Set name, or anything else, which shows the neutral look. */
  readonly color: string | null | undefined;
  /** The usual icon of the kind of entry, such as `ProjectsIcon` for a project. */
  readonly defaultIcon: CatalogIcon;
  /** `"bare"` by default; `"tile"` for cards and detail headers. There is no filled tile. */
  readonly form?: EntryMarkForm;
  /** One of the five sizes of the icon catalog; the tile grows around it. */
  readonly size?: IconSize;
}

/**
 * The side of the soft tile against the icon in it: the icon keeps three eighths of its own side
 * as air on each side.
 */
const TILE_FACTOR = 1.75;

/** Colored text and soft fill: the Color Set's through its scope, or the neutral roles. */
function colorsOf(colorSet: ColorSetName | undefined) {
  return colorSet === undefined
    ? { text: roleColor("textMuted"), soft: roleColor("hover") }
    : { text: colorSetColor("accentText"), soft: colorSetColor("accentSoft") };
}

function emojiStyle(length: string): CSSProperties {
  return {
    alignItems: "center",
    display: "inline-flex",
    fontSize: length,
    height: length,
    justifyContent: "center",
    lineHeight: 1,
    width: length,
  };
}

/** The icon or emoji of an entry in its color. Decorative: the entry's title names it. */
export function EntryMark({
  icon,
  color,
  defaultIcon,
  form = "bare",
  size = "md",
}: EntryMarkProps) {
  const resolved = resolveEntryIcon(icon);
  const colorSet = resolveColorSetName(color);
  const { text, soft } = colorsOf(colorSet);
  const length = iconLength(size);
  const Picture = resolved.kind === "icon" ? ICON_DIRECTORY[resolved.name] : defaultIcon;
  const picture =
    resolved.kind === "emoji" ? (
      <span style={emojiStyle(length)}>{resolved.emoji}</span>
    ) : (
      <Picture size={size} />
    );

  if (form === "tile") {
    return (
      <ThemeIcon
        aria-hidden
        data-color-set={colorSet}
        variant="light"
        vars={() => ({
          root: {
            "--ti-size": `calc(${length} * ${TILE_FACTOR})`,
            "--ti-bg": soft,
            "--ti-color": text,
          },
        })}
      >
        {picture}
      </ThemeIcon>
    );
  }
  return (
    <Box
      aria-hidden
      component="span"
      data-color-set={colorSet}
      style={{ color: text, display: "inline-flex", flexShrink: 0 }}
    >
      {picture}
    </Box>
  );
}
