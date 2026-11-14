// A file of its own: a story file runs in a page of its own, so no other story has loaded the
// Emoji tab before this one looks at what the page requested.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { EntryIconPicker } from "./index.ts";

/** The page's requests since the story began. The page's own list fills up and then drops some. */
const requests: string[] = [];

const meta = {
  title: "UI/Entry pickers/Icon loading",
  beforeEach: () => {
    requests.length = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) requests.push(entry.name);
    });
    observer.observe({ type: "resource" });
    return () => {
      observer.disconnect();
    };
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The requests for the emoji picker or its data, by the package in the address. */
const emojiRequests = () =>
  requests.filter((name) => /emojibase[-_]data|@mantine[/_+]emoji/.test(name));

/** Whether the picker's stylesheet is in the page, which it is once the picker's code has run. */
const pickerStyles = () =>
  [...document.querySelectorAll("style")].some((style) =>
    /mantine-EmojiPicker|\.m_873e66bb/.test(style.textContent),
  );

export const LoadsTheEmojisWhenTheEmojiTabOpens: Story = {
  render: () => <EntryIconPicker onChange={() => {}} value="house" />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: /^Icon/ }));
    const dialog = await screen.findByRole("dialog", { name: "Choose an icon" });
    // The Icons tab, searched and browsed, asks for nothing of the emoji picker.
    await userEvent.type(within(dialog).getByRole("searchbox", { name: "Search icons" }), "house");
    await expect(emojiRequests()).toEqual([]);
    await expect(pickerStyles()).toBe(false);

    await userEvent.click(within(dialog).getByRole("tab", { name: "Emoji" }));
    await within(dialog).findByRole("grid", { name: "Emojis" }, { timeout: 10_000 });
    await expect(pickerStyles()).toBe(true);
    await waitFor(() =>
      expect(emojiRequests().filter((name) => /emojibase[-_]data.en.data/.test(name))).toHaveLength(
        1,
      ),
    );
    // Only the data of the app's language loads.
    await expect(emojiRequests().filter((name) => /emojibase[-_]data.de/.test(name))).toEqual([]);
  },
};
