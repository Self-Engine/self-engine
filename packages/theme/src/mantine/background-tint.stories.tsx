import { Text } from "@mantine/core";
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
      style={{ display: "flex", gap: "var(--mantine-spacing-sm)", minHeight: "16rem" }}
    >
      <Container role="navSurface" style={{ width: "12rem" }}>
        <Text fw={600}>navSurface</Text>
        <Text c="dimmed">Navigation item</Text>
      </Container>
      <Container role="canvas" style={{ flex: 1 }}>
        <Text fw={600}>canvas</Text>
        <Container
          role="surface"
          style={{ border: `1px solid ${roleColor("border")}`, marginTop: "var(--mantine-spacing-xs)" }}
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

function chromeWith(backgroundTint: boolean) {
  return resolveAppearance({ ...FIXED_APPEARANCE, backgroundTint }, BUILT_IN_THEMES).light.roles
    .chrome;
}

export const On: StoryObj<typeof meta> = {
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId("chrome")).toHaveStyle({ backgroundColor: chromeWith(true) });
  },
};

/** The outermost background differs without the tint, so this statement needs its own appearance. */
export const Off: StoryObj<typeof meta> = {
  globals: { backgroundTint: "off" },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId("chrome")).toHaveStyle({ backgroundColor: chromeWith(false) });
  },
};
