import { rem, Text } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties, ReactNode } from "react";
import { expect } from "storybook/test";
import {
  BUILT_IN_THEMES,
  type ColorRole,
  FIXED_APPEARANCE,
  resolveAppearance,
  roleColor,
} from "../core/index.ts";
import { activeColorMode } from "./story-samples.tsx";

const CONTAINER: CSSProperties = {
  borderRadius: "var(--mantine-radius-md)",
  padding: "var(--mantine-spacing-md)",
};

function Container({
  role,
  style,
  children,
}: {
  readonly role: ColorRole;
  readonly style?: CSSProperties;
  readonly children: ReactNode;
}) {
  return (
    <div data-testid={role} style={{ ...CONTAINER, background: roleColor(role), ...style }}>
      {children}
    </div>
  );
}

/** The layers of the app window: the tinted chrome with the navigation and the content on top of it. */
function Arrangement() {
  return (
    <Container
      role="chrome"
      style={{ display: "flex", gap: "var(--mantine-spacing-sm)", minHeight: rem(256) }}
    >
      <Container role="navSurface" style={{ width: rem(192) }}>
        <Text fw={600}>navSurface</Text>
        <Text c="dimmed">Navigation item</Text>
      </Container>
      <Container role="canvas" style={{ flex: 1 }}>
        <Text fw={600}>canvas</Text>
        <Container
          role="surface"
          style={{
            border: `1px solid ${roleColor("border")}`,
            marginTop: "var(--mantine-spacing-xs)",
          }}
        >
          <Text fw={600}>surface</Text>
          <Text c="dimmed">A tile on the content</Text>
        </Container>
      </Container>
    </Container>
  );
}

const meta = {
  title: "Appearance/Background Tint",
  component: Arrangement,
} satisfies Meta<typeof Arrangement>;

export default meta;

/** The engine's `chrome` with this tint, for the Theme, Accent and Color Mode the toolbar chose. */
function chromeWith(backgroundTint: boolean, globals: Readonly<Record<string, unknown>>) {
  const theme = String(globals["theme"]);
  const appearance = {
    ...FIXED_APPEARANCE,
    lightTheme: theme,
    darkTheme: theme,
    accent: String(globals["accent"]),
    backgroundTint,
  };
  return resolveAppearance(appearance, BUILT_IN_THEMES)[activeColorMode()].roles.chrome;
}

// The outermost background differs with the tint, so each story fixes that one switch.

export const On: StoryObj<typeof meta> = {
  globals: { backgroundTint: "on" },
  play: async ({ canvas, globals }) => {
    await expect(canvas.getByTestId("chrome")).toHaveStyle({
      backgroundColor: chromeWith(true, globals),
    });
  },
};

export const Off: StoryObj<typeof meta> = {
  globals: { backgroundTint: "off" },
  play: async ({ canvas, globals }) => {
    await expect(canvas.getByTestId("chrome")).toHaveStyle({
      backgroundColor: chromeWith(false, globals),
    });
  },
};
