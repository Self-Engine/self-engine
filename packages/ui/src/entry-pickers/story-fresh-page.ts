// For the stories of the icon field that need a page in which the emoji picker has not run yet:
// the one that proves that nothing of it loads before the Emoji tab opens, and the one that proves
// that it hides what the device cannot draw, whose check Mantine runs once per page and then
// keeps. In the gate each story file runs in a page of its own, and within a file the stories
// share the page. In Storybook every story shares the one page of the preview.

/** Whether Mantine's emoji picker has run in this page: its stylesheet is in the page from then. */
export function emojiPickerHasRun(): boolean {
  return [...document.querySelectorAll("style")].some((style) =>
    /mantine-EmojiPicker|\.m_873e66bb/.test(style.textContent),
  );
}

const RELOADED = "self-engine:story-fresh-page";

/**
 * Gives a story a page in which the emoji picker has not run yet. Call it first in `beforeEach`.
 *
 * - In the gate, a used page means an earlier story of the same file ran the picker, so the story
 *   fails: a story moved behind one that opens the Emoji tab goes red instead of proving less.
 * - In Storybook every story shares the page of the preview, so a used page is the usual case
 *   after a look at another story. The page loads anew, once, and the story starts again in it.
 */
export async function aPageWithoutTheEmojiPicker(): Promise<void> {
  if (!emojiPickerHasRun()) {
    sessionStorage.removeItem(RELOADED);
    return;
  }
  if (import.meta.env.MODE === "test" || sessionStorage.getItem(RELOADED) !== null) {
    sessionStorage.removeItem(RELOADED);
    throw new Error(
      "The emoji picker already ran in this page: keep this story ahead of every story of its file that opens the Emoji tab.",
    );
  }
  sessionStorage.setItem(RELOADED, "1");
  location.reload();
  // This page is going away: the story must not start in it.
  await new Promise<never>(() => {});
}
