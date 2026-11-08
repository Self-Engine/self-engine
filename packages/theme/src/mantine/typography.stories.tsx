import { Stack, Text, Title, useMantineTheme } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { FONT_FAMILY } from "../core/index.ts";

const HEADING_ORDERS = [1, 2, 3, 4, 5, 6] as const;

function Typography() {
  const { fontSizes, lineHeights } = useMantineTheme();
  return (
    <Stack>
      <Text>{FONT_FAMILY}</Text>
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
  title: "Tokens/Type",
  component: Typography,
} satisfies Meta<typeof Typography>;

export default meta;

export const Overview: StoryObj<typeof meta> = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(FONT_FAMILY)).toBeVisible();
    const sizes = ["xs", "sm", "md", "lg", "xl"].map((step) =>
      Number.parseFloat(getComputedStyle(canvas.getByTestId(step)).fontSize),
    );
    await expect(sizes).toEqual(sizes.toSorted((a, b) => a - b));
    await expect(new Set(sizes).size).toBe(sizes.length);
    await expect(canvas.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(canvas.getByRole("heading", { level: 6 })).toBeVisible();
  },
};
