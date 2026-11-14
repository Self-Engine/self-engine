// The View "Archive" of `projects`, over Fixed Answers (D255): filled, empty, and in German. That
// archiving moves a project here is shown by the Edit Drawer's stories and the module's Port test.

import {
  OLD_SHOP,
  type ProjectsAnswers,
  projectsAnswers,
  projectsStoryPort,
} from "@self-engine/projects/testing";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, within } from "storybook/test";
import { AppAt, editInAddress, loadStoryApp, storyRouter } from "./story-app.tsx";

type Canvas = ReturnType<typeof within>;

const ARCHIVE = "/projects/archive";

const meta = {
  title: "App/Projects/Archive",
  component: AppAt,
  parameters: { layout: "fullscreen" },
  loaders: [loadStoryApp],
  args: { address: ARCHIVE, access: projectsAnswers() },
  render: (args) => <AppAt address={args.address} access={projectsStoryPort().access} />,
} satisfies Meta<typeof AppAt>;
export default meta;
type Story = StoryObj<typeof meta>;

const withAnswers = (answers: ProjectsAnswers) => (args: { readonly address: string }) => (
  <AppAt address={args.address} access={projectsStoryPort(answers).access} />
);

/** The titles in the order the list named `name` shows them, without an emoji of a mark. */
async function titlesShown(canvas: Canvas, name = "Archived projects") {
  return within(await canvas.findByRole("list", { name }))
    .getAllByRole("button")
    .map((row) => row.lastElementChild?.textContent);
}

export const TheArchiveShowsTheArchivedProjectsSortedByTitle: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("heading", { name: "Archive", level: 1 })).toBeVisible();
    await expect(await titlesShown(canvas)).toEqual(["Old shop", "Tax 2025"]);
    await expect(canvas.queryByRole("list", { name: "Active projects" })).toBeNull();
  },
};

export const AnArchivedProjectOpensInTheEditDrawer: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "Old shop" }));
    const drawer = within(await screen.findByRole("dialog", { name: "Old shop" }));
    await expect(await drawer.findByRole("textbox", { name: "Title" })).toHaveValue("Old shop");
    await expect(editInAddress(storyRouter())).toBe(OLD_SHOP.id);
  },
};

export const AnEmptyArchiveSaysWhatAppearsThere: Story = {
  render: withAnswers({ archived: { data: [] } }),
  play: async ({ canvas }) => {
    const empty = within((await canvas.findByText("No archived projects")).parentElement!);
    await expect(empty.getByText(/A project you archive leaves "Active"/)).toBeVisible();
    await expect(empty.queryByRole("button")).toBeNull();
  },
};

export const TheArchiveInGerman: Story = {
  globals: { language: "de" },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("heading", { name: "Archiv", level: 1 })).toBeVisible();
    await expect(await titlesShown(canvas, "Archivierte Projekte")).toEqual([
      "Old shop",
      "Tax 2025",
    ]);
  },
};

export const AnEmptyArchiveInGerman: Story = {
  globals: { language: "de" },
  render: withAnswers({ archived: { data: [] } }),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Keine archivierten Projekte")).toBeVisible();
  },
};
