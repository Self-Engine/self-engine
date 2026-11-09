import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, expect, userEvent, waitFor } from "storybook/test";
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
