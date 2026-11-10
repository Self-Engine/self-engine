import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, spyOn, expect, userEvent, waitFor, within } from "storybook/test";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import {
  type EditDrawerProps,
  Shell,
  useEditDrawerTitle,
  useUnsavedChanges,
  useViewSearch,
  useWriteViewSearch,
} from "@self-engine/shell";
import { memo, type ReactNode, useState } from "react";
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
function SearchStory({ children = <SearchControls /> }: { readonly children?: ReactNode }) {
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
          {children}
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

const objectRendered = fn();
function ObjectSelection() {
  const { client } = useViewSearch((search) => ({ client: search.client }));
  objectRendered(client);
  const write = useWriteViewSearch();
  return (
    <>
      <output aria-label="Selected client">{String(client)}</output>
      <button onClick={() => write((search) => ({ ...search, client: "garden" }))}>Change</button>
    </>
  );
}

/** Without a snapshot per search, a fresh object would never settle and React would give up. */
export const SelectorReturningAFreshObject: Story = {
  render: () => (
    <SearchStory>
      <ObjectSelection />
    </SearchStory>
  ),
  beforeEach: () => objectRendered.mockClear(),
  play: async ({ canvas }) => {
    await expect(await canvas.findByLabelText("Selected client")).toHaveTextContent("studio");
    await userEvent.click(canvas.getByRole("button", { name: "Change" }));
    await waitFor(() =>
      expect(canvas.getByLabelText("Selected client")).toHaveTextContent("garden"),
    );
    await expect(objectRendered.mock.calls.length).toBeLessThan(6);
  },
};

const viewRendered = fn();
function TitledDrawer({ id, onCancel, onDone }: EditDrawerProps) {
  const [name, setName] = useState("First name");
  const [changed, setChanged] = useState(false);
  useEditDrawerTitle(name);
  useUnsavedChanges(() => changed);
  return (
    <>
      <button onClick={() => setName("Second name")}>Rename {id}</button>
      <button onClick={() => setChanged(true)}>Change {id}</button>
      <button onClick={onCancel}>Cancel {id}</button>
      <button onClick={onDone}>Finish {id}</button>
    </>
  );
}
const loadDrawer = fn(async () => ({ default: TitledDrawer }));
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
    await page.findByRole("dialog", { name: "First name" });
    await userEvent.click(await page.findByRole("button", { name: "Rename sample" }));
    await page.findByRole("dialog", { name: "Second name" });
    await userEvent.click(page.getByRole("button", { name: "Change sample" }));
    await userEvent.click(page.getByRole("button", { name: "Cancel sample" }));
    const asked = within(await page.findByRole("dialog", { name: "Discard changes?" }));
    await userEvent.click(asked.getByRole("button", { name: "Keep editing" }));
    await waitFor(() =>
      expect(page.queryByRole("dialog", { name: "Discard changes?" })).toBeNull(),
    );
    await userEvent.click(page.getByRole("button", { name: "Cancel sample" }));
    const askedAgain = within(await page.findByRole("dialog", { name: "Discard changes?" }));
    await userEvent.click(askedAgain.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    await expect(loadDrawer).toHaveBeenCalledTimes(1);
    await expect(viewRendered).not.toHaveBeenCalled();
  },
};
