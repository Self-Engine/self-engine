// The example form in a module's Indicator Panel (#350 needs a start time there): its pickers draw
// their dropdowns in a portal, outside the panel, and a press in one is still a press inside the
// panel. A press on the page still leaves the panel.

import { Button, Select, Stack } from "@mantine/core";
import { DataProvider, NO_DATA_PROCESS } from "@self-engine/data-client/react";
import {
  type IndicatorPanelProps,
  type ModuleIndicatorWithPanelProps,
  Shell,
  type ShellContribution,
  type ShellRouting,
} from "@self-engine/shell";
import { loadStoryShell } from "@self-engine/shell/story-interactions";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { ExampleForm } from "./example-form.tsx";
import { recordingPort } from "./story-port.ts";

function Indicator({ togglePanel }: ModuleIndicatorWithPanelProps) {
  return (
    <Button onClick={togglePanel} size="compact-sm" variant="subtle">
      Open panel
    </Button>
  );
}

/** The example form, and a Select of Mantine's, whose list is in a portal as well. */
function Panel(_props: IndicatorPanelProps) {
  return (
    <Stack>
      <Select data={["Errand", "Visit"]} label="Category" />
      <ExampleForm onSuccess={() => undefined} />
    </Stack>
  );
}

const load = async () => ({ default: () => null });

const MODULE: ShellContribution = {
  id: "example",
  name: { id: "story-example", message: "Example" },
  icon: () => null,
  color: "blue",
  views: [{ id: "overview", title: { id: "story-overview", message: "Overview" }, load }],
  indicator: {
    load: async () => ({ default: Indicator }),
    panel: async () => ({ default: Panel }),
  },
};

const ROUTING: ShellRouting = {
  useAddress: () => ({
    search: () => ({}),
    subscribe: () => () => undefined,
    writeSearch: () => undefined,
    scopedWriteSearch: () => () => undefined,
  }),
  useGoToView: () => async () => true,
  useLeaveGuard: () => undefined,
  Link: ({ to, search: _search, ...props }) => <a href={to} {...props} />,
};

const meta = {
  title: "Forms/Example form/In an Indicator Panel",
  globals: { viewport: { value: "wide", isRotated: false } },
  parameters: {
    layout: "fullscreen",
    viewport: { options: { wide: { name: "Wide", styles: { width: "1440px", height: "800px" } } } },
  },
  loaders: [loadStoryShell],
  render: () => (
    <DataProvider access={recordingPort().access}>
      <Shell
        activeModule={MODULE}
        activeView={MODULE.views[0]}
        contributions={[MODULE]}
        data={{ access: NO_DATA_PROCESS, notify: () => {}, notifyRefused: () => {} }}
        onModuleSidebarCollapsedCommit={() => {}}
        onModuleSidebarWidthCommit={() => {}}
        onNavbarCommit={() => {}}
        routing={ROUTING}
        settings={MODULE}
      >
        <p>Page content</p>
      </Shell>
    </DataProvider>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const panel = () => screen.findByRole("dialog", { name: "Example" });
const expectPanelOpen = async () => {
  const dialog = await panel();
  // A busy browser may still be fading the popover in.
  await waitFor(() => expect(dialog).toBeVisible());
  await expect(screen.queryByRole("dialog", { name: "Discard changes?" })).toBeNull();
};

export const APickInAFieldsDropdownKeepsThePanelOpen: Story = {
  play: async () => {
    const page = within(document.body);
    await userEvent.click(
      await page.findByRole("button", { name: "Open panel" }, { timeout: 4000 }),
    );
    const form = within(await panel());

    // A day from the calendar.
    await userEvent.click(await form.findByRole("textbox", { name: "Day" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Thursday, February 13, 2031" }),
    );
    await expectPanelOpen();
    await expect(form.getByRole("textbox", { name: "Day" })).toHaveValue("02/13/2031");

    // A time from the lists of the time's dropdown.
    await userEvent.click(form.getByRole("spinbutton", { name: "Start" }));
    await userEvent.click((await screen.findAllByRole("button", { name: "02" }))[0]!);
    await userEvent.click(screen.getByRole("button", { name: "45" }));
    await userEvent.click(screen.getByRole("button", { name: "PM" }));
    await expectPanelOpen();
    await expect(form.getByRole("spinbutton", { name: /^(Minutes|Minuten)$/ })).toHaveValue("45");

    // An option of a Select.
    await userEvent.click(form.getByLabelText("Category"));
    await userEvent.click(await screen.findByRole("option", { name: "Visit" }));
    await expectPanelOpen();
    await expect(form.getByLabelText("Category")).toHaveValue("Visit");

    // A press on the page still leaves.
    await userEvent.click(page.getByText("Page content"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Example" })).toBeNull());
  },
};
