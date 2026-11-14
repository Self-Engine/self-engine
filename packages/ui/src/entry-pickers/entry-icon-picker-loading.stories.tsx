// A file of its own: in the gate a story file runs in a page of its own, so no story of another
// file has loaded the Emoji tab before these look at what the page requested. Each story asks
// first for a page in which no story has: in the gate it fails otherwise, in Storybook the page
// loads anew.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { EntryIconPicker } from "./index.ts";
import { aPageWithoutTheEmojiPicker, emojiPickerHasRun } from "./story-fresh-page.ts";

/** The page's requests since the story began. The page's own list fills up and then drops some. */
const requests: string[] = [];

const meta = {
  title: "UI/Entry pickers/Icon loading",
  beforeEach: async () => {
    await aPageWithoutTheEmojiPicker();
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

const answers = fn<(value: string | null) => void>();

/** The requests for the emoji picker or its data, by the package in the address. */
const emojiRequests = () =>
  requests.filter((name) => /emojibase[-_]data|@mantine[/_+]emoji/.test(name));

export const TakesAPastedEmojiWithoutTheEmojiData: Story = {
  render: () => <EntryIconPicker onChange={answers} value="house" />,
  play: async ({ canvas }) => {
    answers.mockClear();
    await userEvent.click(canvas.getByRole("button", { name: /^Icon/ }));
    const dialog = await screen.findByRole("dialog", { name: "Choose an icon" });
    await userEvent.click(within(dialog).getByRole("searchbox", { name: "Search icons" }));
    await userEvent.paste("👨‍👩‍👧‍👦");
    await expect(answers).toHaveBeenLastCalledWith("👨‍👩‍👧‍👦");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await expect(emojiRequests()).toEqual([]);
    await expect(emojiPickerHasRun()).toBe(false);
  },
};

export const LoadsTheEmojisWhenTheEmojiTabOpens: Story = {
  render: () => <EntryIconPicker onChange={() => {}} value="house" />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: /^Icon/ }));
    const dialog = await screen.findByRole("dialog", { name: "Choose an icon" });
    // The Icons tab, searched and browsed, asks for nothing of the emoji picker.
    await userEvent.type(within(dialog).getByRole("searchbox", { name: "Search icons" }), "house");
    await expect(emojiRequests()).toEqual([]);
    await expect(emojiPickerHasRun()).toBe(false);

    // The dialog keeps its size while the emojis load and once they are there.
    const sizeOf = (element: Element) => {
      const { width, height } = element.getBoundingClientRect();
      return { width, height };
    };
    const size = sizeOf(dialog);
    await userEvent.click(within(dialog).getByRole("tab", { name: "Emoji" }));
    await expect(within(dialog).getByLabelText("Loading the emojis")).toBeVisible();
    await expect(sizeOf(dialog)).toEqual(size);
    await within(dialog).findByRole("grid", { name: "Emojis" }, { timeout: 10_000 });
    await expect(sizeOf(dialog)).toEqual(size);
    await expect(emojiPickerHasRun()).toBe(true);
    await waitFor(() =>
      expect(emojiRequests().filter((name) => /emojibase[-_]data.en.data/.test(name))).toHaveLength(
        1,
      ),
    );
    // Only the data of the app's language loads.
    await expect(emojiRequests().filter((name) => /emojibase[-_]data.de/.test(name))).toEqual([]);
  },
};
