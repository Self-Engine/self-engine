import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { BrandMark } from "./brand-mark.tsx";

const meta = {
  title: "Icons/Brand Mark",
  component: BrandMark,
  globals: { colorMode: "light" },
} satisfies Meta<typeof BrandMark>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SizeGrowsWithTheFontScale: Story = {
  globals: { fontScale: "112.5" },
  render: () => <BrandMark data-testid="mark" />,
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId("mark").getBoundingClientRect().width).toBe(31.5);
  },
};

/** The same element repaints: a switch of the Color Mode needs no new render. */
export const ColorsFollowTheColorSchemeInCss: Story = {
  play: async ({ canvasElement }) => {
    const root = document.documentElement;
    const before = root.getAttribute("data-mantine-color-scheme")!;
    const top = canvasElement.querySelector("stop")!;
    const stopColor = () => getComputedStyle(top).stopColor;
    await expect(stopColor()).toBe("rgb(247, 160, 98)");
    root.setAttribute("data-mantine-color-scheme", "dark");
    try {
      await expect(stopColor()).toBe("rgb(255, 226, 207)");
      await expect(canvasElement.querySelector("stop")).toBe(top);
    } finally {
      root.setAttribute("data-mantine-color-scheme", before);
    }
  },
};

/** Ids are per instance: a second mark on the page must not borrow the first one's gradient. */
export const TwoMarksKeepTheirOwnIds: Story = {
  render: () => (
    <>
      <BrandMark />
      <BrandMark />
    </>
  ),
  play: async ({ canvasElement }) => {
    const ids = [...canvasElement.querySelectorAll("[id]")].map((element) => element.id);
    await expect(ids).toHaveLength(4);
    await expect(new Set(ids).size).toBe(4);
  },
};
