// The Background Tint part of the throwaway /theme-preview page. #23 removes it.

import { Stack, Switch, Text } from "@mantine/core";
import type { CSSProperties, ReactNode } from "react";
import { usePreviewAppearance } from "./preview-appearance.tsx";
import { roleColor } from "./preview-role-color.ts";

const CONTAINER: CSSProperties = {
  borderRadius: "var(--mantine-radius-md)",
  padding: "var(--mantine-spacing-md)",
};

function Container({
  role,
  style,
  children,
}: {
  readonly role: Parameters<typeof roleColor>[0];
  readonly style?: CSSProperties;
  readonly children: ReactNode;
}) {
  return <div style={{ ...CONTAINER, background: roleColor(role), ...style }}>{children}</div>;
}

/** The B3 arrangement: the tinted chrome with the navigation and the content on top of it. */
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
          style={{ border: "1px solid var(--se-border)", marginTop: "var(--mantine-spacing-xs)" }}
        >
          <Text fw={600}>surface</Text>
          <Text c="dimmed">A tile on the content</Text>
        </Container>
      </Container>
    </Container>
  );
}

export function BackgroundTintPreview() {
  const [appearance, setAppearance] = usePreviewAppearance();
  return (
    <Stack gap="xs">
      <Switch
        checked={appearance.backgroundTint}
        label="Background Tint"
        onChange={(event) => {
          setAppearance({ backgroundTint: event.currentTarget.checked });
        }}
      />
      <Arrangement />
    </Stack>
  );
}
