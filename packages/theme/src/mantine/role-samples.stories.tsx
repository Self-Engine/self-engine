import { Button, Group, Stack, Text } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { expect } from "storybook/test";
import { roleColor as color } from "../core/index.ts";
import { STATUS_ROLES } from "./story-samples.tsx";

const BUTTON_VARIANTS = ["filled", "light", "outline", "subtle"] as const;
const SURFACES = ["chrome", "navSurface", "canvas", "surface", "surfaceRaised"] as const;

function box(background: string, extra: CSSProperties = {}): CSSProperties {
  return {
    background,
    padding: "var(--mantine-spacing-md)",
    borderRadius: "var(--mantine-radius-md)",
    ...extra,
  };
}

function SurfaceSample({ role }: { readonly role: (typeof SURFACES)[number] }) {
  return (
    <div style={box(color(role), { border: `1px solid ${color("border")}` })}>
      <Text fw={600}>{role}</Text>
      <Text style={{ color: color("text") }}>text</Text>
      <Text style={{ color: color("textMuted") }}>textMuted</Text>
      {role !== "chrome" && (
        <div style={box(color("hover"), { marginTop: "var(--mantine-spacing-xs)" })}>
          <Text style={{ color: color("text") }}>text on hover</Text>
          <Text style={{ color: color("textMuted") }}>textMuted on hover</Text>
        </div>
      )}
    </div>
  );
}

function Surfaces() {
  return (
    <Group align="stretch" grow>
      {SURFACES.map((role) => (
        <SurfaceSample key={role} role={role} />
      ))}
    </Group>
  );
}

function Lines() {
  return (
    <Stack gap="xs">
      <div
        style={{
          borderTop: `1px solid ${color("border")}`,
          paddingTop: "var(--mantine-spacing-xs)",
        }}
      >
        border (decorative)
      </div>
      <div style={box(color("surface"), { border: `1px solid ${color("borderControl")}` })}>
        borderControl (input outline)
      </div>
    </Stack>
  );
}

function Accent() {
  return (
    <Stack gap="xs">
      <Group>
        {BUTTON_VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </Group>
      <Group>
        {BUTTON_VARIANTS.map((variant) => (
          <Button color="teal" key={variant} variant={variant}>
            teal {variant}
          </Button>
        ))}
      </Group>
      <Group grow>
        <div style={box(color("accent"), { color: color("onAccent") })}>accent fill</div>
        <div style={box(color("accentSoft"), { color: color("accentText") })}>accent soft</div>
      </Group>
    </Stack>
  );
}

function StatusSample({ roles }: { readonly roles: (typeof STATUS_ROLES)[number] }) {
  const { fill, onFill, soft, text } = roles;
  return (
    <Group grow>
      <div style={box(color(fill), { color: color(onFill) })}>{fill} fill</div>
      <div style={box(color(soft), { color: color(text) })}>{fill} soft</div>
      <div style={box(color("surface"), { color: color(text) })}>{fill} text</div>
    </Group>
  );
}

function StatusRows() {
  return (
    <Stack gap="xs">
      {STATUS_ROLES.map((roles) => (
        <StatusSample key={roles.fill} roles={roles} />
      ))}
    </Stack>
  );
}

const meta = {
  title: "Appearance/Role Samples",
} satisfies Meta;

export default meta;

export const SurfacesTextAndHover: StoryObj<typeof meta> = {
  render: () => <Surfaces />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("surfaceRaised")).toBeVisible();
    // `chrome` carries no hover sample, every other surface does.
    await expect(canvas.getAllByText("text on hover")).toHaveLength(4);
  },
};

export const BorderLines: StoryObj<typeof meta> = {
  render: () => <Lines />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("borderControl (input outline)")).toBeVisible();
  },
};

export const AccentActions: StoryObj<typeof meta> = {
  render: () => <Accent />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "filled" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "teal subtle" })).toBeVisible();
    await expect(canvas.getByText("accent soft")).toBeVisible();
  },
};

export const StatusColors: StoryObj<typeof meta> = {
  render: () => <StatusRows />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("error fill")).toBeVisible();
    await expect(canvas.getByText("success text")).toBeVisible();
  },
};
