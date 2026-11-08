// Stock Mantine components on the throwaway /theme-preview page. #23 removes it.

import { Button, Card, Group, Menu, Select, Text, TextInput } from "@mantine/core";

export function PreviewMantineComponents() {
  return (
    <Group align="flex-start" grow>
      <Card padding="md" withBorder>
        <Text fw={600}>Card</Text>
        <Text c="dimmed">Dimmed text on a card</Text>
      </Card>
      <TextInput label="Input" placeholder="Placeholder" />
      <TextInput label="Filled input" placeholder="Placeholder" variant="filled" />
      <TextInput disabled label="Disabled input" placeholder="Placeholder" />
      <Select data={["One", "Two", "Three"]} label="Select" placeholder="Pick one" />
      <Menu>
        <Menu.Target>
          <Button variant="default">Menu</Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Label</Menu.Label>
          <Menu.Item>First item</Menu.Item>
          <Menu.Item>Second item</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
