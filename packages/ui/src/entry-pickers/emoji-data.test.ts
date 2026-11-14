import { isSingleEmoji } from "@self-engine/icons/names";
import { describe, expect, it } from "vite-plus/test";
import { emojiLanguageOf, loadEmojiData, onlyAccepted } from "./emoji-data.ts";

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

describe("onlyAccepted", () => {
  const data = {
    categories: [
      { id: "people", label: "People", emojis: ["thumbs_up", "wave"] },
      { id: "places", label: "Places", emojis: ["house"] },
    ],
    emojis: {
      thumbs_up: { id: "thumbs_up", name: "thumbs up", keywords: [], emoji: "👍", skins: ["👍🏽"] },
      wave: { id: "wave", name: "wave", keywords: [], emoji: "👋", skins: ["👋🏽"] },
      house: { id: "house", name: "house", keywords: [], emoji: "🏠" },
    },
  };

  it("drops a rejected emoji from the list and from its category", () => {
    const offered = onlyAccepted(data, (emoji) => emoji !== "🏠");
    expect(Object.keys(offered.emojis)).toEqual(["thumbs_up", "wave"]);
    expect(offered.categories.map((category) => category.emojis)).toEqual([
      ["thumbs_up", "wave"],
      [],
    ]);
  });

  it("drops an emoji when one of its skin tones is rejected", () => {
    const offered = onlyAccepted(data, (emoji) => emoji !== "👋🏽");
    expect(Object.keys(offered.emojis)).toEqual(["thumbs_up", "house"]);
    expect(offered.categories[0]?.emojis).toEqual(["thumbs_up"]);
  });

  it("keeps the list as it is when the rule accepts everything", () => {
    expect(onlyAccepted(data, () => true)).toEqual(data);
  });
});

// The emoji rule reads Unicode's properties from the engine the test runs in, and engines differ:
// Electron 45 and Node's own builds know Unicode 17, a Node linked against a newer ICU knows 18.
// The data reaches Emoji 18. So the list is checked up to Emoji 17, which every engine of the
// app knows, and the nine emojis of Emoji 18 are offered only where the engine accepts them.
const NEWEST_EMOJI_EVERY_ENGINE_KNOWS = 17;

describe.each(["de", "en"] as const)("the emoji data in %s", (language) => {
  it("offers only characters the emoji rule accepts, skin tones included", async () => {
    const data = await loadEmojiData(language);
    const characters = Object.values(data.emojis).flatMap((emoji) => [
      emoji.emoji,
      ...(emoji.skins ?? []),
    ]);
    expect(characters.filter((character) => !isSingleEmoji(character))).toEqual([]);
    for (const category of data.categories) {
      expect(category.emojis.filter((id) => !Object.hasOwn(data.emojis, id))).toEqual([]);
    }
  });

  it("offers every emoji up to Emoji 17 on every engine", async () => {
    const data = await loadEmojiData(language);
    const known = Object.values(data.emojis).filter(
      (emoji) => (emoji.version ?? 0) <= NEWEST_EMOJI_EVERY_ENGINE_KNOWS,
    );
    // emojibase-data 18.0.0 has 1,932 emojis in groups; the adapter leaves out the 9 of the
    // components group (the skin tones and hair styles alone), and 9 more are new in Emoji 18.
    expect(known).toHaveLength(1914);
    // 330 of them in five skin tones each; a variant with two different tones, such as a couple,
    // the adapter leaves out.
    expect(known.flatMap((emoji) => [emoji.emoji, ...(emoji.skins ?? [])])).toHaveLength(3564);
    const newer = Object.values(data.emojis).filter(
      (emoji) => (emoji.version ?? 0) > NEWEST_EMOJI_EVERY_ENGINE_KNOWS,
    );
    expect([0, 9]).toContain(newer.length);
  });

  it("names and finds the house in its language", async () => {
    const data = await loadEmojiData(language);
    const house = Object.values(data.emojis).find((emoji) => emoji.emoji === "🏠");
    expect(house?.name).toBe(language === "de" ? "Haus" : "house");
  });
});
