import { isSingleEmoji } from "@self-engine/icons/names";
import { describe, expect, it } from "vite-plus/test";
import { emojiLanguageOf, loadEmojiData } from "./emoji-data.ts";

describe("emojiLanguageOf", () => {
  it.each([
    ["de", "de"],
    ["en", "en"],
    ["fr", "en"],
    ["", "en"],
  ] as const)("gives the emoji data of %j in %s", (locale, language) => {
    expect(emojiLanguageOf(locale)).toBe(language);
  });
});

describe.each(["de", "en"] as const)("the emoji data in %s", (language) => {
  it("holds only characters the emoji rule accepts, skin tones included", async () => {
    const data = await loadEmojiData(language);
    const characters = Object.values(data.emojis).flatMap((emoji) => [
      emoji.emoji,
      ...(emoji.skins ?? []),
    ]);
    // emojibase-data 18.0.0 has 1,932 emojis in groups; the adapter leaves out the 9 of the
    // components group (the skin tones and hair styles alone).
    expect(Object.keys(data.emojis)).toHaveLength(1923);
    // 332 of them in five skin tones each; a variant with two different tones, such as a couple,
    // the adapter leaves out, so the picker can answer 3,583 characters.
    expect(characters).toHaveLength(3583);
    expect(characters.filter((character) => !isSingleEmoji(character))).toEqual([]);
  });

  it("names and finds the house in its language", async () => {
    const data = await loadEmojiData(language);
    const house = Object.values(data.emojis).find((emoji) => emoji.emoji === "🏠");
    expect(house?.name).toBe(language === "de" ? "Haus" : "house");
  });
});
