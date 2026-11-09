import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, spyOn, expect, userEvent, waitFor, within } from "storybook/test";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Shell, useViewSearch, useWriteViewSearch } from "@self-engine/shell";
import { memo, useState } from "react";
import { contribution as alpha } from "@self-engine/placeholder-alpha";
import { modules, settings } from "./modules.ts";
import { settingsStore } from "./settings-store.ts";
import { createAppRouter } from "./app-router.ts";
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
    return createAppRouter(
      createMemoryHistory({ initialEntries: ["/placeholder-alpha/overview?client=studio"] }),
    );
  });
  return <RouterProvider router={router} />;
}
export const DrawerIsolation: Story = {
  loaders: [() => settingsStore.load()],
  render: () => <DrawerIsolationStory />,
  beforeEach: () => {
    loadDrawer.mockClear();
    viewRendered.mockClear();
    const view = spyOn(alpha.views[0], "load").mockResolvedValue({ default: ObservedView });
    const drawer = spyOn(
      alpha as { editDrawer: NonNullable<typeof alpha.editDrawer> },
      "editDrawer",
    ).mockImplementation(loadDrawer);
    return () => {
      view.mockRestore();
      drawer.mockRestore();
    };
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
