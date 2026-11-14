import { entryIconSchema } from "@self-engine/icons/names";
import { describe, expect, it } from "vite-plus/test";
import { emojiOfSearchTerm } from "./search-term.ts";

describe("emojiOfSearchTerm", () => {
  it.each([
    ["😀", "😀"],
    [" 😀 ", "😀"],
    ["\t🏠\n", "🏠"],
    // A skin tone and a joined emoji of several parts are one emoji.
    ["👍🏽", "👍🏽"],
    ["👨‍👩‍👧‍👦", "👨‍👩‍👧‍👦"],
    ["🧑🏿‍🚀", "🧑🏿‍🚀"],
    ["🇩🇪", "🇩🇪"],
    ["🏴󠁧󠁢󠁷󠁬󠁳󠁿", "🏴󠁧󠁢󠁷󠁬󠁳󠁿"],
    ["❤️", "❤️"],
    ["1️⃣", "1️⃣"],
  ])("takes %j as the emoji %j", (term, emoji) => {
    expect(emojiOfSearchTerm(term)).toBe(emoji);
    expect(entryIconSchema.safeParse(emojiOfSearchTerm(term)).success).toBe(true);
  });

  it.each([
    "",
    "   ",
    "house",
    // An emoji and a word, two emojis, letters followed by an emoji.
    "😀 house",
    "house 😀",
    "😀😀",
    "😀 😀",
    "abc😀",
    // Text an emoji keyboard draws as text, and an icon name.
    "❤",
    "1",
    "rocket-launch",
  ])("keeps %j as a search term", (term) => {
    expect(emojiOfSearchTerm(term)).toBeUndefined();
  });
});
