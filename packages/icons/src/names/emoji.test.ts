import { describe, expect, it } from "vite-plus/test";
import { isSingleEmoji } from "./index.ts";

const ACCEPTED: readonly (readonly [string, string])[] = [
  ["a plain emoji", "😀"],
  ["a flag", "🇩🇪"],
  ["a subdivision flag", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"],
  ["a keycap", "1️⃣"],
  ["a keycap without its variation selector", "#⃣"],
  ["an emoji with a skin tone", "👍🏽"],
  ["a skin tone on a base drawn as text by default", "☝🏻"],
  ["a joined family", "👨‍👩‍👧‍👦"],
  ["a joined emoji with a skin tone", "🧑🏽‍💻"],
  ["a joined flag", "🏳️‍⚧️"],
  ["a text symbol in its emoji form", "©️"],
  ["a heart in its emoji form", "❤️"],
  ["a joined heart", "❤️‍🔥"],
];

const REJECTED: readonly (readonly [string, string])[] = [
  ["an empty text", ""],
  ["a letter", "a"],
  ["a digit", "7"],
  ["a word", "house"],
  ["two emoji", "😀😀"],
  ["an emoji and a word", "😀 hi"],
  ["a space around an emoji", " 😀"],
  ["a text symbol without its emoji form", "©"],
  ["a heart without its emoji form", "❤"],
  ["an emoji forced into its text form", "😀\uFE0E"],
  ["a single regional indicator", "🇩"],
  ["three regional indicators", "🇩🇪🇫"],
  ["a bare variation selector", "\uFE0F"],
  ["a bare joiner", "\u200D"],
  ["a joiner at the end", "😀\u200D"],
  ["five emoji joined", "😀‍😀‍😀‍😀‍😀"],
];

describe("isSingleEmoji", () => {
  it.each(ACCEPTED)("accepts %s", (_, value) => {
    expect(isSingleEmoji(value)).toBe(true);
  });

  it.each(REJECTED)("rejects %s", (_, value) => {
    expect(isSingleEmoji(value)).toBe(false);
  });

  // The Unicode list of emoji needs the regular expression flag `v`, which Node has and Hermes
  // may lack, so the rule cannot use it. It serves here as the yardstick: for every character on
  // its own the rule agrees with it. With a variation selector after it, the rule also accepts a
  // character that is drawn as an emoji anyway, and one that Unicode keeps for future emoji.
  it("agrees with Unicode's list of emoji for every character on its own", () => {
    const unicodeEmoji = /^\p{RGI_Emoji}$/v;
    const disagreements: string[] = [];
    for (let codePoint = 0; codePoint <= 0x10_ffff; codePoint += 1) {
      if (codePoint >= 0xd8_00 && codePoint <= 0xdf_ff) continue;
      const character = String.fromCodePoint(codePoint);
      if (isSingleEmoji(character) !== unicodeEmoji.test(character)) {
        disagreements.push(codePoint.toString(16));
      }
    }
    expect(disagreements).toEqual([]);
  });

  it("accepts a character followed by a variation selector only where it is an emoji", () => {
    const unicodeEmoji = /^\p{RGI_Emoji}$/v;
    const futureOrDrawnAsEmoji = /^(?:\p{Emoji_Presentation}|\p{Cn})/u;
    const disagreements: string[] = [];
    for (let codePoint = 0; codePoint <= 0x10_ffff; codePoint += 1) {
      if (codePoint >= 0xd8_00 && codePoint <= 0xdf_ff) continue;
      const value = `${String.fromCodePoint(codePoint)}️`;
      const accepted = isSingleEmoji(value);
      if (accepted === unicodeEmoji.test(value)) continue;
      if (accepted && futureOrDrawnAsEmoji.test(value)) continue;
      disagreements.push(codePoint.toString(16));
    }
    expect(disagreements).toEqual([]);
  });
});
