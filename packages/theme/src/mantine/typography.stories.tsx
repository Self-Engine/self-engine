import { Stack, Text, Title, useMantineTheme } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { FONT_FAMILY, FONT_SCALES } from "../core/index.ts";
import { isStrictlyIncreasing } from "./story-samples.tsx";

const HEADING_ORDERS = [1, 2, 3, 4, 5, 6] as const;

function Typography() {
  const { fontSizes, lineHeights } = useMantineTheme();
  return (
    <Stack>
      <Text>{FONT_FAMILY}</Text>
      <Text data-testid="font-scales">
        Font scale steps: {FONT_SCALES.map((scale) => `${scale} %`).join(", ")}
      </Text>
      <Text c="dimmed">
        The font and the font scale come from the theme engine. Sizes, line heights and headings are
        Mantine's own scales, which the app uses as they are; the font scale resizes them.
      </Text>
      <Stack gap="xs">
        {Object.entries(fontSizes).map(([step, value]) => (
          <Text data-testid={step} key={step} size={step}>
            {step}: {value}, line height {lineHeights[step]}
          </Text>
        ))}
      </Stack>
      <Stack gap="xs">
        {HEADING_ORDERS.map((order) => (
          <Title key={order} order={order}>
            Heading {order}
          </Title>
        ))}
      </Stack>
    </Stack>
  );
}

const meta = {
  title: "Appearance/Type",
  component: Typography,
} satisfies Meta<typeof Typography>;

export default meta;

export const Overview: StoryObj<typeof meta> = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(FONT_FAMILY)).toBeVisible();
    const sizes = ["xs", "sm", "md", "lg", "xl"].map((step) =>
      Number.parseFloat(getComputedStyle(canvas.getByTestId(step)).fontSize),
    );
    await expect(isStrictlyIncreasing(sizes)).toBe(true);
    await expect(canvas.getByTestId("font-scales")).toHaveTextContent("87.5 %, 93.75 %, 100 %");
    await expect(canvas.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(canvas.getByRole("heading", { level: 6 })).toBeVisible();
  },
};

/** Text grows with the font scale while the root element stays at the browser's 16 px. */
export const AtTheLargestFontScale: StoryObj<typeof meta> = {
  globals: { fontScale: "112.5" },
  play: async ({ canvas }) => {
    await expect(getComputedStyle(document.documentElement).fontSize).toBe("16px");
    await expect(getComputedStyle(canvas.getByTestId("md")).fontSize).toBe("18px");
  },
};
