import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, expect, userEvent, waitFor, within } from "storybook/test";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Shell, useViewSearch, useWriteViewSearch } from "@self-engine/shell";
import { memo, useState } from "react";
import { modules, settings } from "./modules.ts";
import { ROUTING } from "./shell-routing.tsx";

const rendered = fn();
const SelectedClient = memo(function SelectedClient() {
  const client = useViewSearch((search) => search.client);
  rendered(client);
  return <output aria-label="Selected client">{String(client)}</output>;
});
function SearchControls() {
  const write = useWriteViewSearch();
  const edit = useViewSearch((search) => search.edit);
  return (
    <>
      <SelectedClient />
      <output aria-label="Other parameter">{String(edit)}</output>
      <button onClick={() => write((search) => ({ ...search, edit: "unrelated" }))}>
        Change other parameter
      </button>
      <button onClick={() => write((search) => ({ ...search, client: "garden" }))}>
        Change selected parameter
      </button>
    </>
  );
}
function SearchStory() {
  const [router] = useState(() => {
    const root = createRootRoute({
      component: () => (
        <Shell
          contributions={modules}
          settings={settings}
          activeModule={undefined}
          activeView={undefined}
          routing={ROUTING}
        >
          <SearchControls />
        </Shell>
      ),
    });
    return createRouter({
      routeTree: root,
      history: createMemoryHistory({ initialEntries: ["/?client=studio"] }),
    });
  });
  return <RouterProvider router={router} />;
}
const meta = {
  title: "App/View search",
  component: SearchStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SearchStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SelectiveUpdates: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByLabelText("Selected client")).toHaveTextContent("studio");
    rendered.mockClear();
    await userEvent.click(canvas.getByRole("button", { name: "Change other parameter" }));
    await waitFor(() =>
      expect(canvas.getByLabelText("Other parameter")).toHaveTextContent("unrelated"),
    );
    await expect(rendered).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Change selected parameter" }));
    await waitFor(() =>
      expect(canvas.getByLabelText("Selected client")).toHaveTextContent("garden"),
    );
    await expect(rendered).toHaveBeenCalledWith("garden");
  },
};

const viewRendered = fn();
const loadDrawer = fn(async () => ({
  default: ({ id, onClose }: { id: string; onClose: () => void }) => (
    <button onClick={onClose}>Close {id}</button>
  ),
}));
const drawerModule = {
  ...modules[1]!,
  editDrawer: loadDrawer,
};
function ObservedView() {
  const client = useViewSearch((search) => search.client);
  viewRendered(client);
  const write = useWriteViewSearch();
  return (
    <button onClick={() => write((search) => ({ ...search, edit: "sample" }))}>Edit sample</button>
  );
}
function DrawerIsolationStory() {
  const [router] = useState(() => {
    const root = createRootRoute({
      component: () => (
        <Shell
          contributions={[drawerModule]}
          settings={settings}
          activeModule={drawerModule}
          activeView={drawerModule.views[0]}
          routing={ROUTING}
        >
          <ObservedView />
        </Shell>
      ),
    });
    return createRouter({
      routeTree: root,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
  });
  return <RouterProvider router={router} />;
}
export const DrawerIsolation: Story = {
  render: () => <DrawerIsolationStory />,
  beforeEach: () => {
    loadDrawer.mockClear();
    viewRendered.mockClear();
  },
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(await canvas.findByRole("button", { name: "Edit sample" })).toBeVisible();
    await expect(loadDrawer).not.toHaveBeenCalled();
    viewRendered.mockClear();
    await userEvent.click(canvas.getByRole("button", { name: "Edit sample" }));
    await userEvent.click(await page.findByRole("button", { name: "Close sample" }));
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    await expect(loadDrawer).toHaveBeenCalledTimes(1);
    await expect(viewRendered).not.toHaveBeenCalled();
  },
};
