import { ActionIcon, Burger, Drawer, Group } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

const meta = { title: "Appearance/Focus Ring" } satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const ringOf = (element: Element) => getComputedStyle(element).outlineStyle;

const focused = () => {
  const element = document.activeElement;
  if (element === null || element === document.body) throw new Error("nothing has the focus");
  return element;
};

/**
 * `userEvent` moves the focus by script, and Chromium shows `:focus-visible` after that. So does a
 * real click on a control that already had the keyboard's focus, which is where the owner saw it.
 */
export const TheFocusRingFollowsTheKeyboardAndNotAClick: Story = {
  render: () => (
    <Group>
      <button type="button">Before</button>
      <ActionIcon aria-label="Control">×</ActionIcon>
    </Group>
  ),
  play: async ({ canvas }) => {
    const control = canvas.getByRole("button", { name: "Control" });
    await userEvent.click(control);
    await expect(control).toHaveFocus();
    await expect(ringOf(control)).toBe("none");
    await userEvent.tab({ shift: true });
    await userEvent.tab();
    await expect(control).toHaveFocus();
    await expect(ringOf(control)).toBe("solid");
    await userEvent.click(control);
    await expect(ringOf(control)).toBe("none");
  },
};

function BurgerWithDrawer() {
  const [opened, { close, toggle }] = useDisclosure(false);
  return (
    <>
      <Burger aria-label="Open panel" onClick={toggle} opened={opened} />
      <Drawer.Root onClose={close} opened={opened}>
        <Drawer.Overlay />
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Panel</Drawer.Title>
            <Drawer.CloseButton aria-label="Close panel" />
          </Drawer.Header>
          <Drawer.Body>Panel content</Drawer.Body>
        </Drawer.Content>
      </Drawer.Root>
    </>
  );
}

/** The Drawer's focus trap and its focus return move the focus by script, after a pointer too. */
export const NoFocusRingAfterOpeningAndClosingTheDrawerWithThePointer: Story = {
  render: () => <BurgerWithDrawer />,
  play: async ({ canvas }) => {
    const burger = canvas.getByRole("button", { name: "Open panel" });
    await userEvent.tab();
    await expect(burger).toHaveFocus();
    await expect(ringOf(burger)).toBe("solid");
    await userEvent.click(burger);
    const drawer = await screen.findByRole("dialog", { name: "Panel" });
    await waitFor(() => expect(within(drawer).getByText("Panel content")).toBeVisible());
    await waitFor(() => expect(drawer.contains(document.activeElement)).toBe(true));
    await expect(ringOf(focused())).toBe("none");
    const close = within(drawer).getByRole("button", { name: "Close panel" });
    await userEvent.click(close);
    await expect(ringOf(close)).toBe("none");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(burger).toHaveFocus());
    await expect(ringOf(burger)).toBe("none");
  },
};
