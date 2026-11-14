// The Emoji tab on a device that cannot draw one emoji. A file of its own: the picker asks the
// device once per page which emojis it draws and keeps the answer, so no story may have opened the
// Emoji tab in this page before; in Storybook the page loads anew when one has. The device is
// played by its canvas, which draws nothing for the house, so the story holds on any machine
// whatever its fonts draw.

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, spyOn, userEvent, within } from "storybook/test";
import { EntryIconPicker } from "./index.ts";
import { aPageWithoutTheEmojiPicker } from "./story-fresh-page.ts";

/** The emoji this device cannot draw. */
const UNDRAWABLE = "🏠";

const meta = {
  title: "UI/Entry pickers/Icon on a device",
  beforeEach: async () => {
    await aPageWithoutTheEmojiPicker();
    const prototype = CanvasRenderingContext2D.prototype;
    const draw = Reflect.get(prototype, "fillText") as CanvasRenderingContext2D["fillText"];
    const drawing = spyOn(prototype, "fillText").mockImplementation(function (
      this: CanvasRenderingContext2D,
      text,
      ...rest
    ) {
      if (text !== UNDRAWABLE) Reflect.apply(draw, this, [text, ...rest]);
    });
    return () => {
      drawing.mockRestore();
    };
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const answers = fn<(value: string | null) => void>();

export const HidesTheEmojisTheDeviceCannotDraw: Story = {
  render: () => <EntryIconPicker onChange={answers} value={null} />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: /^Icon/ }));
    const dialog = within(await screen.findByRole("dialog", { name: "Choose an icon" }));
    await userEvent.click(dialog.getByRole("tab", { name: "Emoji" }));
    const grid = await dialog.findByRole("grid", { name: "Emojis" }, { timeout: 10_000 });
    await userEvent.type(dialog.getByRole("searchbox", { name: "Search emojis" }), "house");
    // The houses the device draws are offered; the one it cannot draw is not.
    await expect(within(grid).getByRole("gridcell", { name: "house with garden" })).toBeVisible();
    await expect(within(grid).queryByRole("gridcell", { name: "house" })).toBeNull();
  },
};
