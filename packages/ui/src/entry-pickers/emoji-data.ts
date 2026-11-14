// The emoji list of the icon field's Emoji tab (D300): `emojibase-data` as the package ships it,
// turned into Mantine's shape by its own adapter. Each language is one dynamic import, so the
// build makes one chunk per language, and it loads only when the Emoji tab first opens (#268).
// Only the data file is read: the adapter takes the names of the categories from Mantine's own
// list whatever the messages say, and the field gives the translated names to the picker.
//
// The list is cut to what the emoji rule accepts here. The rule reads Unicode's properties from
// the engine it runs in, so an engine older than the data rejects the newest emojis: Electron 45
// knows Unicode 17 and the data reaches Emoji 18. An emoji the field could not answer is not
// offered.

import { type EmojiPickerData, type EmojiPickerEmoji, emojibaseAdapter } from "@mantine/emoji";
import { isSingleEmoji } from "@self-engine/icons/names";

/** The languages emojibase-data names the emojis in, of those the app offers. */
export type EmojiLanguage = "de" | "en";

/** The language of the emoji names for the app's language: German or English, else English. */
export function emojiLanguageOf(locale: string): EmojiLanguage {
  return locale === "de" ? "de" : "en";
}

const NO_MESSAGES = { groups: [] };

/**
 * The list without the emojis a rule rejects, in any of their skin tones, so that every emoji
 * the picker shows can be answered.
 */
export function onlyAccepted(
  data: EmojiPickerData,
  accepts: (emoji: string) => boolean,
): EmojiPickerData {
  const emojis: Record<string, EmojiPickerEmoji> = {};
  for (const [id, emoji] of Object.entries(data.emojis)) {
    if (accepts(emoji.emoji) && (emoji.skins ?? []).every(accepts)) emojis[id] = emoji;
  }
  return {
    categories: data.categories.map((category) => ({
      ...category,
      emojis: category.emojis.filter((id) => Object.hasOwn(emojis, id)),
    })),
    emojis,
  };
}

const LOADERS: Readonly<Record<EmojiLanguage, () => Promise<{ default: unknown }>>> = {
  de: () => import("emojibase-data/de/data.json"),
  en: () => import("emojibase-data/en/data.json"),
};

const loaded = new Map<EmojiLanguage, Promise<EmojiPickerData>>();

/** The emojis in one language, loaded and converted once per language and then kept. */
export function loadEmojiData(language: EmojiLanguage): Promise<EmojiPickerData> {
  let data = loaded.get(language);
  if (data === undefined) {
    // A failed load stays failed, here and in the browser: Chromium keeps a module that failed
    // to load in its module map and answers each later import of it with the same error
    // (whatwg/html#6768). In the desktop app the chunk is a file of the app itself, so it fails
    // only in a damaged install, which no retry would mend.
    data = LOADERS[language]().then(({ default: emojis }) =>
      onlyAccepted(
        emojibaseAdapter(emojis as Parameters<typeof emojibaseAdapter>[0], NO_MESSAGES),
        isSingleEmoji,
      ),
    );
    loaded.set(language, data);
  }
  return data;
}
