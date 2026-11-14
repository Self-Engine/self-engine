// For the stories of the icon field that need a page in which the emoji picker has not run yet:
// the one that proves that nothing of it loads before the Emoji tab opens, and the one that proves
// that it hides what the device cannot draw, whose check Mantine runs once per page and then
// keeps. Each story file runs in a page of its own; within a file the stories share the page.

/** Whether Mantine's emoji picker has run in this page: its stylesheet is in the page from then. */
export function emojiPickerHasRun(): boolean {
  return [...document.querySelectorAll("style")].some((style) =>
    /mantine-EmojiPicker|\.m_873e66bb/.test(style.textContent),
  );
}

/**
 * Fails the story when an earlier story of its file has already run the emoji picker in this page,
 * so a story moved behind one that opens the Emoji tab goes red instead of proving less.
 */
export function expectTheEmojiPickerNotYetRun(): void {
  if (emojiPickerHasRun()) {
    throw new Error(
      "The emoji picker already ran in this page: keep this story ahead of every story of its file that opens the Emoji tab.",
    );
  }
}
