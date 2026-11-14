// The emoji list of the icon field's Emoji tab (D300): `emojibase-data` as the package ships it,
// turned into Mantine's shape by its own adapter. Each language is one dynamic import, so the
// build makes one chunk per language, and it loads only when the Emoji tab first opens (#268).
// Only the data file is read: the adapter takes the names of the categories from Mantine's own
// list whatever the messages say, and the field gives the translated names to the picker.

import { type EmojiPickerData, emojibaseAdapter } from "@mantine/emoji";

/** The languages emojibase-data names the emojis in, of those the app offers. */
export type EmojiLanguage = "de" | "en";

/** The language of the emoji names for the app's language: German or English, else English. */
export function emojiLanguageOf(locale: string): EmojiLanguage {
  return locale === "de" ? "de" : "en";
}

const NO_MESSAGES = { groups: [] };

const LOADERS: Readonly<Record<EmojiLanguage, () => Promise<{ default: unknown }>>> = {
  de: () => import("emojibase-data/de/data.json"),
  en: () => import("emojibase-data/en/data.json"),
};

const loaded = new Map<EmojiLanguage, Promise<EmojiPickerData>>();

/** The emojis in one language, loaded and converted once per language and then kept. */
export function loadEmojiData(language: EmojiLanguage): Promise<EmojiPickerData> {
  let data = loaded.get(language);
  if (data === undefined) {
    data = LOADERS[language]().then(
      ({ default: emojis }) =>
        emojibaseAdapter(emojis as Parameters<typeof emojibaseAdapter>[0], NO_MESSAGES),
      (error: unknown) => {
        // A failed load is tried again at the next opening instead of being kept.
        loaded.delete(language);
        throw error;
      },
    );
    loaded.set(language, data);
  }
  return data;
}
