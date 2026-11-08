// The icon part of the throwaway /theme-preview page. #23 removes it.

import { Button, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import * as icons from "@self-engine/icons";
import { COLOR_SETS } from "@self-engine/theme";
import { roleColor } from "./preview-role-color.ts";

const SIZES = ["xs", "sm", "md", "lg"] as const;
const BUTTON_VARIANTS = ["filled", "light", "outline", "subtle"] as const;
const TEXT_ROLES = ["text", "textMuted"] as const;

/** Reads the package's exports, so a new icon shows up here without touching this page. */
const CATALOG = Object.entries(icons);

function Catalog() {
  return (
    <SimpleGrid cols={4}>
      {CATALOG.map(([name, Icon]) => (
        <Group gap="xs" key={name}>
          <Icon />
          <Text>{name}</Text>
        </Group>
      ))}
    </SimpleGrid>
  );
}

/** Each step beside text of the same step, to judge the proportion at every font scale. */
function Sizes() {
  return (
    <Group gap="xl">
      {SIZES.map((size) => (
        <Group gap="xs" key={size}>
          <icons.TimeIcon size={size} />
          <Text size={size}>{size} text</Text>
        </Group>
      ))}
    </Group>
  );
}

/** The surrounding element decides the color: text, an Accent action, or a Module Color. */
function Colors() {
  return (
    <Stack gap="xs">
      <Group gap="xl">
        {TEXT_ROLES.map((role) => (
          <Group gap="xs" key={role} style={{ color: roleColor(role) }}>
            <icons.SearchIcon />
            {role}
          </Group>
        ))}
      </Group>
      <Group>
        {BUTTON_VARIANTS.map((variant) => (
          <Button key={variant} leftSection={<icons.AddIcon size="sm" />} variant={variant}>
            {variant}
          </Button>
        ))}
      </Group>
      <Group gap="xl">
        {Object.keys(COLOR_SETS).map((name) => (
          <Group
            data-module-color={name}
            gap="xs"
            key={name}
            style={{ color: "var(--se-module-text)" }}
          >
            <icons.ProjectsIcon />
            {name}
          </Group>
        ))}
      </Group>
    </Stack>
  );
}

export function IconsPreview() {
  return (
    <Stack>
      <Catalog />
      <Sizes />
      <Colors />
    </Stack>
  );
}
