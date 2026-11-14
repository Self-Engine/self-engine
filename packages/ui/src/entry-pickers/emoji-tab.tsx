// The Emoji tab of the icon field (D300): Mantine's bare `EmojiPicker` with our texts. The field
// imports this file dynamically when the tab first opens, so the picker, its stylesheet and its
// virtual list stay out of the startup code and out of the field's own chunk; the startup check
// of the web app holds that (#268). It passes on the data loader of `emoji-data.ts`, so the one
// dynamic import of this file brings the tab and the loader of its data together; the data of
// each language is a dynamic import of its own.

import "@mantine/emoji/styles.css";
import { useLingui } from "@lingui/react/macro";
import { EmojiPicker, type EmojiPickerData, type EmojiPickerLabels } from "@mantine/emoji";
import { useMemo } from "react";

export { emojiLanguageOf, loadEmojiData } from "./emoji-data.ts";

export interface EmojiTabProps {
  /** The emoji list in the app's language, from `loadEmojiData`. */
  readonly data: EmojiPickerData;
  /** One emoji, in the skin tone the user chose. */
  readonly onChoose: (emoji: string) => void;
  /** Whether the search field takes the focus when the tab appears. */
  readonly autoFocus: boolean;
  /** The search term, shared with the Icons tab (D301); Mantine's own field shows it. */
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
}

/** The emoji grid with its search, categories, skin tones and preview, in the app's language. */
export function EmojiTab({ data, onChoose, autoFocus, query, onQueryChange }: EmojiTabProps) {
  const { t } = useLingui();
  // Kept per language: the picker hands its texts to every emoji in the grid through a context.
  const labels = useMemo<Required<EmojiPickerLabels>>(
    () => ({
      search: t`Search emojis`,
      skinTone: t`Skin tone`,
      noResults: t`No emoji matches the search.`,
      skinToneDefault: t`Default skin tone`,
      skinToneLight: t`Light skin tone`,
      skinToneMediumLight: t`Medium-light skin tone`,
      skinToneMedium: t`Medium skin tone`,
      skinToneMediumDark: t`Medium-dark skin tone`,
      skinToneDark: t`Dark skin tone`,
      searchResults: t`Search results`,
      preview: t`Emoji preview`,
      clearSearch: t`Clear search`,
      emojis: t`Emojis`,
    }),
    [t],
  );
  // Mantine's eight categories, by its ids.
  const categoryLabels = useMemo<Readonly<Record<string, string>>>(
    () => ({
      people: t`Smileys & People`,
      nature: t`Animals & Nature`,
      foods: t`Food & Drink`,
      activity: t`Activity`,
      places: t`Travel & Places`,
      objects: t`Objects`,
      symbols: t`Symbols`,
      flags: t`Flags`,
    }),
    [t],
  );
  return (
    <EmojiPicker
      autoFocus={autoFocus}
      categoryLabels={categoryLabels}
      data={data}
      labels={labels}
      onSearchChange={onQueryChange}
      searchValue={query}
      // `loadEmojiData` offers only what the emoji rule accepts, each skin tone included, and the
      // picker answers an emoji or one of its skin tones, so every answer is strict.
      onEmojiSelect={(emoji) => {
        onChoose(emoji.emoji);
      }}
      withUnsupportedDetection
    />
  );
}
