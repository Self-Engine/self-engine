import { Paper, SimpleGrid } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import {
  BUILT_IN_THEMES,
  FIXED_APPEARANCE,
  type FinalColors,
  resolveAppearance,
  roleColor,
} from "../core/index.ts";
import { useFinalColors } from "./index.tsx";
import { Swatch } from "./story-samples.tsx";

type Role = keyof FinalColors;

function ColorRoles() {
  const colors = useFinalColors();
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
      {(Object.keys(colors) as Role[]).map((role) => (
        <Paper key={role} p="xs" withBorder>
          <Swatch color={roleColor(role)} label={role} testId={role} value={colors[role]} />
        </Paper>
      ))}
    </SimpleGrid>
  );
}

const meta = {
  title: "Appearance/Color Roles",
  component: ColorRoles,
} satisfies Meta<typeof ColorRoles>;

export default meta;

export const Overview: StoryObj<typeof meta> = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("surfaceRaised")).toBeVisible();
    const swatch = canvas.getByTestId("text");
    await expect(getComputedStyle(swatch).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  },
};

/** Fixes every switch against the toolbar. `toolbar.test.ts` proves that stories start here. */
export const InTheFixedAppearance: StoryObj<typeof meta> = {
  globals: {
    theme: FIXED_APPEARANCE.lightTheme,
    accent: FIXED_APPEARANCE.accent,
    colorMode: FIXED_APPEARANCE.colorMode,
    backgroundTint: FIXED_APPEARANCE.backgroundTint ? "on" : "off",
    density: FIXED_APPEARANCE.density,
    fontScale: String(FIXED_APPEARANCE.fontScale),
    language: "en",
  },
  play: async ({ canvas }) => {
    const root = document.documentElement;
    await expect(root.getAttribute("data-mantine-color-scheme")).toBe("light");
    await expect(root.dataset["density"]).toBe("comfortable");
    await expect(root.style.fontSize).toBe("100%");
    await expect(root.lang).toBe("en");
    // Only Neutral with its own Accent and the Background Tint on produces this `chrome`.
    const { chrome } = resolveAppearance(FIXED_APPEARANCE, BUILT_IN_THEMES).light.roles;
    await expect(canvas.getByText(chrome)).toBeVisible();
  },
};
