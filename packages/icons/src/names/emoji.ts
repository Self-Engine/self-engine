// "Exactly one emoji", decided the same way on every device. Unicode's own list (`\p{RGI_Emoji}`)
// needs the regular expression flag `v`, which Hermes may lack, so the rule is built from the
// property escapes every engine of the app supports. It starts from the old app's rule and closes
// its gap: a character drawn as text by default, such as ©, ❤ or a digit, is an emoji only with
// the variation selector U+FE0F (or a keycap mark) after it, as an emoji keyboard types it.

const VS16 = "\\uFE0F";

/**
 * One pictograph: a character drawn as an emoji by default (a regional indicator alone is a
 * letter, not a picture), a pictographic character with U+FE0F, or a base with a skin tone.
 */
const PART = [
  `\\p{Emoji_Modifier_Base}${VS16}?\\p{Emoji_Modifier}`,
  `(?!\\p{Regional_Indicator})\\p{Emoji_Presentation}${VS16}?`,
  `\\p{Extended_Pictographic}${VS16}`,
].join("|");

/** Joined pictographs: Unicode's longest sequences have four parts, a family or a kiss. */
const JOINED = `(?:${PART})(?:\\u200D(?:${PART})){0,3}`;
const FLAG = "\\p{Regional_Indicator}{2}";
/** The flags of England, Scotland and Wales: a black flag and tag characters. */
const SUBDIVISION_FLAG = "\\u{1F3F4}[\\u{E0020}-\\u{E007E}]+\\u{E007F}";
const KEYCAP = `[0-9#*]${VS16}?\\u20E3`;

const SINGLE_EMOJI = new RegExp(`^(?:${FLAG}|${SUBDIVISION_FLAG}|${KEYCAP}|${JOINED})$`, "u");

/** Whether a text is exactly one emoji and nothing else. */
export function isSingleEmoji(value: string): boolean {
  return SINGLE_EMOJI.test(value);
}
